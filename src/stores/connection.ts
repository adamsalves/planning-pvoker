import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ConnectionState } from '@/types'

// Quantas tentativas falhas seguidas até trocar a percepção para "demorando mais
// que o normal" (status 'down'). NÃO para de tentar — o Socket.IO segue
// reconectando pra sempre; isto é só o gatilho visual do overlay.
const RECONNECT_BUDGET = 5

// Fonte única do estado de conexão Socket.IO. Diferente do user store, NÃO é
// persistido: é efêmero e deve recomeçar em 'connecting' a cada carga da página.
export const useConnectionStore = defineStore('connection', () => {
  const status = ref<ConnectionState>('connecting')
  const attempts = ref(0)
  // Bumped on every successful RECONNECT (not the first connect). Consumers that
  // hold room state (RoomView) watch it to re-emit join_room — the server binds
  // presence to socket.id, and a reconnected socket has a brand-new id.
  const reconnectNonce = ref(0)

  // Dirige o overlay: qualquer estado que não seja 'connected' está esperando.
  const isWaiting = computed(() => status.value !== 'connected')
  // Passou do budget — overlay troca a copy, mas continua sendo loading (não erro).
  const isDown = computed(() => status.value === 'down')

  function setConnected() {
    status.value = 'connected'
    attempts.value = 0
  }

  function setReconnecting() {
    status.value = 'reconnecting'
  }

  // A successful reconnect: back online AND signal consumers to rebind (join_room).
  function setReconnected() {
    status.value = 'connected'
    attempts.value = 0
    reconnectNonce.value++
  }

  // Cada falha de conexão (connect_error / reconnect_failed). Ao cruzar o budget,
  // a percepção vira 'down' sem alterar o fato de que seguimos tentando.
  function registerFailedAttempt() {
    attempts.value++
    if (attempts.value >= RECONNECT_BUDGET) status.value = 'down'
  }

  function reset() {
    status.value = 'connecting'
    attempts.value = 0
  }

  return {
    status,
    attempts,
    reconnectNonce,
    isWaiting,
    isDown,
    setConnected,
    setReconnecting,
    setReconnected,
    registerFailedAttempt,
    reset,
  }
})
