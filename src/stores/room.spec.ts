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

    // Server payload
    const serverRoom = {
      id: 'room-123',
      adminId: 'p1',
      config: roomConfig,
      players: [adminPlayer],
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
  })

  it('computes currentRound properly', () => {
    const store = useRoomStore()

    expect(store.currentRound).toBeNull()

    // Simulate server round start
    store.syncRoom({
      id: 'room-123',
      adminId: 'p1',
      config: roomConfig,
      players: [adminPlayer],
      rounds: [{ id: 'rnd-1', subject: 'Login bug', status: 'voting', votes: {} }],
      currentRoundIndex: 0,
    })

    expect(store.currentRound).toBeDefined()
    expect(store.currentRound?.subject).toBe('Login bug')
    expect(store.currentRound?.status).toBe('voting')
  })

  it('leaves room effectively', () => {
    const store = useRoomStore()

    store.syncRoom({
      id: 'r1',
      adminId: 'p1',
      config: roomConfig,
      players: [adminPlayer],
      rounds: [],
      currentRoundIndex: -1,
    })

    expect(store.isInRoom).toBe(true)

    store.leaveRoom()
    expect(store.isInRoom).toBe(false)
    expect(store.currentRoom).toBeNull()
  })
})
