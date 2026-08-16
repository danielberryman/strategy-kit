import { describe, expect, it } from 'vitest'
import { defineFixtureSuite, fixtureSuiteHash } from './fixtureSuite.js'
import type { FixtureSuite } from './types.js'

function suite(overrides: Partial<FixtureSuite<string, 'YES' | 'NO'>> = {}): FixtureSuite<string, 'YES' | 'NO'> {
  return {
    suiteId: 'test-suite',
    version: '1',
    cases: [
      { id: 'a', input: 'is the sky blue', expected: 'YES' },
      { id: 'b', input: 'is the sky green', expected: 'NO' },
    ],
    ...overrides,
  }
}

describe('defineFixtureSuite', () => {
  it('returns a valid suite unchanged', () => {
    const s = suite()
    expect(defineFixtureSuite(s)).toBe(s)
  })

  it('throws when the suite has no cases', () => {
    expect(() => defineFixtureSuite(suite({ cases: [] }))).toThrow(/no cases/)
  })

  it('throws on a duplicate case id', () => {
    expect(() =>
      defineFixtureSuite(
        suite({
          cases: [
            { id: 'a', input: 'x', expected: 'YES' },
            { id: 'a', input: 'y', expected: 'NO' },
          ],
        })
      )
    ).toThrow(/duplicate case id/)
  })
})

describe('fixtureSuiteHash', () => {
  it('is stable across repeated calls on the same suite', () => {
    const s = suite()
    expect(fixtureSuiteHash(s)).toBe(fixtureSuiteHash(s))
  })

  it('changes when case content changes', () => {
    const original = fixtureSuiteHash(suite())
    const changed = fixtureSuiteHash(suite({ cases: [{ id: 'a', input: 'different', expected: 'YES' }] }))
    expect(changed).not.toBe(original)
  })

  it('is unaffected by version alone changing', () => {
    const v1 = fixtureSuiteHash(suite({ version: '1' }))
    const v2 = fixtureSuiteHash(suite({ version: '2' }))
    expect(v1).toBe(v2)
  })
})
