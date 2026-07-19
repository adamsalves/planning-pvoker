<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useRoomStore } from '@/stores/room'
import CreateRoomForm from './CreateRoomForm.vue'
import JoinRoomForm from './JoinRoomForm.vue'
import IconTriangleAlert from '~icons/lucide/triangle-alert'
import IconTarget from '~icons/lucide/target'

const { t } = useI18n()

// Tab state: 'create' ou 'join'
const activeTab = ref<'create' | 'join'>('create')

const route = useRoute()

// F5.4 — navegar pra Home NÃO sai da sala (o modelo do F5): se ainda há sala ativa,
// um banner lembra disso e oferece o retorno. Na Home o header NÃO mostra "Voltar à
// Sala" (evita CTA duplicado), então este banner é o caminho de volta aqui.
const { currentRoom } = storeToRefs(useRoomStore())

function setTab(tab: 'create' | 'join') {
  activeTab.value = tab
}

// Link de convite (?room=...): abre já na aba "Entrar" e repassa o código
// (normalizado) ao JoinRoomForm, que o usa como valor inicial do campo.
const rawRoom = Array.isArray(route.query.room) ? route.query.room[0] : route.query.room
const sharedRoomCode = typeof rawRoom === 'string' ? rawRoom.trim() : ''
if (sharedRoomCode.length > 0) {
  activeTab.value = 'join'
}

// Quando o RoomView devolve o usuário por sessão inválida/sala inexistente,
// explica o motivo em vez de mandá-lo para a home sem contexto.
const sessionExpired = route.query.notice === 'session-expired'
</script>

<template>
  <div class="home-container">
    <!-- Hero Section -->
    <div class="hero">
      <span class="hero-icon">🃏</span>
      <h1 class="hero-title">Planning Poker</h1>
      <p class="hero-subtitle">{{ t('home.subtitle') }}</p>
    </div>

    <!-- Aviso de sessão expirada (redirecionado do RoomView) -->
    <p v-if="sessionExpired" class="session-notice" role="alert">
      <IconTriangleAlert aria-hidden="true" />
      {{ t('home.sessionExpired') }}
    </p>

    <!-- F5.4 — pista de sala ativa: você navegou pra Home sem sair da sala. -->
    <RouterLink v-if="currentRoom" :to="`/room/${currentRoom.id}`" class="room-notice">
      <IconTarget aria-hidden="true" />
      <span>{{ t('home.inRoom') }}</span>
      <span class="room-notice-action">{{ t('layout.backToRoom') }}</span>
    </RouterLink>

    <!-- Tab Switcher -->
    <div class="tab-switcher">
      <button :class="['tab-btn', { active: activeTab === 'create' }]" @click="setTab('create')">
        {{ t('home.tabs.create') }}
      </button>
      <button :class="['tab-btn', { active: activeTab === 'join' }]" @click="setTab('join')">
        {{ t('home.tabs.join') }}
      </button>
    </div>

    <!-- Forms -->
    <Transition name="tab" mode="out-in">
      <CreateRoomForm v-if="activeTab === 'create'" key="create" />
      <JoinRoomForm v-else key="join" :initial-room-code="sharedRoomCode" />
    </Transition>
  </div>
</template>

<style scoped>
.home-container {
  max-width: 520px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
}

/* Hero */
.hero {
  text-align: center;
  margin-bottom: var(--space-8);
  animation: slideUp var(--transition-normal);
}

.hero-icon {
  font-size: 4rem;
  display: block;
  margin-bottom: var(--space-4);
}

.hero-title {
  font-size: var(--text-3xl);
  font-weight: 800;
  letter-spacing: -1px;
  background: linear-gradient(135deg, var(--c-primary), var(--c-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: var(--space-2);
}

.hero-subtitle {
  color: var(--c-text-mute);
  font-size: var(--text-lg);
}

/* Aviso de sessão expirada */
.session-notice {
  margin-bottom: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: rgba(239, 68, 68, 0.1);
  color: var(--c-danger);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  text-align: center;
  animation: slideUp var(--transition-normal);
}

/* F5.4 — banner de sala ativa (link de retorno) */
.room-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--c-primary-soft);
  color: var(--c-primary);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  text-align: center;
  animation: slideUp var(--transition-normal);
}

.room-notice:hover {
  background: var(--c-bg-mute);
}

.room-notice-action {
  font-weight: 700;
  text-decoration: underline;
}

/* Tab Switcher */
.tab-switcher {
  display: flex;
  background: var(--c-bg-mute);
  border-radius: var(--radius-lg);
  padding: var(--space-1);
  margin-bottom: var(--space-6);
}

.tab-btn {
  flex: 1;
  padding: var(--space-2) var(--space-4);
  border: none;
  background: transparent;
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--c-text-mute);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab-btn.active {
  background: var(--c-bg-soft);
  color: var(--c-text);
  box-shadow: var(--shadow-sm);
}

/* Tab Transition */
.tab-enter-active,
.tab-leave-active {
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);
}

.tab-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.tab-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
</style>
