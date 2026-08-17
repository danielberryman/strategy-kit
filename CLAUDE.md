# strategy-kit

Standalone TypeScript library: a strategy registry (closed-label
classification, schema-grounded extraction), fixed-comparison scoring, and a
hash-pinned approval gate. See `README.md` for what it does and current
status.

## Standing invariant

This library must never import from `hub/` or any other consumer repo. If a
change needs something consumer-specific (a real model client, a real vault,
a real filesystem/state root), that need belongs in `src/adapters/` as an
interface a consumer implements — not as a direct dependency here. This is
what keeps the library open-source-clean and independently testable.

## Commands

- `npm run build` — `tsc` emit to `dist/`
- `npm run typecheck` — `tsc -p tsconfig.json --noEmit`
- `npm run test` — `vitest run`

## Code style / conventions

- TypeScript, `strict: true`. No React, no DOM — this is a pure logic
  library; hub consumes it from server-side code only.
- `package.json` is publish-shaped (`main`/`module`/`types`/`exports`/
  `files`) but not published to npm yet -- `private: false` and public on
  GitHub, consumed via a git dependency for now.
