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

  it('creates a room with initial state', () => {
    const store = useRoomStore()
    store.createRoom('room-123', adminPlayer, roomConfig)

    expect(store.currentRoom).toBeDefined()
    expect(store.currentRoom!.id).toBe('room-123')
    expect(store.currentRoom!.adminId).toBe('p1')
    expect(store.currentRoom!.config.deckType).toBe('fibonacci')
    expect(store.currentRoom!.players).toHaveLength(1)
    expect(store.currentRoom!.players[0]!.name).toBe('Admin')
  })

  it('starts a new round and maps it correctly to currentRound', () => {
    const store = useRoomStore()
    store.createRoom('r1', adminPlayer, roomConfig)
    store.startRound('Refactor backend')

    expect(store.currentRound).toBeDefined()
    expect(store.currentRound?.subject).toBe('Refactor backend')
    expect(store.currentRound?.status).toBe('voting')
    expect(store.currentRound?.votes).toEqual({})
  })

  it('casts a vote and reveals', () => {
    const store = useRoomStore()
    store.createRoom('r1', adminPlayer, roomConfig)
    store.startRound('Vote check')

    // cast vote
    store.castVote('p1', 5)
    expect(store.currentRound?.votes['p1']).toBe(5)

    // reveal
    store.revealVotes()
    expect(store.currentRound?.status).toBe('revealed')
  })

  it('adds and removes players correctly', () => {
    const store = useRoomStore()
    store.createRoom('r1', adminPlayer, roomConfig)

    const bob: Player = { id: 'p2', name: 'Bob', role: 'member' }
    store.addPlayer(bob)

    expect(store.currentRoom?.players).toHaveLength(2)
    expect(store.players).toHaveLength(2)

    store.removePlayer('p2')
    expect(store.currentRoom?.players).toHaveLength(1)
  })
})
