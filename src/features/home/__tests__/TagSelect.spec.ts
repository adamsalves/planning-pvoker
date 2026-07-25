import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TagSelect from '../TagSelect.vue'

describe('TagSelect.vue', () => {
  it('renders the "no area" option plus every tag, labelled from i18n', () => {
    const wrapper = mount(TagSelect)
    const options = wrapper.findAll('option')

    expect(options.map((o) => o.text())).toEqual([
      'Sem área',
      'Dev',
      'Design',
      'QA',
      'Produto',
      'Outro',
    ])
    expect(wrapper.text()).toContain('Sua área (opcional)')
  })

  it('emits the picked tag through v-model', async () => {
    const wrapper = mount(TagSelect)
    await wrapper.find('select').setValue('qa')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['qa'])
  })

  it('reflects the modelValue as the selected option', () => {
    const wrapper = mount(TagSelect, { props: { modelValue: 'design' } })
    expect(wrapper.find<HTMLSelectElement>('select').element.value).toBe('design')
  })
})
