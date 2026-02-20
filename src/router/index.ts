import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/room/:id',
      name: 'room',
      component: () => import('../features/room/RoomView.vue'),
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('../features/history/HistoryView.vue'),
    },
  ],
})

export default router
