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

export interface FixedComparisonOptions {
  /** How many times to run each case, for sampling variance -- default 3,
   * mirrors capability-router-test.mjs's own default. */
  repeats?: number
  signal?: AbortSignal
}

async function run<Label extends string>(
  suite: ClosedLabelFixtureSuite<Label>,
  spec: ClosedLabelStrategySpec<Label>,
  caller: ModelCaller,
  options: FixedComparisonOptions = {}
): Promise<FixedComparisonResult<ModelCallerMessage[], Label>> {
  const repeats = options.repeats ?? 3
  const perCase: FixedComparisonCaseResult<ModelCallerMessage[], Label>[] = suite.cases.map((c) => ({
    caseId: c.id,
    input: c.input,
    expected: c.expected,
    runs: [],
  }))

  // Sequential, not parallel -- mirrors the ported script's shape and
  // avoids hammering a local Ollama instance with concurrent requests.
  for (let r = 0; r < repeats; r++) {
    for (let i = 0; i < suite.cases.length; i++) {
      const label = await runClosedLabelStrategy(spec, caller, suite.cases[i].input, options.signal)
      ;(perCase[i].runs as FixedComparisonRun<Label>[]).push({ runIndex: r, label })
    }
  }

  const perRunAccuracy = Array.from(
    { length: repeats },
    (_, r) => perCase.filter((c) => c.runs[r].label === c.expected).length / perCase.length
  )

  const confusionMatrix = {} as ConfusionMatrix<Label>
  for (const a of spec.labels) {
    confusionMatrix[a] = {} as Record<Label | 'UNPARSEABLE', number>
    for (const b of [...spec.labels, 'UNPARSEABLE' as const]) confusionMatrix[a][b] = 0
  }
  let totalCorrect = 0
  let totalCalls = 0
  for (const c of perCase) {
    for (const caseRun of c.runs) {
      totalCalls++
      const predicted = spec.labels.includes(caseRun.label as Label) ? (caseRun.label as Label) : 'UNPARSEABLE'
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
  const majorityWrongCases: MajorityWrongCase<ModelCallerMessage[], Label>[] = []
  for (const c of perCase) {
    const counts = new Map<Label | 'UNPARSEABLE', number>()
    for (const caseRun of c.runs) {
      const l = spec.labels.includes(caseRun.label as Label) ? (caseRun.label as Label) : ('UNPARSEABLE' as const)
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
