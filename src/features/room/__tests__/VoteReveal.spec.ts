import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import IconPartyPopper from '~icons/lucide/party-popper'
import VoteReveal from '../VoteReveal.vue'
import confetti from 'canvas-confetti'
import { must } from '@/test-utils/must'

// Mocking canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}))

describe('VoteReveal.vue', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calculates average, min and max correctly', () => {
    const wrapper = mount(VoteReveal, {
      props: {
        votes: { p1: 5, p2: 8, p3: 2 },
        playerCount: 4,
      },
    })

    // Average of 5, 8, 2 is 15 / 3 = 5
    expect(wrapper.text()).toContain('5')
    // Min is 2
    expect(wrapper.text()).toContain('2')
    // Max is 8
    expect(wrapper.text()).toContain('8')
    // Count is 3/4
    expect(wrapper.text()).toContain('3/4')
  })

  it('shows only the vote count when playerCount is omitted (historical recap)', () => {
    const wrapper = mount(VoteReveal, {
      props: {
        votes: { p1: 5, p2: 8 },
        celebrate: false,
      },
    })

    // Sem denominador: o total atual de jogadores não vale para rodadas passadas
    // (quem votou pode ter saído — "2/1" mentiria).
    const voteStat = must(wrapper.findAll('.stat-card').at(-1), 'last stat card')
    expect(voteStat.text()).toContain('Votos')
    expect(voteStat.find('.stat-value').text()).toBe('2')
  })

  it('renders distribution bars correctly ordered', () => {
    const wrapper = mount(VoteReveal, {
      props: {
        votes: { p1: 8, p2: 8, p3: 5, p4: 8, p5: 1 },
        playerCount: 5,
      },
    })

    // It should render distribution rows
    const rows = wrapper.findAll('.bar-row')
    expect(rows).toHaveLength(3) // unique values: '8', '5', '1'

    // The most frequent '8' (count 3) should be first
    expect(must(rows[0], 'bar row 0').find('.bar-label').text()).toBe('8')
    expect(must(rows[0], 'bar row 0').find('.bar-count').text()).toBe('3')

    // '5' and '1' have count 1 each
    expect(must(rows[1], 'bar row 1').find('.bar-count').text()).toBe('1')
  })

  it('ignores non-numeric votes for stats but includes in distribution', () => {
    const wrapper = mount(VoteReveal, {
      props: {
        votes: { p1: 3, p2: '☕' },
        playerCount: 2,
      },
    })

    // Average, min, max should be 3
    // But distribution should show ☕
    expect(wrapper.text()).toContain('☕')
  })

  it('detects consensus and fires confetti on mount', () => {
    mount(VoteReveal, {
      props: {
        votes: { p1: 5, p2: 5, p3: 5 },
        playerCount: 3,
      },
    })

    expect(confetti).toHaveBeenCalled()
  })

  it('does not fire confetti when celebrate is false (used in the session summary)', () => {
    vi.mocked(confetti).mockClear()

    mount(VoteReveal, {
      props: {
        votes: { p1: 5, p2: 5, p3: 5 },
        playerCount: 3,
        celebrate: false,
      },
    })

    expect(confetti).not.toHaveBeenCalled()
  })

  it('does not fire confetti when the user prefers reduced motion', () => {
    vi.mocked(confetti).mockClear()
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    )

    const wrapper = mount(VoteReveal, {
      props: {
        votes: { p1: 5, p2: 5, p3: 5 },
        playerCount: 3,
      },
    })

    expect(confetti).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Consenso!')
  })

  it('shows consensus banner', () => {
    const wrapper = mount(VoteReveal, {
      props: {
        votes: { p1: 13, p2: 13 },
        playerCount: 2,
      },
    })

    expect(wrapper.text()).toContain('Consenso!')
    expect(wrapper.find('.consensus-value').text()).toBe('13')
  })

  it('does not show consensus banner when votes diverge', () => {
    const wrapper = mount(VoteReveal, {
      props: {
        votes: { p1: 13, p2: 8 },
        playerCount: 2,
      },
    })

    expect(wrapper.text()).not.toContain('Consenso!')
  })

  it('voto único não é consenso: sem banner nem confetti (rodada de 1 votante)', () => {
    // Um voto sozinho não é consenso — não há com quem concordar. Antes dava
    // banner + confetti falsos numa rodada de 1 votante. Regressão.
    vi.mocked(confetti).mockClear()

    const wrapper = mount(VoteReveal, {
      props: {
        votes: { p1: 5 },
        playerCount: 1,
      },
    })

    expect(wrapper.text()).not.toContain('Consenso!')
    expect(wrapper.findComponent(IconPartyPopper).exists()).toBe(false)
    expect(confetti).not.toHaveBeenCalled()
  })

  it('flip 1→2 votos iguais: banner e confetti disparam quando o consenso passa a valer', async () => {
    // Guarda o watch(hasConsensus): uma rodada que começa com 1 voto (sem consenso)
    // e ganha um 2º voto igual deve, aí sim, celebrar — o confetti dispara no flip
    // false→true, não só on-mount.
    vi.mocked(confetti).mockClear()

    const wrapper = mount(VoteReveal, {
      props: { votes: { p1: 5 }, playerCount: 2 },
    })

    // 1 voto → ainda não é consenso: sem banner nem confetti.
    expect(wrapper.text()).not.toContain('Consenso!')
    expect(confetti).not.toHaveBeenCalled()

    // Chega o 2º voto igual → consenso passa a valer.
    await wrapper.setProps({ votes: { p1: 5, p2: 5 } })

    expect(wrapper.text()).toContain('Consenso!')
    expect(wrapper.find('.consensus-value').text()).toBe('5')
    expect(confetti).toHaveBeenCalled()
  })

  it('só o banner de consenso traz o party-popper, decorativo', () => {
    const consenso = mount(VoteReveal, { props: { votes: { p1: 5, p2: 5 }, playerCount: 2 } })
    const icon = consenso.findComponent(IconPartyPopper)
    expect(icon.exists()).toBe(true)
    expect(icon.attributes('aria-hidden')).toBe('true')

    const divergente = mount(VoteReveal, { props: { votes: { p1: 13, p2: 8 }, playerCount: 2 } })
    expect(divergente.findComponent(IconPartyPopper).exists()).toBe(false)
  })
})
