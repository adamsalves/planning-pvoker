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
      // ORDER MATTERS, in the all-observers case: the repair promotes the first
      // player when nobody is a non-observer, and observers are exactly who
      // eligibleVotersOf filters out — so running the prune first would judge
      // eligibility against a role the room is about to change, and drop a vote the
      // repaired room would have counted. In every other case the repair picks a
      // non-observer and the order is indifferent.
      const repaired = this.repairOrphanAdmin(room)
      this.pruneOrphanVotes(room)
      this.rooms.set(room.id, room)
      // Write the repair back, AFTER the map holds it (flushSave reads current
      // state). Without this the snapshot keeps the orphan adminId until some
      // unrelated mutation happens to save, and the warn below re-fires on every
      // boot — an operator can't tell "still broken" from "fixed and re-detected".
      if (repaired) this.scheduleSave(room.id)
    }
    for (const [key, token] of tokens) this.tokens.set(key, token)
    if (rooms.length > 0) {
      logger.info(`♻️  Rehydrated ${rooms.length} room(s) from persistence`)
    }
  }

  // Repoints an `adminId` that names nobody in `players` at a real player.
  //
  // Reachable only through rehydration: createRoom takes adminId from a player it
  // just seated, and leaveRoom always repoints it at a remaining one. Left alone the
  // room isn't broken, it is QUIETLY BRICKED — requireAdmin (events.ts) compares the
  // caller against adminId so no admin command passes, and leaveRoom's `wasAdmin`
  // never fires, so the handover that exists to rescue a driverless room can't run
  // either. It stays alive and un-driveable until its TTL.
  //
  // This used to be a rejection in persistence.ts, which threw away an otherwise
  // intact room — subject backlog, round history, every other player — over one
  // dangling string. The rejection was chosen deliberately then, on the grounds that
  // repairing state nobody has ever observed means opening a code path to resurrect
  // corruption that isn't understood. That reasoning is answered rather than ignored:
  //
  //   - the repair is NOT a general `.transform()` in the schema. It is one named
  //     step at boot, so nothing else in the system can reach it;
  //   - it fixes ONE field, by the same policy leaveRoom's handover already uses
  //     (first non-observer, else the first player), so a repaired room lands in a
  //     state the running system produces anyway;
  //   - everything it cannot understand is still DISCARDED — the shape schema and
  //     the currentRoundIndex refine are untouched, and `players: []` (nobody to
  //     promote) remains a rejection;
  //   - it is LOUD. The whole point of the original refusal was that the failure was
  //     never observed in production; a silent repair would keep it that way.
  //
  // leaveRoom's handover filters by presence first and this does not — but that is
  // an ABSENCE OF EFFECT, not a different policy. setPresence() runs after hydrate
  // (see index.ts), so during this pass the oracle is still the constructor default
  // answering "everyone is present": the filter would keep the whole list and select
  // identically. Written without it because a filter that provably cannot discriminate
  // reads as a rule someone must maintain. Same reason pruneOrphanVotes gives below.
  //
  // Inherited cost, identical to leaveRoom's and documented there at length: when
  // every seated player is an observer the promotion drafts one into `admin`, which
  // makes them a voter (eligibleVotersOf only filters observers) for every later
  // round. It is permanent — events.ts resolves role FROM adminId on join, so they
  // cannot demote themselves by rejoining — and the new admin can take themselves
  // out of a round via set_round_voter. A room nobody can drive is still worse.
  //
  // Returns whether it changed anything, so the caller can persist the repair.
  private repairOrphanAdmin(room: Room): boolean {
    if (room.players.some((p) => p.id === room.adminId)) return false

    // persistence.ts rejects an empty players array, so there is always a candidate.
    // The guard is not dead code even so: RoomPersistence is a PORT, and an
    // implementation that doesn't run the zod schema (every test double here) can
    // hand over a room this method must not throw on.
    const next = room.players.find((p) => p.role !== 'observer') ?? room.players[0]
    if (!next) return false

    const orphaned = room.adminId
    room.adminId = next.id
    next.role = 'admin'
    logger.warn(
      `🛠️  Repaired orphan adminId in room ${room.id}: ${orphaned} named no seated player; ` +
        `promoted ${next.id} (${next.name}). The snapshot was kept instead of discarded.`,
    )
    return true
  }

  // Drops votes in the round in progress whose author the round does not count.
  //
  // Keyed off eligibleVotersOf — the same seam castVote admits through and the
  // quorum counts — and NOT off "is seated in the room", which is a strictly weaker
  // claim: an observer or an admin-excluded player is seated, yet the round refuses
  // their vote everywhere else. Using the weaker one here would let this cleanup
  // bless data that castVote would have rejected outright.
  //
  // Why any of it is needed: leaveRoom prunes the departing player's vote before
  // saving, but only since that fix, and it is not retroactive — snapshots written
  // earlier carry the vote of someone who left mid-round, with no matching player.
  // Nothing on the server counts such a vote (every quorum path iterates players),
  // but the client feeds the raw map to useVoteStats, so it inflates the average and
  // can fabricate a consensus out of a voter who is gone. Beyond that legacy
  // cleanup, this is a boundary invariant worth holding on its own: snapshots come
  // from outside the process.
  //
  // What this deliberately does NOT do — the two exclusions matter:
  //   - Past and revealed rounds are left alone. A vote outliving its author is
  //     EXPECTED there: leaveRoom prunes only the round in progress, precisely so a
  //     revealed result stays the one the room saw.
  //   - A rehydration GHOST is not pruned HERE. It is a seated, non-excluded,
  //     non-observer player (see the note on hydrate above), so it stays ELIGIBLE and
  //     keeps its vote through this pass. That is deliberate, and presence is not the
  //     criterion here for a reason more basic than policy: setPresence() is called by
  //     setupSocketEvents, which runs AFTER hydrate (see index.ts) — during this pass
  //     the oracle is still the constructor default that answers "everyone is
  //     present", so presence cannot be consulted at all. Even if it could, at boot
  //     nobody has reconnected yet, and pruning by presence would wipe the votes of a
  //     whole team that is simply mid-reconnect: the exact work persistence exists to
  //     save.
  //
  //     Deferred, not accepted: sealRound() prunes by presence AT THE REVEAL, which is
  //     the moment the answer is both knowable and needed — presence is wired by then,
  //     and a ghost's vote can no longer reach the stats the client computes. So the
  //     ghost keeps its vote here and loses it there. Do not "fix" this by pruning at
  //     boot; that is the version that destroys a reconnecting team's work.
  private pruneOrphanVotes(room: Room): void {
    // Same resolver the single-vote seam uses, and its `!round` runtime guard earns
    // its keep HERE above all: this is the one call reached BEFORE any in-process
    // invariant has held — persistence.ts's refine is all that stands between a
    // hand-edited snapshot and this line. A throw would cost more here than anywhere
    // else: hydrate aborts mid-loop, the token map never loads, and hasToken()
    // returning false for everyone turns OFF the anti-escalation check in join_room,
    // while index.ts keeps the process serving.
    const round = this.currentRoundIfVoting(room)
    if (!round) return

    const counted = new Set(this.eligibleVotersOf(room, round).map((p) => p.id))
    const dropped = Object.keys(round.votes).filter((playerId) => !counted.has(playerId))
    for (const playerId of dropped) delete round.votes[playerId]

    // Say it happened. This is the one step of the boot that destroys user-visible
    // state, and hydrate only ever logs the survivors — same reasoning as the
    // discard log in persistence.loadAll. Silent when there is nothing to drop.
    if (dropped.length > 0) {
      logger.warn(
        `♻️  Room ${room.id}: dropped ${dropped.length} rehydrated vote(s) the round does not count (${dropped.join(', ')})`,
      )
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

      // Virar espectador tira a pessoa do que a rodada conta (eligibleVotersOf
      // filtra observers), então o voto que ela já tinha dado precisa ir junto —
      // mesma regra e mesmo seam do leaveRoom e do setRoundVoter.
      //
      // Alcançável sem sair da sala de verdade: o cliente reenvia o papel do user
      // store a cada join, então quem sai, escolhe "espectador" na home e volta
      // DENTRO da janela de grace nunca passa pelo leaveRoom — o jogador segue na
      // sala com o voto intacto e reaparece como espectador. Sem isto, o mapa de
      // votos guarda o voto de alguém que a rodada não espera mais, e o cliente,
      // que soma o mapa cru no useVoteStats, o conta na média e no consenso.
      if (existingPlayer.role === 'observer') this.dropCurrentVote(room, player.id)
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
    //
    // SECOND HOME FOR THIS POLICY: repairOrphanAdmin() runs the same selection at
    // boot, to repoint an adminId that a snapshot left dangling. It deliberately
    // drops the presence filter (the oracle isn't wired during hydrate) but keeps
    // "first non-observer, else the first player" identical. The two are the only
    // places that decide who inherits a room — change one and the other has to
    // follow, or a room's admin depends on whether the server restarted.
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
    // timer, so no leaveRoom. Its vote therefore survives this path, and that is
    // fine: sealRound() drops it at the REVEAL, where presence is already wired and
    // the answer is both knowable and needed. Do not try to close the gap in
    // hydrate() instead — at boot nobody is present yet, so pruning by presence
    // there would wipe the votes of a whole team mid-reconnect. See the note on
    // pruneOrphanVotes, which says the same from the other side.
    //
    // Only the round in progress — the seam below is what enforces that, and a
    // revealed round is settled history (the room already saw that result).
    this.dropCurrentVote(room, playerId)

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

  // The round that is open for votes right now, or undefined. Two guards, and both
  // matter: -1 means the room has no round at all (setup, or after a reset), and a
  // REVEALED round is settled history — the room already saw that result, so nothing
  // may rewrite it. The `!round` is a runtime guard, not a type one, since
  // noUncheckedIndexedAccess is off; it only bites on a rehydrated snapshot, the one
  // path that reaches here without an in-process invariant having held.
  private currentRoundIfVoting(room: Room): Round | undefined {
    if (room.currentRoundIndex === -1) return undefined
    const round = room.rounds[room.currentRoundIndex]
    return round && round.status === 'voting' ? round : undefined
  }

  // Single seam for one rule: a vote whose author the round no longer counts must
  // not reach the reveal. The server itself never trips over such a vote — every
  // quorum path iterates room.players — but the client feeds the raw votes map to
  // useVoteStats, so it lands in the count, the average, the distribution and in
  // hasConsensus, where it can manufacture agreement out of somebody who is gone.
  //
  // THREE callers reach this from three different directions, which is exactly why
  // it is one function: the admin takes someone out of the round (setRoundVoter),
  // the person leaves the room for good (leaveRoom, after the grace expires), and
  // the boot finds a snapshot carrying a vote the round does not count
  // (pruneOrphanVotes, which drops several at once and so guards separately).
  // Before this was extracted the rule lived duplicated at each site — and the third
  // one arrived months later, in a PR that had to rediscover the reasoning.
  private dropCurrentVote(room: Room, playerId: string): void {
    const round = this.currentRoundIfVoting(room)
    if (round) delete round.votes[playerId]
  }

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
      // Drop any vote they had already cast — same seam the leave path uses.
      this.dropCurrentVote(room, playerId)
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
      this.sealRound(room, round)
    }
  }

  // Closes a round: drops the votes of players who are not present, THEN marks it
  // revealed. The two steps are one operation on purpose — after `status` flips, the
  // round is settled history and nothing may touch its votes.
  //
  // Who can possibly be absent, seated AND holding a vote at this moment? Only a
  // rehydration ghost. A live socket is present; someone who just dropped is inside
  // the grace window, which counts as present; and once the grace expires leaveRoom
  // runs and takes both the player and their vote. So "absent + seated + voted" is
  // exactly the ghost, and this prunes it precisely — no live voter can be caught.
  //
  // It also settles an incoherence: the quorum above ALREADY ignores absent players
  // (that is what stops a ghost from stalling the round), while the reveal counted
  // their votes anyway — the client sums the raw votes map in useVoteStats, so a
  // ghost inflated the average and could manufacture a consensus among people who
  // were no longer there. Deciding the round by one set of people and reporting it
  // over another was the bug; both are now "who is present".
  //
  // Trade-off, deliberate: the reveal shows the votes of who is IN the room, not
  // every vote ever cast for the round. Someone who voted and vanished across a
  // restart loses their number from the result. Same rule the leave path applies —
  // and their estimate could not be discussed by a team they are absent from anyway.
  //
  // The default PresenceOracle answers "everyone is present", so this is a no-op
  // wherever presence is not wired (unit tests, NullPersistence boots).
  private sealRound(room: Room, round: Round): void {
    for (const playerId of Object.keys(round.votes)) {
      if (!this.presence.isPresent(room.id, playerId)) delete round.votes[playerId]
    }
    round.status = 'revealed'
  }

  public revealVotes(roomId: string): Room | null {
    const room = this.rooms.get(roomId)
    if (!room || room.currentRoundIndex === -1) return null

    const round = room.rounds[room.currentRoundIndex]
    this.sealRound(room, round)

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
