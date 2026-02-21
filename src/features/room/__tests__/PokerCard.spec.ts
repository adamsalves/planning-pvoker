import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PokerCard from '../PokerCard.vue'

describe('PokerCard.vue', () => {
  it('renders the card value correctly', () => {
    const wrapper = mount(PokerCard, {
      props: { value: 13 },
    })

    expect(wrapper.text()).toContain('13')
  })

  it('emits a "select" event with its value when clicked', async () => {
    const wrapper = mount(PokerCard, {
      props: { value: 5 },
    })

    await wrapper.trigger('click')

    expect(wrapper.emitted()).toHaveProperty('select')
    expect(wrapper.emitted('select')?.[0]).toEqual([5])
  })

  it('does not emit "select" when disabled', async () => {
    const wrapper = mount(PokerCard, {
      props: { value: 21, disabled: true },
    })

    await wrapper.trigger('click')

    expect(wrapper.emitted()).not.toHaveProperty('select')
    expect(wrapper.classes()).toContain('disabled')
  })

  it('applies selected class when prop is true', () => {
    const wrapper = mount(PokerCard, {
      props: { value: 8, selected: true },
    })

    expect(wrapper.classes()).toContain('selected')
  })

  it('applies face-down class if prop is true', () => {
    const wrapper = mount(PokerCard, {
      props: { value: 3, faceDown: true },
    })

    expect(wrapper.classes()).toContain('face-down')
  })

  it('identifies and styles special coffee card correctly', () => {
    const wrapper = mount(PokerCard, {
      props: { value: '☕' },
    })

    expect(wrapper.classes()).toContain('special')
  })
})
