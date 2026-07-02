<script setup lang="ts">
import { computed } from 'vue'
import { useRoomStore } from '@/stores/room'
import BaseCard from '@/components/BaseCard.vue'
import RoundHeader from './RoundHeader.vue'
import PokerTable from './PokerTable.vue'
import VotingArea from './VotingArea.vue'
import VoteReveal from './VoteReveal.vue'
import RoundControls from './RoundControls.vue'
import PlayerList from './PlayerList.vue'

// Estado da sala vem do store; o derivado do usuário (papel, voto otimista,
// contagens) chega por prop e os eventos sobem para o RoomView (dono do socket).
defineProps<{
  isAdmin: boolean
  isObserver: boolean
  selectedVote: string | number | null
  activePlayerCount: number
  allActiveVoted: boolean
}>()

defineEmits<{
  vote: [value: string | number]
  reveal: []
  'next-round': []
  finish: []
}>()

const roomStore = useRoomStore()
const currentRound = computed(() => roomStore.currentRound)
const deckType = computed(() => roomStore.roomConfig?.deckType ?? 'fibonacci')
</script>

<template>
  <div class="room-content">
    <div class="voting-panel">
      <!-- Cabeçalho da rodada com progresso -->
      <RoundHeader
        v-if="currentRound"
        :subject="currentRound.subject"
        :round-number="roomStore.currentSubjectIndex"
        :total-subjects="roomStore.totalSubjects"
        :status="currentRound.status"
      />

      <!-- Mesa central -->
      <BaseCard v-if="currentRound" class="section-card">
        <PokerTable
          :players="roomStore.players"
          :votes="currentRound.votes"
          :status="currentRound.status"
        />
      </BaseCard>

      <!-- Cartas de votação (jogadores podem votar) -->
      <BaseCard v-if="currentRound?.status === 'voting' && !isObserver" class="section-card">
        <VotingArea
          :deck-type="deckType"
          :selected-value="selectedVote"
          @vote="$emit('vote', $event)"
        />
      </BaseCard>

      <!-- Mensagem para o espectador -->
      <BaseCard v-if="currentRound?.status === 'voting' && isObserver" class="section-card">
        <div class="observer-message">
          <p>👁️ Você está como espectador</p>
          <p class="observer-sub">Aguardando os jogadores votarem...</p>
        </div>
      </BaseCard>

      <!-- Resultado (após revelar) -->
      <BaseCard v-if="currentRound?.status === 'revealed'" class="section-card">
        <VoteReveal :votes="currentRound.votes" :player-count="activePlayerCount" />
      </BaseCard>

      <!-- Controles do admin -->
      <RoundControls
        v-if="isAdmin && currentRound"
        :status="currentRound.status"
        :all-voted="allActiveVoted"
        :is-last-subject="roomStore.isLastSubject"
        @reveal="$emit('reveal')"
        @next-round="$emit('next-round')"
        @finish="$emit('finish')"
      />

      <!-- Espera: não é admin e ainda não há rodada -->
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
          :players="roomStore.players"
          :votes="currentRound?.votes ?? {}"
          :status="currentRound?.status ?? 'waiting'"
        />
      </BaseCard>
    </div>
  </div>
</template>

<style scoped>
/* Layout de fase de 2 colunas — espelhado em RoomSetup (mesma grade da sala). */
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

@media (max-width: 768px) {
  .room-content {
    grid-template-columns: 1fr;
  }

  .sidebar-panel {
    position: static;
  }
}
</style>
