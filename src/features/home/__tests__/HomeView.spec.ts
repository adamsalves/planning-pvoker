import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HomeView from '../HomeView.vue'
import { useRoomStore } from '@/stores/room'
import type { Room } from '@/types'

let routeQuery: Record<string, string | string[] | undefined> = {}

function activeRoom(): Room {
  return {
    id: 'abc123',
    adminId: 'p1',
    config: { deckType: 'fibonacci', autoReveal: false },
    players: [],
    subjects: [],
    phase: 'voting',
    rounds: [],
    currentRoundIndex: -1,
  }
}

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
    // HomeView passou a ler o roomStore (banner F5.4), então precisa de Pinia ativo.
    setActivePinia(createPinia())
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

  // F5.4 — banner de sala ativa (navegar pra Home não sai da sala).
  it('shows the active-room banner linking back to the room when a session is active', () => {
    useRoomStore().syncRoom(activeRoom())
    const wrapper = mount(HomeView, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    })

    const banner = wrapper
      .findAllComponents(RouterLinkStub)
      .find((c) => c.classes().includes('room-notice'))
    expect(banner).toBeDefined()
    expect(banner?.props('to')).toBe('/room/abc123')
    expect(banner?.text()).toContain('Você está numa sala')
  })

  it('hides the active-room banner when there is no active room', () => {
    const wrapper = mount(HomeView, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    expect(wrapper.find('.room-notice').exists()).toBe(false)
  })
})
