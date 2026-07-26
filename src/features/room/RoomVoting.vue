<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import IconEye from '~icons/lucide/eye'
import IconHourglass from '~icons/lucide/hourglass'
import IconUserMinus from '~icons/lucide/user-minus'
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
  // O usuário local vota nesta rodada? (false = observer OU tirado pelo admin)
  isVotingThisRound: boolean
  selectedVote: string | number | null
  // Quem o admin tirou desta rodada — continuam sentados à mesa, sem deck.
  nonVoterIds: string[]
  voterCount: number
  allVotersVoted: boolean
}>()

defineEmits<{
  vote: [value: string | number]
  reveal: []
  'next-round': []
  finish: []
  'toggle-voter': [playerId: string, voting: boolean]
}>()

const { t } = useI18n()
const roomStore = useRoomStore()
const currentRound = computed(() => roomStore.currentRound)
const deckType = computed(() => roomStore.roomConfig?.deckType ?? 'fibonacci')

// Ao menos um voto lançado — habilita o "Revelar Votos" (revelar zero votos não
// mostra nada). Deriva direto da rodada; observers não entram em `votes`.
const anyVoted = computed(() => Object.keys(currentRound.value?.votes ?? {}).length > 0)
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
          :non-voter-ids="nonVoterIds"
          :absent-player-ids="roomStore.absentPlayerIds"
        />
      </BaseCard>

      <!-- Cartas de votação (só quem vota nesta rodada) -->
      <BaseCard v-if="currentRound?.status === 'voting' && isVotingThisRound" class="section-card">
        <VotingArea
          :deck-type="deckType"
          :selected-value="selectedVote"
          @vote="$emit('vote', $event)"
        />
      </BaseCard>

      <!-- Mensagem para o espectador (papel da SALA) -->
      <BaseCard v-if="currentRound?.status === 'voting' && isObserver" class="section-card">
        <div class="observer-message">
          <p><IconEye class="btn-icon" aria-hidden="true" />{{ t('room.voting.observerTitle') }}</p>
          <p class="observer-sub">{{ t('room.voting.observerWaiting') }}</p>
        </div>
      </BaseCard>

      <!-- Tirado DESTA rodada pelo admin: distinto do espectador, que é papel da
           sala inteira. Ícone user-minus (eye é reservado ao papel de observer). -->
      <BaseCard
        v-if="currentRound?.status === 'voting' && !isObserver && !isVotingThisRound"
        class="section-card"
      >
        <div class="observer-message">
          <p>
            <IconUserMinus class="btn-icon" aria-hidden="true" />{{
              t('room.voters.notVotingTitle')
            }}
          </p>
          <p class="observer-sub">{{ t('room.voters.notVotingSub') }}</p>
        </div>
      </BaseCard>

      <!-- Resultado (após revelar) -->
      <BaseCard v-if="currentRound?.status === 'revealed'" class="section-card">
        <VoteReveal :votes="currentRound.votes" :player-count="voterCount" />
      </BaseCard>

      <!-- Controles do admin -->
      <RoundControls
        v-if="isAdmin && currentRound"
        :status="currentRound.status"
        :any-voted="anyVoted"
        :all-voted="allVotersVoted"
        :is-last-subject="roomStore.isLastSubject"
        @reveal="$emit('reveal')"
        @next-round="$emit('next-round')"
        @finish="$emit('finish')"
      />

      <!-- Espera: não é admin e ainda não há rodada -->
      <BaseCard v-if="!currentRound && !isAdmin" class="section-card">
        <div class="waiting-message">
          <IconHourglass class="waiting-icon" aria-hidden="true" />
          <p>{{ t('room.voting.waitingForStart') }}</p>
        </div>
      </BaseCard>
    </div>

    <div class="sidebar-panel">
      <BaseCard :title="t('room.participants')" class="section-card">
        <PlayerList
          :players="roomStore.players"
          :votes="currentRound?.votes ?? {}"
          :status="currentRound?.status ?? 'waiting'"
          :non-voter-ids="nonVoterIds"
          :absent-player-ids="roomStore.absentPlayerIds"
          :voters-editable="isAdmin && currentRound?.status === 'voting'"
          @toggle-voter="(id, voting) => $emit('toggle-voter', id, voting)"
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

/* Era um <p> com o emoji; agora é o SVG, que a `.app-icon` deixa inline-block em
   1em — o font-size é que dá o tamanho e o text-align do pai é que centraliza. */
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
