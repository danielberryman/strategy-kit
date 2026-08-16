import { describe, expect, it } from 'vitest'
import type { Pseudonymizer } from '../adapters/pseudonymizer.js'
import { pseudonymizeCapture } from './pseudonymize.js'

function fakePseudonymizer(): Pseudonymizer {
  const realToFake = new Map<string, string>()
  const fakeToReal = new Map<string, string>()
  let counter = 0
  return {
    swap(real) {
      const existing = realToFake.get(real)
      if (existing) return existing
      const fake = `fake-${counter++}`
      realToFake.set(real, fake)
      fakeToReal.set(fake, real)
      return fake
    },
    tryRestore(fake) {
      return fakeToReal.get(fake)
    },
  }
}

describe('pseudonymizeCapture', () => {
  it('swaps a grounded output string identically in both input and output', () => {
    const p = fakePseudonymizer()
    const input = { text: 'contact Jane Doe about the invoice' }
    const output = { name: 'Jane Doe' }

    const result = pseudonymizeCapture(input, output, p)

    expect(result.output.name).not.toBe('Jane Doe')
    expect(result.input.text).toContain(result.output.name)
    expect(result.input.text).not.toContain('Jane Doe')
  })

  it('leaves an output string untouched when it is not a substring of input', () => {
    const p = fakePseudonymizer()
    const input = { text: 'contact Jane Doe about the invoice' }
    const output = { status: 'ok' }

    const result = pseudonymizeCapture(input, output, p)

    expect(result.output.status).toBe('ok')
    expect(result.input.text).toBe(input.text)
  })

  it('walks nested objects and arrays', () => {
    const p = fakePseudonymizer()
    const input = { text: 'Jane Doe emailed jane@example.com yesterday' }
    const output = { people: [{ name: 'Jane Doe', email: 'jane@example.com' }] }

    const result = pseudonymizeCapture(input, output, p)

    const person = result.output.people[0]
    expect(person.name).not.toBe('Jane Doe')
    expect(person.email).not.toBe('jane@example.com')
    expect(result.input.text).toContain(person.name)
    expect(result.input.text).toContain(person.email)
  })

  it('swaps repeated occurrences of the same value consistently', () => {
    const p = fakePseudonymizer()
    const input = { text: 'Jane Doe called. Jane Doe left a message.' }
    const output = { names: ['Jane Doe', 'Jane Doe'] }

    const result = pseudonymizeCapture(input, output, p)

    expect(result.output.names[0]).toBe(result.output.names[1])
    expect(result.input.text).not.toContain('Jane Doe')
  })

  it('does not swap empty strings', () => {
    const p = fakePseudonymizer()
    const input = { text: '' }
    const output = { note: '' }

    const result = pseudonymizeCapture(input, output, p)

    expect(result.output.note).toBe('')
  })
})
