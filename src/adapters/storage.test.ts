import { describe, expect, it } from 'vitest'
import type { StrategyStorage } from './storage.js'
import type { ApprovalRecord } from '../strategy/hash.js'

function fakeStorage(): StrategyStorage {
  const records = new Map<string, ApprovalRecord>()
  const fixtureSuiteHashes = new Map<string, string>()
  return {
    async getApprovalRecord(strategyId) {
      return records.get(strategyId)
    },
    async putApprovalRecord(record) {
      records.set(record.strategyId, record)
    },
    async getCurrentFixtureSuiteHash(strategyId) {
      return fixtureSuiteHashes.get(strategyId)
    },
  }
}

describe('StrategyStorage', () => {
  it('round-trips an ApprovalRecord by strategyId', async () => {
    const storage = fakeStorage()
    const record: ApprovalRecord = {
      strategyId: 'test-yesno',
      model: 'llama3.2',
      declaredShapeHash: 'abc',
      fixtureSuiteHash: 'def',
      aggregateAccuracy: 0.95,
    }
    await storage.putApprovalRecord(record)
    expect(await storage.getApprovalRecord('test-yesno')).toEqual(record)
  })

  it('returns undefined for an unknown strategyId', async () => {
    const storage = fakeStorage()
    expect(await storage.getApprovalRecord('nope')).toBeUndefined()
  })

  it('returns undefined for an unregistered fixture suite hash', async () => {
    const storage = fakeStorage()
    expect(await storage.getCurrentFixtureSuiteHash('nope')).toBeUndefined()
  })
})
