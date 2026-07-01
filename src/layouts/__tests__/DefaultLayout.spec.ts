import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import router from '@/router'
import DefaultLayout from '../DefaultLayout.vue'

describe('DefaultLayout.vue', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await router.push('/')
    await router.isReady()
  })

  it('does not move focus to <main> on the initial mount', async () => {
    const wrapper = mount(DefaultLayout, {
      attachTo: document.body,
      global: { plugins: [router], stubs: { RouterView: true } },
    })
    await nextTick()
    await nextTick()

    expect(document.activeElement).not.toBe(wrapper.get('main').element)

    wrapper.unmount()
  })

  it('moves focus to <main> and announces the route title on navigation', async () => {
    const wrapper = mount(DefaultLayout, {
      attachTo: document.body,
      global: { plugins: [router], stubs: { RouterView: true } },
    })

    await router.push({ name: 'history' })
    await nextTick()
    await nextTick()

    const main = wrapper.get('main')
    expect(document.activeElement).toBe(main.element)
    expect(wrapper.find('[aria-live="polite"]').text()).toBe('Histórico')

    wrapper.unmount()
  })

  it('moves focus to <main> when only the route param changes (same route name)', async () => {
    await router.push({ name: 'room', params: { id: 'room-a' } })
    const wrapper = mount(DefaultLayout, {
      attachTo: document.body,
      global: { plugins: [router], stubs: { RouterView: true } },
    })

    await router.push({ name: 'room', params: { id: 'room-b' } })
    await nextTick()
    await nextTick()

    expect(document.activeElement).toBe(wrapper.get('main').element)

    wrapper.unmount()
  })
})
