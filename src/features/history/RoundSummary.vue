<script setup lang="ts">
import { computed } from 'vue'
import BaseCard from '@/components/BaseCard.vue'
import type { Round } from '@/types'

const props = defineProps<{
  round: Round
  roundNumber: number
}>()

const activeVotes = computed(() => Object.values(props.round.votes))

const numericVotes = computed(() => {
  return activeVotes.value.filter((v) => typeof v === 'number') as number[]
})

const stats = computed(() => {
  const votes = numericVotes.value
  if (votes.length === 0) return { mean: 0, min: 0, max: 0, consensus: false }

  const min = Math.min(...votes)
  const max = Math.max(...votes)
  const sum = votes.reduce((a, b) => a + b, 0)
  const mean = sum / votes.length

  // Consensus se max == min, e todos votaram algo (podem ser T-Shirts repetidas, mas aqui checamos numericos)
  const consensus = min === max && votes.length === activeVotes.value.length

  // Se tem cartas textuais MISTURADAS, o consenso textual
  let isStringConsensus = false
  if (numericVotes.value.length === 0 && activeVotes.value.length > 0) {
    const firstVote = activeVotes.value[0]
    isStringConsensus = activeVotes.value.every((v) => v === firstVote)
  }

  return {
    mean: Number(mean.toFixed(1)),
    min,
    max,
    consensus: consensus || isStringConsensus,
  }
})
</script>

<template>
  <BaseCard class="round-card">
    <div class="round-header">
      <h3 class="round-title">
        <span class="round-number">R{{ roundNumber }}</span>
        {{ round.subject }}
      </h3>
      <span v-if="stats.consensus" class="badge success">🤝 Consenso Atingido</span>
      <span v-else class="badge warning">Dispersão ({{ stats.max - stats.min }})</span>
    </div>

    <div class="stats-grid" v-if="numericVotes.length > 0">
      <div class="stat-box">
        <span class="stat-label">Média</span>
        <span class="stat-value">{{ stats.mean }}</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">Mínimo</span>
        <span class="stat-value">{{ stats.min }}</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">Máximo</span>
        <span class="stat-value">{{ stats.max }}</span>
      </div>
      <div class="stat-box">
        <span class="stat-label">Votos</span>
        <span class="stat-value">{{ activeVotes.length }}</span>
      </div>
    </div>
    <div v-else>
      <p class="text-votes">Votos textuais: {{ activeVotes.join(', ') || 'Nenhum' }}</p>
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
  color: #16a34a;
}

.badge.warning {
  background: rgba(250, 204, 21, 0.2);
  color: #ca8a04;
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
