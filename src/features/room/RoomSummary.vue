<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import IconNotepadText from '~icons/lucide/notepad-text'
import { useRoomStore } from '@/stores/room'
import { revealedRoundsOf } from '@/utils/rounds'
import BaseCard from '@/components/BaseCard.vue'
import VoteReveal from './VoteReveal.vue'

const { t } = useI18n()
const roomStore = useRoomStore()

// Resumo AO VIVO da sala: só rodadas já REVELADAS (ver `revealedRoundsOf` — fonte
// única do predicado + numeração real, compartilhada com o contador da aba no
// RoomView, pra o rótulo "Resumo (N)" nunca divergir do que é listado aqui).
const revealedRounds = computed(() => revealedRoundsOf(roomStore.currentRoom))
</script>

<template>
  <div class="room-summary">
    <div v-if="revealedRounds.length === 0" class="summary-empty">
      <IconNotepadText class="empty-icon" aria-hidden="true" />
      <p class="empty-title">{{ t('room.summary.liveEmpty') }}</p>
      <p class="empty-hint">{{ t('room.summary.liveEmptyHint') }}</p>
    </div>

    <div v-else class="rounds-recap">
      <BaseCard v-for="{ round, number } in revealedRounds" :key="round.id" class="recap-card">
        <template #header>
          <div class="recap-header">
            <span class="recap-badge">{{ t('room.summary.roundLabel', { number }) }}</span>
            <span class="recap-subject">{{ round.subject }}</span>
          </div>
        </template>
        <!-- celebrate=false: sem confetti no resumo. player-count omitido: recap de
             rodada passada — quem votou pode ter saído e o denominador atual
             mentiria (ex.: "2/1"). Espelha o SessionSummary da fase concluída. -->
        <VoteReveal :votes="round.votes" :celebrate="false" />
      </BaseCard>
    </div>
  </div>
</template>

<style scoped>
.room-summary {
  max-width: 700px;
  width: 100%;
  margin: 0 auto;
}

.rounds-recap {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.recap-card {
  animation: slideUp var(--transition-normal);
}

.recap-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.recap-badge {
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 2px var(--space-2);
  background: var(--c-primary-soft);
  color: var(--c-primary);
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.recap-subject {
  font-weight: 600;
  font-size: var(--text-base);
}

.summary-empty {
  text-align: center;
  padding: var(--space-8) var(--space-4);
  color: var(--c-text-mute);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

/* Era um <p> com o emoji; agora é o SVG (inline-block em 1em pela `.app-icon`),
   então o tamanho vem do font-size e o align-items do flex é que centraliza. */
.empty-icon {
  font-size: 2.5rem;
  margin: 0;
}

.empty-title {
  font-weight: 600;
  font-size: var(--text-base);
  color: var(--c-text-soft);
  margin: 0;
}

.empty-hint {
  font-size: var(--text-sm);
  margin: 0;
}
</style>
