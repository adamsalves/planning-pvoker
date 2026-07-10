import { Room, Player, RoomConfig, Round } from './types'
import { NullPersistence, type RoomPersistence } from './persistence'
import { logger } from './logger'

// Defensive cap on a room's cumulative backlog. The per-call Zod limit
// (MAX_SUBJECTS_PER_CALL in validation.ts) only bounds a single add_subjects
// payload; without a total cap an admin could still grow the in-memory list
// without bound through repeated calls.
const MAX_SUBJECTS_TOTAL = 200

export class RoomManager {
  private rooms: Map<string, Room> = new Map()

  // Per-(room, player) session secret. Kept OUTSIDE the Room object so it is
  // never serialized into room_state_updated — the broadcast carries the
  // adminId, so without a private token a member could rejoin claiming
  // player.id === adminId and escalate to admin. The token is the proof that a
  // socket really owns that identity. Stable across rejoins (reused, not
  // regenerated) so a refresh or a second tab isn't locked out.
  private tokens: Map<string, string> = new Map()

  // Write-through coalescing state: at most one save per room is in flight; a
  // room mutated again while its save runs is marked dirty and re-saved with the
  // LATEST state once the in-flight save settles. Collapsing intermediate
  // snapshots is safe — only the newest state matters to a rehydrating boot.
  private savingRooms = new Set<string>()
  private dirtyRooms = new Set<string>()

  // Persistence is best-effort and defaults to a no-op, so `new RoomManager()`
  // (used across the tests) behaves exactly as before — pure in-memory.
  constructor(private readonly persistence: RoomPersistence = new NullPersistence()) {}

  private tokenKey(roomId: string, playerId: string): string {
    return `${roomId}::${playerId}`
  }

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  // Rebuild the in-memory Maps from durable storage. Called once at boot, BEFORE
  // the server accepts connections, so a client reconnecting right after a
  // redeploy finds its room (and its token) already present instead of getting
  // "room not found". A no-op under NullPersistence.
  //
  // Known trade-off: presence/grace timers (events.ts) are ephemeral and lost on
  // restart, so a rehydrated room comes back with every player it had — including
  // ones who won't reconnect. Such a "ghost" lingers until the room's TTL expires
  // (no disconnect fires for a socket that never existed in this process), and
  // while present it still counts toward the autoReveal quorum. Accepted for now:
  // a grace-based reaper can't simply run here because the free-tier cold start
  // (~60s) exceeds the reconnect grace (~30s) and would evict the room before the
  // team finishes reconnecting. A presence-aware autoReveal fix is a follow-up.
  public async hydrate(): Promise<void> {
    const { rooms, tokens } = await this.persistence.loadAll()
    for (const room of rooms) this.rooms.set(room.id, room)
    for (const [key, token] of tokens) this.tokens.set(key, token)
    if (rooms.length > 0) {
      logger.info(`♻️  Rehydrated ${rooms.length} room(s) from persistence`)
    }
  }

  // --- Write-through (best-effort mirroring of state to persistence) ---

  // Schedules a save of the room's CURRENT state (or a delete if it's gone),
  // coalescing a burst of mutations into a single in-flight save per room.
  private scheduleSave(roomId: string): void {
    if (this.savingRooms.has(roomId)) {
      this.dirtyRooms.add(roomId)
      return
    }
    this.savingRooms.add(roomId)
    void this.flushSave(roomId)
  }

  private async flushSave(roomId: string): Promise<void> {
    try {
      // Read the latest state at flush time, so coalesced mutations all land.
      const room = this.rooms.get(roomId)
      if (room) {
        await this.persistence.saveRoom(room)
      } else {
        await this.persistence.deleteRoom(roomId)
      }
    } catch (err) {
      // Persistence is best-effort — log and keep serving from memory.
      logger.warn(`persistence: save failed for room ${roomId}: ${String(err)}`)
    } finally {
      if (this.dirtyRooms.delete(roomId)) {
        void this.flushSave(roomId) // dirtied again while saving — persist newer state
      } else {
        this.savingRooms.delete(roomId)
      }
    }
  }

  private saveTokenThrough(roomId: string, playerId: string, token: string): void {
    this.persistence
      .saveToken(roomId, playerId, token)
      .catch((err) => logger.warn(`persistence: saveToken failed for ${roomId}: ${String(err)}`))
  }

  // --- Session tokens (anti-escalation) ---

  // Returns the existing token for (room, player) or mints a new one. Reusing
  // the same token across rejoins keeps multi-tab/refresh from being rejected.
  public getOrCreateToken(roomId: string, playerId: string): string {
    const key = this.tokenKey(roomId, playerId)
    const existing = this.tokens.get(key)
    if (existing) return existing
    const token = crypto.randomUUID()
    this.tokens.set(key, token)
    // Only a freshly minted token needs persisting; a reused one is already stored.
    this.saveTokenThrough(roomId, playerId, token)
    return token
  }

  public hasToken(roomId: string, playerId: string): boolean {
    return this.tokens.has(this.tokenKey(roomId, playerId))
  }

  // True only when a token is supplied AND matches the stored one. A missing or
  // wrong token returns false so callers can reject the join.
  public verifyToken(roomId: string, playerId: string, token: string | undefined): boolean {
    if (!token) return false
    return this.tokens.get(this.tokenKey(roomId, playerId)) === token
  }

  public clearToken(roomId: string, playerId: string): void {
    this.tokens.delete(this.tokenKey(roomId, playerId))
    this.persistence
      .deleteToken(roomId, playerId)
      .catch((err) => logger.warn(`persistence: deleteToken failed for ${roomId}: ${String(err)}`))
  }

  public createRoom(roomId: string, adminPlayer: Player, config: RoomConfig): Room {
    const newRoom: Room = {
      id: roomId,
      adminId: adminPlayer.id,
      config,
      players: [adminPlayer],
      subjects: [],
      phase: 'setup',
      rounds: [],
      currentRoundIndex: -1,
    }
    this.rooms.set(roomId, newRoom)
    this.scheduleSave(roomId)
    return newRoom
  }

  public joinRoom(roomId: string, player: Player): Room | null {
    const room = this.rooms.get(roomId)
    if (!room) return null

    // Check if player already exists, update role/name if so, else add
    const existingPlayer = room.players.find((p) => p.id === player.id)
    if (!existingPlayer) {
      room.players.push(player)
    } else {
      existingPlayer.name = player.name
      existingPlayer.role = player.role
    }

    this.scheduleSave(roomId)
    return room
  }

  public leaveRoom(roomId: string, playerId: string): Room | null {
    const room = this.rooms.get(roomId)
    if (!room) return null

    const wasAdmin = room.adminId === playerId
    room.players = room.players.filter((p) => p.id !== playerId)

    // The player is really gone now (this runs after the grace window in
    // events.ts), so drop their session secret. During the grace window
    // leaveRoom is NOT called, so a refreshing player keeps their token.
    this.clearToken(roomId, playerId)

    // If room becomes empty, destroy it
    if (room.players.length === 0) {
      this.rooms.delete(roomId)
      // Schedule AFTER the delete: flushSave reads the current map state, so it now
      // sees the room gone and persists a delete (not a stale save).
      this.scheduleSave(roomId)
      return null
    }

    // If the admin left, hand admin to the next remaining player so the room
    // doesn't get stuck with nobody able to drive the session.
    if (wasAdmin) {
      const next = room.players[0]
      room.adminId = next.id
      next.role = 'admin'
    }

    // Schedule AFTER admin transfer so the snapshot carries the final adminId.
    this.scheduleSave(roomId)
    return room
  }

  // --- Subject Backlog Management (setup phase) ---

  public addSubjects(roomId: string, subjects: string[]): Room | null {
    const room = this.rooms.get(roomId)
    if (!room || room.phase !== 'setup') return null
    if (room.subjects.length + subjects.length > MAX_SUBJECTS_TOTAL) return null

    room.subjects.push(...subjects)
    this.scheduleSave(roomId)
    return room
  }

  public removeSubject(roomId: string, index: number): Room | null {
    const room = this.rooms.get(roomId)
    if (!room || room.phase !== 'setup') return null
    if (index < 0 || index >= room.subjects.length) return null

    room.subjects.splice(index, 1)
    this.scheduleSave(roomId)
    return room
  }

  // --- Session Flow ---

  public startSession(roomId: string): Room | null {
    const room = this.rooms.get(roomId)
    if (!room || room.phase !== 'setup') return null
    if (room.subjects.length === 0) return null

    // Create round for the first subject
    const firstRound: Round = {
      id: crypto.randomUUID(),
      subject: room.subjects[0],
      status: 'voting',
      votes: {},
    }

    room.phase = 'voting'
    room.rounds = [firstRound]
    room.currentRoundIndex = 0

    this.scheduleSave(roomId)
    return room
  }

  public nextRound(roomId: string): Room | null {
    const room = this.rooms.get(roomId)
    if (!room || room.phase !== 'voting') return null

    const nextSubjectIndex = room.currentRoundIndex + 1

    // If there are no more subjects, complete the session
    if (nextSubjectIndex >= room.subjects.length) {
      room.phase = 'completed'
      this.scheduleSave(roomId)
      return room
    }

    // Create round for the next subject
    const newRound: Round = {
      id: crypto.randomUUID(),
      subject: room.subjects[nextSubjectIndex],
      status: 'voting',
      votes: {},
    }

    room.rounds.push(newRound)
    room.currentRoundIndex = nextSubjectIndex

    this.scheduleSave(roomId)
    return room
  }

  // --- Voting ---

  public castVote(roomId: string, playerId: string, value: string | number): Room | null {
    const room = this.rooms.get(roomId)
    if (!room || room.currentRoundIndex === -1) return null

    // Only players present in the room who are not observers may vote
    const player = room.players.find((p) => p.id === playerId)
    if (!player || player.role === 'observer') return null

    const round = room.rounds[room.currentRoundIndex]
    if (round.status !== 'voting') return null

    round.votes[playerId] = value

    // Check autoReveal if everyone has voted
    if (room.config.autoReveal) {
      const activePlayers = room.players.filter((p) => p.role !== 'observer')
      // Guard length: [].every() is true, which would reveal a round in an
      // observers-only room (zero active players) without a single vote.
      const allVoted =
        activePlayers.length > 0 && activePlayers.every((p) => round.votes[p.id] !== undefined)
      if (allVoted) {
        round.status = 'revealed'
      }
    }

    this.scheduleSave(roomId)
    return room
  }

  public revealVotes(roomId: string): Room | null {
    const room = this.rooms.get(roomId)
    if (!room || room.currentRoundIndex === -1) return null

    const round = room.rounds[room.currentRoundIndex]
    round.status = 'revealed'

    this.scheduleSave(roomId)
    return room
  }

  // --- Reset for new session ---

  public resetSession(roomId: string): Room | null {
    const room = this.rooms.get(roomId)
    if (!room) return null

    room.subjects = []
    room.phase = 'setup'
    room.rounds = []
    room.currentRoundIndex = -1

    this.scheduleSave(roomId)
    return room
  }
}
