import { ref } from 'vue'
import { io, Socket } from 'socket.io-client'
import type { Player, RoomConfig } from '@/types'
import { useRoomStore } from '@/stores/room'
import { useUserStore } from '@/stores/user'

// Singleton socket instance to avoid multiple connections across composable usages
let socket: Socket | null = null

export function useSocket() {
  const isConnected = ref(false)
  const roomStore = useRoomStore()
  const userStore = useUserStore()

  function connect() {
    if (!socket) {
      socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3001', {
        autoConnect: true,
      })

      socket.on('connect', () => {
        isConnected.value = true
        console.log('Socket connected:', socket?.id)
      })

      socket.on('disconnect', () => {
        isConnected.value = false
        console.log('Socket disconnected')
      })

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
            console.error('Failed to join room:', response.error)
            reject(new Error(response.error))
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
