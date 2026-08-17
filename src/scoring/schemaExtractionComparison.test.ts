import { describe, expect, it } from 'vitest'
import { SchemaExtractionComparisonBackend, toApprovalRecord } from './schemaExtractionComparison.js'
import { hashDeclaredShape } from '../strategy/hash.js'
import { fixtureSuiteHash } from './fixtureSuite.js'
import type { SchemaExtractionStrategySpec } from '../strategy/types.js'
import type { SchemaExtractionFixtureSuite } from './types.js'
import type { ModelCaller, ModelCallerParams } from '../adapters/modelCaller.js'

type Pair = { field: string; value: string }

// Queued fake: each streamTurn() call consumes the next scripted reply in
// order, same shape fixedComparison.test.ts uses.
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

// "field: value" lines, one pair per line. Blank reply -> null (genuinely
// unparseable). Literal NONE -> [] (a valid, correctly-parsed "nothing
// extracted" answer -- distinct from null, same distinction
// generateFindParams.ts's parseExtractedValuesReply() draws).
function parse(raw: string): Pair[] | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  if (trimmed.toUpperCase() === 'NONE') return []
  return trimmed.split('\n').map((line) => {
    const idx = line.indexOf(':')
    return { field: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() }
  })
}

// Trivial accept-everything groundingCheck -- runSchemaExtractionStrategy's
// own groundingCheck-rejection behavior is covered in classifyOnce.test.ts;
// this file exercises SchemaExtractionComparisonBackend's aggregation, not
// grounding, so grounding is a no-op here (same posture fixedComparison.
// test.ts's own trivial groundingCheck takes for the same reason).
const spec: SchemaExtractionStrategySpec<string, Pair[]> = {
  strategyId: 'test-extract-pairs',
  kind: 'schema-extraction',
  model: 'llama3.2',
  system: 'Extract field:value pairs, or NONE.',
  parse,
  groundingCheck: () => true,
}

const suite: SchemaExtractionFixtureSuite<string, Pair[]> = {
  suiteId: 'extract-pairs-suite',
  version: '1',
  cases: [
    { id: 'a', input: 'my name is Alice', expected: [{ field: 'name', value: 'Alice' }] },
    { id: 'b', input: 'call me Bob please', expected: [{ field: 'name', value: 'Bob' }] },
    { id: 'c', input: 'no info here', expected: [] },
  ],
}

function normalizePair(p: Pair): string {
  return `${p.field.toLowerCase()}=${p.value.toLowerCase()}`
}

// Order-independent, case-insensitive set equality -- a real-world example
// of why this backend's isEqual/keyOf are caller-supplied rather than a
// fixed default.
function pairsKey(pairs: Pair[]): string {
  return JSON.stringify([...pairs].map(normalizePair).sort())
}

function setsEqual(a: Pair[], b: Pair[]): boolean {
  return pairsKey(a) === pairsKey(b)
}

// run() iterates repeat-major (all cases for repeat 0, then repeat 1, ...),
// same order fixedComparison.ts uses. Replies queued in that order across
// 3 repeats x 3 cases (a, b, c):
//   repeat 0: a=Alice(correct)   b=Bob(correct)      c=stuff:junk(wrong)
//   repeat 1: a=Alice(correct)   b=location:NYC(wrong) c=NONE(correct, matches expected [])
//   repeat 2: a=Alice(correct)   b=Bob(correct)      c=stuff:junk(wrong)
//
// Hand-computed expectations:
//   case a: always name=Alice -> consistent, correct every run.
//   case b: Bob, NYC(field mismatch), Bob -> inconsistent; majority name=Bob (2/3) == expected -> majority-right.
//   case c: junk, [](correct), junk -> inconsistent; majority stuff=junk (2/3) != expected [] -> majority-wrong.
//   totalCalls = 9, totalCorrect = a(3) + b(2) + c(1) = 6, aggregateAccuracy = 6/9 = 2/3.
//   perRunAccuracy = [2/3, 2/3, 2/3] (each run: a + exactly one of b/c correct).
const replies = ['name: Alice', 'name: Bob', 'stuff: junk', 'name: Alice', 'location: NYC', 'NONE', 'name: Alice', 'name: Bob', 'stuff: junk']

const options = { repeats: 3, toMessages: (input: string) => [{ role: 'user' as const, text: input }], isEqual: setsEqual, keyOf: pairsKey }

describe('SchemaExtractionComparisonBackend.run', () => {
  it('computes aggregate accuracy, inconsistent and majority-wrong cases', async () => {
    const caller = queuedCaller(replies)
    const result = await SchemaExtractionComparisonBackend.run(suite, spec, caller, options)

    expect(result.suiteId).toBe('extract-pairs-suite')
    expect(result.strategyId).toBe('test-extract-pairs')
    expect(result.model).toBe('llama3.2')
    expect(result.repeats).toBe(3)
    expect(result.totalCalls).toBe(9)
    expect(result.totalCorrect).toBe(6)
    expect(result.aggregateAccuracy).toBeCloseTo(6 / 9)
    expect(result.perRunAccuracy).toEqual([2 / 3, 2 / 3, 2 / 3])

    expect(result.inconsistentCases.map((c) => c.caseId)).toEqual(['b', 'c'])
    expect(result.majorityWrongCases.map((c) => c.caseId)).toEqual(['c'])

    expect(result.declaredShapeHash).toBe(hashDeclaredShape(spec))
    expect(result.fixtureSuiteHash).toBe(fixtureSuiteHash(suite))
  })

  it('scores a null (unparseable) run as incorrect even when expected is an empty array', async () => {
    // Case c alone, single run, blank reply -> null, never counted correct
    // regardless of what `expected` is -- an ungrounded/unparseable result
    // is never trusted, same posture closed-label's 'unparseable' takes.
    const caller = queuedCaller([''])
    const singleCaseSuite: SchemaExtractionFixtureSuite<string, Pair[]> = {
      suiteId: 'single-c',
      version: '1',
      cases: [{ id: 'c', input: 'no info here', expected: [] }],
    }
    const result = await SchemaExtractionComparisonBackend.run(singleCaseSuite, spec, caller, {
      ...options,
      repeats: 1,
    })
    expect(result.perCase[0].runs[0].output).toBeNull()
    expect(result.totalCorrect).toBe(0)
  })

  it('defaults to 3 repeats when none is given', async () => {
    const caller = queuedCaller(replies)
    const { repeats: _repeats, ...rest } = options
    const result = await SchemaExtractionComparisonBackend.run(suite, spec, caller, rest)
    expect(result.repeats).toBe(3)
    expect(result.totalCalls).toBe(9)
  })
})

describe('toApprovalRecord', () => {
  it('picks exactly the ApprovalRecord fields off a SchemaExtractionComparisonResult', async () => {
    const caller = queuedCaller(replies)
    const result = await SchemaExtractionComparisonBackend.run(suite, spec, caller, options)
    expect(toApprovalRecord(result)).toEqual({
      strategyId: 'test-extract-pairs',
      model: 'llama3.2',
      declaredShapeHash: hashDeclaredShape(spec),
      fixtureSuiteHash: fixtureSuiteHash(suite),
      aggregateAccuracy: 6 / 9,
    })
  })
})
