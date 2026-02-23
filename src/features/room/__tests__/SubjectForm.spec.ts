import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SubjectForm from '../SubjectForm.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseInput from '@/components/BaseInput.vue'

describe('SubjectForm.vue', () => {
  const defaultProps = {
    subjects: [],
    playerCount: 3,
  }

  it('renders input and add button', () => {
    const wrapper = mount(SubjectForm, { props: defaultProps })
    expect(wrapper.findComponent(BaseInput).exists()).toBe(true)
    expect(wrapper.findComponent(BaseButton).exists()).toBe(true)
  })

  it('shows error if subject is less than 2 characters', async () => {
    const wrapper = mount(SubjectForm, { props: defaultProps })

    await wrapper.find('form').trigger('submit.prevent')

    const input = wrapper.findComponent(BaseInput)
    expect(input.props('error')).toBe('O subject deve ter pelo menos 2 caracteres')
    expect(wrapper.emitted('add')).toBeUndefined()
  })

  it('emits "add" event with trimmed subject and clears input', async () => {
    const wrapper = mount(SubjectForm, { props: defaultProps })

    const input = wrapper.findComponent(BaseInput)
    await input.vm.$emit('update:modelValue', '  Test Subject  ')

    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.emitted()).toHaveProperty('add')
    expect(wrapper.emitted('add')?.[0]).toEqual(['Test Subject'])

    expect(input.props('modelValue')).toBe('')
    expect(input.props('error')).toBe('')
  })

  it('displays backlog list when subjects exist', () => {
    const wrapper = mount(SubjectForm, {
      props: { subjects: ['Login', 'Signup', 'Dashboard'], playerCount: 3 },
    })

    expect(wrapper.text()).toContain('Backlog (3 subjects)')
    expect(wrapper.text()).toContain('Login')
    expect(wrapper.text()).toContain('Signup')
    expect(wrapper.text()).toContain('Dashboard')
  })

  it('emits "remove" when remove button is clicked', async () => {
    const wrapper = mount(SubjectForm, {
      props: { subjects: ['Login', 'Signup'], playerCount: 3 },
    })

    const removeButtons = wrapper.findAll('.remove-btn')
    await removeButtons[1].trigger('click')

    expect(wrapper.emitted()).toHaveProperty('remove')
    expect(wrapper.emitted('remove')?.[0]).toEqual([1])
  })

  it('disables start button when no subjects', () => {
    const wrapper = mount(SubjectForm, {
      props: { subjects: [], playerCount: 3 },
    })

    const buttons = wrapper.findAllComponents(BaseButton)
    const startBtn = buttons.find((b) => b.text().includes('Iniciar Sessão'))
    expect(startBtn?.props('disabled')).toBe(true)
  })

  it('disables start button when not enough players', () => {
    const wrapper = mount(SubjectForm, {
      props: { subjects: ['Login'], playerCount: 1 },
    })

    const buttons = wrapper.findAllComponents(BaseButton)
    const startBtn = buttons.find((b) => b.text().includes('Iniciar Sessão'))
    expect(startBtn?.props('disabled')).toBe(true)
  })

  it('emits "start" when start button is clicked', async () => {
    const wrapper = mount(SubjectForm, {
      props: { subjects: ['Login'], playerCount: 2 },
    })

    const buttons = wrapper.findAllComponents(BaseButton)
    const startBtn = buttons.find((b) => b.text().includes('Iniciar Sessão'))
    await startBtn?.trigger('click')

    expect(wrapper.emitted()).toHaveProperty('start')
  })
})
