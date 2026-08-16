import { describe, expect, it } from 'vitest'
import { assertApproved, StrategyRegistry } from './registry.js'
import { hashDeclaredShape } from './hash.js'
import type { ApprovalRecord } from './hash.js'
import type { ClosedLabelStrategySpec } from './types.js'
import type { StrategyStorage } from '../adapters/storage.js'

class FakeStorage implements StrategyStorage {
  #records = new Map<string, ApprovalRecord>()
  #fixtureSuiteHashes = new Map<string, string>()
  async getApprovalRecord(strategyId: string) {
    return this.#records.get(strategyId)
  }
  async putApprovalRecord(record: ApprovalRecord) {
    this.#records.set(record.strategyId, record)
  }
  async getCurrentFixtureSuiteHash(strategyId: string) {
    return this.#fixtureSuiteHashes.get(strategyId)
  }
  setCurrentFixtureSuiteHash(strategyId: string, hash: string) {
    this.#fixtureSuiteHashes.set(strategyId, hash)
  }
}

function baseSpec(
  overrides: Partial<ClosedLabelStrategySpec<'YES' | 'NO'>> = {}
): ClosedLabelStrategySpec<'YES' | 'NO'> {
  return {
    strategyId: 'test-yesno',
    kind: 'closed-label',
    model: 'llama3.2',
    labels: ['YES', 'NO'],
    groundingCheck: (_raw, parsed) => parsed !== 'unparseable',
    system: 'Answer YES or NO.',
    ...overrides,
  }
}

const REASON_PATTERNS = {
  neverBenchmarked: /never been benchmarked/,
  modelSwap: /model swap/,
  shapeDrift: /drifted/,
  fixtureSuiteChanged: /fixture suite/,
}

function assertOnlyReason(message: string, reason: keyof typeof REASON_PATTERNS) {
  for (const [key, pattern] of Object.entries(REASON_PATTERNS)) {
    if (key === reason) expect(message).toMatch(pattern)
    else expect(message).not.toMatch(pattern)
  }
}

describe('assertApproved', () => {
  it('rejects with "never benchmarked" when no ApprovalRecord exists', async () => {
    const storage = new FakeStorage()
    await expect(assertApproved(baseSpec(), storage)).rejects.toThrow()
    try {
      await assertApproved(baseSpec(), storage)
      throw new Error('expected rejection')
    } catch (err) {
      assertOnlyReason((err as Error).message, 'neverBenchmarked')
    }
  })

  it('rejects with "model swap" when the record was approved against a different model', async () => {
    const storage = new FakeStorage()
    await storage.putApprovalRecord({
      strategyId: 'test-yesno',
      model: 'mistral',
      declaredShapeHash: 'irrelevant',
      fixtureSuiteHash: 'irrelevant',
      aggregateAccuracy: 0.9,
    })
    try {
      await assertApproved(baseSpec({ model: 'llama3.2' }), storage)
      throw new Error('expected rejection')
    } catch (err) {
      const message = (err as Error).message
      assertOnlyReason(message, 'modelSwap')
      expect(message).toContain('mistral')
      expect(message).toContain('llama3.2')
    }
  })

  it('rejects with "drifted" when declaredShapeHash no longer matches the spec', async () => {
    const approvedSpec = baseSpec()
    const storage = new FakeStorage()
    await storage.putApprovalRecord({
      strategyId: 'test-yesno',
      model: 'llama3.2',
      declaredShapeHash: hashDeclaredShape(approvedSpec),
      fixtureSuiteHash: 'suite-v1',
      aggregateAccuracy: 0.9,
    })
    storage.setCurrentFixtureSuiteHash('test-yesno', 'suite-v1')

    // sanity: the originally-approved spec still passes
    await expect(assertApproved(approvedSpec, storage)).resolves.toBeDefined()

    const driftedSpec = baseSpec({ groundingCheck: (raw) => raw.length > 0 })
    try {
      await assertApproved(driftedSpec, storage)
      throw new Error('expected rejection')
    } catch (err) {
      const message = (err as Error).message
      assertOnlyReason(message, 'shapeDrift')
      expect(message).toContain(hashDeclaredShape(approvedSpec))
      expect(message).toContain(hashDeclaredShape(driftedSpec))
    }
  })

  it('rejects with "fixture suite" when the current suite hash no longer matches', async () => {
    const spec = baseSpec()
    const storage = new FakeStorage()
    await storage.putApprovalRecord({
      strategyId: 'test-yesno',
      model: 'llama3.2',
      declaredShapeHash: hashDeclaredShape(spec),
      fixtureSuiteHash: 'suite-v1',
      aggregateAccuracy: 0.9,
    })
    storage.setCurrentFixtureSuiteHash('test-yesno', 'suite-v2')
    try {
      await assertApproved(spec, storage)
      throw new Error('expected rejection')
    } catch (err) {
      const message = (err as Error).message
      assertOnlyReason(message, 'fixtureSuiteChanged')
      expect(message).toContain('suite-v1')
      expect(message).toContain('suite-v2')
    }
  })

  it('resolves with the ApprovalRecord on the happy path', async () => {
    const spec = baseSpec()
    const storage = new FakeStorage()
    const record: ApprovalRecord = {
      strategyId: 'test-yesno',
      model: 'llama3.2',
      declaredShapeHash: hashDeclaredShape(spec),
      fixtureSuiteHash: 'suite-v1',
      aggregateAccuracy: 0.9167,
    }
    await storage.putApprovalRecord(record)
    storage.setCurrentFixtureSuiteHash('test-yesno', 'suite-v1')

    const result = await assertApproved(spec, storage)
    expect(result).toEqual(record)
  })
})

describe('StrategyRegistry.use', () => {
  it('delegates to assertApproved and returns the spec when approved', async () => {
    const spec = baseSpec()
    const storage = new FakeStorage()
    await storage.putApprovalRecord({
      strategyId: 'test-yesno',
      model: 'llama3.2',
      declaredShapeHash: hashDeclaredShape(spec),
      fixtureSuiteHash: 'suite-v1',
      aggregateAccuracy: 0.9,
    })
    storage.setCurrentFixtureSuiteHash('test-yesno', 'suite-v1')

    const registry = new StrategyRegistry(storage)
    const used = await registry.use(spec)
    expect(used.strategyId).toBe('test-yesno')
  })

  it('re-checks approval on every call, not only at registration', async () => {
    const spec = baseSpec()
    const storage = new FakeStorage()
    const registry = new StrategyRegistry(storage)
    await expect(registry.use(spec)).rejects.toThrow(/never been benchmarked/)
  })
})
