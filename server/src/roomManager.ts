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
  //
  // Cleanup invariant (backlog 6.8): this Map has NO whole-room purge, and it
  // doesn't need one TODAY. Tokens are dropped per-player in clearToken (called
  // from leaveRoom), and the ONLY in-memory room-destroy site — this.rooms.delete
  // in leaveRoom — is reached solely once the room is already empty, i.e. after
  // every player's token was cleared one by one. So a destroyed room leaves no
  // orphan token behind. If you EVER add a path that removes a room (or clears its
  // players) WITHOUT going through per-player leaveRoom — a "kick all", an admin
  // "close room", an in-memory idle reaper — add a clearRoomTokens(roomId) that
  // deletes every `${roomId}::*` key and call it at that destroy site, or these
  // tokens orphan for the life of the process. The persistence mirror already
  // covers its own side: persistence.deleteRoom drops the whole `tokens:${roomId}`
  // hash wholesale (see persistence.ts).
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
    for (const room of rooms) {
      this.pruneOrphanVotes(room)
      this.rooms.set(room.id, room)
    }
    for (const [key, token] of tokens) this.tokens.set(key, token)
    if (rooms.length > 0) {
      logger.info(`♻️  Rehydrated ${rooms.length} room(s) from persistence`)
    }
  }

  // Drops votes in the round in progress that belong to nobody seated in the room.
  //
  // In-process this can't happen anymore: leaveRoom prunes the departing player's
  // vote before saving. But snapshots written BEFORE that fix are still out there —
  // a room whose voter left mid-round carries their vote with no matching player —
  // and that fix is not retroactive. Such a vote is counted by the client (which
  // feeds the raw map to useVoteStats) and by nothing on the server, so it inflates
  // the average and can fabricate a consensus out of a voter who is gone.
  //
  // Beyond the legacy cleanup this is a boundary invariant worth holding: a vote
  // must belong to a seated player. Snapshots come from outside the process.
  //
  // What this deliberately does NOT do — the two exclusions matter:
  //   - Past and revealed rounds are left alone. A vote outliving its player is
  //     EXPECTED there: leaveRoom prunes only the round in progress, precisely so a
  //     revealed result stays the one the room saw.
  //   - A rehydration GHOST is not an orphan. It's still in room.players (see the
  //     note on hydrate above), so its vote survives this, by design: at boot nobody
  //     is present yet, and pruning by presence would delete the votes of a whole
  //     team that is simply mid-reconnect — the exact work persistence exists to
  //     save. The ghost's vote keeps counting in the reveal stats; the ghost can no
  //     longer STALL the round (the quorum is presence-aware), and telling "coming
  //     back" from "gone for good" needs presence broadcast to clients, which is the
  //     follow-up already noted above. Accepted limitation, not an oversight.
  private pruneOrphanVotes(room: Room): void {
    if (room.currentRoundIndex === -1) return
    const round = room.rounds[room.currentRoundIndex]
    if (round.status !== 'voting') return
    for (const playerId of Object.keys(round.votes)) {
      if (!room.players.some((p) => p.id === playerId)) delete round.votes[playerId]
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

    // If room becomes empty, destroy it. The last player's token was just cleared
    // above (clearToken) and every earlier player cleared theirs on their own
    // leave, so tearing the room down here orphans no token. Read the cleanup
    // invariant on the `tokens` field before adding ANY other room-destroy path.
    if (room.players.length === 0) {
      this.rooms.delete(roomId)
      // Schedule AFTER the delete: flushSave reads the current map state, so it now
      // sees the room gone and persists a delete (not a stale save).
      this.scheduleSave(roomId)
      return null
    }

    // If the admin left, hand admin to the next remaining player so the room
    // doesn't get stuck with nobody able to drive the session.
    //
    // Observers are skipped: the promotion sets role = 'admin', and eligibleVotersOf
    // only filters out observers — so promoting one silently drafts someone who
    // joined to WATCH into the quorum of every round from then on.
    //
    // Falling back to players[0] when everyone left IS an observer is deliberate: a
    // room nobody can drive is worse than the promotion. Its cost is real but
    // deferred — an observers-only room has no quorum to break, yet the promotion
    // is permanent, so a player joining later finds the ex-observer counted as a
    // voter (the new admin can take themselves out via set_round_voter). Removing
    // that residue means letting adminId point at a player whose role isn't
    // 'admin', which both the join_room role normalization in events.ts (role is
    // resolved FROM adminId) and the client's crown/observer grouping assume away.
    //
    // The promoted player keeps admin across a rejoin in either branch, by that
    // same events.ts normalization.
    //
    // Presence is the FIRST filter, for the same reason observers are the second:
    // handing the room to someone who can't drive it defeats the transfer. An
    // absent player here is STRUCTURALLY a rehydration ghost — present covers a live
    // socket OR the reconnect grace, and no other path leaves an absent player in
    // room.players — so it would inherit the room and never come back to run it.
    //
    // Temporally it's fuzzier: in the seconds after a cold start, a teammate who is
    // about to reconnect reads exactly like a ghost. That is what makes the observer
    // promotion above MORE likely than its "only when everyone left is an observer"
    // wording suggests — it now fires whenever everyone PRESENT is an observer — and
    // that promotion is permanent. Judged the better trade anyway: an admin who can
    // act now beats holding the room for someone who may not be coming back.
    //
    // When nobody is present at all the whole list is the pool: the room is dormant,
    // and whoever reconnects first is kept as admin by events.ts anyway.
    if (wasAdmin) {
      const present = room.players.filter((p) => this.presence.isPresent(room.id, p.id))
      const pool = present.length > 0 ? present : room.players
      const next = pool.find((p) => p.role !== 'observer') ?? pool[0]
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
    // Their VOTE, on the other hand, goes — the same rule setRoundVoter already
    // applies when the admin takes someone out of a round: a vote from someone the
    // round no longer counts skews the reveal. The asymmetry with excludedVoterIds
    // above is the point: an orphan exclusion is INERT (eligibleVotersOf iterates
    // room.players, so an id nobody carries never matches), while an orphan vote is
    // live data. The server never noticed, because every quorum path iterates
    // room.players; the client is what breaks. It feeds the raw votes map to
    // useVoteStats, so a leftover vote still lands in the count, the average, the
    // distribution and — worst — in hasConsensus, where it resurrects the false
    // consensus that the "at least 2 votes" guard exists to prevent: one present
    // voter plus one ghost vote reads as agreement, banner and confetti included.
    //
    // Accepted cost: "who left" includes someone who only lost the network for 31
    // seconds and is already coming back — leaveRoom runs when the grace expires,
    // not when the tab closes. They rejoin with no vote and have to cast again.
    // Judged better than the alternative, which is the whole room reading a number
    // from someone who isn't there. The client clears its optimistic vote on this
    // same transition (RoomView), so the card doesn't lie about it.
    //
    // NOT covered here: a rehydration ghost never leaves — no socket, no grace
    // timer, so no leaveRoom — and its vote survives a restart. Tracked as backlog;
    // fixing it belongs in hydrate(), not in the leave path.
    //
    // Only the round in progress. A revealed round is settled history — the room
    // already saw that result, and rewriting it would retroactively change what was
    // shown (same reason setRoundVoter refuses to touch a revealed round).
    if (room.currentRoundIndex !== -1) {
      const currentRound = room.rounds[room.currentRoundIndex]
      if (currentRound.status === 'voting') delete currentRound.votes[playerId]
    }

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
