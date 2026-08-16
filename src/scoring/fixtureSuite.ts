import { hashFixtureSuite } from '../strategy/hash.js'
import type { FixtureSuite } from './types.js'

// Constructs a FixtureSuite, enforcing the invariants fixedComparison.ts
// relies on without re-checking itself: non-empty, and case ids unique
// (ids are how majority-wrong/inconsistent-case reporting refers back to a
// specific case).
export function defineFixtureSuite<Input, Expected>(
  suite: FixtureSuite<Input, Expected>
): FixtureSuite<Input, Expected> {
  if (suite.cases.length === 0) {
    throw new Error(`strategy-kit: fixture suite "${suite.suiteId}" has no cases.`)
  }
  const seen = new Set<string>()
  for (const c of suite.cases) {
    if (seen.has(c.id)) {
      throw new Error(`strategy-kit: fixture suite "${suite.suiteId}" has a duplicate case id "${c.id}".`)
    }
    seen.add(c.id)
  }
  return suite
}

// The canonical content hashed into ApprovalRecord.fixtureSuiteHash --
// suiteId/cases only. `version` is deliberately excluded: the gate should
// react to actual case-content changes, not an unbumped/bumped label.
export function fixtureSuiteHash<Input, Expected>(suite: FixtureSuite<Input, Expected>): string {
  return hashFixtureSuite({
    suiteId: suite.suiteId,
    cases: suite.cases.map((c) => ({ id: c.id, input: c.input, expected: c.expected })),
  })
}
