import { ref } from 'vue'
import { io, Socket } from 'socket.io-client'
import type { Player, RoomConfig } from '@/types'
import { useRoomStore } from '@/stores/room'

// Singleton socket instance to avoid multiple connections across composable usages
let socket: Socket | null = null

export function useSocket() {
  const isConnected = ref(false)
  const roomStore = useRoomStore()

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

  function joinRoom(roomId: string, player: Player, config?: RoomConfig) {
    if (!socket) connect()
    socket?.emit('join_room', { roomId, player, config }, (response: { error?: string }) => {
      if (response.error) {
        console.error('Failed to join room:', response.error)
      }
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
