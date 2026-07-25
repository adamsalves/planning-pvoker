import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RedisPersistence, NullPersistence, type RedisClient } from '../src/persistence'
import { logger } from '../src/logger'
import type { Room } from '../src/types'

// In-memory fake of the narrow RedisClient port. Backs commands with plain Maps
// and logs each one, so tests assert BOTH the resulting state and the exact
// commands issued. Cast-free: the port types reads as `unknown`, and this fake
// returns stored values (or null) directly.
class FakeRedis implements RedisClient {
  strings = new Map<string, unknown>()
  hashes = new Map<string, Map<string, unknown>>()
  sets = new Map<string, Set<string>>()
  expires: Array<{ key: string; seconds: number }> = []
  log: string[] = []

  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown> {
    this.log.push(`set ${key}${opts?.ex ? ` ex=${opts.ex}` : ''}`)
    this.strings.set(key, value)
    return Promise.resolve('OK')
  }
  get(key: string): Promise<unknown> {
    this.log.push(`get ${key}`)
    return Promise.resolve(this.strings.has(key) ? this.strings.get(key) : null)
  }
  del(...keys: string[]): Promise<number> {
    let n = 0
    for (const k of keys) {
      this.log.push(`del ${k}`)
      if (this.strings.delete(k)) n++
      if (this.hashes.delete(k)) n++
    }
    return Promise.resolve(n)
  }
  expire(key: string, seconds: number): Promise<number> {
    this.log.push(`expire ${key} ${seconds}`)
    this.expires.push({ key, seconds })
    return Promise.resolve(this.strings.has(key) || this.hashes.has(key) ? 1 : 0)
  }
  sadd(key: string, member: string, ...members: string[]): Promise<number> {
    this.log.push(`sadd ${key} ${[member, ...members].join(',')}`)
    let set = this.sets.get(key)
    if (!set) {
      set = new Set()
      this.sets.set(key, set)
    }
    let added = 0
    for (const m of [member, ...members]) {
      if (!set.has(m)) {
        set.add(m)
        added++
      }
    }
    return Promise.resolve(added)
  }
  srem(key: string, member: string, ...members: string[]): Promise<number> {
    this.log.push(`srem ${key} ${[member, ...members].join(',')}`)
    const set = this.sets.get(key)
    if (!set) return Promise.resolve(0)
    let removed = 0
    for (const m of [member, ...members]) if (set.delete(m)) removed++
    return Promise.resolve(removed)
  }
  smembers(key: string): Promise<string[]> {
    this.log.push(`smembers ${key}`)
    return Promise.resolve([...(this.sets.get(key) ?? [])])
  }
  hset(key: string, kv: Record<string, unknown>): Promise<number> {
    this.log.push(`hset ${key} ${Object.keys(kv).join(',')}`)
    let hash = this.hashes.get(key)
    if (!hash) {
      hash = new Map()
      this.hashes.set(key, hash)
    }
    let added = 0
    for (const [field, value] of Object.entries(kv)) {
      if (!hash.has(field)) added++
      hash.set(field, String(value))
    }
    return Promise.resolve(added)
  }
  hgetall(key: string): Promise<unknown> {
    this.log.push(`hgetall ${key}`)
    const hash = this.hashes.get(key)
    if (!hash || hash.size === 0) return Promise.resolve(null)
    return Promise.resolve(Object.fromEntries(hash))
  }
  hdel(key: string, ...fields: string[]): Promise<number> {
    this.log.push(`hdel ${key} ${fields.join(',')}`)
    const hash = this.hashes.get(key)
    if (!hash) return Promise.resolve(0)
    let removed = 0
    for (const f of fields) if (hash.delete(f)) removed++
    if (hash.size === 0) this.hashes.delete(key) // Redis drops an emptied hash
    return Promise.resolve(removed)
  }
}

const sampleRoom = (id = 'ROOM1'): Room => ({
  id,
  adminId: 'p1',
  config: { deckType: 'fibonacci', autoReveal: false },
  players: [{ id: 'p1', name: 'Ana', role: 'admin' }],
  subjects: ['S1'],
  phase: 'voting',
  rounds: [{ id: 'r1', subject: 'S1', status: 'voting', votes: { p1: 5 } }],
  currentRoundIndex: 0,
})

describe('RedisPersistence', () => {
  let redis: FakeRedis
  let persistence: RedisPersistence
  // Stubbed for every test: several cases here feed loadAll a deliberately broken
  // snapshot, which now warns — without this the suite output is buried in the very
  // noise those tests are producing on purpose. Also what the two logging tests assert on.
  let warn: ReturnType<typeof vi.spyOn<typeof logger, 'warn'>>

  beforeEach(() => {
    redis = new FakeRedis()
    persistence = new RedisPersistence(redis, 100) // fixed TTL for assertions
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('saveRoom stores the room, indexes it, and refreshes the token TTL', async () => {
    const room = sampleRoom()
    await persistence.saveRoom(room)
    expect(redis.strings.get('room:ROOM1')).toEqual(room)
    expect([...(redis.sets.get('rooms:index') ?? [])]).toContain('ROOM1')
    expect(redis.expires).toContainEqual({ key: 'tokens:ROOM1', seconds: 100 })
    expect(redis.log).toContain('set room:ROOM1 ex=100')
  })

  it('deleteRoom removes the room, its index entry, and all its tokens', async () => {
    await persistence.saveRoom(sampleRoom())
    await persistence.saveToken('ROOM1', 'p1', 'tok-1')
    await persistence.deleteRoom('ROOM1')
    expect(redis.strings.has('room:ROOM1')).toBe(false)
    expect(redis.hashes.has('tokens:ROOM1')).toBe(false)
    expect([...(redis.sets.get('rooms:index') ?? [])]).not.toContain('ROOM1')
  })

  it('saveToken writes the token into the room hash and sets a TTL', async () => {
    await persistence.saveToken('ROOM1', 'p1', 'tok-1')
    expect(redis.hashes.get('tokens:ROOM1')?.get('p1')).toBe('tok-1')
    expect(redis.expires).toContainEqual({ key: 'tokens:ROOM1', seconds: 100 })
  })

  it('deleteToken removes only that player field', async () => {
    await persistence.saveToken('ROOM1', 'p1', 'tok-1')
    await persistence.saveToken('ROOM1', 'p2', 'tok-2')
    await persistence.deleteToken('ROOM1', 'p1')
    expect(redis.hashes.get('tokens:ROOM1')?.has('p1')).toBe(false)
    expect(redis.hashes.get('tokens:ROOM1')?.get('p2')).toBe('tok-2')
  })

  it('loadAll reconstructs rooms and the token map from the index', async () => {
    await persistence.saveRoom(sampleRoom('ROOMA'))
    await persistence.saveRoom(sampleRoom('ROOMB'))
    await persistence.saveToken('ROOMA', 'p1', 'tok-a')
    await persistence.saveToken('ROOMB', 'p1', 'tok-b')

    const snap = await persistence.loadAll()
    expect(snap.rooms.map((r) => r.id).sort()).toEqual(['ROOMA', 'ROOMB'])
    expect(snap.tokens.get('ROOMA::p1')).toBe('tok-a')
    expect(snap.tokens.get('ROOMB::p1')).toBe('tok-b')
  })

  it('loadAll skips and self-heals a stale index entry (room gone via TTL)', async () => {
    await persistence.saveRoom(sampleRoom('ALIVE'))
    await redis.sadd('rooms:index', 'GHOST') // indexed but no room:GHOST

    const snap = await persistence.loadAll()
    expect(snap.rooms.map((r) => r.id)).toEqual(['ALIVE'])
    expect([...(redis.sets.get('rooms:index') ?? [])]).not.toContain('GHOST')
  })

  it('loadAll keeps valid tokens and skips a corrupt field (not all-or-nothing)', async () => {
    await persistence.saveRoom(sampleRoom('ROOM1'))
    await persistence.saveToken('ROOM1', 'p1', 'tok-1')
    // Inject a corrupt (non-string) token field alongside the valid one.
    redis.hashes.get('tokens:ROOM1')?.set('p2', 42)

    const snap = await persistence.loadAll()
    expect(snap.tokens.get('ROOM1::p1')).toBe('tok-1') // valid one survives
    expect(snap.tokens.has('ROOM1::p2')).toBe(false) // corrupt one skipped
  })

  // The whole point of the field is surviving a restart, so pin the round trip:
  // sobreviver ao save→load é o que mantém a seleção do admin após um redeploy.
  it('round-trips excludedVoterIds through save and load', async () => {
    const room = sampleRoom('ROOM1')
    room.rounds[0].excludedVoterIds = ['p2']
    await persistence.saveRoom(room)

    const snap = await persistence.loadAll()
    expect(snap.rooms[0].rounds[0].excludedVoterIds).toEqual(['p2'])
  })

  // Guards the `.optional()` on excludedVoterIds. A snapshot written by a deploy
  // that predates "admin chooses who votes" has no such field; if the schema ever
  // required it, safeParse would fail and loadAll DROPS the room — every live
  // room would die on deploy. This test fails if someone tightens it.
  it('loadAll accepts a pre-feature round with no excludedVoterIds', async () => {
    await redis.sadd('rooms:index', 'OLD')
    redis.strings.set('room:OLD', {
      id: 'OLD',
      adminId: 'p1',
      config: { deckType: 'fibonacci', autoReveal: false },
      players: [{ id: 'p1', name: 'Ana', role: 'admin' }],
      subjects: ['S1'],
      phase: 'voting',
      rounds: [{ id: 'r1', subject: 'S1', status: 'voting', votes: { p1: 5 } }],
      currentRoundIndex: 0,
    })

    const snap = await persistence.loadAll()
    expect(snap.rooms.map((r) => r.id)).toEqual(['OLD'])
    expect(snap.rooms[0].rounds[0].excludedVoterIds).toBeUndefined()
  })

  // Mesma régua do excludedVoterIds: sobreviver ao save→load é o contrato do
  // campo, então fixa o round trip da tag através de um redeploy.
  it('round-trips a player tag through save and load', async () => {
    const room = sampleRoom('ROOM1')
    room.players[0].tag = 'design'
    await persistence.saveRoom(room)

    const snap = await persistence.loadAll()
    expect(snap.rooms[0].players[0].tag).toBe('design')
  })

  // Guards the `.catch(undefined)` on tag. Tags are a PRODUCT enum likely to
  // change; a snapshot carrying a value later dropped from the list must degrade
  // to "no tag", NOT drop the whole room (that would kill every live room on the
  // deploy that removed the value). Fails if someone swaps .catch for a bare
  // .optional(): the invalid value would then fail safeParse and the room would
  // be discarded, emptying snap.rooms.
  it('loadAll degrades an unknown player tag to undefined but keeps the room', async () => {
    await redis.sadd('rooms:index', 'DRIFT')
    redis.strings.set('room:DRIFT', {
      id: 'DRIFT',
      adminId: 'p1',
      config: { deckType: 'fibonacci', autoReveal: false },
      players: [{ id: 'p1', name: 'Ana', role: 'admin', tag: 'devops' }], // fora de PLAYER_TAGS
      subjects: ['S1'],
      phase: 'voting',
      rounds: [{ id: 'r1', subject: 'S1', status: 'voting', votes: { p1: 5 } }],
      currentRoundIndex: 0,
    })

    const snap = await persistence.loadAll()
    expect(snap.rooms.map((r) => r.id)).toEqual(['DRIFT'])
    expect(snap.rooms[0].players[0].tag).toBeUndefined()
  })

  it('loadAll drops a malformed snapshot instead of throwing', async () => {
    await redis.sadd('rooms:index', 'BAD')
    redis.strings.set('room:BAD', { id: 'BAD', not: 'a room' })

    const snap = await persistence.loadAll()
    expect(snap.rooms).toEqual([])
    expect([...(redis.sets.get('rooms:index') ?? [])]).not.toContain('BAD')
  })

  // Each field below is valid on its own — only the RELATIONSHIP is broken, which
  // is exactly what a per-field schema misses. Rehydrating one of these would arm
  // a TypeError inside castVote/setRoundVoter/revealVotes (see the refine on
  // roomSchema), so the room must be dropped like any other malformed snapshot.
  it.each([
    ['index past the end of rounds', { phase: 'voting', rounds: [], currentRoundIndex: 1 }],
    ['index 0 with no rounds at all', { phase: 'voting', rounds: [], currentRoundIndex: 0 }],
    ['negative index other than -1', { phase: 'setup', rounds: [], currentRoundIndex: -2 }],
    ['fractional index', { phase: 'setup', rounds: [], currentRoundIndex: 1.5 }],
  ])('loadAll drops a snapshot whose currentRoundIndex is inconsistent: %s', async (_, broken) => {
    await redis.sadd('rooms:index', 'BROKEN')
    redis.strings.set('room:BROKEN', { ...sampleRoom(), id: 'BROKEN', ...broken })

    const snap = await persistence.loadAll()
    expect(snap.rooms).toEqual([])
    expect([...(redis.sets.get('rooms:index') ?? [])]).not.toContain('BROKEN')
  })

  // Sibling of the case above, with the opposite failure mode: an orphan adminId
  // throws nothing, it leaves the room permanently un-driveable (requireAdmin never
  // matches, and leaveRoom's wasAdmin never fires, so no handover rescues it).
  // Dropping the room is the lesser loss. `players: []` is the degenerate case —
  // an empty room is destroyed in-process, so a snapshot of one is already broken.
  it.each([
    ['adminId names nobody in players', { adminId: 'ghost' }],
    ['no players at all', { players: [] }],
  ])('loadAll drops a snapshot with an orphan adminId: %s', async (_, broken) => {
    await redis.sadd('rooms:index', 'ORPHAN')
    redis.strings.set('room:ORPHAN', { ...sampleRoom(), id: 'ORPHAN', ...broken })

    const snap = await persistence.loadAll()
    expect(snap.rooms).toEqual([])
    expect([...(redis.sets.get('rooms:index') ?? [])]).not.toContain('ORPHAN')
  })

  // Every other case here seats a SINGLE player, where "some player matches" is
  // indistinguishable from "the first one does", "the last one does", or "all of
  // them do". This one separates them: a room whose admin is neither first nor last
  // must survive. Without it the suite green-lights a guard that would discard most
  // multi-player rooms on the deploy that shipped it — the mass-loss failure mode
  // the excludedVoterIds and tag tests above already exist to prevent.
  it('loadAll keeps a multi-player room whose admin is not the first player', async () => {
    await redis.sadd('rooms:index', 'CROWD')
    redis.strings.set('room:CROWD', {
      ...sampleRoom(),
      id: 'CROWD',
      adminId: 'p2',
      players: [
        { id: 'p1', name: 'Ana', role: 'member' },
        { id: 'p2', name: 'Bia', role: 'admin' },
        { id: 'p3', name: 'Caio', role: 'observer' },
      ],
    })

    const snap = await persistence.loadAll()
    expect(snap.rooms.map((r) => r.id)).toEqual(['CROWD'])
    expect(snap.rooms[0].adminId).toBe('p2')
  })

  // The guard must key off membership, not role: leaveRoom's observers-only
  // fallback and the join normalization can both leave the admin seated with a
  // role the client renders differently. Only "is anybody there?" is structural.
  it('loadAll keeps a room whose admin is seated but not roled admin', async () => {
    await redis.sadd('rooms:index', 'ROLEY')
    redis.strings.set('room:ROLEY', {
      ...sampleRoom(),
      id: 'ROLEY',
      adminId: 'p1',
      players: [{ id: 'p1', name: 'Ana', role: 'observer' }],
    })

    const snap = await persistence.loadAll()
    expect(snap.rooms.map((r) => r.id)).toEqual(['ROLEY'])
  })

  // Dropping a room destroys user-visible state, and hydrate() only logs the
  // survivors — so the refine messages have to reach an operator, or a room vanishes
  // with no explanation. Pins the reason, not just the fact that something was said.
  it('loadAll reports WHY it discarded a snapshot', async () => {
    await redis.sadd('rooms:index', 'ORPHAN')
    redis.strings.set('room:ORPHAN', { ...sampleRoom(), id: 'ORPHAN', adminId: 'ghost' })

    await persistence.loadAll()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('ORPHAN')
    expect(warn.mock.calls[0][0]).toContain('adminId must name one of the room players')
  })

  // The other half of the contract: an index entry whose room simply expired is the
  // ROUTINE case, not corruption. Warning on it would fire on every boot with an idle
  // room and bury the reports above. Fails if someone logs unconditionally.
  it('loadAll stays silent when the room is merely gone (TTL)', async () => {
    await persistence.saveRoom(sampleRoom('ALIVE'))
    await redis.sadd('rooms:index', 'GHOST') // indexed but no room:GHOST

    await persistence.loadAll()
    expect(warn).not.toHaveBeenCalled()
  })

  it('loadAll keeps a consistent -1 index (a room still in setup)', async () => {
    await redis.sadd('rooms:index', 'SETUP')
    redis.strings.set('room:SETUP', {
      ...sampleRoom(),
      id: 'SETUP',
      phase: 'setup',
      rounds: [],
      currentRoundIndex: -1,
    })

    const snap = await persistence.loadAll()
    expect(snap.rooms.map((r) => r.id)).toEqual(['SETUP'])
  })
})

describe('NullPersistence', () => {
  it('loadAll returns empty and every write is a no-op', async () => {
    const persistence = new NullPersistence()
    const snap = await persistence.loadAll()
    expect(snap.rooms).toEqual([])
    expect(snap.tokens.size).toBe(0)
    await expect(persistence.saveRoom(sampleRoom())).resolves.toBeUndefined()
    await expect(persistence.deleteRoom('X')).resolves.toBeUndefined()
    await expect(persistence.saveToken('X', 'p', 't')).resolves.toBeUndefined()
    await expect(persistence.deleteToken('X', 'p')).resolves.toBeUndefined()
  })
})
