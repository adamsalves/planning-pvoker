import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import IconCheck from '~icons/lucide/check'
import IconHourglass from '~icons/lucide/hourglass'
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

  // Os badges de status são ícones (SVG), não mais emoji. A asserção alveja o ícone
  // ESPECÍFICO (não "algum svg"): trocar um pelo outro inverte o significado do badge
  // — "votou" onde deveria ser "aguardando" — e o teste tem de pegar isso.
  it('shows pending badge during voting without vote', () => {
    const wrapper = mount(PlayerList, {
      props: {
        players: [mockPlayers[1]!],
        votes: {},
        status: 'voting',
      },
    })

    const badge = wrapper.find('.pending-badge')
    expect(badge.findComponent(IconHourglass).exists()).toBe(true)
    expect(badge.findComponent(IconCheck).exists()).toBe(false)
    expect(wrapper.text()).toContain('Aguardando voto')
  })

  it('shows voted badge during voting with voted', () => {
    const wrapper = mount(PlayerList, {
      props: {
        players: [mockPlayers[1]!],
        votes: { '2': 8 }, // Player 2 voted 8
        status: 'voting',
      },
    })

    const badge = wrapper.find('.voted-badge')
    expect(badge.findComponent(IconCheck).exists()).toBe(true)
    expect(badge.findComponent(IconHourglass).exists()).toBe(false)
    expect(wrapper.text()).toContain('Votou')
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
    expect(wrapper.find('.voted-badge').exists()).toBe(false)
  })

  it('marks the admin crown as decorative with a sr-only alternative', () => {
    const wrapper = mount(PlayerList, {
      props: { players: [mockPlayers[0]!], votes: {}, status: 'waiting' },
    })

    expect(wrapper.find('.admin-badge').attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toContain('(admin)')
  })

  it('marks status icons as decorative with sr-only alternatives', () => {
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

  describe('quem vota na rodada', () => {
    it('só mostra o toggle quando votersEditable', () => {
      const semToggle = mount(PlayerList, {
        props: { players: mockPlayers, votes: {}, status: 'voting' },
      })
      // Default false: o RoomSetup usa o mesmo componente e não tem rodada.
      expect(semToggle.find('.voter-toggle').exists()).toBe(false)

      const comToggle = mount(PlayerList, {
        props: { players: mockPlayers, votes: {}, status: 'voting', votersEditable: true },
      })
      // Um por jogador ativo — espectadores não entram na escolha.
      expect(comToggle.findAll('.voter-toggle')).toHaveLength(2)
    })

    it('emite toggle-voter com o estado OPOSTO ao atual', async () => {
      const wrapper = mount(PlayerList, {
        props: {
          players: mockPlayers,
          votes: {},
          status: 'voting',
          nonVoterIds: ['2'],
          votersEditable: true,
        },
      })

      const boxes = wrapper.findAll('.voter-toggle input')
      // Admin ('1') vota → marcado; Member ('2') excluído → desmarcado.
      expect(boxes[0]!.attributes('checked')).toBeDefined()
      expect(boxes[1]!.attributes('checked')).toBeUndefined()

      // Tirar quem vota pede voting=false; devolver quem está fora pede true.
      await boxes[0]!.trigger('change')
      expect(wrapper.emitted('toggle-voter')?.[0]).toEqual(['1', false])
      await boxes[1]!.trigger('change')
      expect(wrapper.emitted('toggle-voter')?.[1]).toEqual(['2', true])
    })

    it('mostra "não vota" no lugar de pendente, sem sair da seção de jogadores', () => {
      const wrapper = mount(PlayerList, {
        props: {
          players: [mockPlayers[1]!],
          votes: {},
          status: 'voting',
          nonVoterIds: ['2'],
        },
      })

      const badge = wrapper.find('.non-voter-badge')
      expect(badge.exists()).toBe(true)
      expect(badge.find('.sr-only').text()).toBe('Não vota nesta rodada')
      // Não pode aparecer como "aguardando voto": ninguém espera o voto dele.
      expect(wrapper.find('.pending-badge').exists()).toBe(false)
      // E segue contando como jogador, não como espectador.
      expect(wrapper.html()).toContain('Jogadores (1)')
    })
  })
})
