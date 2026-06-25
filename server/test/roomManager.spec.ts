import { describe, it, expect, beforeEach } from 'vitest'
import { RoomManager } from '../src/roomManager'
import type { Player, RoomConfig } from '../src/types'

const config: RoomConfig = { deckType: 'fibonacci', autoReveal: false }
const admin: Player = { id: 'a1', name: 'Admin', role: 'admin' }
const member: Player = { id: 'm1', name: 'Member', role: 'member' }
const observer: Player = { id: 'o1', name: 'Obs', role: 'observer' }

let rm: RoomManager

beforeEach(() => {
  rm = new RoomManager()
})

describe('createRoom', () => {
  it('creates a room with the creator as admin and empty state', () => {
    const room = rm.createRoom('r1', admin, config)
    expect(room.adminId).toBe('a1')
    expect(room.players).toEqual([admin])
    expect(room.phase).toBe('setup')
    expect(room.currentRoundIndex).toBe(-1)
    expect(rm.getRoom('r1')).toBe(room)
  })
})

describe('joinRoom', () => {
  it('adds a new player', () => {
    rm.createRoom('r1', admin, config)
    const room = rm.joinRoom('r1', member)
    expect(room?.players).toHaveLength(2)
    expect(room?.players[1]).toEqual(member)
  })

  it('upserts an existing player (updates name/role, no duplicate)', () => {
    rm.createRoom('r1', admin, config)
    rm.joinRoom('r1', member)
    const room = rm.joinRoom('r1', { id: 'm1', name: 'Renamed', role: 'observer' })
    expect(room?.players).toHaveLength(2)
    expect(room?.players.find((p) => p.id === 'm1')).toEqual({
      id: 'm1',
      name: 'Renamed',
      role: 'observer',
    })
  })

  it('returns null for a missing room', () => {
    expect(rm.joinRoom('nope', member)).toBeNull()
  })
})

describe('leaveRoom', () => {
  it('removes a player', () => {
    rm.createRoom('r1', admin, config)
    rm.joinRoom('r1', member)
    const room = rm.leaveRoom('r1', 'm1')
    expect(room?.players.map((p) => p.id)).toEqual(['a1'])
  })

  it('transfers admin to the next player when the admin leaves', () => {
    rm.createRoom('r1', admin, config)
    rm.joinRoom('r1', member)
    const room = rm.leaveRoom('r1', 'a1')
    expect(room?.adminId).toBe('m1')
    expect(room?.players.find((p) => p.id === 'm1')?.role).toBe('admin')
  })

  it('deletes the room when the last player leaves', () => {
    rm.createRoom('r1', admin, config)
    expect(rm.leaveRoom('r1', 'a1')).toBeNull()
    expect(rm.getRoom('r1')).toBeUndefined()
  })
})

describe('addSubjects', () => {
  it('appends subjects during setup', () => {
    rm.createRoom('r1', admin, config)
    const room = rm.addSubjects('r1', ['A', 'B'])
    expect(room?.subjects).toEqual(['A', 'B'])
  })

  it('rejects when not in setup phase', () => {
    rm.createRoom('r1', admin, config)
    rm.addSubjects('r1', ['A'])
    rm.startSession('r1')
    expect(rm.addSubjects('r1', ['B'])).toBeNull()
  })

  it('rejects a batch that would exceed MAX_SUBJECTS_TOTAL (200)', () => {
    rm.createRoom('r1', admin, config)
    rm.addSubjects(
      'r1',
      Array.from({ length: 200 }, (_, i) => `S${i}`),
    )
    expect(rm.addSubjects('r1', ['overflow'])).toBeNull()
    expect(rm.getRoom('r1')?.subjects).toHaveLength(200)
  })
})

describe('removeSubject', () => {
  it('removes by index', () => {
    rm.createRoom('r1', admin, config)
    rm.addSubjects('r1', ['A', 'B', 'C'])
    const room = rm.removeSubject('r1', 1)
    expect(room?.subjects).toEqual(['A', 'C'])
  })

  it('rejects an out-of-range index', () => {
    rm.createRoom('r1', admin, config)
    rm.addSubjects('r1', ['A'])
    expect(rm.removeSubject('r1', 5)).toBeNull()
    expect(rm.removeSubject('r1', -1)).toBeNull()
  })
})

describe('session flow', () => {
  it('startSession requires subjects and moves to voting', () => {
    rm.createRoom('r1', admin, config)
    expect(rm.startSession('r1')).toBeNull()
    rm.addSubjects('r1', ['A', 'B'])
    const room = rm.startSession('r1')
    expect(room?.phase).toBe('voting')
    expect(room?.currentRoundIndex).toBe(0)
    expect(room?.rounds[0].subject).toBe('A')
  })

  it('nextRound advances, then completes after the last subject', () => {
    rm.createRoom('r1', admin, config)
    rm.addSubjects('r1', ['A', 'B'])
    rm.startSession('r1')
    const second = rm.nextRound('r1')
    expect(second?.currentRoundIndex).toBe(1)
    expect(second?.rounds[1].subject).toBe('B')
    const done = rm.nextRound('r1')
    expect(done?.phase).toBe('completed')
  })
})

describe('castVote', () => {
  beforeEach(() => {
    rm.createRoom('r1', admin, config)
    rm.joinRoom('r1', member)
    rm.joinRoom('r1', observer)
    rm.addSubjects('r1', ['A'])
    rm.startSession('r1')
  })

  it('records a vote for an active player', () => {
    const room = rm.castVote('r1', 'm1', 5)
    expect(room?.rounds[0].votes['m1']).toBe(5)
  })

  it('rejects a vote from an observer', () => {
    expect(rm.castVote('r1', 'o1', 5)).toBeNull()
  })

  it('rejects a vote from a player not in the room', () => {
    expect(rm.castVote('r1', 'ghost', 5)).toBeNull()
  })

  it('auto-reveals when autoReveal is on and all active players voted', () => {
    const arm = new RoomManager()
    arm.createRoom('r2', admin, { deckType: 'fibonacci', autoReveal: true })
    arm.joinRoom('r2', member)
    arm.joinRoom('r2', observer)
    arm.addSubjects('r2', ['A'])
    arm.startSession('r2')
    arm.castVote('r2', 'a1', 3)
    const room = arm.castVote('r2', 'm1', 5)
    expect(room?.rounds[0].status).toBe('revealed')
  })
})

describe('session tokens', () => {
  it('mints a non-empty token and reuses it on repeat calls', () => {
    const a = rm.getOrCreateToken('r1', 'a1')
    const b = rm.getOrCreateToken('r1', 'a1')
    expect(a).toBeTruthy()
    expect(b).toBe(a) // stable across rejoins (no multi-tab/refresh lockout)
  })

  it('issues distinct tokens per (room, player)', () => {
    const a = rm.getOrCreateToken('r1', 'a1')
    const samePlayerOtherRoom = rm.getOrCreateToken('r2', 'a1')
    const otherPlayerSameRoom = rm.getOrCreateToken('r1', 'm1')
    expect(samePlayerOtherRoom).not.toBe(a)
    expect(otherPlayerSameRoom).not.toBe(a)
  })

  it('hasToken reflects whether a token was issued', () => {
    expect(rm.hasToken('r1', 'a1')).toBe(false)
    rm.getOrCreateToken('r1', 'a1')
    expect(rm.hasToken('r1', 'a1')).toBe(true)
  })

  it('verifyToken accepts only the exact token', () => {
    const token = rm.getOrCreateToken('r1', 'a1')
    expect(rm.verifyToken('r1', 'a1', token)).toBe(true)
    expect(rm.verifyToken('r1', 'a1', 'wrong')).toBe(false)
    expect(rm.verifyToken('r1', 'a1', undefined)).toBe(false)
    expect(rm.verifyToken('r1', 'unknown', token)).toBe(false)
  })

  it('clearToken removes the token', () => {
    const token = rm.getOrCreateToken('r1', 'a1')
    rm.clearToken('r1', 'a1')
    expect(rm.hasToken('r1', 'a1')).toBe(false)
    expect(rm.verifyToken('r1', 'a1', token)).toBe(false)
  })

  it('leaveRoom clears the leaving player token (but not others)', () => {
    rm.createRoom('r1', admin, config)
    rm.joinRoom('r1', member)
    rm.getOrCreateToken('r1', 'a1')
    rm.getOrCreateToken('r1', 'm1')
    rm.leaveRoom('r1', 'm1')
    expect(rm.hasToken('r1', 'm1')).toBe(false)
    expect(rm.hasToken('r1', 'a1')).toBe(true)
  })
})

describe('revealVotes / resetSession', () => {
  it('reveal sets the current round to revealed', () => {
    rm.createRoom('r1', admin, config)
    rm.addSubjects('r1', ['A'])
    rm.startSession('r1')
    const room = rm.revealVotes('r1')
    expect(room?.rounds[0].status).toBe('revealed')
  })

  it('reset returns the room to setup', () => {
    rm.createRoom('r1', admin, config)
    rm.addSubjects('r1', ['A'])
    rm.startSession('r1')
    const room = rm.resetSession('r1')
    expect(room?.phase).toBe('setup')
    expect(room?.subjects).toEqual([])
    expect(room?.currentRoundIndex).toBe(-1)
  })
})
