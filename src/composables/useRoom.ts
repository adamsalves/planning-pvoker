import { useRouter } from 'vue-router'
import { v4 as uuidv4 } from 'uuid'
import { useUserStore } from '@/stores/user'
import type { JoinableRole, DeckType, RoomConfig } from '@/types'
import { useSocket } from './useSocket'
import { logger } from '@/utils/logger'

export function useRoom() {
  const router = useRouter()
  const userStore = useUserStore()
  const { joinRoom: socketJoin } = useSocket()

  async function createRoom(playerName: string, deckType: DeckType, autoReveal: boolean) {
    const roomId = uuidv4().substring(0, 8)
    const playerId = uuidv4()

    const config: RoomConfig = { deckType, autoReveal }

    // Save player locally first
    userStore.setPlayer(playerName, playerId, 'admin')

    // Await the join so the session token is stored BEFORE we navigate — the
    // RoomView mount re-joins, and without the token that second join would be
    // rejected as an impostor (it carries the same player id).
    try {
      await socketJoin(roomId, { id: playerId, name: playerName, role: 'admin' }, config)
      router.push({ name: 'room', params: { id: roomId } })
    } catch (error) {
      logger.error('Could not create room:', error)
    }
  }

  async function joinRoom(playerName: string, roomCode: string, role: JoinableRole = 'member') {
    const playerId = uuidv4()

    // Save player local
    userStore.setPlayer(playerName, playerId, role)

    // Await before navigating (same reason as createRoom: store the token first).
    try {
      await socketJoin(roomCode, { id: playerId, name: playerName, role })
      router.push({ name: 'room', params: { id: roomCode } })
    } catch (error) {
      logger.error('Could not join room:', error)
    }
  }

  return {
    createRoom,
    joinRoom,
  }
}
