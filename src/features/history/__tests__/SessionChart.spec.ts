import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SessionChart from '../SessionChart.vue'
import type { SessionHistory } from '@/stores/history'

function session(rounds: SessionHistory['rounds']): SessionHistory {
  return { id: 's1', date: new Date().toISOString(), roomId: 'r', deckType: 'x', rounds }
}

// O <Bar> do vue-chartjs precisa de um canvas (indisponível no jsdom) — stubamos.
const mountChart = (s: SessionHistory) =>
  mount(SessionChart, { props: { session: s }, global: { stubs: { Bar: true } } })

describe('SessionChart.vue', () => {
  it('renders the average chart for a numeric deck', () => {
    const wrapper = mountChart(
      session([{ id: 'r1', subject: 'A', status: 'revealed', votes: { p1: 5, p2: 8 } }]),
    )

    expect(wrapper.find('.chart-empty').exists()).toBe(false)
  })

  it('hides the misleading average chart for a non-numeric deck', () => {
    const wrapper = mountChart(
      session([{ id: 'r1', subject: 'A', status: 'revealed', votes: { p1: 'M', p2: 'G' } }]),
    )

    expect(wrapper.find('.chart-empty').exists()).toBe(true)
    expect(wrapper.text()).toContain('não-numéricos')
  })

  it('shows a neutral message for a session without any votes', () => {
    const wrapper = mountChart(session([{ id: 'r1', subject: 'A', status: 'voting', votes: {} }]))

    expect(wrapper.find('.chart-empty').exists()).toBe(true)
    expect(wrapper.text()).toContain('Ainda não há votos')
  })
})
