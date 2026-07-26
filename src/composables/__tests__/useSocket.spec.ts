import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSocket } from '../useSocket'
import { JoinAckError } from '../joinErrors'
import { useUserStore } from '@/stores/user'
import { useConnectionStore } from '@/stores/connection'
import type { Player } from '@/types'
import { io } from 'socket.io-client'

// Mock socket.io-client. `io` is the Manager (socket.io.on) used for reconnect_* events.
vi.mock('socket.io-client', () => {
  const mSocket = {
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    io: { on: vi.fn() },
    id: 'mock-socket-id',
  }
  return {
    io: vi.fn(() => mSocket),
  }
})

// Cast-free helpers (the project forbids `as`/`!`): grab the socket from the
// last io() call and the ack callback passed to the join_room emit.
function lastSocket() {
  const result = vi.mocked(io).mock.results.at(-1)
  if (!result || result.type !== 'return') throw new Error('io() was not called')
  return result.value
}

function joinAck() {
  const call = vi.mocked(lastSocket().emit).mock.calls.find((c) => c[0] === 'join_room')
  if (!call) throw new Error('join_room was not emitted')
  const ack = call[2]
  if (typeof ack !== 'function') throw new Error('join_room ack is not a function')
  return ack
}

function castVoteAck() {
  const call = vi.mocked(lastSocket().emit).mock.calls.find((c) => c[0] === 'cast_vote')
  if (!call) throw new Error('cast_vote was not emitted')
  const ack = call[2]
  if (typeof ack !== 'function') throw new Error('cast_vote ack is not a function')
  return ack
}

// Grab a socket-level handler (connect/disconnect/connect_error) registered via socket.on.
function socketHandler(event: string) {
  const call = vi.mocked(lastSocket().on).mock.calls.find((c) => c[0] === event)
  if (!call) throw new Error(`socket handler not registered: ${event}`)
  const handler = call[1]
  if (typeof handler !== 'function') throw new Error(`handler is not a function: ${event}`)
  return handler
}

// Grab a Manager-level handler (reconnect_*) registered via socket.io.on.
//
// Devolve um wrapper em vez do handler cru: os overloads de `Manager.on` fazem o
// TS reduzir a assinatura recuperada do mock à interseção dos eventos, cujos
// parâmetros colapsam em `never` — então chamar `handler(1)` não compila, e
// `handler()` reclama de aridade. O teste, por natureza, não conhece o tipo dos
// argumentos daquele evento específico.
//
// Alargar para `unknown` e estreitar com `typeof` devolve uma chamada válida sem
// nenhuma asserção (a regra do projeto proíbe `as`/`!`). Sendo honesto sobre o que
// isto é: chamar um valor estreitado para `Function` devolve `any` vindo da lib —
// não é narrowing de verdade, só não é um cast escrito à mão.
function managerHandler(event: string): (...args: unknown[]) => void {
  const call = vi.mocked(lastSocket().io.on).mock.calls.find((c) => c[0] === event)
  if (!call) throw new Error(`manager handler not registered: ${event}`)
  const handler: unknown = call[1]
  if (typeof handler !== 'function') throw new Error(`handler is not a function: ${event}`)
  return (...args: unknown[]) => handler(...args)
}

const player: Player = { id: 'p1', name: 'Joe', role: 'member' }

describe('useSocket', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // We need to reset the singleton inside the module.
    // Easiest is to call disconnect() if we had connected.
    const { disconnect } = useSocket()
    disconnect()
  })

  it('connects to socket and registers listeners', () => {
    const { connect, isConnected } = useSocket()
    expect(isConnected.value).toBe(false)

    connect()

    expect(io).toHaveBeenCalled()

    // Get the mocked socket logic
    const mockSocket = lastSocket()

    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('room_state_updated', expect.any(Function))

    // Manually trigger connect callback to test reactivity
    socketHandler('connect')()

    expect(isConnected.value).toBe(true)

    // Manually trigger disconnect
    socketHandler('disconnect')()

    expect(isConnected.value).toBe(false)
  })

  it('emits join_room', () => {
    const { joinRoom } = useSocket()
    const p = { id: 'p1', name: 'Joe', role: 'member' as const }

    joinRoom('room-1', p)

    const mockSocket = lastSocket()
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'join_room',
      { roomId: 'room-1', player: p, config: undefined },
      expect.any(Function),
    )

    joinAck()({ success: true }) // resolve o join p/ limpar o timer de safety-net
  })

  it('emits leave_room with the room id (explicit exit, no ack needed)', () => {
    const { leaveRoom, connect } = useSocket()
    connect()

    leaveRoom('room-1')

    expect(lastSocket().emit).toHaveBeenCalledWith('leave_room', { roomId: 'room-1' })
  })

  it('emits cast_vote', () => {
    const { castVote, connect } = useSocket()
    connect() // initialize socket manually to capture exact call without chaining auto-connect if any
    const mockSocket = lastSocket()

    castVote('room-1', 'p1', 5)

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'cast_vote',
      { roomId: 'room-1', playerId: 'p1', value: 5 },
      expect.any(Function),
    )
  })

  it('rejects cast_vote when the server returns an error ack', async () => {
    const { castVote, connect } = useSocket()
    connect()
    const promise = castVote('room-1', 'p1', 999)

    castVoteAck()({ error: 'invalid_vote_for_deck' })

    await expect(promise).rejects.toThrow('invalid_vote_for_deck')
  })

  it('emits start_session', () => {
    const { startSession, connect } = useSocket()
    connect()
    const mockSocket = lastSocket()

    startSession('room-1')

    expect(mockSocket.emit).toHaveBeenCalledWith('start_session', {
      roomId: 'room-1',
    })
  })

  it('emits next_round', () => {
    const { nextRound, connect } = useSocket()
    connect()
    const mockSocket = lastSocket()

    nextRound('room-1')

    expect(mockSocket.emit).toHaveBeenCalledWith('next_round', {
      roomId: 'room-1',
    })
  })

  it('emits add_subjects', () => {
    const { addSubjects, connect } = useSocket()
    connect()
    const mockSocket = lastSocket()

    addSubjects('room-1', ['Login', 'Signup'])

    expect(mockSocket.emit).toHaveBeenCalledWith('add_subjects', {
      roomId: 'room-1',
      subjects: ['Login', 'Signup'],
    })
  })

  it('emits reveal_votes', () => {
    const { revealVotes, connect } = useSocket()
    connect()
    const mockSocket = lastSocket()

    revealVotes('room-1')

    expect(mockSocket.emit).toHaveBeenCalledWith('reveal_votes', { roomId: 'room-1' })
  })

  // --- Session token wiring (anti-escalation) ---

  it('does not resend a token that belongs to a different room', () => {
    const userStore = useUserStore()
    userStore.setActiveRoom('room-A')
    userStore.setSessionToken('tok-A')

    const { joinRoom } = useSocket()
    joinRoom('room-B', player) // joining a different room than the stored token's

    expect(lastSocket().emit).toHaveBeenCalledWith(
      'join_room',
      expect.objectContaining({ roomId: 'room-B', token: undefined }),
      expect.any(Function),
    )

    joinAck()({ success: true }) // resolve o join p/ limpar o timer de safety-net
  })

  it('resends the stored token when rejoining the active room', () => {
    const userStore = useUserStore()
    userStore.setActiveRoom('room-A')
    userStore.setSessionToken('tok-A')

    const { joinRoom } = useSocket()
    joinRoom('room-A', player)

    expect(lastSocket().emit).toHaveBeenCalledWith(
      'join_room',
      expect.objectContaining({ roomId: 'room-A', token: 'tok-A' }),
      expect.any(Function),
    )

    joinAck()({ success: true }) // resolve o join p/ limpar o timer de safety-net
  })

  it('rejects when the server returns an error ack', async () => {
    const { joinRoom } = useSocket()
    const promise = joinRoom('room-1', player)

    joinAck()({ error: 'invalid_session' })

    await expect(promise).rejects.toThrow('invalid_session')
    // Typed so RoomView can tell a real server rejection from a connection failure.
    await expect(promise).rejects.toBeInstanceOf(JoinAckError)
  })

  it('resolves and stores the token from a successful ack', async () => {
    const userStore = useUserStore()
    const { joinRoom } = useSocket()
    const promise = joinRoom('room-1', player)

    joinAck()({ success: true, token: 'fresh-token' })

    await expect(promise).resolves.toBeUndefined()
    expect(userStore.sessionToken).toBe('fresh-token')
    expect(userStore.activeRoomId).toBe('room-1')
  })
})

describe('useSocket connection state', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    useSocket().disconnect() // reset the module singleton between tests
  })

  it('marks connected on connect and reconnecting on a non-manual drop', () => {
    const connection = useConnectionStore()
    const { connect } = useSocket()
    connect()

    socketHandler('connect')()
    expect(connection.status).toBe('connected')

    socketHandler('disconnect')('transport close')
    expect(connection.status).toBe('reconnecting')
  })

  it('does NOT flip to reconnecting on a manual (client) disconnect', () => {
    const connection = useConnectionStore()
    const { connect } = useSocket()
    connect()
    socketHandler('connect')()

    socketHandler('disconnect')('io client disconnect')
    expect(connection.status).toBe('connected')
  })

  it('counts failed attempts and flips to down past the budget, still waiting', () => {
    const connection = useConnectionStore()
    const { connect } = useSocket()
    connect()

    const onConnectError = socketHandler('connect_error')
    for (let i = 0; i < 5; i++) onConnectError(new Error('xhr poll error'))

    expect(connection.isDown).toBe(true)
    expect(connection.isWaiting).toBe(true)
  })

  it('reflects manager reconnect_attempt / reconnect and signals a rejoin', () => {
    const connection = useConnectionStore()
    const { connect } = useSocket()
    connect()

    managerHandler('reconnect_attempt')(1)
    expect(connection.status).toBe('reconnecting')

    const nonceBefore = connection.reconnectNonce
    managerHandler('reconnect')(2)
    expect(connection.status).toBe('connected')
    // The reconnect must bump the nonce so RoomView re-emits join_room.
    expect(connection.reconnectNonce).toBe(nonceBefore + 1)
  })

  it('counts a manager reconnect_failed as a failed attempt', () => {
    const connection = useConnectionStore()
    const { connect } = useSocket()
    connect()

    const before = connection.attempts
    managerHandler('reconnect_failed')()
    expect(connection.attempts).toBe(before + 1)
  })
})
