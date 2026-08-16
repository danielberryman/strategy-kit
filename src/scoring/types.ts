import type { ModelCallerMessage } from '../adapters/modelCaller.js'

export interface FixtureCase<Input, Expected> {
  /** Stable identity across suite edits -- reporting (inconsistent/
   * majority-wrong cases) refers back to a case by id, not array index. */
  id: string
  input: Input
  expected: Expected
}

/** A versioned, named collection of fixture cases -- the thing
 * fixtureSuiteHash() (fixtureSuite.ts) canonicalizes and hashes into
 * ApprovalRecord.fixtureSuiteHash via strategy/hash.ts's hashFixtureSuite().
 * `version` is a human-authored marker, not itself part of the hashed
 * content -- the gate reacts to actual case-content changes regardless of
 * whether version was bumped. */
export interface FixtureSuite<Input, Expected> {
  suiteId: string
  version: string
  cases: readonly FixtureCase<Input, Expected>[]
}

// Phase 3 only scores closed-label strategies -- there is no
// runSchemaExtractionStrategy yet, and these 4 metrics (accuracy,
// confusion matrix, majority vote, consistency) are inherently
// label-shaped. FixtureSuite itself stays generic so schema-extraction
// scoring can reuse it later without a breaking change; only this alias
// and FixedComparisonBackend.run() are narrowed to closed-label.
export type ClosedLabelFixtureSuite<Label extends string> = FixtureSuite<ModelCallerMessage[], Label>

export interface FixedComparisonRun<Label extends string> {
  runIndex: number
  label: Label | 'unparseable'
}

export interface FixedComparisonCaseResult<Input, Label extends string> {
  caseId: string
  input: Input
  expected: Label
  runs: readonly FixedComparisonRun<Label>[]
}

/** Rows = expected label, columns = predicted label, 'UNPARSEABLE' always a
 * column. Rows are spec.labels (the closed set), not just labels that
 * happen to appear as `expected` in the suite, so a suite missing coverage
 * for a label still gets a (zero-filled) row instead of silently omitting
 * it. */
export type ConfusionMatrix<Label extends string> = Record<Label, Record<Label | 'UNPARSEABLE', number>>

export interface MajorityWrongCase<Input, Label extends string> extends FixedComparisonCaseResult<Input, Label> {
  majorityLabel: Label | 'UNPARSEABLE'
}

export interface FixedComparisonResult<Input, Label extends string> {
  suiteId: string
  strategyId: string
  model: string
  repeats: number
  totalCalls: number
  totalCorrect: number
  aggregateAccuracy: number
  perRunAccuracy: readonly number[]
  confusionMatrix: ConfusionMatrix<Label>
  inconsistentCases: readonly FixedComparisonCaseResult<Input, Label>[]
  majorityWrongCases: readonly MajorityWrongCase<Input, Label>[]
  declaredShapeHash: string
  fixtureSuiteHash: string
  perCase: readonly FixedComparisonCaseResult<Input, Label>[]
}
