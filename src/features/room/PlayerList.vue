<script setup lang="ts">
import { computed } from 'vue'
import type { Player } from '@/types'

interface Props {
  players: Player[]
  votes: Record<string, string | number>
  status: 'waiting' | 'voting' | 'revealed'
}

const props = defineProps<Props>()

// Separar jogadores ativos dos espectadores
const activePlayers = computed(() => props.players.filter((p) => p.role !== 'observer'))
const observers = computed(() => props.players.filter((p) => p.role === 'observer'))

function hasVoted(playerId: string): boolean {
  return playerId in props.votes
}

function getVote(playerId: string): string | number | undefined {
  return props.votes[playerId]
}
</script>

<template>
  <div class="player-list-wrapper">
    <!-- Active Players -->
    <div class="player-section">
      <h4 class="section-title">Jogadores ({{ activePlayers.length }})</h4>
      <TransitionGroup name="player" tag="ul" class="player-list">
        <li v-for="player in activePlayers" :key="player.id" class="player-item">
          <div class="player-info">
            <span class="player-avatar">{{ player.name.charAt(0).toUpperCase() }}</span>
            <span class="player-name">
              {{ player.name }}
              <span v-if="player.role === 'admin'" class="admin-badge">👑</span>
            </span>
          </div>
          <div class="player-status">
            <Transition name="fade" mode="out-in">
              <!-- Votação em andamento: mostrar se votou ou não -->
              <span
                v-if="status === 'voting' && hasVoted(player.id)"
                class="voted-badge"
                key="voted"
              >
                ✅
              </span>
              <span v-else-if="status === 'voting'" class="pending-badge" key="pending"> ⏳ </span>
              <!-- Votos revelados: mostrar o valor -->
              <span
                v-else-if="status === 'revealed' && hasVoted(player.id)"
                class="vote-value"
                key="value"
              >
                {{ getVote(player.id) }}
              </span>
            </Transition>
          </div>
        </li>
      </TransitionGroup>
    </div>

    <!-- Observers -->
    <div v-if="observers.length > 0" class="player-section observers">
      <h4 class="section-title">Espectadores ({{ observers.length }})</h4>
      <ul class="player-list">
        <li v-for="player in observers" :key="player.id" class="player-item observer-item">
          <div class="player-info">
            <span class="player-avatar observer-avatar">{{
              player.name.charAt(0).toUpperCase()
            }}</span>
            <span class="player-name">{{ player.name }}</span>
          </div>
          <span class="observer-badge">👁️</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.player-list-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.section-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--c-text-mute);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: var(--space-2);
}

.player-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.player-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--c-bg-mute);
  transition: background var(--transition-fast);
}

.player-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.player-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--c-primary), var(--c-secondary));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: var(--text-sm);
  flex-shrink: 0;
}

.observer-avatar {
  background: var(--c-border);
  color: var(--c-text-mute);
}

.player-name {
  font-weight: 500;
  font-size: var(--text-base);
  color: var(--c-text);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.admin-badge {
  font-size: var(--text-xs);
}

.player-status {
  min-width: 40px;
  text-align: center;
}

.voted-badge {
  font-size: var(--text-base);
}

.pending-badge {
  font-size: var(--text-base);
  animation: pulse 1.5s ease-in-out infinite;
}

.vote-value {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 var(--space-2);
  background: var(--c-primary-soft);
  color: var(--c-primary);
  border-radius: var(--radius-md);
  font-weight: 700;
  font-size: var(--text-sm);
}

.observer-badge {
  font-size: var(--text-sm);
}

.observer-item {
  opacity: 0.7;
}

/* Animations */
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

.player-enter-active,
.player-leave-active {
  transition: all var(--transition-normal);
}

.player-enter-from,
.player-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-fast);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
