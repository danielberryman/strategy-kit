import { createHash } from 'node:crypto'
import type { StrategySpec } from './types.js'

// The hash-pinned gate's hashing primitives. Node's built-in crypto only
// -- no new runtime dependency (package.json stays "no runtime deps").

/** Deterministic JSON-ish stringify: object keys sorted recursively, so
 * two structurally-identical values hash identically regardless of
 * property insertion order. Array order is preserved (meaningful --
 * `labels` order affects classifyOnce's parse). */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value))
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeysDeep((value as Record<string, unknown>)[key])
    }
    return out
  }
  return value
}

export function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

/** The strategy's own declared shape -- what defines WHAT it is and HOW it
 * verifies its own output. Function-valued fields (groundingCheck, parse)
 * are captured via `.toString()` -- the only available representation of
 * "what this function actually does" without a runtime schema-description
 * object, and sufficient to catch drift: editing groundingCheck's logic,
 * even with labels/model unchanged, changes this hash. */
export function declaredShapeOf(spec: StrategySpec<any, any, any>): unknown {
  if (spec.kind === 'closed-label') {
    return {
      kind: spec.kind,
      strategyId: spec.strategyId,
      model: spec.model,
      labels: [...spec.labels],
      system: spec.system,
      groundingCheck: spec.groundingCheck.toString(),
    }
  }
  return {
    kind: spec.kind,
    strategyId: spec.strategyId,
    model: spec.model,
    system: spec.system,
    parse: spec.parse.toString(),
    groundingCheck: spec.groundingCheck.toString(),
  }
}

export function hashDeclaredShape(spec: StrategySpec<any, any, any>): string {
  return sha256(canonicalize(declaredShapeOf(spec)))
}

/** Hashes the canonical content of a fixture suite (Phase 3 defines what
 * that content actually is -- this function only needs `unknown` in
 * Phase 2, since it's pure canonicalize+hash with no shape opinion). */
export function hashFixtureSuite(content: unknown): string {
  return sha256(canonicalize(content))
}

/** Approval record: the gate's stored proof that a strategy was
 * benchmarked, against which model, against which declared shape, against
 * which fixture suite, with what result. */
export interface ApprovalRecord {
  strategyId: string
  model: string
  declaredShapeHash: string
  fixtureSuiteHash: string
  aggregateAccuracy: number
}
