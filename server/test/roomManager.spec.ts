import { describe, it, expect, beforeEach } from 'vitest'
import { RoomManager } from '../src/roomManager'
import type { Player, RoomConfig, Room } from '../src/types'
import type { RoomPersistence, PersistenceSnapshot } from '../src/persistence'

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

  it('carries a new player tag and overwrites it on re-join (like name/role)', () => {
    rm.createRoom('r1', admin, config)
    const joined = rm.joinRoom('r1', { id: 'm1', name: 'Member', role: 'member', tag: 'dev' })
    expect(joined?.players.find((p) => p.id === 'm1')?.tag).toBe('dev')

    // The client re-sends its current tag on every join; here it dropped the tag,
    // so the upsert clears it — same overwrite path as name/role.
    const rejoined = rm.joinRoom('r1', { id: 'm1', name: 'Member', role: 'member' })
    expect(rejoined?.players.find((p) => p.id === 'm1')?.tag).toBeUndefined()
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

  it('keeps a promoted player tag when the admin leaves', () => {
    rm.createRoom('r1', admin, config)
    rm.joinRoom('r1', { id: 'm1', name: 'Member', role: 'member', tag: 'qa' })
    const room = rm.leaveRoom('r1', 'a1') // admin leaves → m1 promoted in-place
    const promoted = room?.players.find((p) => p.id === 'm1')
    expect(promoted?.role).toBe('admin')
    expect(promoted?.tag).toBe('qa') // in-place role mutation must not drop the tag
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

describe('autoReveal quorum is presence-aware', () => {
  const autoRevealConfig: RoomConfig = { deckType: 'fibonacci', autoReveal: true }
  // A third eligible voter that stands in for a rehydration ghost: eligible to
  // vote, but never present (no socket, no grace timer).
  const ghost: Player = { id: 'g1', name: 'Ghost', role: 'member' }

  // Seeds a voting room [admin, member, ghost] with autoReveal on, and an oracle
  // where only admin + member are present.
  function seededRoom() {
    const arm = new RoomManager()
    arm.setPresence({ isPresent: (_roomId, playerId) => playerId === 'a1' || playerId === 'm1' })
    arm.createRoom('r1', admin, autoRevealConfig)
    arm.joinRoom('r1', member)
    arm.joinRoom('r1', ghost)
    arm.addSubjects('r1', ['A'])
    arm.startSession('r1')
    return arm
  }

  it('reveals once the present voters have voted, excluding the absent ghost', () => {
    const arm = seededRoom()
    arm.castVote('r1', 'a1', 3)
    const room = arm.castVote('r1', 'm1', 5)
    // Ghost never voted, but it is absent, so it is out of the quorum.
    expect(room?.rounds[0].status).toBe('revealed')
  })

  it('does not reveal while a present voter has not voted yet', () => {
    const arm = seededRoom()
    const room = arm.castVote('r1', 'a1', 3) // member (present) still pending
    expect(room?.rounds[0].status).toBe('voting')
  })

  it('the default oracle counts every eligible voter (a pending one blocks reveal)', () => {
    // No setPresence(): default oracle reports everyone present, so the ghost is
    // still required and the round stays open — the pre-fix behavior, preserved.
    const arm = new RoomManager()
    arm.createRoom('r1', admin, autoRevealConfig)
    arm.joinRoom('r1', member)
    arm.joinRoom('r1', ghost)
    arm.addSubjects('r1', ['A'])
    arm.startSession('r1')
    arm.castVote('r1', 'a1', 3)
    const room = arm.castVote('r1', 'm1', 5) // g1 still hasn't voted
    expect(room?.rounds[0].status).toBe('voting')
  })

  it('reveals when the last present voter leaves and the rest have voted', () => {
    // Three present voters; two vote; the third leaves before voting. Once gone,
    // the remaining present voters are the whole quorum and all have voted.
    const arm = new RoomManager()
    arm.setPresence({ isPresent: () => true })
    arm.createRoom('r1', admin, autoRevealConfig)
    arm.joinRoom('r1', member)
    arm.joinRoom('r1', ghost)
    arm.addSubjects('r1', ['A'])
    arm.startSession('r1')
    arm.castVote('r1', 'a1', 3)
    arm.castVote('r1', 'm1', 5)
    const room = arm.leaveRoom('r1', 'g1')
    expect(room?.rounds[0].status).toBe('revealed')
  })
})

describe('setRoundVoter (admin chooses who votes in the round)', () => {
  const other: Player = { id: 'm2', name: 'Other', role: 'member' }

  // Voting room [admin, member, other, observer] on subject A, autoReveal off.
  function seeded(autoReveal = false) {
    const arm = new RoomManager()
    arm.createRoom('r1', admin, { deckType: 'fibonacci', autoReveal })
    arm.joinRoom('r1', member)
    arm.joinRoom('r1', other)
    arm.joinRoom('r1', observer)
    arm.addSubjects('r1', ['A', 'B'])
    arm.startSession('r1')
    return arm
  }

  it('starts a session with nobody excluded', () => {
    expect(seeded().getRoom('r1')?.rounds[0].excludedVoterIds).toEqual([])
  })

  it('excludes and re-includes a player', () => {
    const arm = seeded()
    expect(arm.setRoundVoter('r1', 'm1', false)?.rounds[0].excludedVoterIds).toEqual(['m1'])
    expect(arm.setRoundVoter('r1', 'm1', true)?.rounds[0].excludedVoterIds).toEqual([])
  })

  it('is idempotent — excluding twice does not duplicate the id', () => {
    const arm = seeded()
    arm.setRoundVoter('r1', 'm1', false)
    expect(arm.setRoundVoter('r1', 'm1', false)?.rounds[0].excludedVoterIds).toEqual(['m1'])
  })

  it('drops a vote already cast by the player being excluded', () => {
    const arm = seeded()
    arm.castVote('r1', 'm1', 5)
    const room = arm.setRoundVoter('r1', 'm1', false)
    // Keeping it would skew the reveal stats with a vote nobody is waiting on.
    expect(room?.rounds[0].votes['m1']).toBeUndefined()
  })

  it('lets the admin take themselves out (facilitator who does not vote)', () => {
    expect(seeded().setRoundVoter('r1', 'a1', false)?.rounds[0].excludedVoterIds).toEqual(['a1'])
  })

  it('rejects toggling an observer, an unknown player, or a revealed round', () => {
    const arm = seeded()
    expect(arm.setRoundVoter('r1', 'o1', false)).toBeNull()
    expect(arm.setRoundVoter('r1', 'ghost', false)).toBeNull()
    arm.revealVotes('r1')
    expect(arm.setRoundVoter('r1', 'm1', false)).toBeNull()
  })

  it('rejects when the room has no active round', () => {
    const arm = new RoomManager()
    arm.createRoom('r1', admin, config)
    arm.joinRoom('r1', member)
    expect(arm.setRoundVoter('r1', 'm1', false)).toBeNull()
    expect(arm.setRoundVoter('nope', 'm1', false)).toBeNull()
  })

  it('refuses a vote from an excluded player, and accepts it again once re-included', () => {
    const arm = seeded()
    arm.setRoundVoter('r1', 'm1', false)
    expect(arm.castVote('r1', 'm1', 5)).toBeNull()
    arm.setRoundVoter('r1', 'm1', true)
    expect(arm.castVote('r1', 'm1', 5)?.rounds[0].votes['m1']).toBe(5)
  })

  it('carries the selection over to the next round, as an independent copy', () => {
    const arm = seeded()
    arm.setRoundVoter('r1', 'm1', false)
    const room = arm.nextRound('r1')
    expect(room?.rounds[1].excludedVoterIds).toEqual(['m1'])

    // Distinct arrays, not one shared reference — the assertion that actually
    // pins the copy in createRound (the one below passes either way, since
    // setRoundVoter reassigns instead of mutating).
    expect(room?.rounds[0].excludedVoterIds).not.toBe(room?.rounds[1].excludedVoterIds)

    // Toggling in the new round must not rewrite the previous one's history.
    arm.setRoundVoter('r1', 'm2', false)
    expect(room?.rounds[0].excludedVoterIds).toEqual(['m1'])
    expect(room?.rounds[1].excludedVoterIds).toEqual(['m1', 'm2'])
  })

  it('auto-reveals when excluding the last voter the round was waiting on', () => {
    const arm = seeded(true)
    arm.castVote('r1', 'a1', 3)
    arm.castVote('r1', 'm1', 5)
    // m2 is the only one left pending; taking them out completes the quorum.
    const room = arm.setRoundVoter('r1', 'm2', false)
    expect(room?.rounds[0].status).toBe('revealed')
  })

  // Intersection with the presence-aware quorum (PR #51): the two filters have
  // to compose, so the round waits on eligible ∩ present.
  describe('composed with presence', () => {
    const ghost: Player = { id: 'g1', name: 'Ghost', role: 'member' }

    // [admin, member, ghost] voting on A, autoReveal on, ghost never present.
    function seededWithGhost() {
      const arm = new RoomManager()
      arm.setPresence({ isPresent: (_roomId, playerId) => playerId !== 'g1' })
      arm.createRoom('r1', admin, { deckType: 'fibonacci', autoReveal: true })
      arm.joinRoom('r1', member)
      arm.joinRoom('r1', ghost)
      arm.addSubjects('r1', ['A'])
      arm.startSession('r1')
      return arm
    }

    it('reveals once the only present, non-excluded voter has voted', () => {
      const arm = seededWithGhost()
      arm.setRoundVoter('r1', 'm1', false) // excluded; g1 is absent
      const room = arm.castVote('r1', 'a1', 3)
      expect(room?.rounds[0].status).toBe('revealed')
    })

    it('does not reveal while an excluded player is the only one who voted', () => {
      const arm = seededWithGhost()
      arm.castVote('r1', 'm1', 5)
      arm.setRoundVoter('r1', 'm1', false)
      // m1's vote was dropped with the exclusion, and a1 (present, eligible)
      // still hasn't voted — the round must stay open.
      expect(arm.getRoom('r1')?.rounds[0].status).toBe('voting')
    })

    it('does not reveal when every present voter is excluded', () => {
      const arm = seededWithGhost()
      arm.setRoundVoter('r1', 'a1', false)
      const room = arm.setRoundVoter('r1', 'm1', false)
      // Only g1 is left eligible, and it is absent — quorum is empty, guard holds.
      expect(room?.rounds[0].status).toBe('voting')
    })
  })

  it('does not reveal a voteless round when every voter is excluded', () => {
    const arm = seeded(true)
    arm.setRoundVoter('r1', 'a1', false)
    arm.setRoundVoter('r1', 'm1', false)
    const room = arm.setRoundVoter('r1', 'm2', false)
    // The `required.length > 0` guard: an empty quorum must not reveal nothing.
    expect(room?.rounds[0].status).toBe('voting')
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

// Deep-clone a room so a recorded snapshot isn't retro-changed by a later mutation
// (lets us prove coalescing persists the LATEST state, not a shared reference).
function cloneRoom(room: Room): Room {
  return {
    ...room,
    config: { ...room.config },
    players: room.players.map((p) => ({ ...p })),
    subjects: [...room.subjects],
    rounds: room.rounds.map((r) => ({ ...r, votes: { ...r.votes } })),
  }
}

// Best-effort persistence double: records every call so tests can assert the
// RoomManager mirrors each mutation. Reads come from `seed` (for hydrate).
class RecordingPersistence implements RoomPersistence {
  savedRooms: Room[] = []
  deletedRoomIds: string[] = []
  savedTokens: Array<{ roomId: string; playerId: string; token: string }> = []
  deletedTokens: Array<{ roomId: string; playerId: string }> = []
  seed: PersistenceSnapshot = { rooms: [], tokens: new Map() }
  rejectSaveRoom = false
  rejectSaveToken = false

  loadAll(): Promise<PersistenceSnapshot> {
    return Promise.resolve(this.seed)
  }
  saveRoom(room: Room): Promise<void> {
    if (this.rejectSaveRoom) return Promise.reject(new Error('redis down'))
    this.savedRooms.push(cloneRoom(room))
    return Promise.resolve()
  }
  deleteRoom(roomId: string): Promise<void> {
    this.deletedRoomIds.push(roomId)
    return Promise.resolve()
  }
  saveToken(roomId: string, playerId: string, token: string): Promise<void> {
    if (this.rejectSaveToken) return Promise.reject(new Error('redis down'))
    this.savedTokens.push({ roomId, playerId, token })
    return Promise.resolve()
  }
  deleteToken(roomId: string, playerId: string): Promise<void> {
    this.deletedTokens.push({ roomId, playerId })
    return Promise.resolve()
  }
  get lastRoom(): Room | undefined {
    return this.savedRooms.at(-1)
  }
}

// Lets the fire-and-forget write-through microtasks (and any coalesced re-save) run.
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('write-through persistence', () => {
  let persistence: RecordingPersistence
  let manager: RoomManager

  beforeEach(() => {
    persistence = new RecordingPersistence()
    manager = new RoomManager(persistence)
  })

  it('persists a snapshot on createRoom', async () => {
    manager.createRoom('r1', admin, config)
    await tick()
    expect(persistence.lastRoom?.id).toBe('r1')
    expect(persistence.lastRoom?.adminId).toBe('a1')
  })

  it('persists the latest state after a chain of mutations', async () => {
    manager.createRoom('r1', admin, config)
    manager.joinRoom('r1', member)
    manager.addSubjects('r1', ['A'])
    manager.startSession('r1')
    manager.castVote('r1', 'm1', 5)
    await tick()
    const last = persistence.lastRoom
    expect(last?.phase).toBe('voting')
    expect(last?.rounds[0].votes['m1']).toBe(5)
    expect(last?.players.map((p) => p.id)).toEqual(['a1', 'm1'])
  })

  it('coalesces a burst but persists the LATEST state', async () => {
    manager.createRoom('r1', admin, config)
    // Rapid-fire mutations while the first save is still in flight.
    manager.addSubjects('r1', ['A'])
    manager.addSubjects('r1', ['B'])
    manager.addSubjects('r1', ['C'])
    await tick()
    await tick()
    expect(persistence.lastRoom?.subjects).toEqual(['A', 'B', 'C'])
    // Fewer saves than mutations: the burst collapsed into in-flight + one re-save.
    expect(persistence.savedRooms.length).toBeLessThan(4)
  })

  it('persists a delete when the last player leaves', async () => {
    manager.createRoom('r1', admin, config)
    await tick()
    manager.leaveRoom('r1', 'a1') // empties -> room destroyed
    await tick()
    expect(persistence.deletedRoomIds).toContain('r1')
  })

  it('persists the reduced room (not a delete) when a non-last player leaves', async () => {
    manager.createRoom('r1', admin, config)
    manager.joinRoom('r1', member)
    await tick()
    persistence.savedRooms.length = 0
    manager.leaveRoom('r1', 'm1')
    await tick()
    expect(persistence.deletedRoomIds).not.toContain('r1')
    expect(persistence.lastRoom?.players.map((p) => p.id)).toEqual(['a1'])
  })

  it('persists a freshly minted token, and does not re-persist a reused one', async () => {
    const t1 = manager.getOrCreateToken('r1', 'a1')
    manager.getOrCreateToken('r1', 'a1') // reuse
    await tick()
    const forA1 = persistence.savedTokens.filter((s) => s.playerId === 'a1')
    expect(forA1).toHaveLength(1)
    expect(forA1[0].token).toBe(t1)
  })

  it('persists token removal on leaveRoom (via clearToken)', async () => {
    manager.createRoom('r1', admin, config)
    manager.joinRoom('r1', member)
    manager.getOrCreateToken('r1', 'm1')
    await tick()
    manager.leaveRoom('r1', 'm1')
    await tick()
    expect(persistence.deletedTokens).toContainEqual({ roomId: 'r1', playerId: 'm1' })
  })

  it('a rejected save does not break the mutation nor throw', async () => {
    persistence.rejectSaveRoom = true
    const room = manager.createRoom('r1', admin, config)
    expect(room.id).toBe('r1') // mutation still returns synchronously
    expect(manager.getRoom('r1')).toBe(room) // still served from memory
    await tick() // rejection is caught + logged, no unhandled rejection
  })

  it('swallows a rejected token save (in-memory token intact)', async () => {
    persistence.rejectSaveToken = true
    const token = manager.getOrCreateToken('r1', 'a1')
    expect(token).toBeTruthy()
    expect(manager.hasToken('r1', 'a1')).toBe(true) // still served from memory
    await tick() // rejection is caught + logged, no unhandled rejection
  })

  it('keeps persisting after a save rejection (in-flight state is cleared)', async () => {
    persistence.rejectSaveRoom = true
    manager.createRoom('r1', admin, config) // this save rejects
    await tick()
    // A later mutation must STILL schedule a save — proving the failed save
    // cleared savingRooms in its finally block (otherwise it'd stay "in flight").
    persistence.rejectSaveRoom = false
    manager.addSubjects('r1', ['A'])
    await tick()
    expect(persistence.lastRoom?.subjects).toEqual(['A'])
  })
})

describe('hydrate', () => {
  it('rebuilds rooms and tokens from persistence', async () => {
    const persistence = new RecordingPersistence()
    const seededRoom: Room = {
      id: 'r9',
      adminId: 'a1',
      config,
      players: [admin],
      subjects: ['A'],
      phase: 'voting',
      rounds: [{ id: 'x', subject: 'A', status: 'voting', votes: {} }],
      currentRoundIndex: 0,
    }
    persistence.seed = { rooms: [seededRoom], tokens: new Map([['r9::a1', 'tok-9']]) }
    const manager = new RoomManager(persistence)

    expect(manager.getRoom('r9')).toBeUndefined() // nothing before hydrate
    await manager.hydrate()

    expect(manager.getRoom('r9')?.phase).toBe('voting')
    expect(manager.hasToken('r9', 'a1')).toBe(true)
    expect(manager.verifyToken('r9', 'a1', 'tok-9')).toBe(true)
  })

  it('is a no-op under the default (Null) persistence', async () => {
    const bare = new RoomManager()
    await bare.hydrate()
    expect(bare.getRoom('anything')).toBeUndefined()
  })
})
