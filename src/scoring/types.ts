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

// Phase 3 only scored closed-label strategies -- there was no
// runSchemaExtractionStrategy yet, and confusion-matrix/majority-vote are
// inherently label-shaped. FixtureSuite itself stayed generic so
// schema-extraction scoring could reuse it later without a breaking
// change; this alias and FixedComparisonBackend.run() stay narrowed to
// closed-label. SchemaExtractionFixtureSuite (below) is that later reuse.
//
// Input defaults to ModelCallerMessage[] -- every fixed-prompt strategy
// (classifyRoute) needs nothing else, so existing call sites are
// unaffected. A strategy whose system prompt (not just its labels) is
// built from something else per call -- query-shape's gate/shape1/shape2,
// whose prompts embed live table/column data -- supplies its own Input
// here too, the same widening ClosedLabelStrategySpec itself already got.
export type ClosedLabelFixtureSuite<Label extends string, Input = ModelCallerMessage[]> = FixtureSuite<Input, Label>

/** Schema-extraction's analog of ClosedLabelFixtureSuite -- unlike that
 * alias, Input/Output aren't pinned to a fixed pair, since every
 * schema-extraction strategy has its own bespoke Input/Output shape (no
 * shared "the input is always messages" assumption applies here). A pure
 * alias, same posture as ClosedLabelFixtureSuite -- carries no fields of
 * its own beyond FixtureSuite's. */
export type SchemaExtractionFixtureSuite<Input, Output> = FixtureSuite<Input, Output>

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

// Schema-extraction's analog of FixedComparisonRun/CaseResult/Result. No
// ConfusionMatrix/MajorityWrongCase equivalent -- those are inherently
// label-shaped (a fixed, enumerable set of possible answers); an arbitrary
// Output has neither a fixed value set nor a meaningful "columns" axis.
// `output: Output | null` -- `null` is runSchemaExtractionStrategy's
// unparseable/ungrounded sentinel, same role 'unparseable' plays for
// closed-label.
export interface SchemaExtractionRun<Output> {
  runIndex: number
  output: Output | null
}

export interface SchemaExtractionCaseResult<Input, Output> {
  caseId: string
  input: Input
  expected: Output
  runs: readonly SchemaExtractionRun<Output>[]
}

export interface SchemaExtractionComparisonResult<Input, Output> {
  suiteId: string
  strategyId: string
  model: string
  repeats: number
  totalCalls: number
  totalCorrect: number
  aggregateAccuracy: number
  perRunAccuracy: readonly number[]
  /** A case whose runs didn't all produce the same output (by `keyOf`),
   * regardless of correctness. */
  inconsistentCases: readonly SchemaExtractionCaseResult<Input, Output>[]
  /** A case where the most-common output across repeats (by `keyOf`)
   * still doesn't match `expected` (by `isEqual`) -- the schema-extraction
   * analog of majorityWrongCases. */
  majorityWrongCases: readonly SchemaExtractionCaseResult<Input, Output>[]
  declaredShapeHash: string
  fixtureSuiteHash: string
  perCase: readonly SchemaExtractionCaseResult<Input, Output>[]
}
