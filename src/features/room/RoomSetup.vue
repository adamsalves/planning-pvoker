<script setup lang="ts">
import { useRoomStore } from '@/stores/room'
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

const roomStore = useRoomStore()
</script>

<template>
  <div class="room-content">
    <div class="voting-panel">
      <BaseCard class="section-card" title="📋 Planejamento da Sessão">
        <template v-if="isAdmin">
          <SubjectForm
            :subjects="roomStore.subjects"
            :player-count="roomStore.players.length"
            @add="$emit('add', $event)"
            @remove="$emit('remove', $event)"
            @start="$emit('start')"
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
