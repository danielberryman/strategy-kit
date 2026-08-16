import { describe, expect, it } from 'vitest'
import type { ModelCaller, ModelCallerParams } from './modelCaller.js'

function fakeCaller(text: string): ModelCaller {
  return {
    async *streamTurn() {
      yield { type: 'text', text }
      yield { type: 'done' }
    },
  }
}

describe('ModelCaller', () => {
  it('is satisfiable by a fake implementation and yields events', async () => {
    const caller = fakeCaller('hello')
    const events = []
    for await (const event of caller.streamTurn({ model: 'x', messages: [{ role: 'user', text: '?' }] })) {
      events.push(event)
    }
    expect(events).toEqual([
      { type: 'text', text: 'hello' },
      { type: 'done' },
    ])
  })

  it('has no tools field at the type level', () => {
    // @ts-expect-error -- ModelCallerParams has no `tools` field; this is the
    // compile-time proof a Track-1 strategy cannot express a tool call.
    const bad: ModelCallerParams = { model: 'x', messages: [], tools: [] }
    expect(bad).toBeTruthy()
  })
})
