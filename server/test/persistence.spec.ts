import { describe, it, expect, beforeEach } from 'vitest'
import { RedisPersistence, NullPersistence, type RedisClient } from '../src/persistence'
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

  beforeEach(() => {
    redis = new FakeRedis()
    persistence = new RedisPersistence(redis, 100) // fixed TTL for assertions
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

  it('loadAll drops a malformed snapshot instead of throwing', async () => {
    await redis.sadd('rooms:index', 'BAD')
    redis.strings.set('room:BAD', { id: 'BAD', not: 'a room' })

    const snap = await persistence.loadAll()
    expect(snap.rooms).toEqual([])
    expect([...(redis.sets.get('rooms:index') ?? [])]).not.toContain('BAD')
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
