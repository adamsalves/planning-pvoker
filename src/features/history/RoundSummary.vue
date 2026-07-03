<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseCard from '@/components/BaseCard.vue'
import type { Round } from '@/types'
import { useVoteStats } from '@/composables/useVoteStats'

const props = defineProps<{
  round: Round
  roundNumber: number
}>()

const { t } = useI18n()

// Estatísticas da rodada — fonte única (useVoteStats).
const { values, numericVotes, count, average, min, max, hasConsensus } = useVoteStats(
  () => props.round.votes,
)
</script>

<template>
  <BaseCard class="round-card">
    <div class="round-header">
      <h3 class="round-title">
        <span class="round-number">R{{ roundNumber }}</span>
        {{ round.subject }}
      </h3>
      <span v-if="hasConsensus" class="badge success">{{ t('history.consensus') }}</span>
      <span v-else class="badge warning"
        >{{ t('history.spread')
        }}<template v-if="min !== null && max !== null"> ({{ max - min }})</template></span
      >
    </div>

    <div class="stats-grid" v-if="numericVotes.length > 0">
      <div class="stat-box">
        <span class="stat-label">{{ t('stats.average') }}</span>
        <span class="stat-value">{{ average }}</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">{{ t('stats.min') }}</span>
        <span class="stat-value">{{ min }}</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">{{ t('stats.max') }}</span>
        <span class="stat-value">{{ max }}</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">{{ t('stats.votes') }}</span>
        <span class="stat-value">{{ count }}</span>
      </div>
    </div>
    <div v-else>
      <p class="text-votes">
        {{ t('history.textVotes', { values: values.join(', ') || t('history.noVotes') }) }}
      </p>
    </div>
  </BaseCard>
</template>

<style scoped>
.round-card {
  margin-bottom: var(--space-3);
  background: var(--c-bg-mute);
}

.round-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.round-title {
  margin: 0;
  font-size: var(--text-base);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.round-number {
  background: var(--c-primary-soft);
  color: var(--c-primary);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
}

.badge {
  font-size: var(--text-xs);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-weight: 600;
}

.badge.success {
  background: rgba(74, 222, 128, 0.2);
  color: var(--c-success-text);
}

.badge.warning {
  background: rgba(250, 204, 21, 0.2);
  color: var(--c-warning-text);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
}

.stat-box {
  background: var(--c-bg);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  text-align: center;
  display: flex;
  flex-direction: column;
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--c-text-mute);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--c-text);
}

.text-votes {
  font-size: var(--text-sm);
  color: var(--c-text-soft);
}
</style>
