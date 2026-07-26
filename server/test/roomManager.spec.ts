import { describe, it, expect, beforeEach } from 'vitest'
import { RoomManager } from '../src/roomManager'
import type { Player, RoomConfig, Room, Round } from '../src/types'
import type { RoomPersistence, PersistenceSnapshot } from '../src/persistence'

// Frozen because createRoom keeps it BY REFERENCE as room.config: a stray write
// would leak into every later test. Nothing mutates it today — the freeze is what
// keeps that true. Same reasoning as the per-test player fixtures below.
const config: Readonly<RoomConfig> = Object.freeze({ deckType: 'fibonacci', autoReveal: false })

// Rebuilt per test, never shared: createRoom/joinRoom store these objects BY
// REFERENCE, and the admin handover promotes in place (next.role = 'admin'), so
// a module-level fixture would carry that role into every later test. These three
// can't be frozen instead — they are the ones the handover legitimately mutates.
let admin: Player
let member: Player
let observer: Player

let rm: RoomManager

beforeEach(() => {
  rm = new RoomManager()
  admin = { id: 'a1', name: 'Admin', role: 'admin' }
  member = { id: 'm1', name: 'Member', role: 'member' }
  observer = { id: 'o1', name: 'Obs', role: 'observer' }
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

  it('skips observers when handing over admin, even if one sits first in the list', () => {
    rm.createRoom('r1', admin, config)
    rm.joinRoom('r1', observer) // sits BEFORE the member in players[]
    rm.joinRoom('r1', member)
    const room = rm.leaveRoom('r1', 'a1')
    expect(room?.adminId).toBe('m1')
    expect(room?.players.find((p) => p.id === 'o1')?.role).toBe('observer')
  })

  it('promotes an observer only when nobody else is left to drive the room', () => {
    rm.createRoom('r1', admin, config)
    rm.joinRoom('r1', observer)
    const room = rm.leaveRoom('r1', 'a1')
    expect(room?.adminId).toBe('o1')
    // Fallback: a room with no players left would be undrivable otherwise.
    expect(room?.players.find((p) => p.id === 'o1')?.role).toBe('admin')
  })

  // Characterization, NOT an endorsement: the fallback promotion is permanent, so
  // its "no quorum to break" justification expires as soon as someone joins. See
  // the comment on the handover in roomManager for why removing this residue costs
  // more than it's worth. If that ever changes, this test SHOULD fail.
  it('leaves the fallback-promoted observer in the quorum once the room fills up again', () => {
    rm.createRoom('r1', admin, { ...config, autoReveal: true })
    rm.joinRoom('r1', observer)
    rm.leaveRoom('r1', 'a1') // observers-only room → o1 promoted by the fallback
    rm.joinRoom('r1', member) // ...and now the room has a real voter again
    rm.addSubjects('r1', ['A'])
    rm.startSession('r1')

    const room = rm.castVote('r1', 'm1', 5)
    // The round still waits on the ex-observer, who is now a full voter.
    expect(room?.rounds[0].status).toBe('voting')
  })

  it('does not add an observer to the quorum by handing them admin', () => {
    rm.createRoom('r1', admin, { ...config, autoReveal: true })
    rm.joinRoom('r1', observer)
    rm.joinRoom('r1', member)
    rm.addSubjects('r1', ['A'])
    rm.startSession('r1')

    rm.leaveRoom('r1', 'a1') // admin goes to m1, o1 stays out of the round
    const room = rm.castVote('r1', 'm1', 5)

    // The only eligible voter voted, so autoReveal fires. With the observer
    // promoted the round would stay open on a vote that can never come.
    expect(room?.rounds[0].status).toBe('revealed')
  })

  it('hands admin to a present player instead of a rehydration ghost', () => {
    rm.setPresence({ isPresent: (_roomId, playerId) => playerId !== 'g1' })
    rm.createRoom('r1', admin, config)
    rm.joinRoom('r1', { id: 'g1', name: 'Ghost', role: 'member' }) // sits before m1
    rm.joinRoom('r1', member)
    const room = rm.leaveRoom('r1', 'a1')
    // g1 is eligible but has no socket and no grace timer — it would inherit a room
    // it can never drive.
    expect(room?.adminId).toBe('m1')
  })

  it('prefers a present observer over an absent voter', () => {
    rm.setPresence({ isPresent: (_roomId, playerId) => playerId !== 'g1' })
    rm.createRoom('r1', admin, config)
    rm.joinRoom('r1', { id: 'g1', name: 'Ghost', role: 'member' })
    rm.joinRoom('r1', observer)
    const room = rm.leaveRoom('r1', 'a1')
    // Someone who can actually drive the room beats a voter who is never coming
    // back — same fallback trade-off as the observers-only case.
    expect(room?.adminId).toBe('o1')
  })

  it('falls back to the whole list when nobody is present (dormant room)', () => {
    rm.setPresence({ isPresent: () => false })
    rm.createRoom('r1', admin, config)
    rm.joinRoom('r1', observer)
    rm.joinRoom('r1', member)
    const room = rm.leaveRoom('r1', 'a1')
    // No present pool to pick from, so the observer preference still applies.
    expect(room?.adminId).toBe('m1')
  })

  it('deletes the room when the last player leaves', () => {
    rm.createRoom('r1', admin, config)
    expect(rm.leaveRoom('r1', 'a1')).toBeNull()
    expect(rm.getRoom('r1')).toBeUndefined()
  })

  // The server itself never noticed a leftover vote (every quorum path iterates
  // room.players), so this is about what the CLIENT computes: useVoteStats reads
  // the raw votes map, and two matching votes with a single voter left standing
  // read as consensus — banner and confetti for one person.
  it("drops the leaving player's vote from the round in progress", () => {
    rm.createRoom('r1', admin, config)
    rm.joinRoom('r1', member)
    rm.addSubjects('r1', ['A'])
    rm.startSession('r1')
    rm.castVote('r1', 'a1', 5)
    rm.castVote('r1', 'm1', 5)

    const room = rm.leaveRoom('r1', 'a1')
    expect(room?.rounds[0].votes).toEqual({ m1: 5 })
  })

  // Mirrors setRoundVoter's refusal to touch a revealed round: the room already
  // saw this result, and pruning it afterwards would rewrite what was shown.
  it('leaves a revealed round untouched (settled history)', () => {
    rm.createRoom('r1', admin, config)
    rm.joinRoom('r1', member)
    rm.addSubjects('r1', ['A'])
    rm.startSession('r1')
    rm.castVote('r1', 'a1', 5)
    rm.castVote('r1', 'm1', 8)
    rm.revealVotes('r1')

    rm.leaveRoom('r1', 'a1')
    expect(rm.getRoom('r1')?.rounds[0].votes).toEqual({ a1: 5, m1: 8 })
  })

  // The one place the prune and the quorum touch, and the scenario the fix exists
  // for — yet every other test here runs with autoReveal off, so nothing covered it.
  // maybeAutoReveal runs right after the prune: the round must NOT reveal on an
  // empty map (required.length > 0 is what holds it), and must not carry the
  // departed vote if it does reveal.
  it('empties the map without revealing when the only player who voted leaves', () => {
    rm.createRoom('r1', admin, { ...config, autoReveal: true })
    rm.joinRoom('r1', member)
    rm.addSubjects('r1', ['A'])
    rm.startSession('r1')
    rm.castVote('r1', 'a1', 5) // m1 still pending

    const room = rm.leaveRoom('r1', 'a1')
    expect(room?.rounds[0].votes).toEqual({})
    expect(room?.rounds[0].status).toBe('voting')
  })

  // Guard for the currentRoundIndex === -1 branch: leaving during setup (or after
  // a reset) must not reach into rounds[-1].
  it('handles a leave during setup, with no round to prune', () => {
    rm.createRoom('r1', admin, config)
    rm.joinRoom('r1', member)
    expect(() => rm.leaveRoom('r1', 'm1')).not.toThrow()
    expect(rm.getRoom('r1')?.rounds).toEqual([])
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
  const ghost: Readonly<Player> = Object.freeze({ id: 'g1', name: 'Ghost', role: 'member' })

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
  // Frozen for the same reason as `config` — shared across this describe's tests.
  const other: Readonly<Player> = Object.freeze({ id: 'm2', name: 'Other', role: 'member' })

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
    const ghost: Readonly<Player> = Object.freeze({ id: 'g1', name: 'Ghost', role: 'member' })

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

  // Snapshots written before leaveRoom started pruning carry votes the round does not
  // count. Nothing on the server counts them either, but the client feeds the raw map
  // to useVoteStats — so a departed voter still inflates the average and can fabricate
  // a consensus. The fix in leaveRoom is not retroactive; this is what cleans them.
  //
  // Takes the whole rounds array + index so the "current round isn't rounds[0]" case
  // is expressible; the single-round overload covers the common shape.
  function seedRounds(rounds: Round[], index: number, players = [admin]): RoomManager {
    const persistence = new RecordingPersistence()
    persistence.seed = {
      rooms: [
        {
          id: 'r9',
          adminId: 'a1',
          config,
          players,
          subjects: ['A'],
          phase: index === -1 ? 'setup' : 'voting',
          rounds,
          currentRoundIndex: index,
        },
      ],
      tokens: new Map([['r9::a1', 'tok-9']]),
    }
    return new RoomManager(persistence)
  }

  const seedWith = (round: Round, players = [admin]) => seedRounds([round], 0, players)

  it('drops a legacy vote with no matching player from the round in progress', async () => {
    const manager = seedWith({ id: 'x', subject: 'A', status: 'voting', votes: { a1: 5, gone: 8 } })
    await manager.hydrate()
    expect(manager.getRoom('r9')?.rounds[0].votes).toEqual({ a1: 5 })
  })

  // The prune keys off eligibleVotersOf — the seam castVote admits through — and not
  // off "is seated". These two fix that distinction: without them, swapping the seam
  // for a plain room.players.some() passes the whole suite (it did, before they existed).
  it('drops the vote of a seated OBSERVER, whom the round never counted', async () => {
    const manager = seedWith({ id: 'x', subject: 'A', status: 'voting', votes: { a1: 5, o1: 5 } }, [
      admin,
      observer,
    ])
    await manager.hydrate()
    expect(manager.getRoom('r9')?.rounds[0].votes).toEqual({ a1: 5 })
  })

  it('drops the vote of a player the admin excluded from the round', async () => {
    const manager = seedWith(
      {
        id: 'x',
        subject: 'A',
        status: 'voting',
        votes: { a1: 5, m1: 5 },
        excludedVoterIds: ['m1'],
      },
      [admin, member],
    )
    await manager.hydrate()
    expect(manager.getRoom('r9')?.rounds[0].votes).toEqual({ a1: 5 })
  })

  // Both exclusions in ONE snapshot — the likeliest real shape of a legacy room:
  // someone left mid-round AND the process restarted before anyone came back.
  it('drops the departed vote while keeping the ghost in the same round', async () => {
    const ghost: Player = { id: 'g1', name: 'Ghost', role: 'member' }
    const manager = seedWith(
      { id: 'x', subject: 'A', status: 'voting', votes: { g1: 8, gone: 3 } },
      [admin, ghost],
    )
    await manager.hydrate()
    expect(manager.getRoom('r9')?.rounds[0].votes).toEqual({ g1: 8 })
  })

  // The prune must follow currentRoundIndex, not assume rounds[0]. The earlier round
  // here is still 'voting' on purpose: even an unrevealed PAST round is out of scope.
  it('prunes the round at currentRoundIndex and leaves earlier rounds untouched', async () => {
    const manager = seedRounds(
      [
        { id: 'r0', subject: 'A', status: 'voting', votes: { a1: 1, gone: 2 } },
        { id: 'r1', subject: 'B', status: 'voting', votes: { a1: 3, gone: 4 } },
      ],
      1,
    )
    await manager.hydrate()
    const rounds = manager.getRoom('r9')?.rounds
    expect(rounds?.[1].votes).toEqual({ a1: 3 })
    expect(rounds?.[0].votes).toEqual({ a1: 1, gone: 2 })
  })

  // A room still in setup has no round to index. Guards the currentRoundIndex === -1
  // early return, which was only ever covered by accident, from unrelated specs.
  it('handles a room in setup, with no round to prune', async () => {
    const manager = seedRounds([], -1)
    await expect(manager.hydrate()).resolves.toBeUndefined()
    expect(manager.getRoom('r9')?.rounds).toEqual([])
    expect(manager.hasToken('r9', 'a1')).toBe(true) // o boot seguiu inteiro
  })

  // A revealed round is settled history — leaveRoom skips it for the same reason, so
  // a vote outliving its player is EXPECTED there and must survive the boot intact.
  it('leaves a revealed round intact even with a vote from a departed player', async () => {
    const manager = seedWith({
      id: 'x',
      subject: 'A',
      status: 'revealed',
      votes: { a1: 5, gone: 8 },
    })
    await manager.hydrate()
    expect(manager.getRoom('r9')?.rounds[0].votes).toEqual({ a1: 5, gone: 8 })
  })

  // The runtime guard on the indexed access, and why it earns its keep. persistence's
  // refine rejects an out-of-range index, so this snapshot can only come from a fake
  // (or a future path that skips the schema) — but if one ever reaches here, throwing
  // is the worst outcome available: hydrate aborts mid-loop, the TOKEN map never
  // loads, and hasToken() returning false for everyone switches OFF the
  // anti-escalation check in join_room. Surviving the bad room is what keeps that on.
  it('survives a snapshot whose currentRoundIndex is out of range, tokens included', async () => {
    const manager = seedRounds([], 5)
    await expect(manager.hydrate()).resolves.toBeUndefined()
    expect(manager.hasToken('r9', 'a1')).toBe(true)
  })

  // A rehydration ghost is NOT an orphan: it is still seated, so its vote survives.
  // Pruning by presence instead of membership would wipe the votes of a whole team
  // mid-reconnect (at boot nobody is present yet) — the work persistence exists to save.
  it('keeps the vote of a seated player who is merely absent (rehydration ghost)', async () => {
    const ghost: Player = { id: 'g1', name: 'Ghost', role: 'member' }
    const manager = seedWith({ id: 'x', subject: 'A', status: 'voting', votes: { g1: 8 } }, [
      admin,
      ghost,
    ])
    manager.setPresence({ isPresent: () => false }) // ninguém conectou ainda
    await manager.hydrate()
    expect(manager.getRoom('r9')?.rounds[0].votes).toEqual({ g1: 8 })
  })
})
