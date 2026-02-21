import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Room } from '@/types'

export const useRoomStore = defineStore('room', () => {
  // State from server (Source of Truth)
  const currentRoom = ref<Room | null>(null)

  // Getters
  const isInRoom = computed(() => currentRoom.value !== null)
  const players = computed(() => currentRoom.value?.players ?? [])
  const currentRound = computed(() => {
    if (!currentRoom.value || currentRoom.value.rounds.length === 0) return null
    if (currentRoom.value.currentRoundIndex === -1) return null
    return currentRoom.value.rounds[currentRoom.value.currentRoundIndex]
  })
  const roomConfig = computed(() => currentRoom.value?.config ?? null)

  // Apenas sincroniza o estado que vem do servidor
  function syncRoom(serverRoom: Room) {
    currentRoom.value = serverRoom
  }

  // O cliente decide sair
  function leaveRoom() {
    currentRoom.value = null
  }

  return {
    currentRoom,
    isInRoom,
    players,
    currentRound,
    roomConfig,
    syncRoom,
    leaveRoom,
  }
})
