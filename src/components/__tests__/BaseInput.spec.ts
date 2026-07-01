import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseInput from '../BaseInput.vue'

describe('BaseInput.vue', () => {
  it('não marca aria-invalid nem aria-describedby quando não há erro', () => {
    const wrapper = mount(BaseInput, { props: { label: 'Nome' } })
    const input = wrapper.find('input')

    expect(input.attributes('aria-invalid')).toBe('false')
    expect(input.attributes('aria-describedby')).toBeUndefined()
    expect(wrapper.find('.input-error-msg').exists()).toBe(false)
  })

  it('liga o input à mensagem de erro via aria-describedby e anuncia via role=alert', () => {
    const wrapper = mount(BaseInput, { props: { label: 'Nome', error: 'Nome é obrigatório' } })
    const input = wrapper.find('input')
    const errorMsg = wrapper.find('.input-error-msg')

    expect(input.attributes('aria-invalid')).toBe('true')
    expect(errorMsg.exists()).toBe(true)
    expect(errorMsg.attributes('role')).toBe('alert')
    expect(errorMsg.text()).toBe('Nome é obrigatório')

    // O id referenciado por aria-describedby precisa ser exatamente o id do span de erro.
    expect(input.attributes('aria-describedby')).toBe(errorMsg.attributes('id'))
  })
})
