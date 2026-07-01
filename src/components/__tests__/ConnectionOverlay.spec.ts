import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import ConnectionOverlay from '../ConnectionOverlay.vue'
import { useConnectionStore } from '@/stores/connection'

describe('ConnectionOverlay.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function overlay(wrapper: ReturnType<typeof mount>) {
    return wrapper.find('.connection-overlay')
  }

  it('appears only after the show delay while connecting', async () => {
    useConnectionStore() // default status 'connecting' → waiting
    const wrapper = mount(ConnectionOverlay)

    // Debounced: nothing right away (avoids flashing on fast connects).
    expect(overlay(wrapper).exists()).toBe(false)

    vi.advanceTimersByTime(500)
    await nextTick()
    expect(overlay(wrapper).exists()).toBe(true)
  })

  it('never appears when the connection resolves before the delay', async () => {
    const store = useConnectionStore()
    const wrapper = mount(ConnectionOverlay)

    vi.advanceTimersByTime(300) // still within the debounce window
    store.setConnected()
    await nextTick()
    vi.advanceTimersByTime(500)
    await nextTick()

    expect(overlay(wrapper).exists()).toBe(false)
  })

  it('stays visible for a minimum time once shown', async () => {
    const store = useConnectionStore()
    const wrapper = mount(ConnectionOverlay)

    vi.advanceTimersByTime(500)
    await nextTick()
    expect(overlay(wrapper).exists()).toBe(true)

    // Connected almost immediately — overlay must not flicker away at once.
    store.setConnected()
    await nextTick()
    expect(overlay(wrapper).exists()).toBe(true)

    vi.advanceTimersByTime(1000)
    await nextTick()
    expect(overlay(wrapper).exists()).toBe(false)
  })

  it('exposes a status role with a stable live-region announcement', async () => {
    useConnectionStore()
    const wrapper = mount(ConnectionOverlay)
    vi.advanceTimersByTime(500)
    await nextTick()

    const el = overlay(wrapper)
    expect(el.attributes('role')).toBe('status')
    expect(el.attributes('aria-live')).toBe('polite')
    expect(el.attributes('aria-busy')).toBe('true')
    // Decorative copy is aria-hidden; the announced text is stable.
    expect(wrapper.find('.overlay-message').attributes('aria-hidden')).toBe('true')
    expect(wrapper.find('.sr-only').text()).toContain('Conectando ao servidor')
  })

  it('rotates the decorative copy over time', async () => {
    useConnectionStore()
    const wrapper = mount(ConnectionOverlay)
    vi.advanceTimersByTime(500)
    await nextTick()
    const first = wrapper.find('.overlay-message').text()

    vi.advanceTimersByTime(2500)
    await nextTick()
    expect(wrapper.find('.overlay-message').text()).not.toBe(first)
  })

  it('switches to the "taking longer" copy when the store is down', async () => {
    const store = useConnectionStore()
    const wrapper = mount(ConnectionOverlay)
    vi.advanceTimersByTime(500)
    await nextTick()

    for (let i = 0; i < 5; i++) store.registerFailedAttempt()
    await nextTick()

    expect(wrapper.find('.overlay-message').text()).toContain('demorando mais que o normal')
    expect(wrapper.find('.sr-only').text()).toContain('demorando mais que o normal')
    // Still a loading state, not an error: the overlay remains visible.
    expect(overlay(wrapper).exists()).toBe(true)
  })
})
