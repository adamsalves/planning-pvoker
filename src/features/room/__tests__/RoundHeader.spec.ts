import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RoundHeader from '../RoundHeader.vue'

describe('RoundHeader.vue', () => {
  it('renders subject, round numbers, and default waiting status', () => {
    const wrapper = mount(RoundHeader, {
      props: {
        subject: 'Implement Login',
        roundNumber: 2,
        totalRounds: 5,
        status: 'waiting',
      },
    })

    expect(wrapper.text()).toContain('Implement Login')
    expect(wrapper.text()).toContain('Rodada 2/5')
    expect(wrapper.text()).toContain('Aguardando subject')
  })

  it('renders voting status with correct label', () => {
    const wrapper = mount(RoundHeader, {
      props: {
        subject: 'Setup CI',
        roundNumber: 1,
        totalRounds: 1,
        status: 'voting',
      },
    })

    expect(wrapper.text()).toContain('Votação em andamento')
  })

  it('renders revealed status with correct label', () => {
    const wrapper = mount(RoundHeader, {
      props: {
        subject: 'Setup CI',
        roundNumber: 1,
        totalRounds: 1,
        status: 'revealed',
      },
    })

    expect(wrapper.text()).toContain('Votos revelados')
  })
})
