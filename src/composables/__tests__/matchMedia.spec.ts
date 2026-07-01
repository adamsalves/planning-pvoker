import { afterEach, describe, expect, it, vi } from 'vitest'
import { canMatchMedia, prefersReducedMotion } from '../matchMedia'

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

describe('matchMedia', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('canMatchMedia é true quando window.matchMedia existe', () => {
    stubMatchMedia(false)
    expect(canMatchMedia()).toBe(true)
  })

  it('canMatchMedia é false quando matchMedia é indisponível (jsdom/SSR)', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(canMatchMedia()).toBe(false)
  })

  it('prefersReducedMotion reflete o resultado de matchMedia quando disponível', () => {
    stubMatchMedia(true)
    expect(prefersReducedMotion()).toBe(true)

    stubMatchMedia(false)
    expect(prefersReducedMotion()).toBe(false)
  })

  it('prefersReducedMotion não quebra e resolve para false sem matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(() => prefersReducedMotion()).not.toThrow()
    expect(prefersReducedMotion()).toBe(false)
  })
})
