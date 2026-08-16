import type { ModelCaller, ModelCallerMessage } from '../adapters/modelCaller.js'
import type { ClosedLabelStrategySpec, SchemaExtractionStrategySpec } from './types.js'

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
//
// `input` resolves a function-valued `labels`/`system` (a strategy whose
// candidate set/prompt is built live per call, e.g. selectTable's
// keyword-shortlisted table candidates) -- it defaults to `messages` itself
// so a fixed-prompt strategy (classifyRoute) needs no caller-side change:
// `Input` defaults to `ModelCallerMessage[]` in ClosedLabelStrategySpec, so
// `messages` already IS a valid `Input` for that common case.
export async function runClosedLabelStrategy<Label extends string, Input = ModelCallerMessage[]>(
  spec: ClosedLabelStrategySpec<Label, Input>,
  caller: ModelCaller,
  messages: ModelCallerMessage[],
  signal?: AbortSignal,
  input: Input = messages as unknown as Input
): Promise<Label | 'unparseable'> {
  const system = typeof spec.system === 'function' ? spec.system(input) : spec.system
  const labels = typeof spec.labels === 'function' ? spec.labels(input) : spec.labels
  let raw = ''
  for await (const event of caller.streamTurn({ model: spec.model, system, messages, signal })) {
    if (event.type === 'text') raw += event.text
  }
  const parsed = parseLabel(raw, labels)
  return spec.groundingCheck(raw, parsed) ? parsed : 'unparseable'
}

// Schema-extraction analog of runClosedLabelStrategy: streams raw text,
// parses it into a structured Output, then requires the strategy's own
// groundingCheck to accept the (Input, Output) pair before it's trusted.
// `null` is the schema-extraction equivalent of closed-label's
// 'unparseable' sentinel -- there's no string sentinel that fits an
// arbitrary Output type, so both an unparseable reply and an ungrounded
// parse collapse to the same "nothing trustworthy came back" signal.
export async function runSchemaExtractionStrategy<Input, Output>(
  spec: SchemaExtractionStrategySpec<Input, Output>,
  caller: ModelCaller,
  input: Input,
  messages: ModelCallerMessage[],
  signal?: AbortSignal
): Promise<Output | null> {
  const system = typeof spec.system === 'function' ? spec.system(input) : spec.system
  let raw = ''
  for await (const event of caller.streamTurn({ model: spec.model, system, messages, signal })) {
    if (event.type === 'text') raw += event.text
  }
  const parsed = spec.parse(raw, input)
  if (parsed === null) return null
  return spec.groundingCheck(input, parsed) ? parsed : null
}
