<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import IconCrown from '~icons/lucide/crown'
import IconCheck from '~icons/lucide/check'
import IconHourglass from '~icons/lucide/hourglass'
import IconEye from '~icons/lucide/eye'
import IconUserMinus from '~icons/lucide/user-minus'
import type { Player } from '@/types'
import { activePlayersOf, observersOf } from '@/utils/players'

interface Props {
  players: Player[]
  votes: Record<string, string | number>
  status: 'waiting' | 'voting' | 'revealed'
  // Tirados pela admin DESTA rodada — seguem nesta seção (não viram espectadores).
  nonVoterIds?: string[]
  // Mostra o toggle de "vota nesta rodada". Default false: o RoomSetup usa este
  // mesmo componente sem rodada nenhuma, onde a escolha não existe.
  votersEditable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  nonVoterIds: () => [],
  votersEditable: false,
})

const emit = defineEmits<{
  'toggle-voter': [playerId: string, voting: boolean]
}>()

const { t } = useI18n()

// Separar jogadores ativos dos espectadores
const activePlayers = computed(() => activePlayersOf(props.players))
const observers = computed(() => observersOf(props.players))

function hasVoted(playerId: string): boolean {
  return playerId in props.votes
}

function getVote(playerId: string): string | number | undefined {
  return props.votes[playerId]
}

function isNonVoter(playerId: string): boolean {
  return props.nonVoterIds.includes(playerId)
}
</script>

<template>
  <div class="player-list-wrapper">
    <!-- Active Players -->
    <div class="player-section">
      <h4 class="section-title">{{ t('room.players.title', { count: activePlayers.length }) }}</h4>
      <TransitionGroup name="player" tag="ul" class="player-list">
        <li
          v-for="player in activePlayers"
          :key="player.id"
          class="player-item"
          :class="{ 'non-voter-item': isNonVoter(player.id) }"
          v-memo="[
            player.name,
            player.role,
            status,
            hasVoted(player.id),
            getVote(player.id),
            isNonVoter(player.id),
            votersEditable,
          ]"
        >
          <div class="player-info">
            <!-- Checkbox real (não div clicável): o toggle precisa ser focável e
                 anunciado como caixa de seleção. O rótulo textual fica no sr-only,
                 já que a linha inteira já mostra o nome visualmente. -->
            <label v-if="votersEditable" class="voter-toggle">
              <input
                type="checkbox"
                :checked="!isNonVoter(player.id)"
                @change="emit('toggle-voter', player.id, isNonVoter(player.id))"
              />
              <span class="sr-only">{{ t('room.voters.toggleLabel', { name: player.name }) }}</span>
            </label>
            <span class="player-avatar">{{ player.name.charAt(0).toUpperCase() }}</span>
            <span class="player-name">
              {{ player.name }}
              <IconCrown v-if="player.role === 'admin'" class="admin-badge" aria-hidden="true" />
              <span v-if="player.role === 'admin'" class="sr-only">{{
                t('room.players.adminSr')
              }}</span>
            </span>
          </div>
          <div class="player-status">
            <Transition name="fade" mode="out-in">
              <!-- Fora da rodada: precede votou/pendente, senão apareceria como
                   "aguardando voto" alguém de quem ninguém espera voto. -->
              <span v-if="isNonVoter(player.id)" class="non-voter-badge" key="non-voter">
                <IconUserMinus aria-hidden="true" /><span class="sr-only">{{
                  t('room.voters.notVotingLabel')
                }}</span>
              </span>
              <!-- Votação em andamento: mostrar se votou ou não -->
              <span
                v-else-if="status === 'voting' && hasVoted(player.id)"
                class="voted-badge"
                key="voted"
              >
                <IconCheck aria-hidden="true" /><span class="sr-only">{{
                  t('room.players.voted')
                }}</span>
              </span>
              <span v-else-if="status === 'voting'" class="pending-badge" key="pending">
                <IconHourglass aria-hidden="true" /><span class="sr-only">{{
                  t('room.players.waitingVote')
                }}</span>
              </span>
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
      <h4 class="section-title">
        {{ t('room.players.observersTitle', { count: observers.length }) }}
      </h4>
      <ul class="player-list">
        <li v-for="player in observers" :key="player.id" class="player-item observer-item">
          <div class="player-info">
            <span class="player-avatar observer-avatar">{{
              player.name.charAt(0).toUpperCase()
            }}</span>
            <span class="player-name">{{ player.name }}</span>
          </div>
          <IconEye class="observer-badge" aria-hidden="true" />
          <span class="sr-only">{{ t('room.players.observerSr') }}</span>
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

/* Ícones de papel/status: cor pelos tokens semânticos (invertem no dark, F3.9) e
   tamanho pelo font-size do contexto — a `.app-icon` normaliza o SVG em 1em. */
.admin-badge {
  font-size: var(--text-sm);
  color: var(--c-warning-text);
}

.player-status {
  min-width: 40px;
  text-align: center;
}

.voted-badge {
  font-size: var(--text-base);
  color: var(--c-success-text);
}

.pending-badge {
  font-size: var(--text-base);
  color: var(--c-text-mute);
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
  font-size: var(--text-base);
  color: var(--c-text-mute);
}

.observer-item {
  opacity: 0.7;
}

/* Fora da rodada: mesmo tom apagado do espectador, porém MENOS forte — a pessoa
   segue na seção de jogadores e volta a votar com um clique do admin. */
.non-voter-item {
  opacity: 0.75;
}

.non-voter-badge {
  font-size: var(--text-base);
  color: var(--c-text-mute);
}

/* O checkbox fica à esquerda do avatar, alinhado com o resto da linha. */
.voter-toggle {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  flex-shrink: 0;
}

.voter-toggle input {
  cursor: pointer;
  accent-color: var(--c-primary);
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
