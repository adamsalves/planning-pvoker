import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PokerTable from '../PokerTable.vue'
import PokerCard from '../PokerCard.vue'
import type { Player } from '@/types'

describe('PokerTable.vue', () => {
  const mockPlayers: Player[] = [
    { id: '1', name: 'Adam', role: 'admin' },
    { id: '2', name: 'Eve', role: 'member' },
    { id: '3', name: 'Snake', role: 'observer' },
  ]

  it('filters out observers from the table', () => {
    const wrapper = mount(PokerTable, {
      props: {
        players: mockPlayers,
        votes: {},
        status: 'waiting',
      },
    })

    // Should render only 2 player spots
    const spots = wrapper.findAll('.player-spot')
    expect(spots).toHaveLength(2)
    expect(wrapper.text()).toContain('Adam')
    expect(wrapper.text()).toContain('Eve')
    expect(wrapper.text()).not.toContain('Snake')
  })

  it('renders face-down cards for players who voted during voting phase', () => {
    const wrapper = mount(PokerTable, {
      props: {
        players: mockPlayers,
        votes: { '1': 8 }, // Only Adam voted
        status: 'voting',
      },
    })

    // 1 card should be rendered
    const cards = wrapper.findAllComponents(PokerCard)
    expect(cards).toHaveLength(1)

    // It should be face-down
    expect(cards[0]!.props('faceDown')).toBe(true)

    // 1 empty slot for Eve
    const emptySlots = wrapper.findAll('.empty-card-slot')
    expect(emptySlots).toHaveLength(1)
  })

  it('renders face-up values when revealed', () => {
    const wrapper = mount(PokerTable, {
      props: {
        players: mockPlayers,
        votes: { '1': 8, '2': 5 },
        status: 'revealed',
      },
    })

    const cards = wrapper.findAllComponents(PokerCard)
    expect(cards).toHaveLength(2)

    // Cards should NOT be face down
    expect(cards[0]!.props('faceDown')).toBe(false)
    expect(cards[1]!.props('faceDown')).toBe(false)

    // Values should match
    const valuesRendered = wrapper.text()
    expect(valuesRendered).toContain('8')
    expect(valuesRendered).toContain('5')
  })

  it('shows appropriate messages in the center of the table', () => {
    const wrapperWaiting = mount(PokerTable, {
      props: { players: [], votes: {}, status: 'waiting' },
    })
    expect(wrapperWaiting.text()).toContain('Aguardando rodada...')

    const wrapperVoting = mount(PokerTable, {
      props: { players: [], votes: {}, status: 'voting' },
    })
    expect(wrapperVoting.text()).toContain('Votos em andamento')

    const wrapperRevealed = mount(PokerTable, {
      props: { players: [], votes: {}, status: 'revealed' },
    })
    expect(wrapperRevealed.text()).toContain('Votos revelados!')
  })
})
