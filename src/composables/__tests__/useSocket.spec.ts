import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSocket } from '../useSocket'
import { useUserStore } from '@/stores/user'
import type { Player } from '@/types'
import { io } from 'socket.io-client'

// Mock socket.io-client
vi.mock('socket.io-client', () => {
  const mSocket = {
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
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
    const mockSocket = (io as Mock).mock.results[0]!.value

    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('room_state_updated', expect.any(Function))

    // Manually trigger connect callback to test reactivity
    const connectCb = mockSocket.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'connect',
    )?.[1] as () => void
    connectCb()

    expect(isConnected.value).toBe(true)

    // Manually trigger disconnect
    const disconnectCb = mockSocket.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'disconnect',
    )?.[1] as () => void
    disconnectCb()

    expect(isConnected.value).toBe(false)
  })

  it('emits join_room', () => {
    const { joinRoom } = useSocket()
    const p = { id: 'p1', name: 'Joe', role: 'member' as const }

    joinRoom('room-1', p)

    const mockSocket = (io as Mock).mock.results[0]!.value
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'join_room',
      { roomId: 'room-1', player: p, config: undefined },
      expect.any(Function),
    )
  })

  it('emits cast_vote', () => {
    const { castVote, connect } = useSocket()
    connect() // initialize socket manually to capture exact call without chaining auto-connect if any
    const mockSocket = (io as Mock).mock.results[0]!.value

    castVote('room-1', 'p1', 5)

    expect(mockSocket.emit).toHaveBeenCalledWith('cast_vote', {
      roomId: 'room-1',
      playerId: 'p1',
      value: 5,
    })
  })

  it('emits start_session', () => {
    const { startSession, connect } = useSocket()
    connect()
    const mockSocket = (io as Mock).mock.results[0]!.value

    startSession('room-1')

    expect(mockSocket.emit).toHaveBeenCalledWith('start_session', {
      roomId: 'room-1',
    })
  })

  it('emits next_round', () => {
    const { nextRound, connect } = useSocket()
    connect()
    const mockSocket = (io as Mock).mock.results[0]!.value

    nextRound('room-1')

    expect(mockSocket.emit).toHaveBeenCalledWith('next_round', {
      roomId: 'room-1',
    })
  })

  it('emits add_subjects', () => {
    const { addSubjects, connect } = useSocket()
    connect()
    const mockSocket = (io as Mock).mock.results[0]!.value

    addSubjects('room-1', ['Login', 'Signup'])

    expect(mockSocket.emit).toHaveBeenCalledWith('add_subjects', {
      roomId: 'room-1',
      subjects: ['Login', 'Signup'],
    })
  })

  it('emits reveal_votes', () => {
    const { revealVotes, connect } = useSocket()
    connect()
    const mockSocket = (io as Mock).mock.results[0]!.value

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
  })

  it('rejects when the server returns an error ack', async () => {
    const { joinRoom } = useSocket()
    const promise = joinRoom('room-1', player)

    joinAck()({ error: 'Sessão inválida' })

    await expect(promise).rejects.toThrow('Sessão inválida')
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
