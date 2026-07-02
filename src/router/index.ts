import { createRouter, createWebHistory } from 'vue-router'

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
      meta: { title: 'Início' },
    },
    {
      path: '/room/:id',
      name: 'room',
      component: () => import('../features/room/RoomView.vue'),
      meta: { title: 'Sala' },
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('../features/history/HistoryView.vue'),
      meta: { title: 'Histórico' },
    },
  ],
})

// Título da página. Para a Sala inclui o código (:id) — senão document.title e o anúncio
// de rota ficariam só "Sala", sem distinguir salas. Compartilhado com DefaultLayout (aria-live).
export function routeTitle(
  meta: { title: string },
  params: Record<string, string | string[]>,
): string {
  const code = typeof params.id === 'string' ? params.id : undefined
  return code ? `${meta.title} ${code}` : meta.title
}

router.afterEach((to) => {
  document.title = `${routeTitle(to.meta, to.params)} · Planning Poker`
})

export default router
