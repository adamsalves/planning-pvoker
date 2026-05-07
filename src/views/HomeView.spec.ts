import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HomeView from './HomeView.vue'

let routeQuery: Record<string, string | string[] | undefined> = {}

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: routeQuery,
  }),
}))

vi.mock('@/composables/useRoom', () => ({
  useRoom: () => ({
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
  }),
}))

describe('HomeView.vue', () => {
  beforeEach(() => {
    routeQuery = {}
  })

  it('opens join form with room code from shared link query', () => {
    routeQuery = { room: 'abc123' }

    const wrapper = mount(HomeView)

    const roomCodeInput = wrapper.find<HTMLInputElement>('input[placeholder="Ex: a1b2c3d4"]')

    expect(wrapper.text()).toContain('Entrar como')
    expect(roomCodeInput.exists()).toBe(true)
    expect(roomCodeInput.element.value).toBe('abc123')
  })
})
