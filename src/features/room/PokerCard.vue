<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  value: string | number
  selected?: boolean
  disabled?: boolean
  revealed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  disabled: false,
  revealed: false,
})

const emit = defineEmits<{
  select: [value: string | number]
}>()

const isSpecial = computed(() => props.value === '☕')

function handleClick() {
  if (!props.disabled) {
    emit('select', props.value)
  }
}
</script>

<template>
  <button
    :class="[
      'poker-card',
      {
        selected,
        disabled,
        revealed,
        special: isSpecial,
      },
    ]"
    :disabled="disabled"
    @click="handleClick"
    :aria-label="`Votar ${value}`"
  >
    <div class="card-inner">
      <div class="card-front">
        <span class="card-value">{{ value }}</span>
      </div>
      <div class="card-back">
        <span class="card-pattern">🃏</span>
      </div>
    </div>
  </button>
</template>

<style scoped>
.poker-card {
  perspective: 600px;
  width: 72px;
  height: 100px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: transform var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}

.poker-card:hover:not(:disabled) {
  transform: translateY(-6px);
}

.poker-card:active:not(:disabled) {
  transform: translateY(-2px);
}

.poker-card.disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
}

.poker-card.revealed .card-inner {
  transform: rotateY(180deg);
}

.card-front,
.card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--c-border);
  box-shadow: var(--shadow-sm);
}

.card-front {
  background: var(--c-bg-soft);
}

.poker-card.selected .card-front {
  border-color: var(--c-primary);
  background: var(--c-primary-soft);
  box-shadow:
    0 0 0 3px var(--c-primary-soft),
    var(--shadow-md);
}

.poker-card.special .card-front {
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  border-color: #f59e0b;
}

.poker-card.special.selected .card-front {
  box-shadow:
    0 0 0 3px rgba(245, 158, 11, 0.2),
    var(--shadow-md);
}

.card-back {
  background: linear-gradient(135deg, var(--c-primary), var(--c-secondary));
  transform: rotateY(180deg);
  border-color: transparent;
}

.card-value {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--c-text);
}

.poker-card.selected .card-value {
  color: var(--c-primary);
}

.card-pattern {
  font-size: var(--text-2xl);
}
</style>
