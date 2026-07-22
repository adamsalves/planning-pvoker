import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { PlayerRole, PlayerTag } from '@/types'

export const useUserStore = defineStore(
  'user',
  () => {
    // State
    const playerName = ref('')
    const playerId = ref('')
    const playerRole = ref<PlayerRole>('member')
    // Área opcional escolhida na entrada. Persistida junto do resto da identidade
    // e reenviada no join — o servidor faz upsert dela como faz com o nome.
    const playerTag = ref<PlayerTag | undefined>(undefined)
    const activeRoomId = ref<string | null>(null)
    // Segredo de sessão emitido pelo servidor no join (anti-escalada de admin).
    // Persistido para sobreviver a um refresh; reenviado nos rejoins. Vale para
    // a sala em `activeRoomId` — ver useSocket.joinRoom.
    const sessionToken = ref<string | null>(null)

    // Actions
    function setPlayer(name: string, id: string, role: PlayerRole, tag?: PlayerTag) {
      playerName.value = name
      playerId.value = id
      playerRole.value = role
      playerTag.value = tag
    }

    function clearPlayer() {
      playerName.value = ''
      playerId.value = ''
      playerRole.value = 'member'
      playerTag.value = undefined
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
      playerTag,
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
