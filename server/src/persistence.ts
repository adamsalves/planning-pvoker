import { Redis } from '@upstash/redis'
import { z } from 'zod'
import { PLAYER_TAGS, type Room } from './types'
import { logger } from './logger'

// Rooms and their session tokens are the authoritative state in-memory (see
// RoomManager); this module MIRRORS every mutation to durable storage so a
// redeploy or cold-start on the single Render instance rehydrates the rooms
// instead of coming back with empty Maps.
//
// Strategy: write-through snapshots, NOT "Redis as the source of truth". The
// Maps stay authoritative and synchronous; persistence happens on the side and
// is best-effort. This keeps RoomManager's public API synchronous and its unit
// tests untouched. It does NOT remove the free-tier cold start — only the loss
// of state ("the room came back" instead of "the room vanished").

// The narrow slice of the Upstash client that RedisPersistence actually uses.
// Depending on this port instead of the concrete Redis keeps the class
// unit-testable with a plain fake — no `as` casts (project rule) and no live
// Redis in CI. The concrete Redis from `@upstash/redis` structurally satisfies
// this interface; that assignment is checked at compile time in createPersistence().
export interface RedisClient {
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>
  // Reads return unknown ON PURPOSE: values come back from an external store, so
  // RedisPersistence validates their shape (see roomSchema) instead of trusting a
  // generic type parameter. This also keeps the client mockable without `as` casts.
  get(key: string): Promise<unknown>
  del(...keys: string[]): Promise<number>
  expire(key: string, seconds: number): Promise<number>
  sadd(key: string, member: string, ...members: string[]): Promise<number>
  srem(key: string, member: string, ...members: string[]): Promise<number>
  smembers(key: string): Promise<string[]>
  hset(key: string, kv: Record<string, unknown>): Promise<number>
  hgetall(key: string): Promise<unknown>
  hdel(key: string, ...fields: string[]): Promise<number>
}

// Structural guard for a room snapshot read back from Redis. Mirrors the Room
// type; a snapshot that's missing (expired) or malformed (schema drift, partial
// write, corruption) fails safeParse and is skipped rather than crashing the boot.
const roomSchema = z.object({
  id: z.string(),
  adminId: z.string(),
  config: z.object({
    deckType: z.enum(['fibonacci', 'tshirt', 'sequential']),
    autoReveal: z.boolean(),
  }),
  players: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      role: z.enum(['admin', 'member', 'observer']),
      // OPCIONAL como excludedVoterIds (snapshot pré-feature não tem o campo).
      // Além disso `.catch(undefined)`: tags são um enum de PRODUTO, propenso a
      // mudar; um valor que saiu da lista degrada para "sem tag" em vez de
      // DERRUBAR a sala inteira (o que mataria toda sala viva no deploy que
      // mudou a lista). role/deck não levam .catch por serem estruturais/estáveis.
      tag: z.enum(PLAYER_TAGS).optional().catch(undefined),
    }),
  ),
  subjects: z.array(z.string()),
  phase: z.enum(['setup', 'voting', 'completed']),
  rounds: z.array(
    z.object({
      id: z.string(),
      subject: z.string(),
      status: z.enum(['voting', 'revealed']),
      votes: z.record(z.string(), z.union([z.string(), z.number()])),
      // OPCIONAL de propósito: snapshots gravados antes desta feature não têm o
      // campo, e um required aqui faria o safeParse falhar — o que em loadAll
      // significa DESCARTAR a sala. Todas as salas vivas morreriam no deploy.
      excludedVoterIds: z.array(z.string()).optional(),
    }),
  ),
  currentRoundIndex: z.number(),
})

// A room's token hash read back from Redis: { playerId -> token }. Values are
// validated PER FIELD in loadAll (a single corrupt field must not drop the whole
// room's tokens), so the value type is intentionally left open here.
const tokenHashSchema = z.record(z.string(), z.unknown())

// What the boot sequence needs to rebuild the in-memory Maps: every room plus
// every session token, keyed EXACTLY like RoomManager keys them (`roomId::playerId`).
export interface PersistenceSnapshot {
  rooms: Room[]
  tokens: Map<string, string>
}

// Port the RoomManager depends on. Every method is async and best-effort: a
// rejection degrades to in-memory-only and must never break a room mutation.
export interface RoomPersistence {
  loadAll(): Promise<PersistenceSnapshot>
  saveRoom(room: Room): Promise<void>
  deleteRoom(roomId: string): Promise<void>
  saveToken(roomId: string, playerId: string, token: string): Promise<void>
  deleteToken(roomId: string, playerId: string): Promise<void>
}

// No-op persistence: selected when no Redis is configured, so the server behaves
// exactly as it did before this feature (pure in-memory). Also the default that
// RoomManager falls back to, which is what keeps every existing test green.
export class NullPersistence implements RoomPersistence {
  loadAll(): Promise<PersistenceSnapshot> {
    return Promise.resolve({ rooms: [], tokens: new Map<string, string>() })
  }
  saveRoom(): Promise<void> {
    return Promise.resolve()
  }
  deleteRoom(): Promise<void> {
    return Promise.resolve()
  }
  saveToken(): Promise<void> {
    return Promise.resolve()
  }
  deleteToken(): Promise<void> {
    return Promise.resolve()
  }
}

const DEFAULT_TTL_SECONDS = 24 * 60 * 60 // 1 day

// Idle rooms/tokens expire after this window so a server that crashed while a
// room was idle (its in-memory grace timers lost with the process) doesn't leave
// the room alive forever in Redis. Refreshed on every write, so an ACTIVE room
// never expires mid-session. Overridable via env, mostly for tests.
function resolveTtlSeconds(): number {
  const parsed = Number(process.env.ROOM_TTL_SECONDS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_SECONDS
}

const roomKey = (roomId: string) => `room:${roomId}`
const tokensKey = (roomId: string) => `tokens:${roomId}`
const ROOMS_INDEX = 'rooms:index'

export class RedisPersistence implements RoomPersistence {
  private readonly ttl: number

  constructor(
    private readonly redis: RedisClient,
    ttlSeconds: number = resolveTtlSeconds(),
  ) {
    this.ttl = ttlSeconds
  }

  // Boot-time rehydration. Reads the room index (avoids KEYS/SCAN) then loads
  // each room and its token hash. Runs once at startup with a handful of rooms,
  // so sequential reads are fine and keep the code cast-free (typed generics).
  async loadAll(): Promise<PersistenceSnapshot> {
    const rooms: Room[] = []
    const tokens = new Map<string, string>()

    const ids = await this.redis.smembers(ROOMS_INDEX)
    const staleIds: string[] = []

    for (const id of ids) {
      const parsedRoom = roomSchema.safeParse(await this.redis.get(roomKey(id)))
      if (!parsedRoom.success) {
        // Missing (expired via TTL) or malformed (schema drift/corruption) — forget it.
        staleIds.push(id)
        continue
      }
      rooms.push(parsedRoom.data)

      // Field-by-field: keep the valid string tokens, skip any corrupt field — one
      // bad entry must NOT drop the whole room's tokens (that would reopen the
      // anti-escalation guard for every player in the room).
      const parsedTokens = tokenHashSchema.safeParse(await this.redis.hgetall(tokensKey(id)))
      if (parsedTokens.success) {
        for (const [playerId, token] of Object.entries(parsedTokens.data)) {
          if (typeof token === 'string') tokens.set(`${id}::${playerId}`, token)
        }
      }
    }

    // Self-heal the index so a stale/bad entry isn't re-scanned on every boot.
    if (staleIds.length > 0) {
      await Promise.all(staleIds.map((id) => this.redis.srem(ROOMS_INDEX, id)))
    }

    return { rooms, tokens }
  }

  // Snapshot the whole room and (re)register it in the index. The tokens hash TTL
  // is bumped alongside so a room that's active but not currently minting tokens
  // keeps them alive (expire on a missing key is a harmless no-op).
  async saveRoom(room: Room): Promise<void> {
    await Promise.all([
      this.redis.set(roomKey(room.id), room, { ex: this.ttl }),
      this.redis.sadd(ROOMS_INDEX, room.id),
      this.redis.expire(tokensKey(room.id), this.ttl),
    ])
  }

  // Drop the room, its index entry, and ALL its tokens at once. Deleting the token
  // hash wholesale means a destroyed room never leaves orphan tokens behind.
  async deleteRoom(roomId: string): Promise<void> {
    await Promise.all([
      this.redis.del(roomKey(roomId)),
      this.redis.srem(ROOMS_INDEX, roomId),
      this.redis.del(tokensKey(roomId)),
    ])
  }

  async saveToken(roomId: string, playerId: string, token: string): Promise<void> {
    await Promise.all([
      this.redis.hset(tokensKey(roomId), { [playerId]: token }),
      this.redis.expire(tokensKey(roomId), this.ttl),
    ])
  }

  async deleteToken(roomId: string, playerId: string): Promise<void> {
    await this.redis.hdel(tokensKey(roomId), playerId)
  }
}

// Picks Redis when both Upstash REST env vars are present, else the in-memory
// no-op. Without configuration the server keeps its original behavior — the
// feature is strictly additive and CI runs with NullPersistence (no secrets).
export function createPersistence(): RoomPersistence {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) {
    logger.info('🗄️  Persistence: Upstash Redis (write-through snapshots)')
    return new RedisPersistence(Redis.fromEnv())
  }
  logger.info(
    '🗄️  Persistence: in-memory only (set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN to enable Redis)',
  )
  return new NullPersistence()
}
