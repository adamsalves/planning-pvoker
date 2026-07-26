import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import IconNotepadText from '~icons/lucide/notepad-text'
import RoomSummary from '../RoomSummary.vue'
import VoteReveal from '../VoteReveal.vue'
import { useRoomStore } from '@/stores/room'
import type { Room, Round } from '@/types'
import { must } from '@/test-utils/must'

function round(
  id: string,
  subject: string,
  status: Round['status'],
  votes: Record<string, string | number> = {},
): Round {
  return { id, subject, status, votes }
}

function makeRoom(rounds: Round[]): Room {
  return {
    id: 'r1',
    adminId: 'p1',
    config: { deckType: 'fibonacci', autoReveal: false },
    players: [{ id: 'p1', name: 'Ana', role: 'admin' }],
    subjects: rounds.map((r) => r.subject),
    phase: 'voting',
    rounds,
    currentRoundIndex: rounds.length - 1,
  }
}

// VoteReveal usa canvas-confetti/matchMedia; stubado (como no RoomView.spec).
function mountSummary(rounds: Round[]) {
  setActivePinia(createPinia())
  useRoomStore().syncRoom(makeRoom(rounds))
  return mount(RoomSummary, { global: { stubs: { VoteReveal: true } } })
}

describe('RoomSummary.vue (live room summary)', () => {
  it('shows the empty state when no round has been revealed yet', () => {
    const wrapper = mountSummary([round('a', 'Login', 'voting', { p1: 5 })])
    expect(wrapper.text()).toContain('Nenhuma rodada concluída ainda')
    expect(wrapper.findComponent(VoteReveal).exists()).toBe(false)
  })

  it('renders only revealed rounds and hides the in-progress one (no vote leak)', () => {
    const wrapper = mountSummary([
      round('a', 'Login', 'revealed', { p1: 5, p2: 5 }),
      round('b', 'Checkout', 'voting', { p1: 8 }),
    ])
    const cards = wrapper.findAllComponents(VoteReveal)
    expect(cards).toHaveLength(1)
    expect(wrapper.text()).toContain('Login')
    expect(wrapper.text()).not.toContain('Checkout')
    // Os votos passados são os da rodada REVELADA — nunca os da rodada em votação.
    expect(must(cards[0], 'first VoteReveal card').props('votes')).toEqual({ p1: 5, p2: 5 })
  })

  it('numbers rounds by their real position, not the filtered subset', () => {
    const wrapper = mountSummary([
      round('a', 'Login', 'revealed', { p1: 5 }),
      round('b', 'Checkout', 'revealed', { p1: 8 }),
      round('c', 'Search', 'voting', { p1: 3 }),
    ])
    expect(wrapper.findAllComponents(VoteReveal)).toHaveLength(2)
    expect(wrapper.text()).toContain('Rodada 1')
    expect(wrapper.text()).toContain('Rodada 2')
    expect(wrapper.text()).not.toContain('Rodada 3')
  })

  it('passes celebrate=false so the recap never fires confetti', () => {
    const wrapper = mountSummary([round('a', 'Login', 'revealed', { p1: 5 })])
    expect(wrapper.findComponent(VoteReveal).props('celebrate')).toBe(false)
  })

  it('o ícone do estado vazio é decorativo e some quando há recaps', () => {
    const vazio = mountSummary([round('a', 'Login', 'voting', { p1: 5 })])
    const icon = vazio.findComponent(IconNotepadText)
    expect(icon.exists()).toBe(true)
    expect(icon.attributes('aria-hidden')).toBe('true')

    const comRecap = mountSummary([round('a', 'Login', 'revealed', { p1: 5 })])
    expect(comRecap.findComponent(IconNotepadText).exists()).toBe(false)
  })
})
