import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlayerList from '../PlayerList.vue'
import type { Player } from '@/types'

describe('PlayerList.vue', () => {
  const mockPlayers: Player[] = [
    { id: '1', name: 'Admin', role: 'admin' },
    { id: '2', name: 'Member', role: 'member' },
    { id: '3', name: 'Observer', role: 'observer' },
  ]

  it('separates active players and observers', () => {
    const wrapper = mount(PlayerList, {
      props: {
        players: mockPlayers,
        votes: {},
        status: 'waiting',
      },
    })

    const html = wrapper.html()
    expect(html).toContain('Jogadores (2)')
    expect(html).toContain('Espectadores (1)')
    expect(html).toContain('Admin')
    expect(html).toContain('Member')
    expect(html).toContain('Observer')
  })

  it('shows pending badge during voting without vote', () => {
    const wrapper = mount(PlayerList, {
      props: {
        players: [mockPlayers[1]!],
        votes: {},
        status: 'voting',
      },
    })

    expect(wrapper.text()).toContain('⏳')
  })

  it('shows voted badge during voting with voted', () => {
    const wrapper = mount(PlayerList, {
      props: {
        players: [mockPlayers[1]!],
        votes: { '2': 8 }, // Player 2 voted 8
        status: 'voting',
      },
    })

    expect(wrapper.text()).toContain('✅')
    expect(wrapper.text()).not.toContain('8') // should not show value yet
  })

  it('shows vote value when revealed', () => {
    const wrapper = mount(PlayerList, {
      props: {
        players: [mockPlayers[1]!],
        votes: { '2': 5 },
        status: 'revealed',
      },
    })

    expect(wrapper.text()).toContain('5')
    expect(wrapper.text()).not.toContain('✅')
  })

  it('marks the admin crown as decorative with a sr-only alternative', () => {
    const wrapper = mount(PlayerList, {
      props: { players: [mockPlayers[0]!], votes: {}, status: 'waiting' },
    })

    expect(wrapper.find('.admin-badge').attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toContain('(admin)')
  })

  it('marks status emoji as decorative with sr-only alternatives', () => {
    const wrapper = mount(PlayerList, {
      props: { players: [mockPlayers[1]!], votes: {}, status: 'voting' },
    })

    expect(wrapper.find('.pending-badge [aria-hidden="true"]').exists()).toBe(true)
    expect(wrapper.find('.pending-badge .sr-only').text()).toBe('Aguardando voto')
  })

  it('marks the observer eye icon as decorative with a sr-only alternative', () => {
    const wrapper = mount(PlayerList, {
      props: { players: [mockPlayers[2]!], votes: {}, status: 'waiting' },
    })

    expect(wrapper.find('.observer-badge').attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toContain('Espectador')
  })
})
