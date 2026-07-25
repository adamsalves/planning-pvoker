import { ref } from 'vue'
import { io, Socket } from 'socket.io-client'
import type { Player, RoomConfig } from '@/types'
import { useRoomStore } from '@/stores/room'
import { useUserStore } from '@/stores/user'
import { useConnectionStore } from '@/stores/connection'
import { logger } from '@/utils/logger'
import { JoinAckError } from './joinErrors'

// Singleton socket instance to avoid multiple connections across composable usages
let socket: Socket | null = null

// Safety-net para o join: se a conexão nunca completar (servidor fora do ar), o
// botão de "loading" não fica preso pra sempre. O cold start do Render (~22s) fica
// bem abaixo, então isto NÃO atrapalha a primeira conexão lenta.
const JOIN_TIMEOUT_MS = 60_000

export function useSocket() {
  const isConnected = ref(false)
  const roomStore = useRoomStore()
  const userStore = useUserStore()
  const connectionStore = useConnectionStore()

  function connect() {
    if (!socket) {
      socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3001', {
        autoConnect: true,
        // Reconexão explícita: tenta pra sempre (o Render free hiberna). O budget
        // de tentativas vive no connection store e só muda a percepção (overlay).
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      })

      socket.on('connect', () => {
        isConnected.value = true
        connectionStore.setConnected()
        logger.debug('Socket connected:', socket?.id)
      })

      socket.on('disconnect', (reason) => {
        isConnected.value = false
        // Saída manual (disconnect() ao deixar a sala) não é uma queda — não dispara
        // o overlay de reconexão. Qualquer outro motivo significa "voltando".
        if (reason !== 'io client disconnect') connectionStore.setReconnecting()
        logger.debug('Socket disconnected:', reason)
      })

      // Cada tentativa de conexão que falha (cold start ou queda) conta pro budget.
      socket.on('connect_error', () => {
        const wasDown = connectionStore.isDown
        connectionStore.registerFailedAttempt()
        // Trace por tentativa só em DEV; ao CRUZAR o budget, um erro visível em prod
        // (segue tentando, mas registra que a conexão está mancando p/ diagnóstico).
        if (connectionStore.isDown && !wasDown) {
          logger.error('Socket connection down (retry budget exceeded) — still retrying')
        } else {
          logger.debug('Socket connect_error — retrying')
        }
      })

      // Eventos do Manager (reconexão automática) reforçam o estado central.
      // 'reconnect' usa setReconnected p/ sinalizar o re-join da sala (ver RoomView):
      // o socket reconectado tem id novo e o servidor indexa presença por socket.id.
      socket.io.on('reconnect_attempt', () => connectionStore.setReconnecting())
      socket.io.on('reconnect', () => connectionStore.setReconnected())
      socket.io.on('reconnect_failed', () => connectionStore.registerFailedAttempt())

      // Backend pushes room state
      socket.on('room_state_updated', (roomData: import('@/types').Room) => {
        roomStore.syncRoom(roomData)
      })
    }
  }

  // Resolves on a successful join, rejects on an error ack so callers can react
  // (navigate only on success; on the rejoin path, drop the token + go home).
  function joinRoom(roomId: string, player: Player, config?: RoomConfig): Promise<void> {
    if (!socket) connect()
    const activeSocket = socket
    if (!activeSocket) return Promise.reject(new Error('Socket indisponível'))

    // Only resend the token if it belongs to THIS room; a token from a previous
    // session would just be rejected by the server.
    const token =
      userStore.activeRoomId === roomId && userStore.sessionToken
        ? userStore.sessionToken
        : undefined

    return new Promise((resolve, reject) => {
      // Destrava o join (com erro transitório genérico — NÃO um JoinAckError, para o
      // RoomView não expulsar pra Home) se o ack nunca chegar.
      const timeout = setTimeout(() => {
        reject(new Error('Tempo de conexão esgotado. Tente novamente.'))
      }, JOIN_TIMEOUT_MS)

      activeSocket.emit(
        'join_room',
        { roomId, player, config, token },
        (response: { error?: string; token?: string }) => {
          clearTimeout(timeout)
          if (response?.error) {
            // Rejeição EXPLÍCITA do servidor (token inválido / sala inexistente).
            // Tipada para o RoomView distinguir disto uma falha de conexão.
            logger.error('Failed to join room:', response.error)
            reject(new JoinAckError(response.error))
            return
          }
          if (response?.token) {
            userStore.setSessionToken(response.token)
            userStore.setActiveRoom(roomId)
          }
          resolve()
        },
      )
    })
  }

  // Saída explícita da sala: pede ao servidor a remoção IMEDIATA (sem esperar o
  // grace de reconexão de 30s) — o jogador some da lista dos outros na hora, a
  // transferência de admin não atrasa e o token de sessão do servidor é
  // descartado junto. Fire-and-forget: chamar disconnect() logo em seguida é
  // seguro porque o engine.io descarrega o buffer de escrita antes de fechar.
  function leaveRoom(roomId: string) {
    socket?.emit('leave_room', { roomId })
  }

  // --- Subject Backlog (setup phase) ---

  function addSubjects(roomId: string, subjects: string[]) {
    socket?.emit('add_subjects', { roomId, subjects })
  }

  function removeSubject(roomId: string, index: number) {
    socket?.emit('remove_subject', { roomId, index })
  }

  // --- Session Flow ---

  function startSession(roomId: string) {
    socket?.emit('start_session', { roomId })
  }

  function nextRound(roomId: string) {
    socket?.emit('next_round', { roomId })
  }

  function resetSession(roomId: string) {
    socket?.emit('reset_session', { roomId })
  }

  // --- Voting ---

  // Retorna uma Promise (como joinRoom): resolve no ack de sucesso, rejeita no ack
  // de erro — assim o RoomView desfaz o voto otimista quando o servidor recusa.
  function castVote(roomId: string, playerId: string, value: string | number): Promise<void> {
    if (!socket) return Promise.reject(new Error('Socket indisponível'))
    const activeSocket = socket
    return new Promise((resolve, reject) => {
      activeSocket.emit(
        'cast_vote',
        { roomId, playerId, value },
        (response: { ok?: boolean; error?: string } | undefined) => {
          if (response?.error) {
            reject(new Error(response.error))
            return
          }
          resolve()
        },
      )
    })
  }

  function revealVotes(roomId: string) {
    socket?.emit('reveal_votes', { roomId })
  }

  // Admin liga/desliga um jogador da rodada corrente. Fire-and-forget como as
  // demais ações de admin: o estado novo volta no room_state_updated.
  function setRoundVoter(roomId: string, playerId: string, voting: boolean) {
    socket?.emit('set_round_voter', { roomId, playerId, voting })
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
    leaveRoom,
    addSubjects,
    removeSubject,
    startSession,
    nextRound,
    resetSession,
    castVote,
    revealVotes,
    setRoundVoter,
    disconnect,
  }
}
