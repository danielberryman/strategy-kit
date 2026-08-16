// Minimal adapter for pseudonymized capture. Phase 4 (capture) is the
// actual consumer -- Phase 2 only needs this to exist and typecheck.
// Shaped ~1:1 off hub's real Vault (examples/drawer-broker/gate/vault.ts),
// narrowed to the two operations a capture pipeline needs.
export interface Pseudonymizer {
  /** Real value in, stable fake out -- the same real value always yields
   * the same fake within this Pseudonymizer's lifetime (consistency), so
   * a captured input/output pair stays coherently pseudonymized together. */
  swap(real: string): string
  /** Fake value in, the real value it was minted for -- or undefined if
   * this Pseudonymizer never issued that token. Fail-closed: never
   * guesses, never reverses a token it didn't itself mint. */
  tryRestore(fake: string): string | undefined
}
