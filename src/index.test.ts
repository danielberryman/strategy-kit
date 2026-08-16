import { describe, expect, it } from 'vitest'
import * as strategyKit from './index.js'

describe('index exports', () => {
  it('exposes the gate', () => {
    expect(typeof strategyKit.assertApproved).toBe('function')
    expect(typeof strategyKit.StrategyRegistry).toBe('function')
  })

  it('exposes classifyOnce and its helpers', () => {
    expect(typeof strategyKit.classifyOnce).toBe('function')
    expect(typeof strategyKit.parseLabel).toBe('function')
    expect(typeof strategyKit.runClosedLabelStrategy).toBe('function')
  })

  it('exposes the hashing functions needed to construct an ApprovalRecord', () => {
    expect(typeof strategyKit.hashDeclaredShape).toBe('function')
    expect(typeof strategyKit.hashFixtureSuite).toBe('function')
  })

  it('exposes the scoring backend', () => {
    expect(typeof strategyKit.FixedComparisonBackend.run).toBe('function')
    expect(typeof strategyKit.toApprovalRecord).toBe('function')
    expect(typeof strategyKit.defineFixtureSuite).toBe('function')
    expect(typeof strategyKit.fixtureSuiteHash).toBe('function')
  })
})
