import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RoundControls from '../RoundControls.vue'

describe('RoundControls.vue', () => {
  it('shows reveal button during voting status', () => {
    const wrapper = mount(RoundControls, {
      props: { status: 'voting', allVoted: false, isLastSubject: false },
    })

    const revealBtn = wrapper.find('button')
    expect(revealBtn.exists()).toBe(true)
    expect(revealBtn.text()).toContain('Revelar Votos')
    expect(revealBtn.text()).not.toContain('(todos votaram!)')
  })

  it('shows "todos votaram" hint when allVoted is true', () => {
    const wrapper = mount(RoundControls, {
      props: { status: 'voting', allVoted: true, isLastSubject: false },
    })

    expect(wrapper.text()).toContain('(todos votaram!)')
  })

  it('emits "reveal" when reveal button is clicked', async () => {
    const wrapper = mount(RoundControls, {
      props: { status: 'voting', allVoted: true, isLastSubject: false },
    })

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted()).toHaveProperty('reveal')
  })

  it('shows "Próximo Subject" button when revealed and not last', () => {
    const wrapper = mount(RoundControls, {
      props: { status: 'revealed', allVoted: true, isLastSubject: false },
    })

    const btn = wrapper.find('button')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('Próximo Subject')
  })

  it('emits "nextRound" when next subject button is clicked', async () => {
    const wrapper = mount(RoundControls, {
      props: { status: 'revealed', allVoted: true, isLastSubject: false },
    })

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted()).toHaveProperty('nextRound')
  })

  it('shows "Finalizar Sessão" button when revealed and is last subject', () => {
    const wrapper = mount(RoundControls, {
      props: { status: 'revealed', allVoted: true, isLastSubject: true },
    })

    const btn = wrapper.find('button')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('Finalizar Sessão')
  })

  it('emits "finish" when finish button is clicked', async () => {
    const wrapper = mount(RoundControls, {
      props: { status: 'revealed', allVoted: true, isLastSubject: true },
    })

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted()).toHaveProperty('finish')
  })

  it('renders nothing when status is waiting', () => {
    const wrapper = mount(RoundControls, {
      props: { status: 'waiting', allVoted: false, isLastSubject: false },
    })

    expect(wrapper.find('button').exists()).toBe(false)
  })
})
