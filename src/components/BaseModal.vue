<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'

interface Props {
  modelValue: boolean // v-model bindings
  title?: string
  preventClose?: boolean // Se true, clicando fora não fecha
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  preventClose: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

const close = () => {
  if (props.preventClose) return
  emit('update:modelValue', false)
  emit('close')
}

// Fechar com ESCAPE key
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.modelValue && !props.preventClose) {
    close()
  }
}

// Prevenir scroll do body quando o modal estiver aberto
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  },
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
        <div class="modal-dialog" @click.stop>
          <div v-if="title || $slots.header" class="modal-header">
            <slot name="header">
              <h2 class="modal-title">{{ title }}</h2>
            </slot>
            <button
              v-if="!preventClose"
              class="modal-close-btn"
              @click="close"
              aria-label="Close modal"
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
