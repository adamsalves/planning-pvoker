<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import IconCircleCheck from '~icons/lucide/circle-check'
import IconRotateCw from '~icons/lucide/rotate-cw'
import type { Round } from '@/types'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import VoteReveal from './VoteReveal.vue'

interface Props {
  rounds: Round[]
}

defineProps<Props>()

const emit = defineEmits<{
  newSession: []
  leave: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="session-summary">
    <div class="summary-header">
      <IconCircleCheck class="check-icon" aria-hidden="true" />
      <h2 class="summary-title">{{ t('room.summary.title') }}</h2>
      <p class="summary-subtitle">
        {{ t('room.summary.subjectsVoted', rounds.length) }}
      </p>
    </div>

    <div class="rounds-recap">
      <BaseCard v-for="(round, index) in rounds" :key="round.id" class="recap-card">
        <template #header>
          <div class="recap-header">
            <span class="recap-badge">{{ index + 1 }}/{{ rounds.length }}</span>
            <span class="recap-subject">{{ round.subject }}</span>
          </div>
        </template>
        <!-- Sem player-count: recap histórico — o total atual de jogadores não
             corresponde a quem votou na rodada (ex.: alguém saiu depois de votar). -->
        <VoteReveal :votes="round.votes" :celebrate="false" />
      </BaseCard>
    </div>

    <div class="summary-actions">
      <BaseButton variant="primary" size="lg" block @click="emit('newSession')">
        <IconRotateCw class="btn-icon" aria-hidden="true" />{{ t('room.summary.newSession') }}
      </BaseButton>
      <BaseButton variant="ghost" size="md" block @click="emit('leave')">
        {{ t('room.leave.button') }}
      </BaseButton>
    </div>
  </div>
</template>

<style scoped>
.session-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  animation: slideUp var(--transition-normal);
}

.summary-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

/* Verde do token semântico (inverte no dark, F3.9): o ✅ que ele substitui já
   carregava a cor de sucesso — sem isso o ícone herdaria o texto padrão. */
.check-icon {
  font-size: 3rem;
  color: var(--c-success-text);
  animation: popIn 0.4s ease-out;
}

.summary-title {
  font-size: var(--text-xl);
  font-weight: 700;
  margin: 0;
}

.summary-subtitle {
  font-size: var(--text-sm);
  color: var(--c-text-mute);
  margin: 0;
}

.rounds-recap {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.recap-card {
  animation: slideUp var(--transition-normal);
}

.recap-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.recap-badge {
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 2px var(--space-2);
  background: var(--c-primary-soft);
  color: var(--c-primary);
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.recap-subject {
  font-weight: 600;
  font-size: var(--text-base);
}

.summary-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

@keyframes popIn {
  0% {
    transform: scale(0);
    opacity: 0;
  }
  70% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
