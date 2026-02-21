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
        // could throw/handle navigation back home here
      }
    })
  }

  function castVote(roomId: string, playerId: string, value: string | number) {
    socket?.emit('cast_vote', { roomId, playerId, value })
  }

  function startRound(roomId: string, subject: string) {
    socket?.emit('start_round', { roomId, subject })
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
    castVote,
    startRound,
    revealVotes,
    disconnect,
  }
}
