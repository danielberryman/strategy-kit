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

Core library is built out: strategy registry, hash-pinned approval gate,
fixed-comparison scoring (including LLM-judge scoring and a
schema-extraction comparison backend), and a pseudonymized capture
pipeline. 66 tests, typecheck and build both clean. In active use as the
call-strategy layer behind a production classification/routing pipeline.

## Install

Not on npm yet. Consume via a git or `file:` dependency:

```json
"strategy-kit": "github:danielberryman/strategy-kit"
```

## Commands

- `npm run build` — `tsc` emit to `dist/`
- `npm run typecheck` — `tsc -p tsconfig.json --noEmit`
- `npm run test` — `vitest run`
