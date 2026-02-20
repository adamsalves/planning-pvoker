import { useRouter } from 'vue-router'
import { v4 as uuidv4 } from 'uuid'
import { useUserStore } from '@/stores/user'
import { useRoomStore } from '@/stores/room'
import type { JoinableRole, DeckType, RoomConfig } from '@/types'

/**
 * Composable que encapsula a lógica de criação e entrada em uma sala.
 *
 * Conceitos Vue praticados:
 * - Composables: funções reutilizáveis que usam a Composition API
 * - Encapsulamento de lógica de negócio fora dos componentes
 * - Uso de outros stores e composables internamente
 */
export function useRoom() {
  const router = useRouter()
  const userStore = useUserStore()
  const roomStore = useRoomStore()

  /**
   * Cria uma nova sala e redireciona o admin para ela.
   */
  function createRoom(playerName: string, deckType: DeckType, autoReveal: boolean) {
    const roomId = uuidv4().substring(0, 8) // Código curto e legível
    const playerId = uuidv4()

    const config: RoomConfig = {
      deckType,
      autoReveal,
    }

    // Salvar dados do player
    userStore.setPlayer(playerName, playerId, 'admin')

    // Criar sala na store
    roomStore.createRoom(roomId, { id: playerId, name: playerName, role: 'admin' }, config)

    // Navegar para a sala
    router.push({ name: 'room', params: { id: roomId } })
  }

  /**
   * Entra em uma sala existente com o código fornecido.
   */
  function joinRoom(playerName: string, roomCode: string, role: JoinableRole = 'member') {
    const playerId = uuidv4()

    // Salvar dados do player
    userStore.setPlayer(playerName, playerId, role)

    // Entrar na sala
    roomStore.joinRoom(
      roomCode,
      { id: playerId, name: playerName, role },
      { deckType: 'fibonacci', autoReveal: false }, // config será preenchida pelo WebSocket
    )

    // Navegar para a sala
    router.push({ name: 'room', params: { id: roomCode } })
  }

  return {
    createRoom,
    joinRoom,
  }
}
