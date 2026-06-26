import { ref } from 'vue'
import { io, Socket } from 'socket.io-client'
import type { Player, RoomConfig } from '@/types'
import { useRoomStore } from '@/stores/room'
import { useUserStore } from '@/stores/user'
import { useConnectionStore } from '@/stores/connection'
import { logger } from '@/utils/logger'
import { JoinAckError } from './joinErrors'

// Singleton socket instance to avoid multiple connections across composable usages
let socket: Socket | null = null

export function useSocket() {
  const isConnected = ref(false)
  const roomStore = useRoomStore()
  const userStore = useUserStore()
  const connectionStore = useConnectionStore()

  function connect() {
    if (!socket) {
      socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3001', {
        autoConnect: true,
        // Reconexão explícita: tenta pra sempre (o Render free hiberna). O budget
        // de tentativas vive no connection store e só muda a percepção (overlay).
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      })

      socket.on('connect', () => {
        isConnected.value = true
        connectionStore.setConnected()
        logger.debug('Socket connected:', socket?.id)
      })

      socket.on('disconnect', (reason) => {
        isConnected.value = false
        // Saída manual (disconnect() ao deixar a sala) não é uma queda — não dispara
        // o overlay de reconexão. Qualquer outro motivo significa "voltando".
        if (reason !== 'io client disconnect') connectionStore.setReconnecting()
        logger.debug('Socket disconnected:', reason)
      })

      // Cada tentativa de conexão que falha (cold start ou queda) conta pro budget.
      socket.on('connect_error', () => {
        connectionStore.registerFailedAttempt()
      })

      // Eventos do Manager (reconexão automática) reforçam o estado central.
      socket.io.on('reconnect_attempt', () => connectionStore.setReconnecting())
      socket.io.on('reconnect', () => connectionStore.setConnected())
      socket.io.on('reconnect_failed', () => connectionStore.registerFailedAttempt())

      // Backend pushes room state
      socket.on('room_state_updated', (roomData: import('@/types').Room) => {
        roomStore.syncRoom(roomData)
      })
    }
  }

  // Resolves on a successful join, rejects on an error ack so callers can react
  // (navigate only on success; on the rejoin path, drop the token + go home).
  function joinRoom(roomId: string, player: Player, config?: RoomConfig): Promise<void> {
    if (!socket) connect()
    const activeSocket = socket
    if (!activeSocket) return Promise.reject(new Error('Socket indisponível'))

    // Only resend the token if it belongs to THIS room; a token from a previous
    // session would just be rejected by the server.
    const token =
      userStore.activeRoomId === roomId && userStore.sessionToken
        ? userStore.sessionToken
        : undefined

    return new Promise((resolve, reject) => {
      activeSocket.emit(
        'join_room',
        { roomId, player, config, token },
        (response: { error?: string; token?: string }) => {
          if (response?.error) {
            // Rejeição EXPLÍCITA do servidor (token inválido / sala inexistente).
            // Tipada para o RoomView distinguir disto uma falha de conexão.
            logger.error('Failed to join room:', response.error)
            reject(new JoinAckError(response.error))
            return
          }
          if (response?.token) {
            userStore.setSessionToken(response.token)
            userStore.setActiveRoom(roomId)
          }
          resolve()
        },
      )
    })
  }

  // --- Subject Backlog (setup phase) ---

  function addSubjects(roomId: string, subjects: string[]) {
    socket?.emit('add_subjects', { roomId, subjects })
  }

  function removeSubject(roomId: string, index: number) {
    socket?.emit('remove_subject', { roomId, index })
  }

  // --- Session Flow ---

  function startSession(roomId: string) {
    socket?.emit('start_session', { roomId })
  }

  function nextRound(roomId: string) {
    socket?.emit('next_round', { roomId })
  }

  function resetSession(roomId: string) {
    socket?.emit('reset_session', { roomId })
  }

  // --- Voting ---

  function castVote(roomId: string, playerId: string, value: string | number) {
    socket?.emit('cast_vote', { roomId, playerId, value })
  }

  function revealVotes(roomId: string) {
    socket?.emit('reveal_votes', { roomId })
  }

  function disconnect() {
    if (socket) {
      socket.disconnect()
      socket = null
    }
  }

  return {
    isConnected,
    connect,
    joinRoom,
    addSubjects,
    removeSubject,
    startSession,
    nextRound,
    resetSession,
    castVote,
    revealVotes,
    disconnect,
  }
}
