// The capture pipeline's record shape and the storage adapter it writes
// through. Both are pure/adapter-shaped -- this library has no filesystem
// or stateRoot concept (see CLAUDE.md's standing invariant); a real
// filesystem-backed CaptureStorage is a consumer's own adapter.

/** One pseudonymized input/output pair, captured after a
 * SchemaExtractionStrategySpec's groundingCheck accepted it. Future
 * fixture material for Scoring, never raw user data. */
export interface CaptureRecord {
  id: string
  strategyId: string
  capturedAt: number
  input: unknown
  output: unknown
}

export interface CaptureStorage {
  put(record: CaptureRecord): Promise<void>
  /** Deletes records older than retentionMs, returns the deleted ids. No
   * real implementation lives in this library; a consumer adapter backs
   * this against its own storage -- one JSON file per record, atomic
   * temp-file + rename, is a reasonable default shape. */
  sweep(retentionMs: number): Promise<string[]>
}
