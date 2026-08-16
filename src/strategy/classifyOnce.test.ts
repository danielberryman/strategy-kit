import { describe, expect, it } from 'vitest'
import { classifyOnce, parseLabel, runClosedLabelStrategy, runSchemaExtractionStrategy } from './classifyOnce.js'
import type { ClosedLabelStrategySpec, SchemaExtractionStrategySpec } from './types.js'
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

  it('resolves a function-valued system/labels using messages as the default Input', async () => {
    const caller = fakeCaller('YES')
    const dynamicSpec: ClosedLabelStrategySpec<'YES' | 'NO'> = {
      strategyId: 'test-dynamic',
      kind: 'closed-label',
      model: 'llama3.2',
      labels: (messages) => (messages.length > 0 ? ['YES', 'NO'] : []),
      groundingCheck: (_raw, parsed) => parsed !== 'unparseable',
      system: (messages) => `Answer about: ${messages.map((m) => m.text).join(' ')}`,
    }
    const result = await runClosedLabelStrategy(dynamicSpec, caller, [{ role: 'user', text: 'a?' }])
    expect(result).toBe('YES')
    expect(caller.calls[0].system).toBe('Answer about: a?')
  })

  it('resolves a function-valued system/labels against a caller-supplied Input distinct from messages', async () => {
    const caller = fakeCaller('B')
    const dynamicSpec: ClosedLabelStrategySpec<'A' | 'B' | 'C', readonly string[]> = {
      strategyId: 'test-dynamic-input',
      kind: 'closed-label',
      model: 'llama3.2',
      labels: (candidates) => candidates as unknown as readonly ('A' | 'B' | 'C')[],
      groundingCheck: (_raw, parsed) => parsed !== 'unparseable',
      system: (candidates) => `Choose from: ${candidates.join(', ')}`,
    }
    const result = await runClosedLabelStrategy(
      dynamicSpec,
      caller,
      [{ role: 'user', text: '?' }],
      undefined,
      ['A', 'B']
    )
    expect(result).toBe('B')
    expect(caller.calls[0].system).toBe('Choose from: A, B')
  })

  it('leaves a fixed-string system/labels spec unaffected (classifyRoute-shaped usage)', async () => {
    const caller = fakeCaller('YES')
    const result = await runClosedLabelStrategy(spec(), caller, [{ role: 'user', text: '?' }])
    expect(result).toBe('YES')
    expect(caller.calls[0].system).toBe('Answer YES or NO.')
  })
})

describe('runSchemaExtractionStrategy', () => {
  function extractionSpec(
    overrides: Partial<SchemaExtractionStrategySpec<string, { value: string }>> = {}
  ): SchemaExtractionStrategySpec<string, { value: string }> {
    return {
      strategyId: 'test-extract',
      kind: 'schema-extraction',
      model: 'llama3.2',
      system: 'Extract the value.',
      parse: (raw) => (raw.trim().length > 0 ? { value: raw.trim() } : null),
      groundingCheck: (input, output) => input.includes(output.value),
      ...overrides,
    }
  }

  it('returns the parsed output when parse succeeds and groundingCheck accepts it', async () => {
    const caller = fakeCaller('hello')
    const result = await runSchemaExtractionStrategy(extractionSpec(), caller, 'say hello please', [
      { role: 'user', text: 'say hello please' },
    ])
    expect(result).toEqual({ value: 'hello' })
  })

  it('returns null when parse fails (unparseable reply)', async () => {
    const caller = fakeCaller('   ')
    const result = await runSchemaExtractionStrategy(extractionSpec(), caller, 'say hello please', [
      { role: 'user', text: 'say hello please' },
    ])
    expect(result).toBeNull()
  })

  it('returns null when groundingCheck rejects a successfully parsed output', async () => {
    const caller = fakeCaller('goodbye')
    const result = await runSchemaExtractionStrategy(
      extractionSpec({ groundingCheck: () => false }),
      caller,
      'say hello please',
      [{ role: 'user', text: 'say hello please' }]
    )
    expect(result).toBeNull()
  })

  it('resolves a function-valued system prompt from Input', async () => {
    const caller = fakeCaller('hello')
    const dynamic = extractionSpec({ system: (input) => `Extract a value from: ${input}` })
    await runSchemaExtractionStrategy(dynamic, caller, 'say hello please', [
      { role: 'user', text: 'say hello please' },
    ])
    expect(caller.calls[0].system).toBe('Extract a value from: say hello please')
  })

  it('passes Input through to parse, not just raw', async () => {
    const caller = fakeCaller('anything')
    // parse ignores the raw reply entirely and echoes Input back -- proves
    // parse actually receives Input rather than being called raw-only.
    const echoesInput = extractionSpec({
      parse: (_raw, input) => ({ value: `input was: ${input}` }),
      groundingCheck: () => true,
    })
    const result = await runSchemaExtractionStrategy(echoesInput, caller, 'say hello please', [
      { role: 'user', text: 'say hello please' },
    ])
    expect(result).toEqual({ value: 'input was: say hello please' })
  })
})
