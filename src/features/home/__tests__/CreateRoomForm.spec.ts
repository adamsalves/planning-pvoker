import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CreateRoomForm from '../CreateRoomForm.vue'

// A lógica de createRoom (navegação/token) é testada em useRoom.spec; aqui o form
// só precisa do stub para montar sem tocar em socket/router.
vi.mock('@/composables/useRoom', () => ({
  useRoom: () => ({
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
  }),
}))

describe('CreateRoomForm.vue', () => {
  it('renders the three decks with the first one selected by default', () => {
    const wrapper = mount(CreateRoomForm)
    const options = wrapper.findAll('.deck-option')

    expect(options).toHaveLength(3)
    expect(wrapper.text()).toContain('Fibonacci')
    expect(wrapper.text()).toContain('T-Shirt Sizes')
    expect(wrapper.text()).toContain('Sequencial')
    // fibonacci (DECK_TYPES[0]) começa selecionado
    expect(options[0].classes()).toContain('selected')
  })

  it('moves the selection when another deck is picked', async () => {
    const wrapper = mount(CreateRoomForm)
    const options = wrapper.findAll('.deck-option')

    await wrapper.find('input[value="tshirt"]').setValue()

    expect(options[1].classes()).toContain('selected')
    expect(options[0].classes()).not.toContain('selected')
  })

  it('keeps the auto-reveal checkbox focusable (sr-only, not display:none) and operable', async () => {
    const wrapper = mount(CreateRoomForm)
    const checkbox = wrapper.find<HTMLInputElement>('input.toggle-input')

    expect(checkbox.classes()).toContain('sr-only')
    expect(checkbox.attributes('disabled')).toBeUndefined()

    await checkbox.setValue(true)

    expect(checkbox.element.checked).toBe(true)
  })

  it('renders its own submit button', () => {
    const wrapper = mount(CreateRoomForm)
    expect(wrapper.text()).toContain('Criar Sala')
  })
})
