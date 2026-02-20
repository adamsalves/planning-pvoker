<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useRoomStore } from '@/stores/room'
import { DECKS } from '@/types'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const roomStore = useRoomStore()

// Type-safe: route.params.id pode ser string | string[]. Usamos computed + guard em vez de `as string`
const roomId = computed(() => {
  const id = route.params.id
  return Array.isArray(id) ? id[0] : id
})
const isAdmin = computed(() => userStore.playerRole === 'admin')
const deckLabel = computed(() => {
  const dt = roomStore.roomConfig?.deckType
  return dt ? DECKS[dt].label : 'Fibonacci'
})

function handleLeave() {
  roomStore.leaveRoom()
  userStore.clearPlayer()
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="room-container">
    <BaseCard class="room-info-card">
      <template #header>
        <div class="room-header">
          <div>
            <h2 class="room-title">
              Sala <span class="room-code">{{ roomId }}</span>
            </h2>
            <div class="room-meta">
              <span class="badge badge-role" :class="userStore.playerRole">
                {{
                  isAdmin
                    ? '👑 Admin'
                    : userStore.playerRole === 'observer'
                      ? '👁️ Espectador'
                      : '🃏 Jogador'
                }}
              </span>
              <span class="badge badge-deck">{{ deckLabel }}</span>
            </div>
          </div>
          <BaseButton variant="ghost" size="sm" @click="handleLeave"> Sair da Sala </BaseButton>
        </div>
      </template>

      <div class="room-placeholder">
        <p class="placeholder-icon">🚧</p>
        <p class="placeholder-text">
          Bem-vindo(a), <strong>{{ userStore.playerName }}</strong
          >!
        </p>
        <p class="placeholder-sub">
          A sala de votação será construída na <strong>Fase 4</strong>. Por enquanto, verifique que
          a navegação e persistência estão funcionando!
        </p>
      </div>
    </BaseCard>
  </div>
</template>

<style scoped>
.room-container {
  max-width: 800px;
  margin: 0 auto;
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

.room-placeholder {
  text-align: center;
  padding: var(--space-8) 0;
}

.placeholder-icon {
  font-size: 3rem;
  margin-bottom: var(--space-4);
}

.placeholder-text {
  font-size: var(--text-lg);
  color: var(--c-text);
  margin-bottom: var(--space-2);
}

.placeholder-sub {
  color: var(--c-text-mute);
  font-size: var(--text-sm);
  max-width: 400px;
  margin: 0 auto;
  line-height: 1.6;
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
