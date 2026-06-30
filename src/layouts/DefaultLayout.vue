<script setup lang="ts">
import { computed } from 'vue'
import { RouterView } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useRoomStore } from '@/stores/room'

const roomStore = useRoomStore()
const { currentRoom, isInRoom, isCompleted } = storeToRefs(roomStore)

const showBackToRoom = computed(() => isInRoom.value && !isCompleted.value)
</script>

<template>
  <div class="layout-wrapper">
    <header class="navbar">
      <div class="navbar-content">
        <RouterLink to="/" class="navbar-brand">
          <span class="logo-icon">🃏</span>
          <h1 class="logo-text">Planning Poker</h1>
        </RouterLink>
        <nav class="navbar-nav">
          <RouterLink
            v-if="showBackToRoom"
            :to="`/room/${currentRoom?.id}`"
            class="nav-link nav-link-room"
          >
            <span class="room-icon">🎯</span>
            Voltar à Sala
          </RouterLink>
          <RouterLink to="/" class="nav-link">Home</RouterLink>
          <RouterLink to="/history" class="nav-link">Histórico</RouterLink>
        </nav>
      </div>
    </header>

    <main class="main-content">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <footer class="footer">
      <div class="footer-content">
        <p>
          Planning Poker · feito por
          <a
            href="https://github.com/adamsalves"
            target="_blank"
            rel="noopener noreferrer"
            class="footer-link"
            >Adams Alves</a
          >
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.layout-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.navbar {
  background: var(--c-bg-soft);
  border-bottom: 1px solid var(--c-border);
  position: sticky;
  top: 0;
  z-index: 40;
}

.navbar-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-4);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
}

.navbar-brand:hover .logo-text {
  color: var(--c-primary);
}

.logo-icon {
  font-size: var(--text-2xl);
}

.logo-text {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--c-text);
  margin: 0;
  letter-spacing: -0.5px;
}

.navbar-nav {
  display: flex;
  gap: var(--space-4);
}

.nav-link {
  color: var(--c-text-soft);
  font-weight: 500;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
}

.nav-link:hover {
  background: var(--c-bg-mute);
  color: var(--c-text);
}

.nav-link.router-link-active {
  color: var(--c-primary);
  background: var(--c-primary-soft);
}

.nav-link-room {
  background: var(--c-primary);
  color: white;
}

.nav-link-room:hover {
  background: var(--c-primary-hover);
  color: white;
}

.nav-link-room .room-icon {
  margin-right: 4px;
}

.main-content {
  flex: 1;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  padding: var(--space-6) var(--space-4);
}

.footer {
  border-top: 1px solid var(--c-border);
  background: var(--c-bg-soft);
  padding: var(--space-6) var(--space-4);
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
  color: var(--c-text-mute);
  font-size: var(--text-sm);
}

.footer-link {
  color: var(--c-primary);
  font-weight: 500;
}

.footer-link:hover {
  text-decoration: underline;
}

/* Page Transitions */
.page-enter-active,
.page-leave-active {
  transition:
    opacity var(--transition-normal),
    transform var(--transition-normal);
}

.page-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
