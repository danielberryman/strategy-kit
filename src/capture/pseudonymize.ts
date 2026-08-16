import type { Pseudonymizer } from '../adapters/pseudonymizer.js'

// Swaps a captured input/output pair for storage. A SchemaExtractionStrategy's
// output values are grounded by being literal substrings of the input (see
// strategy/types.ts's groundingCheck doc) -- pseudonymizing only those
// substrings, and mirroring the exact same swap into the input text, keeps
// a captured pair substring-grounded after pseudonymization, so it stays
// usable as future fixture material.

function walkStrings(value: unknown, swap: (s: string) => string): unknown {
  if (typeof value === 'string') return swap(value)
  if (Array.isArray(value)) return value.map((v) => walkStrings(v, swap))
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      out[key] = walkStrings(v, swap)
    }
    return out
  }
  return value
}

export function pseudonymizeCapture<Input, Output>(
  input: Input,
  output: Output,
  pseudonymizer: Pseudonymizer
): { input: Input; output: Output } {
  const originalInputText = JSON.stringify(input)

  // Pass 1: collect every grounded value (a non-empty output string leaf
  // that's a substring of the ORIGINAL, unmutated input text) and its
  // stable fake. Checking against the original text -- not one mutated in
  // place as values are swapped -- keeps repeated occurrences of the same
  // real value grounded even after the first occurrence is swapped.
  const fakeByReal = new Map<string, string>()
  walkStrings(output, (value) => {
    if (value !== '' && originalInputText.includes(value) && !fakeByReal.has(value)) {
      fakeByReal.set(value, pseudonymizer.swap(value))
    }
    return value
  })

  let swappedInputText = originalInputText
  for (const [real, fake] of fakeByReal) {
    swappedInputText = swappedInputText.split(real).join(fake)
  }

  const pseudonymizedOutput = walkStrings(output, (value) => fakeByReal.get(value) ?? value) as Output

  return { input: JSON.parse(swappedInputText) as Input, output: pseudonymizedOutput }
}
