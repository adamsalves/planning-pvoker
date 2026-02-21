<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  loading?: boolean
  block?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
  disabled: false,
  loading: false,
  block: false,
})

const classes = computed(() => {
  return [
    'base-button',
    `variant-${props.variant}`,
    `size-${props.size}`,
    { 'is-block': props.block },
    { 'is-loading': props.loading },
  ]
})
</script>

<template>
  <button
    :class="classes"
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading"
    :aria-disabled="disabled || loading"
  >
    <span v-if="loading" class="spinner"></span>
    <span :class="{ 'opacity-0': loading }">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border-radius: var(--radius-md);
  font-weight: 500;
  transition: all var(--transition-fast);
  cursor: pointer;
  border: 1px solid transparent;
  position: relative;
  overflow: hidden;
}

.base-button:focus-visible {
  outline: 2px solid var(--c-primary);
  outline-offset: 2px;
}

.base-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.is-block {
  width: 100%;
}

.opacity-0 {
  opacity: 0;
}

/* Sizes */
.size-sm {
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-sm);
}

.size-md {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-base);
}

.size-lg {
  padding: var(--space-3) var(--space-6);
  font-size: var(--text-lg);
}

/* Variants */
.variant-primary {
  background-color: var(--c-primary);
  color: white;
  box-shadow: var(--shadow-sm);
}
.variant-primary:hover:not(:disabled) {
  background-color: var(--c-primary-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.variant-secondary {
  background-color: var(--c-bg-mute);
  color: var(--c-text);
  border-color: var(--c-border);
}
.variant-secondary:hover:not(:disabled) {
  background-color: var(--c-border);
}

.variant-danger {
  background-color: var(--c-danger);
  color: white;
}
.variant-danger:hover:not(:disabled) {
  filter: brightness(0.9);
}

.variant-ghost {
  background-color: transparent;
  color: var(--c-text-soft);
}
.variant-ghost:hover:not(:disabled) {
  background-color: var(--c-bg-mute);
  color: var(--c-text);
}

/* Spinner */
.spinner {
  position: absolute;
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
