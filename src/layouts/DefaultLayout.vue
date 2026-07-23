<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { routeTitle } from '@/router'
import { storeToRefs } from 'pinia'
import { useRoomStore } from '@/stores/room'
import { useUserStore } from '@/stores/user'
import { useThemeStore } from '@/stores/theme'
import { useLocaleStore } from '@/stores/locale'
import IconTarget from '~icons/lucide/target'
import IconChartColumn from '~icons/lucide/chart-column'
import IconSun from '~icons/lucide/sun'
import IconMoon from '~icons/lucide/moon'
import IconSunMoon from '~icons/lucide/sun-moon'

const { t } = useI18n()

// isCompleted (in-memory) decide o rótulo QUANDO a sala está carregada; após um
// reload não está, e o rótulo degrada p/ "Voltar à Sala" (ver backToRoom).
const roomStore = useRoomStore()
const { isCompleted } = storeToRefs(roomStore)

// O banner de "sala ativa" chaveia pelo activeRoomId PERSISTIDO (localStorage), não
// pelo currentRoom in-memory — assim sobrevive a reload/hard-nav (o currentRoom zera
// no boot, mas o activeRoomId fica). É limpo no leave e no JoinAckError (RoomView).
const userStore = useUserStore()
const { activeRoomId } = storeToRefs(userStore)

// F2.8 — troca de rota move o foco pro <main> e anuncia o título via aria-live,
// já que o SPA não recarrega a página (o leitor de tela não percebe a navegação sozinho).
const route = useRoute()

// Afordance ÚNICO de retorno (item #5): um banner no topo do <main> que aparece em
// QUALQUER rota com sala ativa, exceto a própria sala (lá seria redundante). Unifica
// os dois afordances antigos da F5 (botão do navbar só-na-404 + banner só-na-Home)
// num só lugar. Chaveia pelo activeRoomId PERSISTIDO (ver acima) → sobrevive a reload.
const showActiveRoomBanner = computed(() => activeRoomId.value !== null && route.name !== 'room')
const backToRoom = computed(() =>
  isCompleted.value
    ? { icon: IconChartColumn, label: t('layout.viewSummary') }
    : { icon: IconTarget, label: t('layout.backToRoom') },
)

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

// Título anunciado ao trocar de rota (inclui o código da Sala). Ver routeTitle no router.
const announcedTitle = computed(() => routeTitle(route.meta, route.params))

const themeStore = useThemeStore()
const { preference: themePreference } = storeToRefs(themeStore)
const themeIcon = computed(() =>
  themePreference.value === 'light'
    ? IconSun
    : themePreference.value === 'dark'
      ? IconMoon
      : IconSunMoon,
)
const themeLabel = computed(() =>
  t('layout.theme.toggle', { name: t(`layout.theme.${themePreference.value}`) }),
)

// F8 — toggle de idioma. O botão mostra o idioma ALVO (pra onde o clique leva),
// não o atual: "EN" convida o leitor de inglês perdido na UI em português.
const localeStore = useLocaleStore()
const { locale } = storeToRefs(localeStore)
const localeTarget = computed(() => (locale.value === 'pt-BR' ? 'EN' : 'PT'))
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
          <RouterLink to="/" class="nav-link">{{ t('layout.home') }}</RouterLink>
          <button
            type="button"
            class="theme-toggle"
            :aria-label="themeLabel"
            :title="themeLabel"
            @click="themeStore.cycle()"
          >
            <component :is="themeIcon" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="theme-toggle locale-toggle"
            :aria-label="t('layout.localeToggle')"
            :title="t('layout.localeToggle')"
            @click="localeStore.toggle()"
          >
            {{ localeTarget }}
          </button>
        </nav>
      </div>
    </header>

    <!-- Live region IRMÃ do <main> (não filha): na navegação o foco vai pro <main>; se a
         região estivesse dentro, o leitor de tela poderia anunciar o título duas vezes. -->
    <p class="sr-only" aria-live="polite">{{ announcedTitle }}</p>
    <main ref="mainRef" class="main-content" tabindex="-1">
      <!-- Banner único de "sala ativa" (item #5): aparece em qualquer rota com sala
           ativa, menos a própria sala. Fica no topo do <main> (a região que recebe
           foco na navegação, F2.8), então quem usa leitor de tela o encontra primeiro. -->
      <RouterLink v-if="showActiveRoomBanner" :to="`/room/${activeRoomId}`" class="room-notice">
        <component :is="backToRoom.icon" aria-hidden="true" />
        <span>{{ t('layout.activeRoom') }}</span>
        <span class="room-notice-action">{{ backToRoom.label }}</span>
      </RouterLink>
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <footer class="footer">
      <div class="footer-content">
        <p>
          Planning Poker · {{ t('layout.madeBy') }}
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

/* Banner único de "sala ativa" (item #5): no topo do <main>, centralizado e com
   largura própria pra ficar consistente em qualquer rota (a Home tem coluna de
   520px, a 404 é mais larga). Reusa o visual primary-soft do antigo banner da Home. */
.room-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  max-width: 560px;
  margin: 0 auto var(--space-6);
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

/* F8 — toggle de idioma: mesma base do theme-toggle, mas com texto ("EN"/"PT"). */
.locale-toggle {
  font-size: var(--text-sm);
  font-weight: 700;
  letter-spacing: 0.5px;
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
