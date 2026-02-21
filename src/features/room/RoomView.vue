<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useRoomStore } from '@/stores/room'
import { DECKS } from '@/types'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import SubjectForm from './SubjectForm.vue'
import RoundHeader from './RoundHeader.vue'
import VotingArea from './VotingArea.vue'
import PlayerList from './PlayerList.vue'
import PokerTable from './PokerTable.vue'
import VoteReveal from './VoteReveal.vue'
import RoundControls from './RoundControls.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const roomStore = useRoomStore()

// Type-safe route param
const roomId = computed(() => {
  const id = route.params.id
  return Array.isArray(id) ? id[0] : id
})

const isAdmin = computed(() => userStore.playerRole === 'admin')
const isObserver = computed(() => userStore.playerRole === 'observer')

const deckLabel = computed(() => {
  const dt = roomStore.roomConfig?.deckType
  return dt ? DECKS[dt].label : 'Fibonacci'
})

const deckType = computed(() => roomStore.roomConfig?.deckType ?? 'fibonacci')
const currentRound = computed(() => roomStore.currentRound)
const players = computed(() => roomStore.players)
const selectedVote = computed(() => {
  if (!currentRound.value) return null
  return currentRound.value.votes[userStore.playerId] ?? null
})

// Apenas jogadores ativos (não observers) para contagem
const activePlayerCount = computed(() => players.value.filter((p) => p.role !== 'observer').length)

const allActiveVoted = computed(() => {
  if (!currentRound.value) return false
  const activePlayers = players.value.filter((p) => p.role !== 'observer')
  return activePlayers.every((p) => p.id in currentRound.value!.votes)
})

// Auto-reveal quando configurado e todos votaram
const autoReveal = computed(() => roomStore.roomConfig?.autoReveal ?? false)
watch(allActiveVoted, (allVoted) => {
  if (allVoted && autoReveal.value && currentRound.value?.status === 'voting') {
    roomStore.revealVotes()
  }
})

// Adicionar jogadores mock para demonstração (serão removidos na Fase 5 com WebSocket)
function addMockPlayers() {
  roomStore.addPlayer({ id: 'mock-1', name: 'Maria', role: 'member' })
  roomStore.addPlayer({ id: 'mock-2', name: 'João', role: 'member' })
  roomStore.addPlayer({ id: 'mock-3', name: 'Ana', role: 'observer' })
}

// Se a sala não tem outros jogadores, adicionar mocks
if (players.value.length <= 1) {
  addMockPlayers()
}

// Handlers
function handleStartRound(subject: string) {
  roomStore.startRound(subject)
}

function handleVote(value: string | number) {
  if (currentRound.value?.status !== 'voting') return
  roomStore.castVote(userStore.playerId, value)

  // Mock: simular votos dos outros jogadores após 500ms
  setTimeout(() => {
    const deck = DECKS[deckType.value].values
    for (const p of players.value) {
      if (p.id !== userStore.playerId && p.role !== 'observer') {
        if (!currentRound.value?.votes[p.id]) {
          const randomValue = deck[Math.floor(Math.random() * (deck.length - 1))]
          if (randomValue !== undefined) {
            roomStore.castVote(p.id, randomValue)
          }
        }
      }
    }
  }, 800)
}

function handleReveal() {
  roomStore.revealVotes()
}

function handleNewRound() {
  // Reseta o estado para permitir nova rodada
  // O SubjectForm aparecerá automaticamente
}

function handleLeave() {
  roomStore.leaveRoom()
  userStore.clearPlayer()
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="room-container">
    <!-- Room Header -->
    <BaseCard class="room-info-card">
      <template #header>
        <div class="room-header">
          <div>
            <h2 class="room-title">
              Sala <span class="room-code">{{ roomId }}</span>
            </h2>
            <div class="room-meta">
              <span class="badge badge-role" :class="userStore.playerRole">
                {{ isAdmin ? '👑 Admin' : isObserver ? '👁️ Espectador' : '🃏 Jogador' }}
              </span>
              <span class="badge badge-deck">{{ deckLabel }}</span>
            </div>
          </div>
          <BaseButton variant="ghost" size="sm" @click="handleLeave"> Sair da Sala </BaseButton>
        </div>
      </template>
    </BaseCard>

    <!-- Main Content: Two Column Layout -->
    <div class="room-content">
      <!-- Left: Voting Area -->
      <div class="voting-panel">
        <!-- Admin: Subject Form (quando não há rodada ativa ou após revelar) -->
        <BaseCard
          v-if="isAdmin && (!currentRound || currentRound.status === 'revealed')"
          class="section-card"
        >
          <SubjectForm @submit="handleStartRound" />
        </BaseCard>

        <!-- Round Header (quando há rodada ativa) -->
        <RoundHeader
          v-if="currentRound"
          :subject="currentRound.subject"
          :round-number="roomStore.currentRoom!.currentRoundIndex + 1"
          :total-rounds="roomStore.currentRoom!.rounds.length"
          :status="currentRound.status"
        />

        <!-- Poker Table (Mesa central com animações 3D) -->
        <BaseCard v-if="currentRound" class="section-card table-wrapper">
          <PokerTable
            :players="players"
            :votes="currentRound.votes"
            :status="currentRound.status"
          />
        </BaseCard>

        <!-- Voting Cards (jogadores podem votar) -->
        <BaseCard v-if="currentRound?.status === 'voting' && !isObserver" class="section-card">
          <VotingArea :deck-type="deckType" :selected-value="selectedVote" @vote="handleVote" />
        </BaseCard>

        <!-- Observer waiting message -->
        <BaseCard v-if="currentRound?.status === 'voting' && isObserver" class="section-card">
          <div class="observer-message">
            <p>👁️ Você está como espectador</p>
            <p class="observer-sub">Aguardando os jogadores votarem...</p>
          </div>
        </BaseCard>

        <!-- Vote Reveal (após revelar) -->
        <BaseCard v-if="currentRound?.status === 'revealed'" class="section-card">
          <VoteReveal :votes="currentRound.votes" :player-count="activePlayerCount" />
        </BaseCard>

        <!-- Admin Controls -->
        <RoundControls
          v-if="isAdmin && currentRound"
          :status="currentRound.status"
          :all-voted="allActiveVoted"
          @reveal="handleReveal"
          @new-round="handleNewRound"
        />

        <!-- Empty state: sem rodada e não é admin -->
        <BaseCard v-if="!currentRound && !isAdmin" class="section-card">
          <div class="waiting-message">
            <p class="waiting-icon">⏳</p>
            <p>Aguardando o Scrum Master iniciar uma rodada...</p>
          </div>
        </BaseCard>
      </div>

      <!-- Right: Player List -->
      <div class="sidebar-panel">
        <BaseCard title="Participantes" class="section-card">
          <PlayerList
            :players="players"
            :votes="currentRound?.votes ?? {}"
            :status="currentRound?.status ?? 'waiting'"
          />
        </BaseCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.room-container {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  animation: slideUp var(--transition-normal);
}

.room-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}

.room-title {
  font-size: var(--text-xl);
  font-weight: 700;
  margin: 0;
}

.room-code {
  color: var(--c-primary);
  font-family: monospace;
  letter-spacing: 1px;
}

.room-meta {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.badge {
  font-size: var(--text-xs);
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  font-weight: 500;
}

.badge-role {
  background: var(--c-primary-soft);
  color: var(--c-primary);
}

.badge-role.admin {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.badge-role.observer {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.badge-deck {
  background: var(--c-bg-mute);
  color: var(--c-text-mute);
}

/* Two Column Layout */
.room-content {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: var(--space-5);
  align-items: start;
}

.voting-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.sidebar-panel {
  position: sticky;
  top: 80px; /* Navbar height + padding */
}

.section-card {
  animation: slideUp var(--transition-normal);
}

/* Messages */
.observer-message,
.waiting-message {
  text-align: center;
  padding: var(--space-6) 0;
  color: var(--c-text-mute);
}

.observer-sub {
  font-size: var(--text-sm);
  margin-top: var(--space-1);
}

.waiting-icon {
  font-size: 2rem;
  margin-bottom: var(--space-2);
}

/* Responsive */
@media (max-width: 768px) {
  .room-content {
    grid-template-columns: 1fr;
  }

  .sidebar-panel {
    position: static;
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
