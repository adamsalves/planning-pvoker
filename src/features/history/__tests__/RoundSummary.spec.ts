import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RoundSummary from '../RoundSummary.vue'
import type { Round } from '@/types'

function makeRound(votes: Round['votes'], subject = 'Login'): Round {
  return { id: 'r1', subject, status: 'revealed', votes }
}

describe('RoundSummary.vue', () => {
  it('deck numérico com consenso: badge de consenso + grid de estatísticas', () => {
    const wrapper = mount(RoundSummary, {
      props: { round: makeRound({ p1: 5, p2: 5, p3: 5 }), roundNumber: 1 },
    })

    expect(wrapper.text()).toContain('Consenso Atingido')
    expect(wrapper.find('.stats-grid').exists()).toBe(true)
    // média, mínimo, máximo, votos
    const values = wrapper.findAll('.stat-value').map((n) => n.text())
    expect(values).toEqual(['5', '5', '5', '3'])
  })

  it('deck numérico sem consenso: badge de dispersão com amplitude (max - min)', () => {
    const wrapper = mount(RoundSummary, {
      props: { round: makeRound({ p1: 2, p2: 8 }), roundNumber: 2 },
    })

    expect(wrapper.text()).not.toContain('Consenso Atingido')
    expect(wrapper.text()).toContain('Dispersão (6)') // 8 - 2
    expect(wrapper.find('.stats-grid').exists()).toBe(true)
  })

  it('deck textual com votos idênticos: mostra consenso (corrige código morto do RoundSummary antigo)', () => {
    const wrapper = mount(RoundSummary, {
      props: { round: makeRound({ p1: 'M', p2: 'M' }), roundNumber: 3 },
    })

    expect(wrapper.text()).toContain('Consenso Atingido')
    // sem grid numérico; lista os votos textuais
    expect(wrapper.find('.stats-grid').exists()).toBe(false)
    expect(wrapper.text()).toContain('Votos textuais: M, M')
  })

  it('deck textual divergente: badge "Dispersão" SEM número (min/max nulos)', () => {
    const wrapper = mount(RoundSummary, {
      props: { round: makeRound({ p1: 'P', p2: 'M' }), roundNumber: 4 },
    })

    expect(wrapper.text()).not.toContain('Consenso Atingido')
    expect(wrapper.text()).toContain('Dispersão')
    expect(wrapper.text()).not.toContain('Dispersão (')
    expect(wrapper.find('.stats-grid').exists()).toBe(false)
    expect(wrapper.text()).toContain('Votos textuais: P, M')
  })
})
