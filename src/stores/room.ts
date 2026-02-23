import { shallowRef, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Room } from '@/types'

export const useRoomStore = defineStore('room', () => {
  // State from server (Source of Truth)
  const currentRoom = shallowRef<Room | null>(null)

  // Getters
  const isInRoom = computed(() => currentRoom.value !== null)
  const players = computed(() => currentRoom.value?.players ?? [])
  const currentRound = computed(() => {
    if (!currentRoom.value || currentRoom.value.rounds.length === 0) return null
    if (currentRoom.value.currentRoundIndex === -1) return null
    return currentRoom.value.rounds[currentRoom.value.currentRoundIndex]
  })
  const roomConfig = computed(() => currentRoom.value?.config ?? null)

  // Phase-related getters
  const phase = computed(() => currentRoom.value?.phase ?? 'setup')
  const subjects = computed(() => currentRoom.value?.subjects ?? [])
  const isSetupPhase = computed(() => phase.value === 'setup')
  const isVotingPhase = computed(() => phase.value === 'voting')
  const isCompleted = computed(() => phase.value === 'completed')
  const totalSubjects = computed(() => subjects.value.length)
  const currentSubjectIndex = computed(() => {
    if (!currentRoom.value || currentRoom.value.currentRoundIndex === -1) return 0
    return currentRoom.value.currentRoundIndex + 1
  })
  const isLastSubject = computed(() => {
    if (!currentRoom.value) return false
    return currentRoom.value.currentRoundIndex >= currentRoom.value.subjects.length - 1
  })

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
    phase,
    subjects,
    isSetupPhase,
    isVotingPhase,
    isCompleted,
    totalSubjects,
    currentSubjectIndex,
    isLastSubject,
    syncRoom,
    leaveRoom,
  }
})
