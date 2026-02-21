import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import VoteReveal from '../VoteReveal.vue'
import confetti from 'canvas-confetti'

// Mocking canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}))

describe('VoteReveal.vue', () => {
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
    expect(rows[0]!.find('.bar-label').text()).toBe('8')
    expect(rows[0]!.find('.bar-count').text()).toBe('3')

    // '5' and '1' have count 1 each
    expect(rows[1]!.find('.bar-count').text()).toBe('1')
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
})
