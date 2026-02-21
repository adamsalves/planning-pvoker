import { useRouter } from 'vue-router'
import { v4 as uuidv4 } from 'uuid'
import { useUserStore } from '@/stores/user'
import type { JoinableRole, DeckType, RoomConfig } from '@/types'
import { useSocket } from './useSocket'

export function useRoom() {
  const router = useRouter()
  const userStore = useUserStore()
  const { joinRoom: socketJoin } = useSocket()

  function createRoom(playerName: string, deckType: DeckType, autoReveal: boolean) {
    const roomId = uuidv4().substring(0, 8)
    const playerId = uuidv4()

    const config: RoomConfig = { deckType, autoReveal }

    // Save player locally first
    userStore.setPlayer(playerName, playerId, 'admin')

    // Ask server to join/create the room
    socketJoin(roomId, { id: playerId, name: playerName, role: 'admin' }, config)

    // And navigate there
    router.push({ name: 'room', params: { id: roomId } })
  }

  function joinRoom(playerName: string, roomCode: string, role: JoinableRole = 'member') {
    const playerId = uuidv4()

    // Save player local
    userStore.setPlayer(playerName, playerId, role)

    // Notify server (config not passed since it's just joining)
    socketJoin(roomCode, { id: playerId, name: playerName, role })

    router.push({ name: 'room', params: { id: roomCode } })
  }

  return {
    createRoom,
    joinRoom,
  }
}
