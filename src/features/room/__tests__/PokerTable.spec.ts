import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PokerTable from '../PokerTable.vue'
import PokerCard from '../PokerCard.vue'
import type { Player } from '@/types'
import { must } from '@/test-utils/must'

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

  it('posiciona cada jogador via --cos/--sin exatos (raios responsivos moram no CSS)', () => {
    const wrapper = mount(PokerTable, {
      props: { players: mockPlayers, votes: {}, status: 'waiting' },
    })

    // 2 ativos (observer filtrado). O CSS faz `var(--cos) * var(--rx)`, então o FORMATO
    // importa — checamos as strings EXATAS (toFixed(4)), não um prefixo frouxo.
    const spots = wrapper.findAll('.player-spot')
    // 1º jogador na base do oval: angle=π/2 → cos=0, sin=1.
    const firstStyle = must(spots[0], 'player spot 0 (Adam)').attributes('style') ?? ''
    expect(firstStyle).toContain('--cos: 0.0000')
    expect(firstStyle).toContain('--sin: 1.0000')
    // 2º jogador no topo: angle=3π/2 → cos=-0 (zero negativo, CSS-válido) e sin=-1.
    const secondStyle = must(spots[1], 'player spot 1 (Eve)').attributes('style') ?? ''
    expect(secondStyle).toContain('--cos: -0.0000')
    expect(secondStyle).toContain('--sin: -1.0000')
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
    expect(must(cards[0], 'poker card 0').props('faceDown')).toBe(true)

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
    expect(must(cards[0], 'poker card 0').props('faceDown')).toBe(false)
    expect(must(cards[1], 'poker card 1').props('faceDown')).toBe(false)

    // Values should match
    const valuesRendered = wrapper.text()
    expect(valuesRendered).toContain('8')
    expect(valuesRendered).toContain('5')
  })

  it('exposes a sr-only vote status per player during voting', () => {
    const wrapper = mount(PokerTable, {
      props: { players: mockPlayers, votes: { '1': 8 }, status: 'voting' },
    })

    const spots = wrapper.findAll('.player-spot')
    expect(must(spots[0], 'player spot 0 (Adam)').find('.sr-only').text()).toContain('Votou')
    expect(must(spots[1], 'player spot 1 (Eve)').find('.sr-only').text()).toContain(
      'Aguardando voto',
    )
  })

  it('announces the revealed vote value via sr-only and hides the decorative card', () => {
    const wrapper = mount(PokerTable, {
      props: { players: mockPlayers, votes: { '1': 8 }, status: 'revealed' },
    })

    // O valor revelado é anunciado no name tag ("Votou 8")...
    const spots = wrapper.findAll('.player-spot')
    expect(must(spots[0], 'player spot 0 (Adam)').find('.sr-only').text()).toBe('Votou 8')
    // ...e quem não votou não ganha anúncio nenhum
    expect(must(spots[1], 'player spot 1 (Eve)').find('.sr-only').exists()).toBe(false)

    // A carta da mesa é decorativa: botão desabilitado sem ação, fora da árvore de a11y
    const card = wrapper.findComponent(PokerCard)
    expect(card.attributes('aria-hidden')).toBe('true')
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

  describe('tirado da rodada', () => {
    // A diferença que importa em relação ao espectador: o espectador SOME da
    // mesa, o tirado da rodada CONTINUA sentado — só muda de estado visual.
    it('continua sentado à mesa, ao contrário do espectador', () => {
      const wrapper = mount(PokerTable, {
        props: { players: mockPlayers, votes: {}, status: 'voting', nonVoterIds: ['2'] },
      })

      expect(wrapper.findAll('.player-spot')).toHaveLength(2)
      expect(wrapper.text()).toContain('Eve')
      expect(wrapper.findAll('.non-voter-spot')).toHaveLength(1)
    })

    it('anuncia "não vota" em vez de "aguardando voto"', () => {
      const wrapper = mount(PokerTable, {
        props: {
          players: [must(mockPlayers[1], 'mock player 1 (Eve)')],
          votes: {},
          status: 'voting',
          nonVoterIds: ['2'],
        },
      })

      expect(wrapper.text()).toContain('Não vota nesta rodada')
      expect(wrapper.text()).not.toContain('Aguardando voto')
    })

    it('sem nonVoterIds nenhum assento fica marcado (default da prop)', () => {
      const wrapper = mount(PokerTable, {
        props: { players: mockPlayers, votes: {}, status: 'voting' },
      })
      expect(wrapper.findAll('.non-voter-spot')).toHaveLength(0)
    })
  })
})
