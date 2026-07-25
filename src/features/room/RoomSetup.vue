<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import IconPencil from '~icons/lucide/pencil'
import { useRoomStore } from '@/stores/room'
import { activePlayersOf } from '@/utils/players'
import BaseCard from '@/components/BaseCard.vue'
import SubjectForm from './SubjectForm.vue'
import PlayerList from './PlayerList.vue'

// Estado da sala vem do store; só o papel derivado do usuário chega por prop.
defineProps<{
  isAdmin: boolean
}>()

defineEmits<{
  add: [subject: string]
  remove: [index: number]
  start: []
}>()

const { t } = useI18n()
const roomStore = useRoomStore()

// Quem senta à mesa — espectador não conta pro gate de iniciar a sessão. Sala com
// 1 jogador + 1 espectador é uma sessão de 1 votante, não de 2.
const activePlayerCount = computed(() => activePlayersOf(roomStore.players).length)
</script>

<template>
  <div class="room-content">
    <div class="voting-panel">
      <BaseCard class="section-card" :title="t('room.setup.planningTitle')">
        <template v-if="isAdmin">
          <SubjectForm
            :subjects="roomStore.subjects"
            :active-player-count="activePlayerCount"
            @add="$emit('add', $event)"
            @remove="$emit('remove', $event)"
            @start="$emit('start')"
          />
        </template>
        <template v-else>
          <div class="waiting-message">
            <IconPencil class="waiting-icon" aria-hidden="true" />
            <p>{{ t('room.setup.waitingForAdmin') }}</p>
            <div v-if="roomStore.subjects.length > 0" class="preview-backlog">
              <p class="backlog-count">
                {{ t('room.setup.subjectsRegistered', roomStore.subjects.length) }}
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
      <BaseCard :title="t('room.participants')" class="section-card">
        <PlayerList :players="roomStore.players" :votes="{}" status="waiting" />
      </BaseCard>
    </div>
  </div>
</template>

<style scoped>
/* Layout de fase de 2 colunas — espelhado em RoomVoting (mesma grade da sala). */
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

.waiting-message {
  text-align: center;
  padding: var(--space-6) 0;
  color: var(--c-text-mute);
}

.waiting-icon {
  font-size: 2rem;
  margin-bottom: var(--space-2);
  color: var(--c-text-mute);
}

/* Backlog em preview (visão do não-admin no setup) */
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

@media (max-width: 768px) {
  .room-content {
    grid-template-columns: 1fr;
  }

  .sidebar-panel {
    position: static;
  }
}
</style>
