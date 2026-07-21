import { Room, Player, RoomConfig, Round } from './types'
import { NullPersistence, type RoomPersistence } from './persistence'
import { logger } from './logger'

// Narrow port the RoomManager consults to decide whether a player still counts
// toward a quorum. Presence (live socket OR within the reconnect grace) lives in
// the events.ts closure and is injected via setPresence(); RoomManager itself
// never touches sockets. Kept minimal on purpose — presence, not authorization.
export interface PresenceOracle {
  isPresent(roomId: string, playerId: string): boolean
}

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

  // Presence oracle for the autoReveal quorum. Defaults to "everyone is present"
  // so `new RoomManager()` (and the NullPersistence path) behaves exactly as
  // before — the quorum is computed over every eligible voter, as it was inline.
  // events.ts wires the real presence via setPresence() after construction.
  private presence: PresenceOracle = { isPresent: () => true }

  // Persistence is best-effort and defaults to a no-op, so `new RoomManager()`
  // (used across the tests) behaves exactly as before — pure in-memory.
  constructor(private readonly persistence: RoomPersistence = new NullPersistence()) {}

  // Injects the presence source. Called once from setupSocketEvents (which owns
  // the socket/grace-timer state), after the RoomManager already exists.
  public setPresence(oracle: PresenceOracle): void {
    this.presence = oracle
  }

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
  // ones who won't reconnect. Such a "ghost" still APPEARS in the player list
  // until the room's TTL expires (no disconnect fires for a socket that never
  // existed in this process). It no longer blocks progress, though: the autoReveal
  // quorum is presence-aware (see maybeAutoReveal + the PresenceOracle), so a ghost
  // is excluded from the quorum and can neither stall the reveal nor pin the room.
  // A grace-based boot reaper is still avoided on purpose — the free-tier cold
  // start (~60s) exceeds the reconnect grace (~30s) and would evict the room
  // before the team finishes reconnecting. Hiding the ghost from the UI is a
  // separate follow-up (it needs presence broadcast to clients).
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
      // Reenviada pelo cliente a cada join (vem do user store persistido), então
      // sobrescreve como name/role — inclusive limpando (undefined) se a pessoa
      // tirou a tag. A tag NÃO é atribuída por outro caminho no server.
      existingPlayer.tag = player.tag
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

    // The departing player is deliberately NOT pruned from the round's
    // excludedVoterIds. Harmless to the quorum (eligibleVotersOf filters over
    // room.players, so someone who is gone never counts), and it keeps the
    // admin's choice sticky for the case that actually matters: a player who
    // drops and comes back with the same id stays out of the round, instead of
    // silently re-entering it. Trade-off: after an explicit "leave" and a
    // re-join, that player is still excluded — the UI (slice 2) has to say so.
    //
    // A present voter just left (their grace expired). If the voters who remain
    // present have all voted, the round can now auto-reveal — the departing
    // player was the last one holding it open. No-op when autoReveal is off.
    this.maybeAutoReveal(room)

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

  // Single factory for both round creation sites. `excludedVoterIds` is copied,
  // never aliased. setRoundVoter always REASSIGNS the array (never mutates in
  // place), so sharing one wouldn't corrupt anything today — the copy is what
  // keeps a future in-place edit from rewriting a past round's history.
  private createRound(subject: string, excludedVoterIds: string[]): Round {
    return {
      id: crypto.randomUUID(),
      subject,
      status: 'voting',
      votes: {},
      excludedVoterIds: [...excludedVoterIds],
    }
  }

  public startSession(roomId: string): Room | null {
    const room = this.rooms.get(roomId)
    if (!room || room.phase !== 'setup') return null
    if (room.subjects.length === 0) return null

    // Create round for the first subject — a fresh session starts with everyone in.
    const firstRound = this.createRound(room.subjects[0], [])

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

    // Create round for the next subject, INHERITING who the admin left out: the
    // selection is meant to carry across rounds, so they don't re-pick every time.
    const previousExcluded =
      room.currentRoundIndex >= 0
        ? (room.rounds[room.currentRoundIndex].excludedVoterIds ?? [])
        : []
    const newRound = this.createRound(room.subjects[nextSubjectIndex], previousExcluded)

    room.rounds.push(newRound)
    room.currentRoundIndex = nextSubjectIndex

    this.scheduleSave(roomId)
    return room
  }

  // --- Voting ---

  public castVote(roomId: string, playerId: string, value: string | number): Room | null {
    const room = this.rooms.get(roomId)
    if (!room || room.currentRoundIndex === -1) return null

    const round = room.rounds[room.currentRoundIndex]
    if (round.status !== 'voting') return null

    // Admission goes through the SAME seam as the quorum: a vote is accepted iff
    // its author is one of the voters the round is waiting on. Also covers a
    // playerId that isn't in the room at all (the filter runs over room.players).
    if (!this.eligibleVotersOf(room, round).some((p) => p.id === playerId)) return null

    round.votes[playerId] = value

    this.maybeAutoReveal(room)

    this.scheduleSave(roomId)
    return room
  }

  // Turns a player on/off as a voter in the CURRENT round (admin-only, enforced
  // at the socket layer). Deliberately per-player rather than a whole-list
  // replace: it matches the per-row toggle in the UI and stays idempotent.
  public setRoundVoter(roomId: string, playerId: string, voting: boolean): Room | null {
    const room = this.rooms.get(roomId)
    if (!room || room.currentRoundIndex === -1) return null

    const round = room.rounds[room.currentRoundIndex]
    // Once revealed, who the round expected is settled history — don't rewrite it.
    if (round.status !== 'voting') return null

    // Observers are already out; flipping a role is a separate concern.
    const player = room.players.find((p) => p.id === playerId)
    if (!player || player.role === 'observer') return null

    const excluded = round.excludedVoterIds ?? []
    if (voting) {
      round.excludedVoterIds = excluded.filter((id) => id !== playerId)
    } else if (!excluded.includes(playerId)) {
      round.excludedVoterIds = [...excluded, playerId]
      // Drop any vote they had already cast — leaving it behind would skew the
      // reveal stats with a vote from someone the round no longer counts.
      delete round.votes[playerId]
    }

    // Taking the last pending voter out can complete the quorum.
    this.maybeAutoReveal(room)

    this.scheduleSave(roomId)
    return room
  }

  // --- AutoReveal quorum (presence-aware) ---

  // The set of players the given round is waiting on: everyone who is neither an
  // observer (room-wide) nor excluded by the admin from THIS round. Single seam
  // shared by the quorum and by castVote's admission check.
  private eligibleVotersOf(room: Room, round: Round): Player[] {
    const excluded = round.excludedVoterIds ?? []
    return room.players.filter((p) => p.role !== 'observer' && !excluded.includes(p.id))
  }

  // Reveals the current round when every PRESENT eligible voter has voted. Only
  // present players count (live socket OR within the reconnect grace, per the
  // injected PresenceOracle), so a rehydration ghost — eligible but with no
  // socket and no grace timer — can't stall the reveal or pin the room. No-op
  // unless autoReveal is on and a round is actively being voted on.
  private maybeAutoReveal(room: Room): void {
    if (!room.config.autoReveal || room.currentRoundIndex === -1) return
    const round = room.rounds[room.currentRoundIndex]
    if (round.status !== 'voting') return

    const required = this.eligibleVotersOf(room, round).filter((p) =>
      this.presence.isPresent(room.id, p.id),
    )
    // Guard length: [].every() is true, which would reveal a round with no
    // present eligible voters (observers-only, or an admin who excluded
    // everyone) without a single vote.
    if (required.length > 0 && required.every((p) => round.votes[p.id] !== undefined)) {
      round.status = 'revealed'
    }
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
