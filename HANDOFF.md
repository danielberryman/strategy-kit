# HANDOFF

## Done

- Phase 1 (scaffolding): repo layout, `package.json` (publish-shaped,
  private), `tsconfig.json`/`tsconfig.build.json`, `vitest.config.ts`,
  `LICENSE` (MIT), `README.md`, `CLAUDE.md`. Stub files (`export {}`) in
  place for every module the plan names, so the directory layout matches
  the design before any real interface is written.

## Not yet built

- Phase 2 — core interfaces: `Strategy` spec types, `ModelCaller` adapter
  (no `tools`/`toolChoice` field, by design), hash-pinned approval gate
  (`assertApproved`/`StrategyRegistry.use()`), `Pseudonymizer` adapter,
  `StrategyStorage` adapter.
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

Phase 2: core interfaces, with the gate's 4 explicit tests (never-benchmarked
/ model-swap / shape-drift / happy-path) as the red-to-green target.
