import { describe, expect, it } from 'vitest'
import { FixedComparisonBackend, toApprovalRecord } from './fixedComparison.js'
import { hashDeclaredShape } from '../strategy/hash.js'
import { fixtureSuiteHash } from './fixtureSuite.js'
import type { ClosedLabelStrategySpec } from '../strategy/types.js'
import type { ClosedLabelFixtureSuite } from './types.js'
import type { ModelCaller, ModelCallerParams } from '../adapters/modelCaller.js'

// Queued fake: each streamTurn() call consumes the next scripted reply in
// order, so a case x repeat grid can be scripted deterministically.
function queuedCaller(replies: string[]): ModelCaller & { calls: ModelCallerParams[] } {
  const calls: ModelCallerParams[] = []
  let i = 0
  return {
    calls,
    async *streamTurn(params) {
      calls.push(params)
      yield { type: 'text', text: replies[i++] }
      yield { type: 'done' }
    },
  }
}

const spec: ClosedLabelStrategySpec<'YES' | 'NO'> = {
  strategyId: 'test-yesno',
  kind: 'closed-label',
  model: 'llama3.2',
  labels: ['YES', 'NO'],
  groundingCheck: (_raw, parsed) => parsed !== 'unparseable',
  system: 'Answer YES or NO.',
}

const suite: ClosedLabelFixtureSuite<'YES' | 'NO'> = {
  suiteId: 'yesno-suite',
  version: '1',
  cases: [
    { id: 'a', input: [{ role: 'user', text: 'a?' }], expected: 'YES' },
    { id: 'b', input: [{ role: 'user', text: 'b?' }], expected: 'YES' },
    { id: 'c', input: [{ role: 'user', text: 'c?' }], expected: 'NO' },
  ],
}

// run() iterates repeat-major (all cases for repeat 0, then all cases for
// repeat 1, ...) -- see fixedComparison.ts. Replies below are queued in
// that same order across 3 repeats x 3 cases (a, b, c):
//   repeat 0: a=YES(correct)  b=YES(correct)  c=blah(unparseable)
//   repeat 1: a=YES(correct)  b=NO(wrong)      c=blah(unparseable)
//   repeat 2: a=YES(correct)  b=YES(correct)   c=blah(unparseable)
//
// Hand-computed expectations:
//   case a: always YES -> consistent, correct every run.
//   case b: YES, NO, YES -> inconsistent (not all equal), majority YES (2/3) == expected -> majority-right.
//   case c: always unparseable -> consistent (all equal, all UNPARSEABLE), majority UNPARSEABLE != NO -> majority-wrong.
//   totalCalls = 9, totalCorrect = a(3) + b(2) + c(0) = 5, aggregateAccuracy = 5/9.
//   perRunAccuracy = [2/3, 1/3, 2/3] (correct cases per repeat: r0={a,b}, r1={a}, r2={a,b}).
//   confusion[YES][YES] = a(3) + b's 2 correct runs = 5; confusion[YES][NO] = b's 1 wrong run = 1;
//   confusion[NO][UNPARSEABLE] = c(3).
const replies = ['YES', 'YES', 'blah', 'YES', 'NO', 'blah', 'YES', 'YES', 'blah']

describe('FixedComparisonBackend.run', () => {
  it('computes aggregate accuracy, confusion matrix, inconsistent and majority-wrong cases', async () => {
    const caller = queuedCaller(replies)
    const result = await FixedComparisonBackend.run(suite, spec, caller, { repeats: 3 })

    expect(result.suiteId).toBe('yesno-suite')
    expect(result.strategyId).toBe('test-yesno')
    expect(result.model).toBe('llama3.2')
    expect(result.repeats).toBe(3)
    expect(result.totalCalls).toBe(9)
    expect(result.totalCorrect).toBe(5)
    expect(result.aggregateAccuracy).toBeCloseTo(5 / 9)
    expect(result.perRunAccuracy).toEqual([2 / 3, 1 / 3, 2 / 3])

    expect(result.confusionMatrix).toEqual({
      YES: { YES: 5, NO: 1, UNPARSEABLE: 0 },
      NO: { YES: 0, NO: 0, UNPARSEABLE: 3 },
    })

    expect(result.inconsistentCases.map((c) => c.caseId)).toEqual(['b'])

    expect(result.majorityWrongCases.map((c) => c.caseId)).toEqual(['c'])
    expect(result.majorityWrongCases[0].majorityLabel).toBe('UNPARSEABLE')

    expect(result.declaredShapeHash).toBe(hashDeclaredShape(spec))
    expect(result.fixtureSuiteHash).toBe(fixtureSuiteHash(suite))
  })

  it('defaults to 3 repeats when none is given', async () => {
    const caller = queuedCaller(replies)
    const result = await FixedComparisonBackend.run(suite, spec, caller)
    expect(result.repeats).toBe(3)
    expect(result.totalCalls).toBe(9)
  })
})

describe('toApprovalRecord', () => {
  it('picks exactly the ApprovalRecord fields off a FixedComparisonResult', async () => {
    const caller = queuedCaller(replies)
    const result = await FixedComparisonBackend.run(suite, spec, caller, { repeats: 3 })
    expect(toApprovalRecord(result)).toEqual({
      strategyId: 'test-yesno',
      model: 'llama3.2',
      declaredShapeHash: hashDeclaredShape(spec),
      fixtureSuiteHash: fixtureSuiteHash(suite),
      aggregateAccuracy: 5 / 9,
    })
  })
})
