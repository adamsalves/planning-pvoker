import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HomeView from '../HomeView.vue'

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

  it('shows a notice when redirected after an invalid session', () => {
    routeQuery = { notice: 'session-expired' }

    const wrapper = mount(HomeView)

    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Sua sessão expirou')
  })

  it('does not show the session notice without the query flag', () => {
    const wrapper = mount(HomeView)

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('keeps the auto-reveal checkbox focusable instead of display:none', () => {
    const wrapper = mount(HomeView)

    expect(wrapper.find('input.toggle-input').classes()).toContain('sr-only')
  })

  it('keeps the auto-reveal checkbox operable by keyboard (tab order + real activation event)', async () => {
    const wrapper = mount(HomeView)
    const checkbox = wrapper.find<HTMLInputElement>('input.toggle-input')

    // Nem disabled nem fora da ordem de tabulação — o que faria um leitor de tela/teclado pular o campo.
    expect(checkbox.attributes('disabled')).toBeUndefined()
    expect(checkbox.attributes('tabindex')).not.toBe('-1')
    expect(checkbox.element.checked).toBe(false)

    // Espaço/Enter num checkbox focado dispara o mesmo evento 'change' que setValue simula aqui.
    await checkbox.setValue(true)

    expect(checkbox.element.checked).toBe(true)
  })
})
