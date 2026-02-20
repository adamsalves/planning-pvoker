<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  label?: string
  type?: string
  placeholder?: string
  error?: string
  disabled?: boolean
  required?: boolean
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  disabled: false,
  required: false,
})

// Vue 3.4+ defineModel makes it easy to bind v-model
const modelValue = defineModel<string | number>()

const inputId = computed(() => props.id || `input-${Math.random().toString(36).substring(2, 9)}`)
</script>

<template>
  <div class="base-input-wrapper">
    <label v-if="label" :for="inputId" class="input-label">
      {{ label }}
      <span v-if="required" class="required-mark">*</span>
    </label>

    <div class="input-container">
      <input
        :id="inputId"
        ref="inputRef"
        v-model="modelValue"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        :class="['base-input', { 'has-error': !!error }]"
        v-bind="$attrs"
      />
    </div>

    <Transition name="fade">
      <span v-if="error" class="input-error-msg">{{ error }}</span>
    </Transition>
  </div>
</template>

<script lang="ts">
// Inherit attributes false so we can bind $attrs directly to the input
export default {
  inheritAttrs: false,
}
</script>

<style scoped>
.base-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  width: 100%;
}

.input-label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--c-text-soft);
}

.required-mark {
  color: var(--c-danger);
  margin-left: 2px;
}

.base-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-family: inherit;
  font-size: var(--text-base);
  color: var(--c-text);
  background-color: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  outline: none;
}

.base-input:hover:not(:disabled) {
  border-color: var(--c-border-hover);
}

.base-input:focus {
  border-color: var(--c-primary);
  box-shadow: 0 0 0 3px var(--c-primary-soft);
}

.base-input:disabled {
  background-color: var(--c-bg-mute);
  color: var(--c-text-mute);
  cursor: not-allowed;
}

.base-input.has-error {
  border-color: var(--c-danger);
}

.base-input.has-error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1); /* danger soft */
}

.input-error-msg {
  font-size: var(--text-sm);
  color: var(--c-danger);
  margin-top: 2px;
}

/* Animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-fast);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
