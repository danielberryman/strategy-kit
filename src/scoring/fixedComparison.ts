import { hashDeclaredShape } from '../strategy/hash.js'
import type { ApprovalRecord } from '../strategy/hash.js'
import { runClosedLabelStrategy } from '../strategy/classifyOnce.js'
import type { ClosedLabelStrategySpec } from '../strategy/types.js'
import type { ModelCaller, ModelCallerMessage } from '../adapters/modelCaller.js'
import { fixtureSuiteHash } from './fixtureSuite.js'
import type {
  ClosedLabelFixtureSuite,
  ConfusionMatrix,
  FixedComparisonCaseResult,
  FixedComparisonResult,
  FixedComparisonRun,
  MajorityWrongCase,
} from './types.js'

export interface FixedComparisonOptions<Input = ModelCallerMessage[]> {
  /** How many times to run each case, for sampling variance -- default 3,
   * mirrors capability-router-test.mjs's own default. */
  repeats?: number
  signal?: AbortSignal
  /** Builds the actual model messages for a case's `input` -- same role as
   * SchemaExtractionComparisonBackend's own toMessages, and for the same
   * reason: runClosedLabelStrategy takes `input` (for resolving
   * system/labels) and `messages` (the model turn) as separate arguments,
   * since an arbitrary Input has no generic way to become
   * ModelCallerMessage[] on its own. Defaults to treating `input` as the
   * messages directly -- exact, unchanged behavior for every strategy
   * whose Input stays the default. */
  toMessages?: (input: Input) => ModelCallerMessage[]
}

async function run<Label extends string, Input = ModelCallerMessage[]>(
  suite: ClosedLabelFixtureSuite<Label, Input>,
  spec: ClosedLabelStrategySpec<Label, Input>,
  caller: ModelCaller,
  options: FixedComparisonOptions<Input> = {}
): Promise<FixedComparisonResult<Input, Label>> {
  // A confusion matrix needs one fixed label universe shared across every
  // case -- a spec whose `labels` is a function (a dynamic, per-call
  // candidate set, e.g. selectTable's keyword-shortlisted tables) has no
  // single axis a matrix could use, since two cases could see different
  // candidate sets entirely. Fail loudly rather than silently scoring
  // against a wrong/empty axis -- same hard-error posture as the approval
  // gate itself (registry.ts).
  if (typeof spec.labels === 'function') {
    throw new Error(
      `strategy-kit: FixedComparisonBackend.run() requires a static labels array -- ` +
        `"${spec.strategyId}" declares labels as a function. A dynamic candidate set has no single ` +
        `confusion-matrix axis across cases; that strategy needs its own scoring approach.`
    )
  }
  const labels = spec.labels
  const repeats = options.repeats ?? 3
  const toMessages = options.toMessages ?? ((input: Input) => input as unknown as ModelCallerMessage[])
  const perCase: FixedComparisonCaseResult<Input, Label>[] = suite.cases.map((c) => ({
    caseId: c.id,
    input: c.input,
    expected: c.expected,
    runs: [],
  }))

  // Sequential, not parallel -- mirrors the ported script's shape and
  // avoids hammering a local Ollama instance with concurrent requests.
  for (let r = 0; r < repeats; r++) {
    for (let i = 0; i < suite.cases.length; i++) {
      const c = suite.cases[i]
      const label = await runClosedLabelStrategy(spec, caller, toMessages(c.input), options.signal, c.input)
      ;(perCase[i].runs as FixedComparisonRun<Label>[]).push({ runIndex: r, label })
    }
  }

  const perRunAccuracy = Array.from(
    { length: repeats },
    (_, r) => perCase.filter((c) => c.runs[r].label === c.expected).length / perCase.length
  )

  const confusionMatrix = {} as ConfusionMatrix<Label>
  for (const a of labels) {
    confusionMatrix[a] = {} as Record<Label | 'UNPARSEABLE', number>
    for (const b of [...labels, 'UNPARSEABLE' as const]) confusionMatrix[a][b] = 0
  }
  let totalCorrect = 0
  let totalCalls = 0
  for (const c of perCase) {
    for (const caseRun of c.runs) {
      totalCalls++
      const predicted = labels.includes(caseRun.label as Label) ? (caseRun.label as Label) : 'UNPARSEABLE'
      confusionMatrix[c.expected][predicted]++
      if (predicted === c.expected) totalCorrect++
    }
  }

  const inconsistentCases = perCase.filter((c) => {
    const first = c.runs[0].label
    return !c.runs.every((r) => r.label === first)
  })

  // Majority-vote tie-break: ported to match capability-router-test.mjs's
  // exact behavior -- ties resolve to whichever label was first seen
  // across a case's repeats. A Map built in run order gives that
  // insertion-order guarantee explicitly rather than leaning on an
  // implicit object-key-order convention.
  const majorityWrongCases: MajorityWrongCase<Input, Label>[] = []
  for (const c of perCase) {
    const counts = new Map<Label | 'UNPARSEABLE', number>()
    for (const caseRun of c.runs) {
      const l = labels.includes(caseRun.label as Label) ? (caseRun.label as Label) : ('UNPARSEABLE' as const)
      counts.set(l, (counts.get(l) ?? 0) + 1)
    }
    const [majorityLabel] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    if (majorityLabel !== c.expected) majorityWrongCases.push({ ...c, majorityLabel })
  }

  return {
    suiteId: suite.suiteId,
    strategyId: spec.strategyId,
    model: spec.model,
    repeats,
    totalCalls,
    totalCorrect,
    aggregateAccuracy: totalCorrect / totalCalls,
    perRunAccuracy,
    confusionMatrix,
    inconsistentCases,
    majorityWrongCases,
    declaredShapeHash: hashDeclaredShape(spec),
    fixtureSuiteHash: fixtureSuiteHash(suite),
    perCase,
  }
}

export const FixedComparisonBackend = { run }

export function toApprovalRecord<Label extends string>(
  result: FixedComparisonResult<unknown, Label>
): ApprovalRecord {
  return {
    strategyId: result.strategyId,
    model: result.model,
    declaredShapeHash: result.declaredShapeHash,
    fixtureSuiteHash: result.fixtureSuiteHash,
    aggregateAccuracy: result.aggregateAccuracy,
  }
}
