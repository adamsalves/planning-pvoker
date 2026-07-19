import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import JoinRoomForm from '../JoinRoomForm.vue'
import IconUser from '~icons/lucide/user'
import IconEye from '~icons/lucide/eye'
import IconLogIn from '~icons/lucide/log-in'

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

  // Os dois papéis usam ícone (não emoji): aqui o 🃏 era rótulo de papel, não a marca,
  // então vira `user` junto com o `eye` — o seletor inteiro recolore via currentColor.
  it('labels both roles with theme-aware icons instead of emojis', () => {
    const wrapper = mount(JoinRoomForm)
    const options = wrapper.findAll('.role-option')

    expect(wrapper.findComponent(IconUser).exists()).toBe(true)
    expect(wrapper.findComponent(IconEye).exists()).toBe(true)
    expect(options[0].find('svg.role-icon').exists()).toBe(true)
    expect(options[1].find('svg.role-icon').exists()).toBe(true)
    expect(wrapper.text()).not.toMatch(/🃏|👁/)
  })

  // O 🔗 saiu da string i18n e virou ícone irmão: o leitor de tela lê só o rótulo.
  it('decorates the submit button with an icon kept out of the label', () => {
    const wrapper = mount(JoinRoomForm)
    const icon = wrapper.findComponent(IconLogIn)

    expect(icon.exists()).toBe(true)
    expect(icon.attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).not.toContain('🔗')
  })

  // Decorativos: o significado do papel vem do texto do rótulo ao lado.
  it('hides the role icons from assistive tech', () => {
    const wrapper = mount(JoinRoomForm)

    for (const icon of wrapper.findAll('svg.role-icon')) {
      expect(icon.attributes('aria-hidden')).toBe('true')
    }
  })
})
