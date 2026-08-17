import type { ModelCallerMessage } from '../adapters/modelCaller.js'

// Strategy specs: the closed, declared shape of a narrow, bounded model
// call -- generalizing a pattern that otherwise gets hand-rolled per call
// site: closed-label classification, and schema/enum-grounded extraction.
// A strategy declares everything needed to (a) run the call, (b)
// mechanically re-verify its output (groundingCheck, part of the
// strategy's own contract -- never injected by a caller, so a caller can't
// silently weaken the check a strategy was approved under), and (c) be
// hashed deterministically for the approval gate (hash.ts) via its own
// declared shape.

/** A closed-label classification strategy: pick exactly one label from a
 * fixed, closed set, given a system prompt and message history.
 *
 * `Input` defaults to `ModelCallerMessage[]` (the messages themselves),
 * which is what every fixed-prompt strategy (e.g. classifyRoute) needs --
 * `labels`/`system` stay plain values and `runClosedLabelStrategy` never
 * needs a caller to pass anything beyond `messages`. A strategy whose
 * candidate set or prompt is built from something else per call (e.g.
 * selectTable's live, keyword-shortlisted table candidates) supplies its
 * own `Input` and a resolver function for `labels`/`system` instead. */
export interface ClosedLabelStrategySpec<Label extends string, Input = ModelCallerMessage[]> {
  /** Unique, stable id -- the key ApprovalRecord and StrategyRegistry.use()
   * key off. A new label set or a model swap under an "identical" strategy
   * is a DIFFERENT strategyId: approval doesn't transfer across label
   * vocabularies or model swaps. */
  strategyId: string
  kind: 'closed-label'
  /** The literal model string this strategy is approved against. Pinned
   * to this exact string, never a category/tier. */
  model: string
  /** The closed label set. Order matters (classifyOnce's first-match-wins
   * substring scan), so `readonly Label[]`, not a Set -- mirrors
   * ClassifierDef.labels. A function of `Input` when the candidate set is
   * built live per call rather than fixed. */
  labels: readonly Label[] | ((input: Input) => readonly Label[])
  /** Mechanical re-verification the raw reply/parsed label must pass
   * before the label is trusted. Lives inside the strategy's own
   * contract, not injected by the calling site. */
  groundingCheck: (raw: string, parsed: Label | 'unparseable') => boolean
  /** System-prompt content. A function of `Input` when the prompt is built
   * live per call (e.g. listing that call's candidate labels) rather than
   * fixed. */
  system: string | ((input: Input) => string)
}

/** A schema/enum-grounded extraction strategy: the model produces a
 * structured Output from a natural-language Input, mechanically verified
 * against a runtime grounding source (literal substring match against the
 * input, or a live enum from a registry) rather than trusted outright.
 * Generalizes generateFindParams.ts's stage-2 shape (parse a raw reply
 * into typed fields, then isGrounded() each extracted value against the
 * user's own text). */
export interface SchemaExtractionStrategySpec<Input, Output> {
  strategyId: string
  kind: 'schema-extraction'
  model: string
  /** System-prompt content. A function of `Input` when the prompt is built
   * live per call (e.g. listing that call's candidate columns) rather than
   * fixed. */
  system: string | ((input: Input) => string)
  /** Parses the model's raw text reply into a structured Output, or null
   * if unparseable. A plain function, not a schema-description object --
   * keeps this library free of any JSON-schema/validation runtime
   * dependency. Takes `input` because real parsing is often only possible
   * with per-call context (e.g. extractGroundedValues needs that call's own
   * live column list to tell a real column name from a hallucinated one) --
   * a parser that needs none of it can just ignore the second argument. */
  parse: (raw: string, input: Input) => Output | null
  /** Given the original Input and the parsed Output, decides whether every
   * extracted value is actually grounded (a literal substring of Input,
   * present in a live enum, etc.) -- generateFindParams.ts's isGrounded()/
   * live-registry-enum check, generalized. */
  groundingCheck: (input: Input, output: Output) => boolean
}

export type StrategySpec<Label extends string = string, Input = unknown, Output = unknown> =
  | ClosedLabelStrategySpec<Label, Input>
  | SchemaExtractionStrategySpec<Input, Output>
