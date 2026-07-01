<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useRoomStore } from '@/stores/room'
import { useThemeStore } from '@/stores/theme'

const roomStore = useRoomStore()
const { currentRoom, isInRoom, isCompleted } = storeToRefs(roomStore)

const showBackToRoom = computed(() => isInRoom.value && !isCompleted.value)

// F2.8 — troca de rota move o foco pro <main> e anuncia o título via aria-live,
// já que o SPA não recarrega a página (o leitor de tela não percebe a navegação sozinho).
const route = useRoute()
const mainRef = ref<HTMLElement | null>(null)

// route.path (não route.name): troca de :id na mesma rota nomeada (ex.: sala -> outra
// sala) também deve mover o foco — mesmo não havendo hoje nenhuma navegação assim.
watch(
  () => route.path,
  async () => {
    await nextTick()
    mainRef.value?.focus()
  },
)

const themeStore = useThemeStore()
const { preference: themePreference } = storeToRefs(themeStore)
const themeIcon = computed(() =>
  themePreference.value === 'light' ? '☀️' : themePreference.value === 'dark' ? '🌙' : '🌗',
)
const themeLabel = computed(() => {
  const name =
    themePreference.value === 'light'
      ? 'claro'
      : themePreference.value === 'dark'
        ? 'escuro'
        : 'automático'
  return `Tema: ${name}. Clique para alternar.`
})
</script>

<template>
  <div class="layout-wrapper">
    <header class="navbar">
      <div class="navbar-content">
        <RouterLink to="/" class="navbar-brand">
          <span class="logo-icon">🃏</span>
          <span class="logo-text">Planning Poker</span>
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
          <button
            type="button"
            class="theme-toggle"
            :aria-label="themeLabel"
            :title="themeLabel"
            @click="themeStore.cycle()"
          >
            <span aria-hidden="true">{{ themeIcon }}</span>
          </button>
        </nav>
      </div>
    </header>

    <main ref="mainRef" class="main-content" tabindex="-1">
      <p class="sr-only" aria-live="polite">{{ route.meta.title }}</p>
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

/* F2.8: <main> recebe foco programático a cada navegação (landmark, não widget
   interativo) — o anel de foco do navegador nesse caso só serve pra atrapalhar
   visualmente; o benefício de a11y (reset de contexto pro leitor de tela) não
   depende de mostrar o outline. Os elementos que o usuário realmente navega via
   Tab mantêm seu próprio :focus-visible normalmente. */
.main-content:focus {
  outline: none;
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

/* F9.4 — toggle de tema */
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-lg);
  line-height: 1;
  cursor: pointer;
  color: var(--c-text);
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast);
}

.theme-toggle:hover {
  background: var(--c-bg-mute);
  border-color: var(--c-border-hover);
}

.theme-toggle:focus-visible {
  outline: 2px solid var(--c-primary);
  outline-offset: 2px;
}

/* F4.5 — navbar responsivo: empilha brand/nav e permite quebra em telas estreitas */
@media (max-width: 640px) {
  .navbar-content {
    flex-direction: column;
    gap: var(--space-3);
  }

  .navbar-nav {
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-2);
  }

  .nav-link {
    padding: var(--space-2);
  }
}
</style>
