import { describe, expect, it } from 'vitest'
import { canonicalize, hashDeclaredShape } from './hash.js'
import type { ClosedLabelStrategySpec, SchemaExtractionStrategySpec } from './types.js'

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

describe('canonicalize', () => {
  it('is independent of object key order', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }))
  })

  it('preserves array order while sorting keys within each element', () => {
    const x = canonicalize([{ b: 1, a: 2 }, { q: 2 }])
    const y = canonicalize([{ q: 2 }, { b: 1, a: 2 }])
    expect(x).not.toBe(y)
    expect(x).toBe('[{"a":2,"b":1},{"q":2}]')
  })
})

describe('hashDeclaredShape', () => {
  it('is stable across repeated calls on the same spec', () => {
    const spec = baseSpec()
    expect(hashDeclaredShape(spec)).toBe(hashDeclaredShape(spec))
  })

  it('differs when groundingCheck differs but everything else is identical', () => {
    const specA = baseSpec({ groundingCheck: (_raw, parsed) => parsed !== 'unparseable' })
    const specB = baseSpec({ groundingCheck: (raw) => raw.length > 0 })
    expect(hashDeclaredShape(specA)).not.toBe(hashDeclaredShape(specB))
  })

  it('differs between a closed-label and a schema-extraction spec sharing other fields', () => {
    const closedLabel = baseSpec()
    const schemaExtraction: SchemaExtractionStrategySpec<string, { value: string }> = {
      strategyId: 'test-yesno',
      kind: 'schema-extraction',
      model: 'llama3.2',
      system: 'Answer YES or NO.',
      parse: (raw) => ({ value: raw }),
      groundingCheck: (input, output) => input.includes(output.value),
    }
    expect(hashDeclaredShape(closedLabel)).not.toBe(hashDeclaredShape(schemaExtraction))
  })
})
