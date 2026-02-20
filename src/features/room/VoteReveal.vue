<script setup lang="ts">
import { computed, watch, onMounted, ref } from 'vue'
import confetti from 'canvas-confetti'

interface Props {
  votes: Record<string, string | number>
  playerCount: number // apenas jogadores ativos (sem observers)
}

const props = defineProps<Props>()

const hasConfettiPlayed = ref(false)

// Calcular estatísticas dos votos
const numericVotes = computed(() => {
  return Object.values(props.votes).filter((v): v is number => typeof v === 'number')
})

const average = computed(() => {
  if (numericVotes.value.length === 0) return null
  const sum = numericVotes.value.reduce((acc, v) => acc + v, 0)
  return Math.round((sum / numericVotes.value.length) * 10) / 10
})

const min = computed(() => {
  if (numericVotes.value.length === 0) return null
  return Math.min(...numericVotes.value)
})

const max = computed(() => {
  if (numericVotes.value.length === 0) return null
  return Math.max(...numericVotes.value)
})

const hasConsensus = computed(() => {
  const values = Object.values(props.votes)
  if (values.length === 0) return false
  return values.every((v) => v === values[0])
})

const consensusValue = computed(() => {
  if (!hasConsensus.value) return null
  const values = Object.values(props.votes)
  return values[0] ?? null
})

// Vote distribution: quantas vezes cada valor aparece
const distribution = computed(() => {
  const dist: Record<string, number> = {}
  for (const vote of Object.values(props.votes)) {
    const key = String(vote)
    dist[key] = (dist[key] || 0) + 1
  }
  // Ordenar por contagem desc
  return Object.entries(dist)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
})

const maxCount = computed(() => {
  if (distribution.value.length === 0) return 0
  return Math.max(...distribution.value.map((d) => d.count))
})

// Confetti quando há consenso
function fireConfetti() {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
  })
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
    })
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
    })
  }, 250)
}

// Disparar confetti na primeira renderização se houver consenso
onMounted(() => {
  if (hasConsensus.value && !hasConfettiPlayed.value) {
    hasConfettiPlayed.value = true
    fireConfetti()
  }
})

watch(hasConsensus, (newVal) => {
  if (newVal && !hasConfettiPlayed.value) {
    hasConfettiPlayed.value = true
    fireConfetti()
  }
})
</script>

<template>
  <div class="vote-reveal animate-slide-up">
    <!-- Consensus Banner -->
    <div v-if="hasConsensus" class="consensus-banner">
      🎉 <strong>Consenso!</strong> Todos votaram
      <span class="consensus-value">{{ consensusValue }}</span>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div v-if="average !== null" class="stat-card">
        <span class="stat-label">Média</span>
        <span class="stat-value">{{ average }}</span>
      </div>
      <div v-if="min !== null" class="stat-card">
        <span class="stat-label">Mínimo</span>
        <span class="stat-value">{{ min }}</span>
      </div>
      <div v-if="max !== null" class="stat-card">
        <span class="stat-label">Máximo</span>
        <span class="stat-value">{{ max }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Votos</span>
        <span class="stat-value">{{ Object.keys(votes).length }}/{{ playerCount }}</span>
      </div>
    </div>

    <!-- Distribution -->
    <div v-if="distribution.length > 0" class="distribution">
      <h4 class="distribution-title">Distribuição</h4>
      <div class="distribution-bars">
        <div v-for="item in distribution" :key="item.value" class="bar-row">
          <span class="bar-label">{{ item.value }}</span>
          <div class="bar-track">
            <div class="bar-fill" :style="{ width: `${(item.count / maxCount) * 100}%` }"></div>
          </div>
          <span class="bar-count">{{ item.count }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vote-reveal {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.consensus-banner {
  text-align: center;
  padding: var(--space-4);
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(99, 102, 241, 0.1));
  border: 1px solid var(--c-success);
  border-radius: var(--radius-lg);
  font-size: var(--text-lg);
  color: var(--c-text);
}

.consensus-value {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  padding: 0 var(--space-2);
  background: var(--c-success);
  color: white;
  border-radius: var(--radius-md);
  font-weight: 700;
  margin-left: var(--space-1);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: var(--space-3);
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3);
  background: var(--c-bg-mute);
  border-radius: var(--radius-lg);
}

.stat-label {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--c-text-mute);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: var(--text-2xl);
  font-weight: 800;
  color: var(--c-primary);
}

.distribution {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.distribution-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--c-text-mute);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}

.distribution-bars {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.bar-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.bar-label {
  min-width: 36px;
  font-weight: 600;
  text-align: center;
  color: var(--c-text);
  font-size: var(--text-sm);
}

.bar-track {
  flex: 1;
  height: 24px;
  background: var(--c-bg-mute);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--c-primary), var(--c-secondary));
  border-radius: var(--radius-full);
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 8px;
}

.bar-count {
  min-width: 24px;
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--c-text-soft);
  text-align: right;
}
</style>
