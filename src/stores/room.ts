import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Room, Player, Round, RoomConfig } from '@/types'

export const useRoomStore = defineStore('room', () => {
  // State
  const currentRoom = ref<Room | null>(null)

  // Getters
  const isInRoom = computed(() => currentRoom.value !== null)
  const players = computed(() => currentRoom.value?.players ?? [])
  const currentRound = computed(() => {
    if (!currentRoom.value || currentRoom.value.rounds.length === 0) return null
    return currentRoom.value.rounds[currentRoom.value.currentRoundIndex]
  })
  const roomConfig = computed(() => currentRoom.value?.config ?? null)

  // Actions
  function createRoom(roomId: string, adminPlayer: Player, config: RoomConfig) {
    currentRoom.value = {
      id: roomId,
      adminId: adminPlayer.id,
      config,
      players: [adminPlayer],
      rounds: [],
      currentRoundIndex: -1,
    }
  }

  function joinRoom(roomId: string, player: Player, config: RoomConfig) {
    currentRoom.value = {
      id: roomId,
      adminId: '', // será preenchido pelo WebSocket
      config,
      players: [player],
      rounds: [],
      currentRoundIndex: -1,
    }
  }

  function addPlayer(player: Player) {
    if (!currentRoom.value) return
    const exists = currentRoom.value.players.find((p) => p.id === player.id)
    if (!exists) {
      currentRoom.value.players.push(player)
    }
  }

  function removePlayer(playerId: string) {
    if (!currentRoom.value) return
    currentRoom.value.players = currentRoom.value.players.filter((p) => p.id !== playerId)
  }

  function startRound(subject: string) {
    if (!currentRoom.value) return
    const newRound: Round = {
      id: crypto.randomUUID(),
      subject,
      status: 'voting',
      votes: {},
    }
    currentRoom.value.rounds.push(newRound)
    currentRoom.value.currentRoundIndex = currentRoom.value.rounds.length - 1
  }

  function castVote(playerId: string, value: string | number) {
    const round = currentRound.value
    if (!round || round.status !== 'voting') return
    round.votes[playerId] = value
  }

  function revealVotes() {
    const round = currentRound.value
    if (!round) return
    round.status = 'revealed'
  }

  function leaveRoom() {
    currentRoom.value = null
  }

  return {
    currentRoom,
    isInRoom,
    players,
    currentRound,
    roomConfig,
    createRoom,
    joinRoom,
    addPlayer,
    removePlayer,
    startRound,
    castVote,
    revealVotes,
    leaveRoom,
  }
})
