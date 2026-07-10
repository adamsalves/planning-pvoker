import { describe, it, expect, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import BaseModal from '../BaseModal.vue'

// BaseModal usa <Teleport to="body">, e o conteúdo teleportado fica fora da árvore
// que `wrapper.find()` enxerga (é só um par de comentários-âncora ali) — por isso os
// testes abaixo consultam `document` diretamente para o conteúdo real do diálogo.
function getDialog(): HTMLElement {
  const dialog = document.querySelector('.modal-dialog')
  if (!(dialog instanceof HTMLElement)) throw new Error('modal-dialog não encontrado no DOM')
  return dialog
}

let wrapper: VueWrapper | undefined

// Desmontar sempre no afterEach (não só no fim de cada teste): se uma asserção falhar
// no meio do teste, o unmount() inline nunca rodaria, e o <Teleport> ficaria órfão no
// document.body — poluindo o document.querySelector('.modal-dialog') dos testes seguintes.
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

function mountModal(props: Record<string, unknown> = {}) {
  wrapper = mount(BaseModal, {
    props: { modelValue: true, title: 'Modal de teste', ...props },
    slots: { default: '<input type="text" />', footer: '<button>Confirmar</button>' },
    attachTo: document.body,
  })
  return wrapper
}

describe('BaseModal.vue', () => {
  it('exposes role="dialog", aria-modal e aria-labelledby apontando pro título', () => {
    mountModal()
    const dialog = getDialog()
    expect(dialog.getAttribute('role')).toBe('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')

    const labelledby = dialog.getAttribute('aria-labelledby')
    expect(labelledby).toBeTruthy()
    expect(document.getElementById(labelledby ?? '')?.textContent).toBe('Modal de teste')
  })

  it('não deixa aria-labelledby pendurado quando o slot #header customizado é usado', () => {
    wrapper = mount(BaseModal, {
      props: { modelValue: true, title: 'Ignorado' },
      slots: { header: '<h2>Header customizado</h2>' },
      attachTo: document.body,
    })

    expect(getDialog().hasAttribute('aria-labelledby')).toBe(false)
  })

  it('move o foco pro diálogo ao abrir e restaura ao fechar', async () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const w = mountModal()
    await nextTick()
    expect(getDialog().contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(trigger)

    await w.setProps({ modelValue: false })
    expect(document.activeElement).toBe(trigger)

    trigger.remove()
  })

  it('Tab do último elemento focável volta pro primeiro', async () => {
    mountModal()
    await nextTick()

    const footerBtn = getDialog().querySelector('.modal-footer button')
    if (footerBtn instanceof HTMLElement) footerBtn.focus()

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )

    expect(document.activeElement).toBe(getDialog().querySelector('.modal-close-btn'))
  })

  it('Shift+Tab do primeiro elemento focável volta pro último', async () => {
    mountModal()
    await nextTick()

    const closeBtn = getDialog().querySelector('.modal-close-btn')
    if (closeBtn instanceof HTMLElement) closeBtn.focus()

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
    )

    expect(document.activeElement).toBe(getDialog().querySelector('.modal-footer button'))
  })

  it('sem nenhum elemento focável, mantém o foco no próprio diálogo e não deixa o Tab escapar', async () => {
    // preventClose remove o botão de fechar; sem slots (default/footer), o diálogo
    // fica sem nenhum elemento focável — cobre o branch `!first || !last` de trapFocus.
    wrapper = mount(BaseModal, {
      props: { modelValue: true, title: 'Sem foco', preventClose: true },
      attachTo: document.body,
    })
    await nextTick()

    const dialog = getDialog()
    expect(dialog.querySelectorAll('a[href], button, input, select, textarea')).toHaveLength(0)
    expect(document.activeElement).toBe(dialog)

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    )

    expect(document.activeElement).toBe(dialog)
  })

  it('usa o aria-label da prop como nome acessível quando há slot #header customizado', () => {
    wrapper = mount(BaseModal, {
      props: { modelValue: true, ariaLabel: 'Configurações' },
      slots: { header: '<h2>Header customizado</h2>' },
      attachTo: document.body,
    })

    const dialog = getDialog()
    expect(dialog.hasAttribute('aria-labelledby')).toBe(false)
    expect(dialog.getAttribute('aria-label')).toBe('Configurações')
  })

  it('Escape fecha o diálogo (emite update:modelValue=false e close)', () => {
    const w = mountModal()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(w.emitted('update:modelValue')).toEqual([[false]])
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('Escape não fecha quando preventClose está ativo', () => {
    const w = mountModal({ preventClose: true })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(w.emitted('close')).toBeUndefined()
  })
})
