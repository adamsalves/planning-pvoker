<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useId, useSlots, watch } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  modelValue: boolean // v-model bindings
  title?: string
  preventClose?: boolean // Se true, clicando fora não fecha
  ariaLabel?: string // Nome acessível quando um slot #header customizado é usado (sem título nosso)
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  preventClose: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

const { t } = useI18n()

const titleId = useId()
const dialogRef = ref<HTMLElement | null>(null)
let previouslyFocused: HTMLElement | null = null

const slots = useSlots()

// Nome acessível do diálogo: aponta pro <h2> do título quando somos nós que o renderizamos;
// com slot #header customizado (não sabemos o conteúdo), cai no aria-label vindo da prop.
const labelledById = computed(() => (props.title && !slots.header ? titleId : undefined))
const dialogAriaLabel = computed(() => (labelledById.value ? undefined : props.ariaLabel))

const close = () => {
  if (props.preventClose) return
  emit('update:modelValue', false)
  emit('close')
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Descarta elementos ocultos (display:none/visibility:hidden): o browser não move foco
// pra eles, então incluí-los faria o trap "prender" o foco num alvo que .focus() ignora.
function isVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el)
  return style.display !== 'none' && style.visibility !== 'hidden'
}

function getFocusableElements(): HTMLElement[] {
  if (!dialogRef.value) return []
  const elements: HTMLElement[] = []
  dialogRef.value.querySelectorAll(FOCUSABLE_SELECTOR).forEach((node) => {
    if (node instanceof HTMLElement && isVisible(node)) elements.push(node)
  })
  return elements
}

// Focus trap: Tab/Shift+Tab ficam presos aos elementos focáveis do diálogo.
function trapFocus(e: KeyboardEvent) {
  const focusable = getFocusableElements()
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!first || !last) {
    e.preventDefault()
    return
  }

  const active = document.activeElement
  const activeIndex = active instanceof HTMLElement ? focusable.indexOf(active) : -1

  if (e.shiftKey && activeIndex <= 0) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (activeIndex === -1 || activeIndex === focusable.length - 1)) {
    e.preventDefault()
    first.focus()
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (!props.modelValue) return
  if (e.key === 'Escape' && !props.preventClose) {
    close()
    return
  }
  if (e.key === 'Tab') trapFocus(e)
}

// Scroll-lock + gerenciamento de foco: ao abrir, guarda quem estava focado e move o
// foco pra dentro do diálogo; ao fechar, restaura o foco pra quem o tinha antes.
// immediate: true cobre o caso de montar já aberto (modelValue true desde o início).
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      previouslyFocused =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      nextTick(() => {
        const target = getFocusableElements()[0] ?? dialogRef.value
        target?.focus()
      })
    } else {
      document.body.style.overflow = ''
      previouslyFocused?.focus()
      previouslyFocused = null
    }
  },
  { immediate: true },
)

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-backdrop" @click="close">
        <div
          ref="dialogRef"
          class="modal-dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="labelledById"
          :aria-label="dialogAriaLabel"
          tabindex="-1"
          @click.stop
        >
          <div v-if="title || $slots.header" class="modal-header">
            <slot name="header">
              <h2 :id="titleId" class="modal-title">{{ title }}</h2>
            </slot>
            <button
              v-if="!preventClose"
              class="modal-close-btn"
              @click="close"
              :aria-label="t('common.closeModal')"
            >
              &times;
            </button>
          </div>

          <div class="modal-body">
            <slot />
          </div>

          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(15, 23, 42, 0.6); /* backdrop blur is often nice but expensive */
  backdrop-filter: blur(4px);
  padding: var(--space-4);
}

.modal-dialog {
  width: 100%;
  max-width: 500px;
  background: var(--c-bg-soft);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  max-height: 90vh; /* Para evitar estourar a tela */
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--c-border);
}

.modal-title {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--c-text);
  margin: 0;
}

.modal-close-btn {
  background: transparent;
  border: none;
  font-size: var(--text-2xl);
  line-height: 1;
  color: var(--c-text-mute);
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.modal-close-btn:hover {
  color: var(--c-text);
  background-color: var(--c-bg-mute);
}

.modal-body {
  padding: var(--space-6);
  overflow-y: auto;
}

.modal-footer {
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--c-border);
  background-color: var(--c-bg-mute);
  border-bottom-left-radius: var(--radius-xl);
  border-bottom-right-radius: var(--radius-xl);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

/* Modal Vue Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--transition-normal);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-dialog,
.modal-leave-active .modal-dialog {
  transition:
    transform var(--transition-normal),
    opacity var(--transition-normal);
}

.modal-enter-from .modal-dialog,
.modal-leave-to .modal-dialog {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}
</style>
