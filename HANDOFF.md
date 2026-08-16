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

## Not yet built

- Phase 4 — Capture mechanism: pseudonymized capture records + retention
  sweep.
- Phase 5 — hub adapters (`hub/lib/strategyKitAdapters/`) and the first
  migrated call site, `classifyRoute.ts`. Note for whoever builds this:
  `StrategyStorage.getCurrentFixtureSuiteHash(strategyId)` has no matching
  setter in the Phase 2 interface. The intended shape is for a real adapter
  to derive it live -- call `fixtureSuiteHash()` against whatever
  `FixtureSuite` module is currently imported/committed for that
  `strategyId`, rather than persisting a second, separately-written value
  that can drift out of sync with the one actually used at benchmark time.

Full design/plan: `~/.claude/plans/let-s-grill-the-last-snazzy-forest.md`.
Originating decision record: `hub/docs/adr/0155-...md`, ledger subject
`ollama-call-strategy-deep-module`.

## Next

Phase 4: capture mechanism (pseudonymized capture records + retention
sweep). `src/capture/*.ts` are still `export {}` stubs.
