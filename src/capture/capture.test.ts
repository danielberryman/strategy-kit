import { describe, expect, it } from 'vitest'
import type { Pseudonymizer } from '../adapters/pseudonymizer.js'
import type { SchemaExtractionStrategySpec } from '../strategy/types.js'
import type { CaptureRecord, CaptureStorage } from './types.js'
import { captureIfGrounded } from './capture.js'

function fakePseudonymizer(): Pseudonymizer {
  const realToFake = new Map<string, string>()
  let counter = 0
  return {
    swap(real) {
      const existing = realToFake.get(real)
      if (existing) return existing
      const fake = `fake-${counter++}`
      realToFake.set(real, fake)
      return fake
    },
    tryRestore() {
      return undefined
    },
  }
}

function fakeStorage(): CaptureStorage & { records: CaptureRecord[] } {
  const records: CaptureRecord[] = []
  return {
    records,
    async put(record) {
      records.push(record)
    },
    async sweep() {
      return []
    },
  }
}

interface Input {
  text: string
}
interface Output {
  name: string
}

function spec(groundingCheck: (input: Input, output: Output) => boolean): SchemaExtractionStrategySpec<Input, Output> {
  return {
    strategyId: 'test-strategy',
    kind: 'schema-extraction',
    model: 'test-model',
    system: 'test system prompt',
    parse: () => null,
    groundingCheck,
  }
}

describe('captureIfGrounded', () => {
  it('does not store anything when groundingCheck rejects the pair', async () => {
    const storage = fakeStorage()
    const result = await captureIfGrounded(
      spec(() => false),
      { text: 'Jane Doe called' },
      { name: 'Jane Doe' },
      fakePseudonymizer(),
      storage
    )

    expect(result).toBeUndefined()
    expect(storage.records).toHaveLength(0)
  })

  it('stores a pseudonymized record when groundingCheck accepts the pair', async () => {
    const storage = fakeStorage()
    const result = await captureIfGrounded(
      spec(() => true),
      { text: 'Jane Doe called' },
      { name: 'Jane Doe' },
      fakePseudonymizer(),
      storage
    )

    expect(storage.records).toHaveLength(1)
    expect(result).toBe(storage.records[0])
    expect(result?.strategyId).toBe('test-strategy')
    expect(typeof result?.id).toBe('string')
    expect(typeof result?.capturedAt).toBe('number')
    expect((result?.output as Output).name).not.toBe('Jane Doe')
  })
})
