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
import SessionSummary from './SessionSummary.vue'
import { useSocket } from '@/composables/useSocket'
import { useHistoryStore } from '@/stores/history'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const roomStore = useRoomStore()
const historyStore = useHistoryStore()
const {
  addSubjects,
  removeSubject,
  startSession,
  nextRound,
  resetSession,
  castVote,
  revealVotes,
  disconnect,
  joinRoom,
} = useSocket()

// Type-safe route param
const roomId = computed(() => {
  const id = route.params.id
  return (Array.isArray(id) ? id[0] : id) as string
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
    revealVotes(roomId.value)
  }
})

// Rejoin effect if the user refreshes the page directly on the /room/:id URL
if (userStore.playerId && userStore.playerName) {
  // Configs optionality means joining existing room handled by backend
  joinRoom(roomId.value, {
    id: userStore.playerId,
    name: userStore.playerName,
    role: userStore.playerRole,
  })
} else {
  // Go home to define a name
  router.push('/')
}

// --- Handlers ---

// Setup phase: backlog management
function handleAddSubject(subject: string) {
  addSubjects(roomId.value, [subject])
}

function handleRemoveSubject(index: number) {
  removeSubject(roomId.value, index)
}

function handleStartSession() {
  startSession(roomId.value)
}

// Voting phase
function handleVote(value: string | number) {
  if (currentRound.value?.status !== 'voting') return
  castVote(roomId.value, userStore.playerId, value)
}

function handleReveal() {
  revealVotes(roomId.value)
}

function handleNextRound() {
  nextRound(roomId.value)
}

function handleFinishSession() {
  nextRound(roomId.value) // Advances past last, which sets phase to 'completed'
}

// Completed / Leave
function handleNewSession() {
  resetSession(roomId.value)
}

function handleLeave() {
  if (roomStore.currentRoom && roomStore.currentRoom.rounds.length > 0) {
    historyStore.saveSession({
      id: `${roomId.value}-${Date.now()}`,
      date: new Date().toISOString(),
      roomId: roomId.value,
      deckType: deckType.value,
      rounds: roomStore.currentRoom.rounds,
    })
  }

  disconnect()
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
              <span class="badge badge-phase">
                {{
                  roomStore.isSetupPhase
                    ? '📝 Preparação'
                    : roomStore.isVotingPhase
                      ? '🗳️ Votação'
                      : '✅ Concluída'
                }}
              </span>
            </div>
          </div>
          <BaseButton variant="ghost" size="sm" @click="handleLeave"> Sair da Sala </BaseButton>
        </div>
      </template>
    </BaseCard>

    <!-- ======================== -->
    <!-- PHASE: SETUP             -->
    <!-- ======================== -->
    <div v-if="roomStore.isSetupPhase" class="room-content">
      <div class="voting-panel">
        <BaseCard class="section-card" title="📋 Planejamento da Sessão">
          <template v-if="isAdmin">
            <SubjectForm
              :subjects="roomStore.subjects"
              :player-count="players.length"
              @add="handleAddSubject"
              @remove="handleRemoveSubject"
              @start="handleStartSession"
            />
          </template>
          <template v-else>
            <div class="waiting-message">
              <p class="waiting-icon">📝</p>
              <p>O Scrum Master está preparando os subjects para votação...</p>
              <div v-if="roomStore.subjects.length > 0" class="preview-backlog">
                <p class="backlog-count">
                  {{ roomStore.subjects.length }}
                  {{
                    roomStore.subjects.length === 1 ? 'subject cadastrado' : 'subjects cadastrados'
                  }}
                </p>
                <ul class="preview-list">
                  <li v-for="(item, index) in roomStore.subjects" :key="index" class="preview-item">
                    <span class="preview-index">{{ index + 1 }}.</span>
                    {{ item }}
                  </li>
                </ul>
              </div>
            </div>
          </template>
        </BaseCard>
      </div>

      <div class="sidebar-panel">
        <BaseCard title="Participantes" class="section-card">
          <PlayerList :players="players" :votes="{}" :status="'waiting'" />
        </BaseCard>
      </div>
    </div>

    <!-- ======================== -->
    <!-- PHASE: VOTING            -->
    <!-- ======================== -->
    <div v-if="roomStore.isVotingPhase" class="room-content">
      <div class="voting-panel">
        <!-- Round Header with progress -->
        <RoundHeader
          v-if="currentRound"
          :subject="currentRound.subject"
          :round-number="roomStore.currentSubjectIndex"
          :total-subjects="roomStore.totalSubjects"
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
          :is-last-subject="roomStore.isLastSubject"
          @reveal="handleReveal"
          @next-round="handleNextRound"
          @finish="handleFinishSession"
        />

        <!-- Waiting: não é admin e sem rodada -->
        <BaseCard v-if="!currentRound && !isAdmin" class="section-card">
          <div class="waiting-message">
            <p class="waiting-icon">⏳</p>
            <p>Aguardando o Scrum Master iniciar a votação...</p>
          </div>
        </BaseCard>
      </div>

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

    <!-- ======================== -->
    <!-- PHASE: COMPLETED         -->
    <!-- ======================== -->
    <div v-if="roomStore.isCompleted" class="room-content room-content--full">
      <SessionSummary
        :rounds="roomStore.currentRoom?.rounds ?? []"
        :player-count="activePlayerCount"
        @new-session="handleNewSession"
        @leave="handleLeave"
      />
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
  flex-wrap: wrap;
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

.badge-phase {
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

.room-content--full {
  grid-template-columns: 1fr;
  max-width: 700px;
  margin: 0 auto;
  width: 100%;
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

/* Preview backlog (non-admin setup view) */
.preview-backlog {
  margin-top: var(--space-4);
  text-align: left;
}

.backlog-count {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--c-primary);
  margin-bottom: var(--space-2);
}

.preview-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.preview-item {
  font-size: var(--text-sm);
  padding: var(--space-1) var(--space-2);
  background: var(--c-bg-mute);
  border-radius: var(--radius-sm);
}

.preview-index {
  font-weight: 600;
  color: var(--c-primary);
  margin-right: var(--space-1);
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
