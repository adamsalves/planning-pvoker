<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useUserStore } from '@/stores/user'
import { useRoomStore } from '@/stores/room'
import { useConnectionStore } from '@/stores/connection'
import { activePlayersOf } from '@/utils/players'
import { revealedRoundsOf } from '@/utils/rounds'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import BaseModal from '@/components/BaseModal.vue'
import RoomSetup from './RoomSetup.vue'
import RoomVoting from './RoomVoting.vue'
import RoomSummary from './RoomSummary.vue'
import SessionSummary from './SessionSummary.vue'
import { useSocket } from '@/composables/useSocket'
import { useShareRoom } from '@/composables/useShareRoom'
import { JoinAckError } from '@/composables/joinErrors'
import { useHistoryStore } from '@/stores/history'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const roomStore = useRoomStore()
const connectionStore = useConnectionStore()
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
  leaveRoom,
} = useSocket()

// Type-safe route param (sem cast `as` — String() normaliza string | string[]).
const roomId = computed(() => {
  const id = route.params.id
  return String(Array.isArray(id) ? id[0] : id)
})

// Admin é derivado da fonte da verdade (servidor): quem é o adminId da sala.
// Fallback para o role local apenas até o primeiro room_state_updated chegar.
const isAdmin = computed(() => {
  const room = roomStore.currentRoom
  return room ? room.adminId === userStore.playerId : userStore.playerRole === 'admin'
})
const isObserver = computed(() => userStore.playerRole === 'observer')

const deckType = computed(() => roomStore.roomConfig?.deckType ?? 'fibonacci')
const deckLabel = computed(() => t(`decks.${deckType.value}`))
const currentRound = computed(() => roomStore.currentRound)
const players = computed(() => roomStore.players)

// Compartilhar sala (link de convite / Web Share) — lógica em useShareRoom.
const { shareStatus, shareRoom } = useShareRoom(roomId)

// Voto otimista: a carta acende na hora do clique, sem esperar o round-trip
// (cast_vote → room_state_updated). Reconciliado com o servidor logo abaixo.
const optimisticVote = ref<string | number | null>(null)

const serverVote = computed(() => {
  if (!currentRound.value) return null
  return currentRound.value.votes[userStore.playerId] ?? null
})

// O voto confirmado pelo servidor prevalece; enquanto não chega, mostra o otimista.
const selectedVote = computed(() => serverVote.value ?? optimisticVote.value)

// Trocar de rodada (nova rodada / reset) limpa o otimista pra não vazar entre rodadas.
// A transição voting→revealed mantém o mesmo round.id, então a seleção persiste no reveal.
watch(
  () => currentRound.value?.id,
  () => {
    optimisticVote.value = null
  },
)

// Apenas jogadores ativos (não observers) para contagem
const activePlayerCount = computed(() => activePlayersOf(players.value).length)

const allActiveVoted = computed(() => {
  const round = currentRound.value
  if (!round) return false
  const active = activePlayersOf(players.value)
  // Guard length: uma sala só de observers (zero ativos) NÃO conta como "todos
  // votaram" — [].every() é true e marcaria a rodada como concluída sem voto.
  return active.length > 0 && active.every((p) => p.id in round.votes)
})

// Abas da fase de votação: "Votação" (rodada atual) ↔ "Resumo" (rodadas já
// reveladas, ao vivo). Só aparecem na fase de votação.
const roomTab = ref<'voting' | 'summary'>('voting')
const votingTabRef = ref<HTMLButtonElement | null>(null)
const summaryTabRef = ref<HTMLButtonElement | null>(null)

// Contagem exibida na aba, derivada da MESMA fonte que o RoomSummary lista
// (`revealedRoundsOf`) — o rótulo "Resumo (N)" nunca diverge do painel.
const revealedRoundCount = computed(() => revealedRoundsOf(roomStore.currentRoom).length)

// Ao (re)entrar em votação — ex.: nova sessão após um reset — volta pra aba de
// votação, pra não ficar preso no resumo da sessão anterior.
watch(
  () => roomStore.isVotingPhase,
  (isVoting) => {
    if (isVoting) roomTab.value = 'voting'
  },
)

// Navegação por teclado das abas (padrão WAI-ARIA tabs): setas trocam a aba e
// movem o foco pra ela (roving tabindex no template).
function onTabsKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
  event.preventDefault()
  roomTab.value = event.key === 'ArrowRight' ? 'summary' : 'voting'
  nextTick(() => {
    const target = roomTab.value === 'summary' ? summaryTabRef.value : votingTabRef.value
    target?.focus()
  })
}

// Auto-reveal é responsabilidade ÚNICA do servidor (roomManager.castVote);
// o cliente não reemite reveal_votes para evitar lógica duplicada/divergente.

// Rejoin the active room. Runs on mount (direct hit / refresh of /room/:id) AND on
// every transparent socket reconnect: the server binds presence to socket.id, so a
// reconnected socket (new id) must re-announce itself or it gets dropped after the
// grace window — while the ConnectionOverlay still shows "connected".
function rejoinActiveRoom() {
  if (!userStore.playerId || !userStore.playerName) return
  // Config optionality means joining an existing room is handled by the backend
  joinRoom(roomId.value, {
    id: userStore.playerId,
    name: userStore.playerName,
    role: userStore.playerRole,
  }).catch((err) => {
    // A distinção-chave: SÓ um erro de ACK do servidor (sessão inválida / sala
    // inexistente) limpa o token e volta pra Home. Falha de conexão / cold start
    // do Render NÃO navega — o ConnectionOverlay cobre a espera e o retry do
    // Socket.IO resolve, sem expulsar o usuário da sala.
    if (err instanceof JoinAckError) {
      userStore.setSessionToken(null)
      // A sala REALMENTE não existe mais (reset/cold-start): descarta o estado
      // obsoleto além do token. Sem isso, o `currentRoom` preso faria a Home
      // mostrar o aviso "sessão expirou" JUNTO com o banner/link "Voltar à Sala"
      // (F5.4) — um retorno quebrado que só reentra no erro.
      roomStore.leaveRoom()
      router.push({ name: 'home', query: { notice: 'session-expired' } })
    }
  })
}

onMounted(() => {
  if (!userStore.playerId || !userStore.playerName) {
    // F5.3 — sem identidade (link/bookmark de /room/:id aberto direto): manda pra
    // Home PRESERVANDO o código da sala em ?room=, que o HomeView usa pra abrir na
    // aba "Entrar" já preenchida. Antes ia pra '/' cru, descartando o id.
    router.push({ name: 'home', query: { room: roomId.value } })
    return
  }
  rejoinActiveRoom()
})

// Re-announce to the server after a transparent reconnect (see rejoinActiveRoom).
watch(
  () => connectionStore.reconnectNonce,
  () => rejoinActiveRoom(),
)

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
  optimisticVote.value = value // acende na hora (otimista)
  castVote(roomId.value, userStore.playerId, value).catch(() => {
    // Servidor recusou (deck inválido / fora de votação / não autorizado): desfaz o
    // otimista se ele ainda for este valor (o usuário pode ter votado de novo).
    if (optimisticVote.value === value) optimisticVote.value = null
  })
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

// Confirmação de saída: o botão "Sair da Sala" do cabeçalho fica sempre visível e
// é fácil de clicar sem querer no meio de uma sessão. A saída pela tela de sessão
// concluída (SessionSummary) é deliberada e continua imediata.
const showLeaveConfirm = ref(false)

// Só há sessão a preservar quando alguma rodada já foi criada (setup vazio não).
const hasRecordedRounds = computed(() => (roomStore.currentRoom?.rounds.length ?? 0) > 0)

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

  // Avisa o servidor ANTES do disconnect: remoção imediata lá (sem o grace de
  // 30s), admin transferido na hora e o token do servidor descartado — sem isso,
  // voltar pra sala logo após sair esbarrava em "Sessão inválida".
  leaveRoom(roomId.value)
  disconnect()
  roomStore.leaveRoom()
  // Sair encerra a sessão: descarta o token e o vínculo com a sala (senão ficam
  // no localStorage e um rejoin futuro tentaria reusar uma sessão já abandonada).
  userStore.setSessionToken(null)
  userStore.setActiveRoom(null)
  router.push({ name: 'home' })
}

function confirmLeave() {
  showLeaveConfirm.value = false
  handleLeave()
}
</script>

<template>
  <div class="room-container">
    <!-- Room Header -->
    <BaseCard class="room-info-card">
      <template #header>
        <div class="room-header">
          <div>
            <h1 class="room-title">
              {{ t('room.title') }} <span class="room-code">{{ roomId }}</span>
            </h1>
            <div class="room-meta">
              <span class="badge badge-role" :class="userStore.playerRole">
                {{
                  isAdmin
                    ? t('room.roles.admin')
                    : isObserver
                      ? t('room.roles.observer')
                      : t('room.roles.player')
                }}
              </span>
              <span class="badge badge-deck">{{ deckLabel }}</span>
              <span class="badge badge-phase">
                {{
                  roomStore.isSetupPhase
                    ? t('room.phases.setup')
                    : roomStore.isVotingPhase
                      ? t('room.phases.voting')
                      : t('room.phases.completed')
                }}
              </span>
            </div>
          </div>
          <div class="room-actions">
            <BaseButton
              variant="secondary"
              size="sm"
              :aria-label="t('room.share.ariaLabel', { roomId })"
              @click="shareRoom"
            >
              {{
                shareStatus === 'copied'
                  ? t('room.share.copied')
                  : shareStatus === 'error'
                    ? t('room.share.error')
                    : t('room.share.action')
              }}
            </BaseButton>
            <BaseButton variant="ghost" size="sm" @click="showLeaveConfirm = true">
              {{ t('room.leave.button') }}
            </BaseButton>
          </div>
        </div>
      </template>
    </BaseCard>

    <!-- PHASE: SETUP -->
    <RoomSetup
      v-if="roomStore.isSetupPhase"
      :is-admin="isAdmin"
      @add="handleAddSubject"
      @remove="handleRemoveSubject"
      @start="handleStartSession"
    />

    <!-- PHASE: VOTING — abas "Votação" (rodada atual) ↔ "Resumo" (ao vivo) -->
    <template v-if="roomStore.isVotingPhase">
      <div
        class="room-tabs"
        role="tablist"
        :aria-label="t('room.tabs.ariaLabel')"
        @keydown="onTabsKeydown"
      >
        <button
          id="room-tab-voting"
          ref="votingTabRef"
          type="button"
          role="tab"
          class="room-tab"
          :class="{ 'room-tab--active': roomTab === 'voting' }"
          :aria-selected="roomTab === 'voting'"
          :tabindex="roomTab === 'voting' ? 0 : -1"
          aria-controls="room-panel-voting"
          @click="roomTab = 'voting'"
        >
          {{ t('room.tabs.voting') }}
        </button>
        <button
          id="room-tab-summary"
          ref="summaryTabRef"
          type="button"
          role="tab"
          class="room-tab"
          :class="{ 'room-tab--active': roomTab === 'summary' }"
          :aria-selected="roomTab === 'summary'"
          :tabindex="roomTab === 'summary' ? 0 : -1"
          aria-controls="room-panel-summary"
          @click="roomTab = 'summary'"
        >
          {{ t('room.tabs.summary') }} ({{ revealedRoundCount }})
        </button>
      </div>

      <RoomVoting
        v-show="roomTab === 'voting'"
        id="room-panel-voting"
        role="tabpanel"
        aria-labelledby="room-tab-voting"
        :is-admin="isAdmin"
        :is-observer="isObserver"
        :selected-vote="selectedVote"
        :active-player-count="activePlayerCount"
        :all-active-voted="allActiveVoted"
        @vote="handleVote"
        @reveal="handleReveal"
        @next-round="handleNextRound"
        @finish="handleFinishSession"
      />
      <RoomSummary
        v-show="roomTab === 'summary'"
        id="room-panel-summary"
        role="tabpanel"
        aria-labelledby="room-tab-summary"
        tabindex="0"
      />
    </template>

    <!-- ======================== -->
    <!-- PHASE: COMPLETED         -->
    <!-- ======================== -->
    <div v-if="roomStore.isCompleted" class="room-content room-content--full">
      <SessionSummary
        :rounds="roomStore.currentRoom?.rounds ?? []"
        @new-session="handleNewSession"
        @leave="handleLeave"
      />
    </div>

    <!-- F3.4 — confirmação antes de sair da sala (BaseModal endurecido na F2.2) -->
    <BaseModal v-model="showLeaveConfirm" :title="t('room.leave.confirmTitle')">
      <p class="leave-confirm-text">
        {{ t('room.leave.confirmBody') }}
        <template v-if="hasRecordedRounds">
          {{ t('room.leave.confirmHistoryNote') }}
        </template>
      </p>
      <template #footer>
        <BaseButton variant="ghost" @click="showLeaveConfirm = false">{{
          t('common.cancel')
        }}</BaseButton>
        <BaseButton variant="danger" @click="confirmLeave">{{
          t('room.leave.confirmAction')
        }}</BaseButton>
      </template>
    </BaseModal>
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

.room-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}

/* Abas Votação ↔ Resumo (fase de votação) */
.room-tabs {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--c-border);
}

.room-tab {
  appearance: none;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px; /* sobrepõe a borda do tablist */
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--c-text-mute);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast);
}

.room-tab:hover {
  color: var(--c-text);
}

.room-tab--active {
  color: var(--c-primary);
  border-bottom-color: var(--c-primary);
}

.room-tab:focus-visible {
  outline: 2px solid var(--c-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}

.leave-confirm-text {
  margin: 0;
  color: var(--c-text-soft);
  line-height: 1.5;
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
  color: var(--c-warning-text);
}

.badge-role.observer {
  background: rgba(107, 114, 128, 0.1);
  color: var(--c-text-mute);
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

/* Responsive */
@media (max-width: 768px) {
  .room-header {
    flex-direction: column;
  }

  .room-actions {
    justify-content: flex-start;
    width: 100%;
  }
}
</style>
