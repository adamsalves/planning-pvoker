import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useLocaleStore } from './locale'
import { i18n } from '@/i18n'

// O vitest.setup fixa navigator.language = 'pt-BR'; testes de detecção sobrescrevem
// localmente e restauram no afterEach para não vazar para os demais.
function setNavigatorLanguage(value: string) {
  Object.defineProperty(window.navigator, 'language', { configurable: true, value })
}

describe('locale store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    setNavigatorLanguage('pt-BR')
    i18n.global.locale.value = 'pt-BR'
    document.documentElement.lang = 'pt-BR'
  })

  it('detecta pt-BR para navegadores em português (qualquer variante)', () => {
    setNavigatorLanguage('pt-PT')
    expect(useLocaleStore().locale).toBe('pt-BR')
  })

  it('detecta en para navegadores em outros idiomas', () => {
    setNavigatorLanguage('fr-FR')
    expect(useLocaleStore().locale).toBe('en')
  })

  it('aplica o locale ao i18n global e ao <html lang> já na criação', () => {
    useLocaleStore()
    expect(i18n.global.locale.value).toBe('pt-BR')
    expect(document.documentElement.lang).toBe('pt-BR')
  })

  it('toggle alterna pt-BR ⇄ en e sincroniza i18n + <html lang>', async () => {
    const store = useLocaleStore()

    store.toggle()
    // O watch da store roda no próximo tick do scheduler do Vue.
    await nextTick()
    expect(store.locale).toBe('en')
    expect(i18n.global.locale.value).toBe('en')
    expect(document.documentElement.lang).toBe('en')

    store.toggle()
    await nextTick()
    expect(store.locale).toBe('pt-BR')
    expect(i18n.global.locale.value).toBe('pt-BR')
  })

  it('setLocale define o idioma diretamente', async () => {
    const store = useLocaleStore()
    store.setLocale('en')
    await nextTick()
    expect(i18n.global.locale.value).toBe('en')
  })
})
