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
})
