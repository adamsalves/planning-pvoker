import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RoundControls from '../RoundControls.vue'

describe('RoundControls.vue', () => {
  it('shows reveal button during voting status', () => {
    const wrapper = mount(RoundControls, {
      props: { status: 'voting', allVoted: false },
    })

    const revealBtn = wrapper.find('button')
    expect(revealBtn.exists()).toBe(true)
    expect(revealBtn.text()).toContain('Revelar Votos')
    expect(revealBtn.text()).not.toContain('(todos votaram!)')
  })

  it('shows "todos votaram" hint when allVoted is true', () => {
    const wrapper = mount(RoundControls, {
      props: { status: 'voting', allVoted: true },
    })

    expect(wrapper.text()).toContain('(todos votaram!)')
  })

  it('emits "reveal" when reveal button is clicked', async () => {
    const wrapper = mount(RoundControls, {
      props: { status: 'voting', allVoted: true },
    })

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted()).toHaveProperty('reveal')
  })

  it('shows new round button when status is revealed', () => {
    const wrapper = mount(RoundControls, {
      props: { status: 'revealed', allVoted: true },
    })

    const btn = wrapper.find('button')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('Nova Rodada')
  })

  it('emits "newRound" when new round button is clicked', async () => {
    const wrapper = mount(RoundControls, {
      props: { status: 'revealed', allVoted: true },
    })

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted()).toHaveProperty('newRound')
  })

  it('renders nothing when status is waiting', () => {
    const wrapper = mount(RoundControls, {
      props: { status: 'waiting', allVoted: false },
    })

    expect(wrapper.find('button').exists()).toBe(false)
  })
})
