import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRoomStore } from './room'
import type { Player, RoomConfig } from '@/types'

describe('Room Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const adminPlayer: Player = { id: 'p1', name: 'Admin', role: 'admin' }
  const roomConfig: RoomConfig = { deckType: 'fibonacci', autoReveal: false }

  it('syncs room state coming from server', () => {
    const store = useRoomStore()

    const serverRoom = {
      id: 'room-123',
      adminId: 'p1',
      config: roomConfig,
      players: [adminPlayer],
      subjects: ['Login', 'Signup'],
      phase: 'setup' as const,
      rounds: [],
      currentRoundIndex: -1,
    }

    store.syncRoom(serverRoom)

    expect(store.currentRoom).toBeDefined()
    expect(store.currentRoom!.id).toBe('room-123')
    expect(store.currentRoom!.adminId).toBe('p1')
    expect(store.currentRoom!.config.deckType).toBe('fibonacci')
    expect(store.currentRoom!.players).toHaveLength(1)
    expect(store.currentRoom!.players[0]!.name).toBe('Admin')
    expect(store.currentRoom!.subjects).toEqual(['Login', 'Signup'])
    expect(store.currentRoom!.phase).toBe('setup')
  })

  it('computes currentRound properly', () => {
    const store = useRoomStore()

    expect(store.currentRound).toBeNull()

    store.syncRoom({
      id: 'room-123',
      adminId: 'p1',
      config: roomConfig,
      players: [adminPlayer],
      subjects: ['Login bug'],
      phase: 'voting' as const,
      rounds: [{ id: 'rnd-1', subject: 'Login bug', status: 'voting', votes: {} }],
      currentRoundIndex: 0,
    })

    expect(store.currentRound).toBeDefined()
    expect(store.currentRound?.subject).toBe('Login bug')
    expect(store.currentRound?.status).toBe('voting')
  })

  it('computes phase-related properties', () => {
    const store = useRoomStore()

    store.syncRoom({
      id: 'r1',
      adminId: 'p1',
      config: roomConfig,
      players: [adminPlayer],
      subjects: ['A', 'B', 'C'],
      phase: 'setup' as const,
      rounds: [],
      currentRoundIndex: -1,
    })

    expect(store.isSetupPhase).toBe(true)
    expect(store.isVotingPhase).toBe(false)
    expect(store.isCompleted).toBe(false)
    expect(store.totalSubjects).toBe(3)
    expect(store.subjects).toEqual(['A', 'B', 'C'])
  })

  it('computes isLastSubject correctly', () => {
    const store = useRoomStore()

    store.syncRoom({
      id: 'r1',
      adminId: 'p1',
      config: roomConfig,
      players: [adminPlayer],
      subjects: ['A', 'B'],
      phase: 'voting' as const,
      rounds: [
        { id: 'rnd-1', subject: 'A', status: 'revealed', votes: {} },
        { id: 'rnd-2', subject: 'B', status: 'voting', votes: {} },
      ],
      currentRoundIndex: 1,
    })

    expect(store.isLastSubject).toBe(true)
    expect(store.currentSubjectIndex).toBe(2)
  })

  it('leaves room effectively', () => {
    const store = useRoomStore()

    store.syncRoom({
      id: 'r1',
      adminId: 'p1',
      config: roomConfig,
      players: [adminPlayer],
      subjects: [],
      phase: 'setup' as const,
      rounds: [],
      currentRoundIndex: -1,
    })

    expect(store.isInRoom).toBe(true)

    store.leaveRoom()
    expect(store.isInRoom).toBe(false)
    expect(store.currentRoom).toBeNull()
  })
})
