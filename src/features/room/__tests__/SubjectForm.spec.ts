import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import IconPlus from '~icons/lucide/plus'
import IconPlay from '~icons/lucide/play'
import IconPencil from '~icons/lucide/pencil'
import IconHourglass from '~icons/lucide/hourglass'
import IconX from '~icons/lucide/x'
import SubjectForm from '../SubjectForm.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseInput from '@/components/BaseInput.vue'
import { i18n } from '@/i18n'

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

  it('re-traduz o erro de validação visível na troca de idioma', async () => {
    const wrapper = mount(SubjectForm, { props: defaultProps })
    await wrapper.find('form').trigger('submit.prevent')

    const input = wrapper.findComponent(BaseInput)
    expect(input.props('error')).toBe('O subject deve ter pelo menos 2 caracteres')

    // O erro é guardado como CHAVE e traduzido no render — trocar o idioma com o
    // erro na tela deve re-traduzi-lo (restauração do locale = afterEach global).
    i18n.global.locale.value = 'en'
    await nextTick()
    expect(input.props('error')).toBe('Subject must be at least 2 characters')
  })

  it('usa singular no backlog com 1 subject', () => {
    const wrapper = mount(SubjectForm, {
      props: { subjects: ['Login'], playerCount: 3 },
    })

    expect(wrapper.text()).toContain('Backlog (1 subject)')
    expect(wrapper.text()).not.toContain('Backlog (1 subjects)')
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

  it('exposes a specific aria-label per backlog item on the remove button', () => {
    const wrapper = mount(SubjectForm, {
      props: { subjects: ['Login', 'Signup'], playerCount: 3 },
    })

    const buttons = wrapper.findAll('.remove-btn')
    expect(buttons[0].attributes('aria-label')).toBe('Remover Login')
    expect(buttons[1].attributes('aria-label')).toBe('Remover Signup')
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

  it('explica por que "Iniciar" está desabilitado: falta subject (pré-requisito)', () => {
    const wrapper = mount(SubjectForm, { props: { subjects: [], playerCount: 3 } })
    expect(wrapper.find('.start-hint').text()).toContain(
      'Adicione ao menos um subject para iniciar',
    )
  })

  it('explica por que "Iniciar" está desabilitado: faltam jogadores', () => {
    const wrapper = mount(SubjectForm, { props: { subjects: ['Login'], playerCount: 1 } })
    expect(wrapper.find('.start-hint').text()).toContain('Aguardando mais jogadores')
  })

  it('esconde o hint quando a sessão já pode iniciar', () => {
    const wrapper = mount(SubjectForm, { props: { subjects: ['Login'], playerCount: 2 } })
    expect(wrapper.find('.start-hint').exists()).toBe(false)
  })

  it('decorates the add and start buttons with icons kept out of the label', () => {
    const wrapper = mount(SubjectForm, { props: defaultProps })

    for (const Icon of [IconPlus, IconPlay]) {
      const icon = wrapper.findComponent(Icon)
      expect(icon.exists()).toBe(true)
      expect(icon.attributes('aria-hidden')).toBe('true')
    }
    // O rótulo textual (nome acessível) segue sem emoji nem ícone.
    expect(wrapper.text()).toContain('Adicionar')
    expect(wrapper.text()).toContain('Iniciar Sessão de Votação')
  })

  // Cada motivo do hint tem o seu ícone (antes eram os emojis 📝/⏳ na string i18n):
  // o <component :is> tem de trocar junto com o texto.
  it('usa o ícone do motivo no hint: falta subject', () => {
    const wrapper = mount(SubjectForm, { props: { subjects: [], playerCount: 3 } })
    expect(wrapper.find('.start-hint').findComponent(IconPencil).exists()).toBe(true)
    expect(wrapper.find('.start-hint').findComponent(IconHourglass).exists()).toBe(false)
  })

  it('usa o ícone do motivo no hint: faltam jogadores', () => {
    const wrapper = mount(SubjectForm, { props: { subjects: ['Login'], playerCount: 1 } })
    expect(wrapper.find('.start-hint').findComponent(IconHourglass).exists()).toBe(true)
    expect(wrapper.find('.start-hint').findComponent(IconPencil).exists()).toBe(false)
  })

  it('mantém o nome acessível do botão de remover ao trocar ✕ por ícone', () => {
    const wrapper = mount(SubjectForm, { props: { subjects: ['Login'], playerCount: 2 } })

    const removeBtn = wrapper.find('.remove-btn')
    expect(removeBtn.findComponent(IconX).exists()).toBe(true)
    expect(removeBtn.attributes('aria-label')).toBe('Remover Login')
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
