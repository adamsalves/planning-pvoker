import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CreateRoomForm from '../CreateRoomForm.vue'
import IconRocket from '~icons/lucide/rocket'
import { must } from '@/test-utils/must'

// Mock estável (hoisted) para asserir os args do submit; a lógica de createRoom
// (navegação/token) segue testada em useRoom.spec.
const { createRoomMock, joinRoomMock } = vi.hoisted(() => ({
  createRoomMock: vi.fn(),
  joinRoomMock: vi.fn(),
}))
vi.mock('@/composables/useRoom', () => ({
  useRoom: () => ({ createRoom: createRoomMock, joinRoom: joinRoomMock }),
}))

describe('CreateRoomForm.vue', () => {
  beforeEach(() => {
    createRoomMock.mockClear()
    joinRoomMock.mockClear()
  })

  it('renders the three decks with the first one selected by default', () => {
    const wrapper = mount(CreateRoomForm)
    const options = wrapper.findAll('.deck-option')

    expect(options).toHaveLength(3)
    expect(wrapper.text()).toContain('Fibonacci')
    expect(wrapper.text()).toContain('T-Shirt Sizes')
    expect(wrapper.text()).toContain('Sequencial')
    // fibonacci (DECK_TYPES[0]) começa selecionado
    expect(must(options[0]).classes()).toContain('selected')
  })

  it('moves the selection when another deck is picked', async () => {
    const wrapper = mount(CreateRoomForm)
    const options = wrapper.findAll('.deck-option')

    await wrapper.find('input[value="tshirt"]').setValue()

    expect(must(options[1]).classes()).toContain('selected')
    expect(must(options[0]).classes()).not.toContain('selected')
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

  // O 🚀 saiu da string i18n e virou ícone irmão: o leitor de tela lê só o rótulo,
  // e o ícone acompanha o tema em vez do glyph colorido do SO.
  it('decorates the submit button with an icon kept out of the label', () => {
    const wrapper = mount(CreateRoomForm)
    const icon = wrapper.findComponent(IconRocket)

    expect(icon.exists()).toBe(true)
    expect(icon.attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).not.toContain('🚀')
  })

  it('renders an optional area selector defaulting to "no area"', () => {
    const wrapper = mount(CreateRoomForm)
    const select = wrapper.find('select.tag-select')

    expect(select.exists()).toBe(true)
    // "Sem área" + os 5 valores do enum (dev/design/qa/product/other)
    expect(select.findAll('option')).toHaveLength(6)
    expect(must(select.findAll('option')[0]).text()).toBe('Sem área')
    expect(wrapper.text()).toContain('Sua área (opcional)')
  })

  it('passes the picked area tag to createRoom on submit', async () => {
    const wrapper = mount(CreateRoomForm)
    await wrapper.find('input[placeholder="Ex: João"]').setValue('Adams')
    await wrapper.find('select.tag-select').setValue('design')
    await wrapper.find('form').trigger('submit')

    // Guarda o threading do onSubmit (values.tag = 4º arg). vi.waitFor aguarda a
    // validação async do vee-validate + o handler — um flushPromises só não basta
    // e a chamada vazaria para o próximo teste.
    await vi.waitFor(() =>
      expect(createRoomMock).toHaveBeenCalledWith('Adams', 'fibonacci', false, 'design'),
    )
  })

  it('submits with no tag when the area is left unset', async () => {
    const wrapper = mount(CreateRoomForm)
    await wrapper.find('input[placeholder="Ex: João"]').setValue('Adams')
    await wrapper.find('form').trigger('submit')

    await vi.waitFor(() =>
      expect(createRoomMock).toHaveBeenCalledWith('Adams', 'fibonacci', false, undefined),
    )
  })
})
