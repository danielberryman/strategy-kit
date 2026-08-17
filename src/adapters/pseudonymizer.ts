// Minimal adapter for pseudonymized capture, narrowed to the two
// operations a capture pipeline needs. Shaped off a real production vault
// implementation -- swap-in/swap-out with stable, consistent fakes.
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
