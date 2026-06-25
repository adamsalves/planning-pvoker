import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { PlayerRole } from '@/types'

export const useUserStore = defineStore(
  'user',
  () => {
    // State
    const playerName = ref('')
    const playerId = ref('')
    const playerRole = ref<PlayerRole>('member')
    const activeRoomId = ref<string | null>(null)
    // Segredo de sessão emitido pelo servidor no join (anti-escalada de admin).
    // Persistido para sobreviver a um refresh; reenviado nos rejoins. Vale para
    // a sala em `activeRoomId` — ver useSocket.joinRoom.
    const sessionToken = ref<string | null>(null)

    // Actions
    function setPlayer(name: string, id: string, role: PlayerRole) {
      playerName.value = name
      playerId.value = id
      playerRole.value = role
    }

    function clearPlayer() {
      playerName.value = ''
      playerId.value = ''
      playerRole.value = 'member'
      sessionToken.value = null
    }

    function setActiveRoom(roomId: string | null) {
      activeRoomId.value = roomId
    }

    function setSessionToken(token: string | null) {
      sessionToken.value = token
    }

    return {
      playerName,
      playerId,
      playerRole,
      activeRoomId,
      sessionToken,
      setPlayer,
      clearPlayer,
      setActiveRoom,
      setSessionToken,
    }
  },
  {
    persist: true, // pinia-plugin-persistedstate: salva no localStorage automaticamente
  },
)
