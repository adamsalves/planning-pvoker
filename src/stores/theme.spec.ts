import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { useThemeStore } from './theme'

// jsdom não implementa matchMedia; este stub simula a preferência do SO e o evento 'change'.
function stubMatchMedia(initialMatches: boolean) {
  const state = { matches: initialMatches }
  const listeners = new Set<() => void>()
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      get matches() {
        return state.matches
      },
      media: '(prefers-color-scheme: dark)',
      addEventListener: (_type: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_type: string, cb: () => void) => listeners.delete(cb),
    })),
  )
  return {
    setMatches: (value: boolean) => {
      state.matches = value
    },
    fireChange: () => listeners.forEach((cb) => cb()),
  }
}

describe('theme store', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    const pinia = createPinia()
    pinia.use(piniaPluginPersistedstate)
    setActivePinia(pinia)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('inicia em "system" e resolve para dark quando o SO prefere dark', () => {
    stubMatchMedia(true)
    const store = useThemeStore()
    expect(store.preference).toBe('system')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('resolve "system" para light quando o SO prefere light', () => {
    stubMatchMedia(false)
    useThemeStore()
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('cycle percorre system → light → dark → system', () => {
    stubMatchMedia(false)
    const store = useThemeStore()
    store.cycle()
    expect(store.preference).toBe('light')
    store.cycle()
    expect(store.preference).toBe('dark')
    store.cycle()
    expect(store.preference).toBe('system')
  })

  it('setPreference aplica o tema escolhido ao <html>', async () => {
    stubMatchMedia(false)
    const store = useThemeStore()
    store.setPreference('dark')
    await nextTick()
    expect(document.documentElement.dataset.theme).toBe('dark')
    store.setPreference('light')
    await nextTick()
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('reage à troca de tema do SO quando em "system"', () => {
    const mm = stubMatchMedia(false)
    useThemeStore()
    expect(document.documentElement.dataset.theme).toBe('light')
    mm.setMatches(true)
    mm.fireChange()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  // A persistência em si (escrita/leitura do localStorage) é do pinia-plugin-persistedstate
  // e foi confirmada no browser (toggle grava `theme` e o reload mantém o tema). Estes
  // testes cobrem a lógica própria da store; o plugin não hidrata fora de um app Vue real.

  it('não quebra quando matchMedia é indisponível (resolve para light)', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(() => useThemeStore()).not.toThrow()
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
