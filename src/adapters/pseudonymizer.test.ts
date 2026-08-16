import { describe, expect, it } from 'vitest'
import type { Pseudonymizer } from './pseudonymizer.js'

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

describe('Pseudonymizer', () => {
  it('returns a stable fake for the same real value', () => {
    const p = fakePseudonymizer()
    const a = p.swap('real@x.com')
    const b = p.swap('real@x.com')
    expect(a).toBe(b)
  })

  it('returns different fakes for different real values', () => {
    const p = fakePseudonymizer()
    expect(p.swap('real@x.com')).not.toBe(p.swap('other@x.com'))
  })

  it('restores the original real value from its fake', () => {
    const p = fakePseudonymizer()
    const fake = p.swap('real@x.com')
    expect(p.tryRestore(fake)).toBe('real@x.com')
  })

  it('fails closed on a token it never issued', () => {
    const p = fakePseudonymizer()
    expect(p.tryRestore('never-issued-token')).toBeUndefined()
  })
})
