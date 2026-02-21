import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SubjectForm from '../SubjectForm.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseInput from '@/components/BaseInput.vue'

describe('SubjectForm.vue', () => {
  it('renders input and submit button', () => {
    const wrapper = mount(SubjectForm)
    expect(wrapper.findComponent(BaseInput).exists()).toBe(true)
    expect(wrapper.findComponent(BaseButton).exists()).toBe(true)
  })

  it('shows error if subject is less than 2 characters', async () => {
    const wrapper = mount(SubjectForm)

    // Attempt submission with empty subject
    await wrapper.find('form').trigger('submit.prevent')

    // The BaseInput component should receive the error prop
    const input = wrapper.findComponent(BaseInput)
    expect(input.props('error')).toBe('O subject deve ter pelo menos 2 caracteres')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('emits "submit" event with trimmed subject and clears input', async () => {
    const wrapper = mount(SubjectForm)

    // Set value directly on the component's internal ref via BaseInput update:modelValue
    const input = wrapper.findComponent(BaseInput)
    await input.vm.$emit('update:modelValue', '  Test Subject  ')

    // Submit
    await wrapper.find('form').trigger('submit.prevent')

    expect(wrapper.emitted()).toHaveProperty('submit')
    expect(wrapper.emitted('submit')?.[0]).toEqual(['Test Subject'])

    // Input should be cleared
    expect(input.props('modelValue')).toBe('')
    expect(input.props('error')).toBe('')
  })
})
