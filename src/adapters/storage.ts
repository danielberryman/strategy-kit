import type { ApprovalRecord } from '../strategy/hash.js'

// Minimal storage adapter Phase 2 needs: read/write ApprovalRecords by
// strategyId (assertApproved's core lookup), and the fixture-suite hash
// currently registered for a strategy (gate reason 4: "fixture suite
// changed"). Full capture/fixture-content storage is Phase 3/4 -- kept out
// until those phases define what "the current fixture suite" actually
// contains. The library has zero concept of HUB_INSTANCE/stateRoot(); a
// consumer's own adapter resolves real paths.
export interface StrategyStorage {
  getApprovalRecord(strategyId: string): Promise<ApprovalRecord | undefined>
  putApprovalRecord(record: ApprovalRecord): Promise<void>
  /** sha256 of the fixture-suite content currently registered as this
   * strategyId's suite -- undefined if none is registered. Compared
   * against ApprovalRecord.fixtureSuiteHash by assertApproved(); Phase 3's
   * FixtureSuite/FixedComparisonBackend own producing the real content
   * this hashes. */
  getCurrentFixtureSuiteHash(strategyId: string): Promise<string | undefined>
}
