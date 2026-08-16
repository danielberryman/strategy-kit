import type { StrategySpec } from './types.js'
import type { StrategyStorage } from '../adapters/storage.js'
import { type ApprovalRecord, hashDeclaredShape } from './hash.js'

export type { ApprovalRecord } from './hash.js'

// Hard-error, zero-fallback trust gate -- same posture as hub's
// dataRoot()/promotedDeployment.ts gates: refusal over guessing, one of
// four specific, structured reasons, never a generic "not approved".
//
// Order matters: never-benchmarked is checked before anything reads
// fields off a nonexistent record; model-swap before shape-drift, since a
// model swap is definitionally a different, unbenchmarked configuration
// regardless of whether the shape hash happens to still match; fixture-
// suite-changed last, since it's the only check requiring a call into
// storage's current-suite-hash lookup rather than the spec/record pair
// alone.
export async function assertApproved(
  spec: StrategySpec<any, any, any>,
  storage: StrategyStorage
): Promise<ApprovalRecord> {
  const record = await storage.getApprovalRecord(spec.strategyId)
  if (!record) {
    throw new Error(
      `strategy-kit: strategy "${spec.strategyId}" has never been benchmarked -- no ApprovalRecord exists. ` +
        `Run it through Scoring's fixed-comparison backend and record the result before calling StrategyRegistry.use().`
    )
  }

  if (record.model !== spec.model) {
    throw new Error(
      `strategy-kit: strategy "${spec.strategyId}" was approved against model "${record.model}", ` +
        `but this spec declares "${spec.model}". A model swap needs its own benchmark -- ` +
        `reliability does not transfer across models.`
    )
  }

  const currentShapeHash = hashDeclaredShape(spec)
  if (record.declaredShapeHash !== currentShapeHash) {
    throw new Error(
      `strategy-kit: strategy "${spec.strategyId}"'s declared shape has drifted since it was approved ` +
        `(recorded ${record.declaredShapeHash}, current ${currentShapeHash}). Re-benchmark before use.`
    )
  }

  const currentFixtureSuiteHash = await storage.getCurrentFixtureSuiteHash(spec.strategyId)
  if (record.fixtureSuiteHash !== currentFixtureSuiteHash) {
    throw new Error(
      `strategy-kit: strategy "${spec.strategyId}"'s fixture suite has changed since it was approved ` +
        `(recorded ${record.fixtureSuiteHash}, current ${currentFixtureSuiteHash ?? 'none registered'}). ` +
        `Re-benchmark against the current suite before use.`
    )
  }

  return record
}

// The ONLY path to a callable strategy. use() re-runs assertApproved on
// EVERY call, not just at registration -- registration may happen at boot,
// long before first actual use, and an approved-at-boot strategy could
// have drifted (a code edit, a fixture-suite change) by the time it's
// first called. There is deliberately no cached "approved" flag this class
// could short-circuit on -- that would itself be the alternate path
// trust-gates.md's "no alternate path" property rules out.
export class StrategyRegistry {
  #storage: StrategyStorage

  constructor(storage: StrategyStorage) {
    this.#storage = storage
  }

  async use<S extends StrategySpec<any, any, any>>(spec: S): Promise<S> {
    await assertApproved(spec, this.#storage)
    return spec
  }
}
