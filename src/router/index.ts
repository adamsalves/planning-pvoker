import { watch } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { i18n } from '@/i18n'

declare module 'vue-router' {
  interface RouteMeta {
    title: string
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  // Honra a posição salva no voltar/avançar (History pode ser longa); topo nas demais.
  scrollBehavior: (_to, _from, savedPosition) => savedPosition ?? { top: 0 },
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../features/home/HomeView.vue'),
      meta: { title: 'routes.home' },
    },
    {
      path: '/room/:id',
      name: 'room',
      component: () => import('../features/room/RoomView.vue'),
      meta: { title: 'routes.room' },
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('../features/history/HistoryView.vue'),
      meta: { title: 'routes.history' },
    },
  ],
})

// Título da página — meta.title guarda a CHAVE i18n; traduz aqui (i18n.global lê o
// locale reativo, então o announcedTitle do DefaultLayout reage à troca de idioma).
// Para a Sala inclui o código (:id) — senão document.title e o anúncio de rota
// ficariam só "Sala", sem distinguir salas.
export function routeTitle(
  meta: { title: string },
  params: Record<string, string | string[]>,
): string {
  const title = i18n.global.t(meta.title)
  const code = typeof params.id === 'string' ? params.id : undefined
  return code ? `${title} ${code}` : title
}

function applyDocumentTitle() {
  const route = router.currentRoute.value
  document.title = `${routeTitle(route.meta, route.params)} · Planning Poker`
}

router.afterEach(() => applyDocumentTitle())

// afterEach só roda em navegação; trocar o idioma também precisa re-titular a aba.
watch(i18n.global.locale, () => applyDocumentTitle())

export default router
