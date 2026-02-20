<script setup lang="ts">
interface Props {
  title?: string
  subtitle?: string
}

defineProps<Props>()
</script>

<template>
  <div class="base-card">
    <div v-if="$slots.header || title" class="card-header">
      <slot name="header">
        <div class="card-title-wrapper">
          <h3 v-if="title" class="card-title">{{ title }}</h3>
          <p v-if="subtitle" class="card-subtitle">{{ subtitle }}</p>
        </div>
      </slot>
    </div>

    <div class="card-body">
      <slot />
    </div>

    <div v-if="$slots.footer" class="card-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
.base-card {
  background: var(--c-bg-soft);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
  transition:
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
  overflow: hidden;
}

.base-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--c-border-hover);
}

.card-header {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--c-border);
}

.card-title-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.card-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--c-text);
  margin: 0;
}

.card-subtitle {
  font-size: var(--text-sm);
  color: var(--c-text-soft);
  margin: 0;
}

.card-body {
  padding: var(--space-5);
}

.card-footer {
  padding: var(--space-4) var(--space-5);
  background: var(--c-bg-mute);
  border-top: 1px solid var(--c-border);
}
</style>
