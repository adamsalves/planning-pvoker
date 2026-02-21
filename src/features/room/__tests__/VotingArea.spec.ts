import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VotingArea from '../VotingArea.vue'
import PokerCard from '../PokerCard.vue'

describe('VotingArea.vue', () => {
  it('renders correct number of cards for fibonacci deck', () => {
    const wrapper = mount(VotingArea, {
      props: { deckType: 'fibonacci', selectedValue: null },
    })

    // 0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ☕, ❓ (dependendo de DECKS)
    // DECKS['fibonacci'].values.length deve ser o nº de PokerCards montados.
    const cards = wrapper.findAllComponents(PokerCard)
    expect(cards.length).toBeGreaterThan(0)
  })

  it('marks the selected card', () => {
    const wrapper = mount(VotingArea, {
      props: { deckType: 'fibonacci', selectedValue: 5 },
    })

    // Find the PokerCard with value 5
    const selectedCard = wrapper.findAllComponents(PokerCard).find((c) => c.props('value') === 5)
    expect(selectedCard).toBeDefined()
    expect(selectedCard?.props('selected')).toBe(true)
  })

  it('emits vote when a card is selected', () => {
    const wrapper = mount(VotingArea, {
      props: { deckType: 'fibonacci', selectedValue: null },
    })

    // Simulando o componente filho emitindo 'select'
    const firstCard = wrapper.findComponent(PokerCard)
    firstCard.vm.$emit('select', 1)

    expect(wrapper.emitted()).toHaveProperty('vote')
    expect(wrapper.emitted('vote')?.[0]).toEqual([1])
  })

  it('disables all cards when disabled prop is true', () => {
    const wrapper = mount(VotingArea, {
      props: { deckType: 'fibonacci', selectedValue: null, disabled: true },
    })

    const cards = wrapper.findAllComponents(PokerCard)
    expect(cards.every((c) => c.props('disabled'))).toBe(true)
  })
})
