# strategy-kit

A closed-set call-strategy registry, fixed-comparison scoring, and a
hash-pinned approval gate for narrow, bounded model calls — closed-label
classification and schema/enum-grounded extraction, each mechanically
re-verified rather than trusted on the model's say-so.

Generalizes a pattern that already exists in production (hub's
`generateFindParams.ts`, `classifyWithEscalation.ts`) into a shared,
framework-agnostic library. Has no dependency on any consumer's
infrastructure — a consumer wires in its own model client, pseudonymizer,
and storage through the `src/adapters/` interfaces.

## Status

Early scaffolding. See `HANDOFF.md` for current phase and what's next.

## Install

Not published. Consume via `file:` dependency, same posture as
`component-library`:

```json
"strategy-kit": "file:../strategy-kit"
```

## Commands

- `npm run build` — `tsc` emit to `dist/`
- `npm run typecheck` — `tsc -p tsconfig.json --noEmit`
- `npm run test` — `vitest run`
