import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RoundHeader from '../RoundHeader.vue'

describe('RoundHeader.vue', () => {
  it('renders subject, progress, and default waiting status', () => {
    const wrapper = mount(RoundHeader, {
      props: {
        subject: 'Implement Login',
        roundNumber: 2,
        totalSubjects: 5,
        status: 'waiting',
      },
    })

    expect(wrapper.text()).toContain('Implement Login')
    expect(wrapper.text()).toContain('Subject 2/5')
    expect(wrapper.text()).toContain('Aguardando subject')
  })

  it('renders voting status with correct label', () => {
    const wrapper = mount(RoundHeader, {
      props: {
        subject: 'Setup CI',
        roundNumber: 1,
        totalSubjects: 3,
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
        totalSubjects: 1,
        status: 'revealed',
      },
    })

    expect(wrapper.text()).toContain('Votos revelados')
  })

  it('renders progress bar', () => {
    const wrapper = mount(RoundHeader, {
      props: {
        subject: 'Test',
        roundNumber: 3,
        totalSubjects: 5,
        status: 'voting',
      },
    })

    const progressFill = wrapper.find('.progress-fill')
    expect(progressFill.exists()).toBe(true)
    expect(progressFill.attributes('style')).toContain('width: 60%')
  })
})
