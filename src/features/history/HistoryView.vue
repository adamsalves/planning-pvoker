<script setup lang="ts">
import { useHistoryStore } from '@/stores/history'
import { computed } from 'vue'
import BaseCard from '@/components/BaseCard.vue'
import RoundSummary from './RoundSummary.vue'
import SessionChart from './SessionChart.vue'

const historyStore = useHistoryStore()
const sessions = computed(() => historyStore.sessions)

function formatDate(isoString: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoString))
}
</script>

<template>
  <div class="history-container">
    <header class="history-header">
      <h1 class="page-title">Histórico de Sessões</h1>
      <p class="page-subtitle">Suas rodadas de Planning Poker anteriores</p>
    </header>

    <div v-if="sessions.length === 0" class="empty-state">
      <span class="empty-icon">📂</span>
      <h2>Nenhum histórico encontrado</h2>
      <p>Você ainda não participou de sessões com rodadas finalizadas.</p>
    </div>

    <div v-else class="sessions-list">
      <BaseCard v-for="session in sessions" :key="session.id" class="session-card">
        <template #header>
          <div class="session-header">
            <div>
              <h2 class="session-title">Sala: {{ session.roomId }}</h2>
              <span class="session-date">{{ formatDate(session.date) }}</span>
            </div>
            <div class="session-meta">
              <span class="badge">Baralho: {{ session.deckType }}</span>
              <span class="badge accent">{{ session.rounds.length }} Rodadas</span>
            </div>
          </div>
        </template>

        <div class="session-content">
          <!-- Rounds List -->
          <div class="rounds-col">
            <RoundSummary
              v-for="(round, idx) in session.rounds"
              :key="round.id"
              :round="round"
              :round-number="idx + 1"
            />
          </div>

          <!-- Chart Area -->
          <div class="chart-col">
            <SessionChart :session="session" />
          </div>
        </div>
      </BaseCard>
    </div>
  </div>
</template>

<style scoped>
.history-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: var(--space-4) 0;
  animation: slideUp var(--transition-normal);
}

.history-header {
  margin-bottom: var(--space-8);
  text-align: center;
}

.page-title {
  font-size: var(--text-3xl);
  font-weight: 800;
  margin-bottom: var(--space-2);
}

.page-subtitle {
  color: var(--c-text-mute);
  font-size: var(--text-lg);
}

.empty-state {
  text-align: center;
  padding: var(--space-12) 0;
  color: var(--c-text-mute);
}

.empty-icon {
  font-size: 4rem;
  display: block;
  margin-bottom: var(--space-4);
  opacity: 0.5;
}

.empty-state h2 {
  color: var(--c-text);
  margin-bottom: var(--space-2);
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.session-card {
  overflow: hidden;
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.session-title {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: 700;
}

.session-date {
  font-size: var(--text-sm);
  color: var(--c-text-mute);
}

.session-meta {
  display: flex;
  gap: var(--space-2);
}

.badge {
  background: var(--c-bg-mute);
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 500;
}

.badge.accent {
  background: var(--c-primary-soft);
  color: var(--c-primary);
}

.session-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-6);
  padding-top: var(--space-4);
}

@media (max-width: 768px) {
  .session-content {
    grid-template-columns: 1fr;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
