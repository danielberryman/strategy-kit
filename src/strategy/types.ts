// Strategy specs: the closed, declared shape of a narrow, bounded model
// call. Generalizes hub's ClassifierDef<Label> (classifyWithEscalation.ts)
// and the schema/enum-grounded extraction shape generateFindParams.ts
// hand-rolls per stage. A strategy declares everything needed to (a) run
// the call, (b) mechanically re-verify its output (groundingCheck, part of
// the strategy's own contract -- never injected by a caller, ADR-0155's
// refinement), and (c) be hashed deterministically for the approval gate
// (hash.ts) via its own declared shape.

/** A closed-label classification strategy: pick exactly one label from a
 * fixed, closed set, given a system prompt and message history. */
export interface ClosedLabelStrategySpec<Label extends string> {
  /** Unique, stable id -- the key ApprovalRecord and StrategyRegistry.use()
   * key off. A new label set or a model swap under an "identical" strategy
   * is a DIFFERENT strategyId (ADR-0155: approval doesn't transfer across
   * label vocabularies or model swaps). */
  strategyId: string
  kind: 'closed-label'
  /** The literal model string this strategy is approved against. Pinned
   * to this exact string, never a category/tier. */
  model: string
  /** The closed label set. Order matters (classifyOnce's first-match-wins
   * substring scan), so `readonly Label[]`, not a Set -- mirrors
   * ClassifierDef.labels. */
  labels: readonly Label[]
  /** Mechanical re-verification the raw reply/parsed label must pass
   * before the label is trusted. Lives inside the strategy's own
   * contract, not injected by the calling site. */
  groundingCheck: (raw: string, parsed: Label | 'unparseable') => boolean
  /** Fixed system-prompt content -- not a per-call template. A strategy
   * that needs per-call system-prompt interpolation isn't closed-label
   * shaped. */
  system: string
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
  system: string
  /** Parses the model's raw text reply into a structured Output, or null
   * if unparseable. A plain function, not a schema-description object --
   * keeps this library free of any JSON-schema/validation runtime
   * dependency. */
  parse: (raw: string) => Output | null
  /** Given the original Input and the parsed Output, decides whether every
   * extracted value is actually grounded (a literal substring of Input,
   * present in a live enum, etc.) -- generateFindParams.ts's isGrounded()/
   * live-registry-enum check, generalized. */
  groundingCheck: (input: Input, output: Output) => boolean
}

export type StrategySpec<Label extends string = string, Input = unknown, Output = unknown> =
  | ClosedLabelStrategySpec<Label>
  | SchemaExtractionStrategySpec<Input, Output>
