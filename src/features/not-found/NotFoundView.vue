<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import IconHouse from '~icons/lucide/house'

const { t } = useI18n()
</script>

<template>
  <div class="not-found">
    <span class="not-found-icon" aria-hidden="true">🃏</span>
    <h1 class="not-found-title">{{ t('notFound.title') }}</h1>
    <p class="not-found-message">{{ t('notFound.message') }}</p>
    <RouterLink to="/" class="not-found-home">
      <IconHouse aria-hidden="true" />
      {{ t('notFound.backHome') }}
    </RouterLink>
  </div>
</template>

<style scoped>
.not-found {
  max-width: 520px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  animation: slideUp var(--transition-normal);
}

.not-found-icon {
  font-size: 4rem;
  /* Carta "fora do baralho": leve rotação reforça o tom de erro sem um X vermelho. */
  display: inline-block;
  transform: rotate(-8deg);
}

.not-found-title {
  font-size: var(--text-2xl);
  font-weight: 800;
  color: var(--c-text);
  margin: 0;
}

.not-found-message {
  color: var(--c-text-mute);
  font-size: var(--text-base);
  margin: 0;
}

.not-found-home {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-3) var(--space-6);
  background: var(--c-primary);
  color: white;
  border-radius: var(--radius-md);
  font-weight: 600;
}

.not-found-home:hover {
  background: var(--c-primary-hover);
}
</style>
