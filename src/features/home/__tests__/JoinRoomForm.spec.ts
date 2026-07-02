import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import JoinRoomForm from '../JoinRoomForm.vue'

// A lógica de joinRoom (navegação/token) é testada em useRoom.spec; aqui o form
// só precisa do stub para montar sem tocar em socket/router.
vi.mock('@/composables/useRoom', () => ({
  useRoom: () => ({
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
  }),
}))

describe('JoinRoomForm.vue', () => {
  it('prefills the room code from the initialRoomCode prop', () => {
    const wrapper = mount(JoinRoomForm, { props: { initialRoomCode: 'abc123' } })
    const input = wrapper.find<HTMLInputElement>('input[placeholder="Ex: a1b2c3d4"]')

    expect(input.element.value).toBe('abc123')
  })

  it('leaves the room code empty without the prop', () => {
    const wrapper = mount(JoinRoomForm)
    const input = wrapper.find<HTMLInputElement>('input[placeholder="Ex: a1b2c3d4"]')

    expect(input.element.value).toBe('')
  })

  it('selects the member role by default', () => {
    const wrapper = mount(JoinRoomForm)
    const options = wrapper.findAll('.role-option')

    expect(options).toHaveLength(2)
    expect(options[0].classes()).toContain('selected') // member
    expect(options[1].classes()).not.toContain('selected')
  })

  it('moves the selection to observer when picked', async () => {
    const wrapper = mount(JoinRoomForm)

    await wrapper.find('input[value="observer"]').setValue()

    const options = wrapper.findAll('.role-option')
    expect(options[1].classes()).toContain('selected')
    expect(options[0].classes()).not.toContain('selected')
  })

  it('renders its own submit button', () => {
    const wrapper = mount(JoinRoomForm)
    expect(wrapper.text()).toContain('Entrar na Sala')
  })
})
