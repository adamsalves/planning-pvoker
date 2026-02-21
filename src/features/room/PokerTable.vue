<script setup lang="ts">
import { computed } from 'vue'
import type { Player } from '@/types'
import PokerCard from './PokerCard.vue'

interface Props {
  players: Player[]
  votes: Record<string, string | number>
  status: 'waiting' | 'voting' | 'revealed'
}

const props = defineProps<Props>()

// Apenas mostramos jogadores ativos na mesa (espectadores não "sentam")
const activePlayers = computed(() => props.players.filter((p) => p.role !== 'observer'))

function hasVoted(playerId: string) {
  return playerId in props.votes
}

// Calcula a posição de cada jogador na mesa oval
function getPlayerStyle(index: number) {
  const total = activePlayers.value.length

  if (total === 1) {
    // Se for só 1 jogador, coloca centralizado na parte inferior
    return { transform: `translate(-50%, calc(-50% + 150px))` }
  }

  // Começa em 90 graus (Math.PI / 2) para o primeiro jogador ficar na base
  const angle = Math.PI / 2 + (index / total) * Math.PI * 2

  // Raios da elipse (espaçamento ao redor da mesa)
  const rx = 220 // Horizontal
  const ry = 150 // Vertical

  const x = Math.cos(angle) * rx
  const y = Math.sin(angle) * ry

  return {
    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
  }
}
</script>

<template>
  <div class="poker-table">
    <!-- Centro da mesa (mensagem ou vazio) -->
    <div class="table-center">
      <div class="table-surface">
        <span v-if="status === 'waiting'" class="table-message">Aguardando rodada...</span>
        <span v-else-if="status === 'voting'" class="table-message pulsing"
          >Votos em andamento</span
        >
        <span v-else class="table-message">Votos revelados!</span>
      </div>
    </div>

    <!-- Jogadores ao redor (Posicionamento absoluto calculado) -->
    <div class="players-ring">
      <TransitionGroup name="table-player">
        <div
          v-for="(player, index) in activePlayers"
          :key="player.id"
          class="player-spot"
          :style="getPlayerStyle(index)"
        >
          <!-- Card Area -->
          <div class="card-area">
            <Transition name="card-drop">
              <PokerCard
                v-if="hasVoted(player.id)"
                :value="status === 'revealed' ? (votes[player.id] ?? '') : ''"
                :face-down="status === 'voting'"
                disabled
                class="table-card"
              />
              <div v-else class="empty-card-slot"></div>
            </Transition>
          </div>

          <!-- Name Tag -->
          <div class="player-tag">
            <span class="avatar">{{ player.name.charAt(0).toUpperCase() }}</span>
            <span class="name">{{ player.name }}</span>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
.poker-table {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 480px; /* Área grande o suficiente para o oval não transbordar */
  width: 100%;
  overflow: hidden; /* Evitar scrollbar se a janela for muito estreita */
}

.table-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
}

.table-surface {
  width: 260px;
  height: 120px;
  background: var(--c-bg-mute);
  border: 4px solid var(--c-border);
  border-radius: 60px; /* Oval look */
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.05);
}

.table-message {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--c-text-mute);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.pulsing {
  animation: pulse-text 1.5s infinite ease-in-out;
  color: var(--c-primary);
}

.players-ring {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* Permite clicar através do container principal */
  z-index: 2; /* Acima da mesa */
}

.player-spot {
  position: absolute;
  left: 50%;
  top: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  width: 100px; /* Consistente para alinhar independente da tag/carta */
  pointer-events: auto; /* Reabilita cliques no item específico, se precisar */
  transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.card-area {
  height: 100px;
  display: flex;
  align-items: flex-end; /* A carta "cai" e fica alinhada na base */
}

/* Reduzir levemente a carta da mesa para caber melhor */
.table-card {
  transform: scale(0.9);
  transform-origin: bottom center;
}

.empty-card-slot {
  width: calc(72px * 0.9);
  height: calc(100px * 0.9);
  border: 2px dashed var(--c-border);
  border-radius: var(--radius-md);
  opacity: 0.3;
}

.player-tag {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--c-bg);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--c-border);
}

.avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--c-primary), var(--c-secondary));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
}

.name {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--c-text);
  max-width: 60px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Animations */
@keyframes pulse-text {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}

.card-drop-enter-active {
  transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.card-drop-leave-active {
  transition: all 0.3s ease;
}
.card-drop-enter-from {
  opacity: 0;
  transform: translateY(-40px) scale(0.9) rotate(-15deg);
}
.card-drop-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(10px);
}

.table-player-enter-active,
.table-player-leave-active {
  transition: all var(--transition-normal);
}
.table-player-enter-from,
.table-player-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
