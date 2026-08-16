import type { ModelCaller, ModelCallerMessage } from '../adapters/modelCaller.js'
import type { ClosedLabelStrategySpec } from './types.js'

// Ported from hub's classifyWithEscalation.ts (classifyOnce/parseLabel/
// normalizeLabel) -- strategy-kit's own copy, not a re-export. hub's
// classifyWithEscalation.ts is untouched by this phase (Phase 5 migrates
// classifyRoute.ts later). Adapted to call through ModelCaller instead of
// hub's ModelClient: no `tools: []` to pass at the call site at all, since
// ModelCaller's type has no tools field to begin with.

// Mirrors capability-router-test.mjs's own parseLabel(): first-match-wins
// uppercase substring match, no numeric confidence exists anywhere in this
// pipeline. Backslashes and punctuation (._- and spaces) are stripped
// before matching -- ported verbatim from hub, including the exact bugs
// it fixes (mistral's escaped "JOB\_SEARCH", llama3.2's punctuation-
// dropped "CANNOTEXPRESS").
function normalizeLabel(s: string): string {
  return s.toUpperCase().replace(/\\/g, '').replace(/[._\- ]/g, '')
}

export function parseLabel<Label extends string>(raw: string, labels: readonly Label[]): Label | 'unparseable' {
  const normalized = normalizeLabel(raw)
  for (const label of labels) {
    if (normalized.includes(normalizeLabel(label))) return label
  }
  return 'unparseable'
}

export async function classifyOnce<Label extends string>(
  labels: readonly Label[],
  caller: ModelCaller,
  model: string,
  system: string,
  messages: ModelCallerMessage[],
  signal?: AbortSignal
): Promise<Label | 'unparseable'> {
  let raw = ''
  for await (const event of caller.streamTurn({ model, system, messages, signal })) {
    if (event.type === 'text') raw += event.text
  }
  return parseLabel(raw, labels)
}

// The execution wrapper a ClosedLabelStrategySpec's groundingCheck runs
// inside: calls classifyOnce() for the raw call, then requires the
// strategy's own groundingCheck to accept the raw/parsed pair before the
// label is trusted -- an ungrounded result normalizes to 'unparseable'
// rather than being surfaced as a false positive.
export async function runClosedLabelStrategy<Label extends string>(
  spec: ClosedLabelStrategySpec<Label>,
  caller: ModelCaller,
  messages: ModelCallerMessage[],
  signal?: AbortSignal
): Promise<Label | 'unparseable'> {
  let raw = ''
  for await (const event of caller.streamTurn({ model: spec.model, system: spec.system, messages, signal })) {
    if (event.type === 'text') raw += event.text
  }
  const parsed = parseLabel(raw, spec.labels)
  return spec.groundingCheck(raw, parsed) ? parsed : 'unparseable'
}
