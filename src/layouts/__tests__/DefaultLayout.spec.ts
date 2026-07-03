import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import router from '@/router'
import DefaultLayout from '../DefaultLayout.vue'

let wrapper: VueWrapper | undefined

function mountLayout() {
  wrapper = mount(DefaultLayout, {
    attachTo: document.body,
    global: { plugins: [router], stubs: { RouterView: true } },
  })
  return wrapper
}

describe('DefaultLayout.vue', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await router.push('/')
    await router.isReady()
  })

  // Desmontar sempre no afterEach (não inline): se uma asserção falhar no meio, o
  // attachTo deixaria o layout órfão no document.body, poluindo os testes seguintes.
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  it('does not move focus to <main> on the initial mount', async () => {
    const w = mountLayout()
    await nextTick()
    await nextTick()

    expect(document.activeElement).not.toBe(w.get('main').element)
  })

  it('moves focus to <main> and announces the route title on navigation', async () => {
    const w = mountLayout()

    await router.push({ name: 'history' })
    await nextTick()
    await nextTick()

    expect(document.activeElement).toBe(w.get('main').element)
    expect(w.find('[aria-live="polite"]').text()).toBe('Histórico')
  })

  it('moves focus to <main> and announces "Sala {código}" when only the route param changes', async () => {
    await router.push({ name: 'room', params: { id: 'room-a' } })
    const w = mountLayout()

    await router.push({ name: 'room', params: { id: 'room-b' } })
    await nextTick()
    await nextTick()

    expect(document.activeElement).toBe(w.get('main').element)
    expect(w.find('[aria-live="polite"]').text()).toBe('Sala room-b')
  })

  // F8 — toggle de idioma na navbar. O i18n é o singleton do app (instalado no
  // vitest.setup), então o teste restaura pt-BR ao final para não vazar.
  it('switches the UI language via the navbar locale toggle', async () => {
    const w = mountLayout()

    const toggle = w.get('.locale-toggle')
    expect(toggle.text()).toBe('EN') // mostra o idioma ALVO
    expect(w.text()).toContain('Histórico')

    await toggle.trigger('click')
    await nextTick()

    expect(toggle.text()).toBe('PT')
    expect(w.text()).toContain('History')
    expect(w.text()).not.toContain('Histórico')
    expect(document.documentElement.lang).toBe('en')

    await toggle.trigger('click')
    await nextTick()
    expect(w.text()).toContain('Histórico')
    expect(document.documentElement.lang).toBe('pt-BR')
  })
})
