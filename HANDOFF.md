# HANDOFF

## Done

- Phase 1 (scaffolding): repo layout, `package.json` (publish-shaped,
  private), `tsconfig.json`/`tsconfig.build.json`, `vitest.config.ts`,
  `LICENSE` (MIT), `README.md`, `CLAUDE.md`. Stub files (`export {}`) in
  place for every module the plan names, so the directory layout matches
  the design before any real interface is written.
- Phase 2 (core interfaces): `ClosedLabelStrategySpec`/
  `SchemaExtractionStrategySpec` (`src/strategy/types.ts`), `ModelCaller`
  adapter with no `tools`/`toolChoice` field anywhere in the type
  (`src/adapters/modelCaller.ts`), the hash-pinned approval gate --
  `canonicalize`/`sha256`/`hashDeclaredShape`/`hashFixtureSuite`/
  `ApprovalRecord` (`src/strategy/hash.ts`), `assertApproved`/
  `StrategyRegistry.use()` (`src/strategy/registry.ts`, 4 specific
  failure reasons: never-benchmarked / model-swap / shape-drift /
  fixture-suite-changed, each proven by its own test plus a negative
  check that the other three reasons don't also match), `Pseudonymizer`
  and `StrategyStorage` adapters, and strategy-kit's own port of hub's
  `classifyOnce`/`parseLabel` (`src/strategy/classifyOnce.ts`, plus
  `runClosedLabelStrategy` which gates a parsed label on the strategy's
  own `groundingCheck`). All 8 stub files filled in; none moved or
  renamed. 31 tests across 7 suites, `npm run typecheck`/`test`/`build`
  all clean.
- Phase 3 (Scoring): `FixtureCase`/`FixtureSuite`/`ClosedLabelFixtureSuite`
  and the result types (`src/scoring/types.ts`); `defineFixtureSuite()`
  (validates non-empty, unique case ids) and `fixtureSuiteHash()` (canonical
  content -- `suiteId` + `cases`, `version` deliberately excluded so an
  unbumped/bumped version label never affects the gate) in
  `src/scoring/fixtureSuite.ts`; `FixedComparisonBackend.run()` +
  `toApprovalRecord()` in `src/scoring/fixedComparison.ts` -- runs a
  `ClosedLabelStrategySpec` against every fixture case, repeated N times
  (default 3) via Phase 2's `runClosedLabelStrategy`, and reports aggregate
  accuracy, a confusion matrix (labels x labels+UNPARSEABLE), inconsistent
  cases (verdict flips across repeats), and majority-vote-wrong cases --
  ported directly from `hub/scripts/capability-router-test.mjs`'s own
  algorithm, including its exact first-seen tie-break behavior. Scoped to
  `ClosedLabelStrategySpec` only (no `runSchemaExtractionStrategy` exists
  yet to score against); `FixtureSuite<Input, Expected>` itself stays
  generic so schema-extraction scoring can reuse it later. `run()` returns
  raw metrics, not an `ApprovalRecord` -- `toApprovalRecord()` is a pure
  1:1 field-picker a caller uses to persist one. `judge.ts` stays an
  interface-only `JudgeBackend<Call, Output, Verdict>` stub (Track 2
  deferred), with the routing constraint documented in comments: a judge's
  own model calls must go through `StrategyRegistry.use()`, never a second
  ungoverned path. 11 new tests across 3 new suites (`fixtureSuite.test.ts`,
  `fixedComparison.test.ts` -- hand-computed synthetic 3-case/3-repeat
  suite, every metric asserted, not just aggregate accuracy --
  `judge.test.ts`), plus 2 new assertions in `index.test.ts`. 42 tests
  total across 10 suites, `npm run typecheck`/`test`/`build` all clean.
- Phase 4 (Capture mechanism): `CaptureRecord`/`CaptureStorage`
  (`src/capture/types.ts`), `pseudonymizeCapture()`
  (`src/capture/pseudonymize.ts` -- two-pass: collect every output string
  leaf that's a substring of the *original* input text and get each a
  stable fake via `Pseudonymizer.swap()`, then apply all swaps to a copy
  of the input text and to the output, so a value repeated more than once
  in `output` still swaps to the same fake and a captured pair stays
  substring-grounded after pseudonymization), and `captureIfGrounded()`
  (`src/capture/capture.ts` -- the hook: no-ops if
  `SchemaExtractionStrategySpec.groundingCheck` rejects the pair,
  otherwise pseudonymizes and calls `CaptureStorage.put()`, returning the
  stored `CaptureRecord`). `CaptureStorage` is interface-only, same
  posture as `StrategyStorage` -- no filesystem/stateRoot code in this
  library; a hub adapter (Phase 5) backs it against
  `<stateRoot>/strategy-captures/<strategyId>/`, one JSON file per record,
  the same atomic temp-file + rename convention as hub's
  `write/push/queue.ts`. All 3 stub files filled in. 7 new tests across 2
  new suites (`pseudonymize.test.ts`, `capture.test.ts`). 49 tests total
  across 12 suites, `npm run typecheck`/`test`/`build` all clean.

- Phase 5 (hub-side, no commits in this repo): hub adapters
  (`hub/lib/strategyKitAdapters/`) and the first migrated call site,
  `classifyRoute.ts`, live entirely in the `hub` repo -- see ledger subject
  `ollama-call-strategy-deep-module` and hub's own commit history
  (`ADR-0155 Phase 5: hub strategy-kit adapters, migrate classifyRoute to
  the strategy registry`). Nothing to show for it in *this* repo's log.
- Phase 6 (this repo): `runSchemaExtractionStrategy` (`src/strategy/
  classifyOnce.ts`, next to `runClosedLabelStrategy`) -- the schema-
  extraction analog Phase 5's own note above flagged as missing, needed
  before any schema-extraction call site (e.g. `generateFindParams.ts`'s
  `extractGroundedValues` family) can migrate. Plus its scoring backend,
  `SchemaExtractionComparisonBackend` (`src/scoring/
  schemaExtractionComparison.ts`) -- `FixedComparisonBackend`'s confusion-
  matrix/majority-vote scoring is inherently label-shaped and doesn't
  generalize to arbitrary structured output, so this is a distinct `run()`
  scoring by caller-supplied `isEqual`/`keyOf` (defaulting to strict
  canonicalized-JSON equality; a caller whose Output is order-independent,
  e.g. `GroundedValue[]`, supplies its own set-equality ported from that
  call site's real benchmark script). Also: both `ClosedLabelStrategySpec`
  and `SchemaExtractionStrategySpec`'s `system` (and closed-label's
  `labels`) now accept `T | ((input: Input) => T)`, not just a fixed value
  -- `selectTable`/`buildClauses`' closed-label call sites build their
  prompt and candidate set live per call, which the old fixed-value-only
  type couldn't express. `hash.ts`'s `declaredShapeOf()` was fixed to match
  (a function value was silently dropped by `JSON.stringify` before this --
  two specs with different resolver logic would have hashed identically).
  `FixedComparisonBackend.run()` now hard-errors on a function-valued
  `labels`: a confusion matrix needs one label universe shared across every
  case, which a dynamic per-call candidate set doesn't have.
- Phase 7 (this repo): `FixedComparisonBackend`/`ClosedLabelFixtureSuite`
  generalized over `Input`, mirroring `SchemaExtractionComparisonBackend`'s
  existing shape -- found needed while migrating hub's `buildClauses`'
  query-shape cascade (fixed `labels`, but a per-call `system` built from
  table/column data), which Phase 6's `labels`-as-function widening alone
  didn't unblock: `run()` was still hardcoded to `Input =
  ModelCallerMessage[]`, with no way to bridge a custom `Input` to the real
  model turn. `FixedComparisonOptions` gained an optional `toMessages:
  (input: Input) => ModelCallerMessage[]`, defaulting to treating `input`
  as the messages directly -- every existing fixed-Input strategy
  (`classify-route`) is unaffected, confirmed by the full suite passing
  unchanged. Doesn't touch the Phase 6 hard-error on function-valued
  `labels` -- that's a genuinely different problem (no shared
  confusion-matrix axis), still unsolved.

Full design/plan: `~/.claude/plans/let-s-grill-the-last-snazzy-forest.md`
(Phases 1-4), `~/.claude/plans/prancy-growing-wand.md` (Phase 6).
Originating decision record: `hub/docs/adr/0155-...md`, ledger subject
`ollama-call-strategy-deep-module`.

## Next

Hub-side: `generateFindParams.ts`'s `extractGroundedValuesNarrowed` and
`buildClauses`' query-shape cascade are both migrated now (hub's own
`HANDOFF.md`). Still open: `selectTable`'s `classifyTableChoice` and
`buildClauses`' aggregation cascade's `resolveField`/`resolveGroupColumn`
have **dynamic labels** (a live per-call candidate shortlist), which Phase
7's `Input`/`toMessages` generalization doesn't help with --
`FixedComparisonBackend.run()` still hard-errors on function-valued
`labels` (Phase 6's deliberate choice: no shared confusion-matrix axis
across cases with different candidate sets). Needs its own decision
before either can migrate: a bespoke scoring loop in the consuming
approve script (call `runClosedLabelStrategy` directly per fixture case,
score by hand), or a new backend here mirroring
`SchemaExtractionComparisonBackend`'s caller-supplied-equality shape.
Aggregation's own op-resolution steps (fixed labels) aren't blocked by
either gap and could follow query-shape's exact pattern whenever someone
picks that up.
