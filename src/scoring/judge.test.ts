import { describe, expect, it } from 'vitest'
import type { JudgeBackend } from './judge.js'

describe('JudgeBackend', () => {
  it('is satisfiable by a fake implementation and returns a verdict', async () => {
    const fakeJudge: JudgeBackend<string, string, 'pass' | 'fail'> = async (call, output) =>
      output.includes(call) ? 'pass' : 'fail'

    expect(await fakeJudge('hello', 'hello world')).toBe('pass')
    expect(await fakeJudge('hello', 'goodbye')).toBe('fail')
  })
})
