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

## Not yet built

- Phase 3 — Scoring: `FixedComparisonBackend`, `FixtureSuite`; `judge.ts`
  stays an interface stub only (Track 2 deferred).
- Phase 4 — Capture mechanism: pseudonymized capture records + retention
  sweep.
- Phase 5 — hub adapters (`hub/lib/strategyKitAdapters/`) and the first
  migrated call site, `classifyRoute.ts`.

Full design/plan: `~/.claude/plans/let-s-grill-the-last-snazzy-forest.md`.
Originating decision record: `hub/docs/adr/0155-...md`, ledger subject
`ollama-call-strategy-deep-module`.

## Next

Phase 3: Scoring's fixed-comparison backend (`FixtureSuite<Input,
Expected>` / `FixedComparisonBackend.run()`), modeled on hub's
`capability-router-test.mjs` (repeats, aggregate accuracy, confusion
matrix, majority-vote-wrong, inconsistent cases). `judge.ts` stays an
interface-only stub.
