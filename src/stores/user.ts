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

    // NÃO limpa o activeRoomId de propósito: o banner de "sala ativa" do layout
    // chaveia por ele, e quem o zera é o fluxo de leave (setActiveRoom(null) na
    // RoomView) + o JoinAckError — não o reset de identidade. Hoje só os testes
    // chamam clearPlayer; se um dia ligá-lo a um "logout", zere TAMBÉM o
    // activeRoomId (setActiveRoom(null)), senão o banner sobrevive apontando pra
    // sala morta e sem identidade pra se auto-curar no clique.
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
