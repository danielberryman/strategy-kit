import { describe, expect, it } from 'vitest'
import { classifyOnce, parseLabel, runClosedLabelStrategy } from './classifyOnce.js'
import type { ClosedLabelStrategySpec } from './types.js'
import type { ModelCaller, ModelCallerParams } from '../adapters/modelCaller.js'

function fakeCaller(text: string): ModelCaller & { calls: ModelCallerParams[] } {
  const calls: ModelCallerParams[] = []
  return {
    calls,
    async *streamTurn(params) {
      calls.push(params)
      yield { type: 'text', text }
      yield { type: 'done' }
    },
  }
}

describe('parseLabel', () => {
  it('rescues an escaped-underscore reply (mistral quirk)', () => {
    expect(parseLabel('JOB\\_SEARCH', ['JOB_SEARCH', 'OTHER'])).toBe('JOB_SEARCH')
  })

  it('rescues a punctuation-dropped reply (llama3.2 quirk)', () => {
    expect(parseLabel('CANNOT-EXPRESS', ['CANNOT_EXPRESS'])).toBe('CANNOT_EXPRESS')
  })

  it('returns unparseable when nothing matches', () => {
    expect(parseLabel('I refuse to answer', ['YES', 'NO'])).toBe('unparseable')
  })
})

describe('classifyOnce', () => {
  it('streams a reply and parses it against the label set', async () => {
    const caller = fakeCaller('yes, definitely')
    const result = await classifyOnce(['YES', 'NO'], caller, 'llama3.2', 'sys', [{ role: 'user', text: '?' }])
    expect(result).toBe('YES')
  })

  it('never passes a tools field to the caller', async () => {
    const caller = fakeCaller('yes')
    await classifyOnce(['YES', 'NO'], caller, 'llama3.2', 'sys', [{ role: 'user', text: '?' }])
    expect(caller.calls[0]).not.toHaveProperty('tools')
  })
})

describe('runClosedLabelStrategy', () => {
  function spec(overrides: Partial<ClosedLabelStrategySpec<'YES' | 'NO'>> = {}): ClosedLabelStrategySpec<'YES' | 'NO'> {
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

  it('returns the parsed label when groundingCheck accepts it', async () => {
    const caller = fakeCaller('YES')
    const result = await runClosedLabelStrategy(spec(), caller, [{ role: 'user', text: '?' }])
    expect(result).toBe('YES')
  })

  it('returns unparseable when groundingCheck rejects a successfully parsed label', async () => {
    const caller = fakeCaller('YES')
    const result = await runClosedLabelStrategy(spec({ groundingCheck: () => false }), caller, [
      { role: 'user', text: '?' },
    ])
    expect(result).toBe('unparseable')
  })
})
