<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="layout-wrapper">
    <header class="navbar">
      <div class="navbar-content">
        <div class="navbar-brand">
          <span class="logo-icon">🃏</span>
          <h1 class="logo-text">Planning Poker</h1>
        </div>
        <nav class="navbar-nav">
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
        <p>Planning Poker App - Vue 3 + Pinia + Vite</p>
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
