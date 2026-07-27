import { Server, Socket, DefaultEventsMap } from 'socket.io'
import { RoomManager } from './roomManager'
import {
  joinRoomSchema,
  roomActionSchema,
  addSubjectsSchema,
  removeSubjectSchema,
  castVoteSchema,
  setRoundVoterSchema,
  isValidVoteForDeck,
} from './validation'
import { logger } from './logger'
import type { AckErrorCode } from './errorCodes'
import type { RoomBroadcast, SocketData } from './types'

// Server/Socket typed with SocketData so the authenticated identity lives on
// `socket.data` (idiomatic Socket.IO), fully typed — no `any`, no closures.
export type AppServer = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>
type AppSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>

// Rejects an ack with a stable error code (see ./errorCodes for the wire contract).
// No-op when the emitter is fire-and-forget (didn't pass a callback).
const fail = (callback: ((res: unknown) => void) | undefined, code: AckErrorCode) =>
  callback?.({ error: code })

export function setupSocketEvents(io: AppServer, roomManager: RoomManager) {
  // How long a disconnected player is kept before removal, so a page refresh or
  // brief network blip doesn't drop them (and possibly destroy the room).
  // Configurable via env (tests use a short window). A non-negative finite value
  // — including 0 — is honored; anything else (unset, empty, non-numeric or
  // negative) falls back to the default. Note `Number('') === 0`, so an empty
  // string is treated as "unset" rather than "no grace".
  const graceFromEnv = process.env.RECONNECT_GRACE_MS
  const parsedGrace = graceFromEnv ? Number(graceFromEnv) : NaN
  const RECONNECT_GRACE_MS = Number.isFinite(parsedGrace) && parsedGrace >= 0 ? parsedGrace : 30_000

  // Shared across all connections (setupSocketEvents runs once): pending removal
  // timers and the set of live socket ids per (room, player) for reconnection.
  const leaveTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const activeSockets = new Map<string, Set<string>>()
  const presenceKey = (roomId: string, playerId: string) => `${roomId}::${playerId}`

  // Feed the RoomManager's autoReveal quorum: a player counts while they have a
  // live socket OR are within the reconnect grace window. A rehydration ghost has
  // neither (no socket ever existed in this process, no grace timer), so it is
  // excluded from the quorum; a refreshing player is in grace and still counts.
  const isPresent = (roomId: string, playerId: string): boolean => {
    const key = presenceKey(roomId, playerId)
    return activeSockets.has(key) || leaveTimers.has(key)
  }
  roomManager.setPresence({ isPresent })

  // The ONE place room state reaches clients (11 call sites, and the only `.emit` of
  // room state in this file), which is why the presence projection belongs here and
  // nowhere else.
  //
  // The spread is load-bearing, not style: it builds a NEW object per broadcast, so
  // `absentPlayerIds` never lands on the stored room and can never reach saveRoom.
  // Assigning the field onto `room` instead would persist process-local state and
  // rehydrate it as fact after the next restart. Shallow is fine — everything read
  // here is read-only.
  //
  // Note the join_room ack also carries `room` (the stored one, without this field).
  // Harmless today: this broadcast is emitted immediately BEFORE that ack and the
  // client takes room state only from here — the ack is read for `error`/`token`
  // only. If the client ever starts syncing from the ack, it has to use this shape.
  const notifyRoomUpdate = (roomId: string) => {
    const room = roomManager.getRoom(roomId)
    if (room) {
      const absentPlayerIds = room.players
        .filter((player) => !isPresent(roomId, player.id))
        .map((player) => player.id)
      const broadcast: RoomBroadcast = { ...room, absentPlayerIds }
      io.to(roomId).emit('room_state_updated', broadcast)
    }
  }

  // Marks a (room, player) present on this socket and cancels any pending removal.
  const markPresent = (roomId: string, playerId: string, socketId: string) => {
    const key = presenceKey(roomId, playerId)
    let sockets = activeSockets.get(key)
    if (!sockets) {
      sockets = new Set()
      activeSockets.set(key, sockets)
    }
    sockets.add(socketId)
    const timer = leaveTimers.get(key)
    if (timer) {
      clearTimeout(timer)
      leaveTimers.delete(key)
    }
  }

  // Drops a socket from a (room, player); if none remain, schedules removal after
  // the grace period (re-checking presence when the timer fires).
  const markAbsent = (roomId: string, playerId: string, socketId: string) => {
    const key = presenceKey(roomId, playerId)
    const sockets = activeSockets.get(key)
    // Only a socket tracked as live presence can trigger a removal. If this
    // identity has no presence entry — e.g. a stale sibling disconnecting after
    // an identity-wide leave_room already cleared it — there is nothing to
    // schedule; doing so would also overwrite (and orphan) any grace timer
    // already pending for this key, leaking it past dispose().
    if (!sockets?.has(socketId)) return
    sockets.delete(socketId)
    if (sockets.size > 0) return // still connected on another socket
    activeSockets.delete(key)

    const timer = setTimeout(() => {
      leaveTimers.delete(key)
      if (activeSockets.has(key)) return // reconnected during the grace period
      roomManager.leaveRoom(roomId, playerId)
      notifyRoomUpdate(roomId)
    }, RECONNECT_GRACE_MS)
    leaveTimers.set(key, timer)
  }

  io.on('connection', (socket: AppSocket) => {
    logger.debug(`⚡ Player Connected: ${socket.id}`)

    // Authenticated identity lives on socket.data — set only after a successful
    // join_room (the single source of truth for authorization; ids from payloads
    // are never trusted). Initialized to null so runtime matches the SocketData type.
    socket.data.roomId = null
    socket.data.playerId = null

    // Authorizes admin-only actions: the socket must be joined to the room
    // AND be its admin. Returns the room when allowed, otherwise null.
    const requireAdmin = (roomId: string) => {
      const room = roomManager.getRoom(roomId)
      if (!room) return null
      if (socket.data.roomId !== roomId || socket.data.playerId !== room.adminId) {
        logger.warn(`⛔ Admin action denied on ${roomId} by socket ${socket.id}`)
        return null
      }
      return room
    }

    // CREATE OR JOIN ROOM
    socket.on('join_room', (data: unknown, callback?: (res: unknown) => void) => {
      const parsed = joinRoomSchema.safeParse(data)
      if (!parsed.success) {
        fail(callback, 'invalid_payload')
        return
      }
      const { roomId, player, config, token } = parsed.data

      let room = roomManager.getRoom(roomId)

      if (!room) {
        if (!config) {
          // Room does not exist and no config provided
          fail(callback, 'room_not_found')
          return
        }
        // Create new room — the creator is always the admin
        room = roomManager.createRoom(roomId, { ...player, role: 'admin' }, config)
        logger.debug(`🏰 Room Created: ${roomId}`)
      } else {
        // Existing room: a returning identity must prove ownership. If this
        // player.id already holds a session token, the join MUST carry the
        // matching one — otherwise it's someone claiming an identity that isn't
        // theirs (e.g. setting player.id = adminId to escalate to admin).
        // First-time joiners (no token yet) pass and get one minted below.
        if (
          roomManager.hasToken(roomId, player.id) &&
          !roomManager.verifyToken(roomId, player.id, token)
        ) {
          logger.warn(`⛔ Join denied on ${roomId}: invalid session token for ${player.id}`)
          fail(callback, 'invalid_session')
          return
        }
        // Joining an existing room. Role resolution here is intentional and final:
        //  - the room's admin (e.g. returning after a refresh) always keeps 'admin';
        //    the creator-admin cannot self-downgrade to observer on rejoin, by design
        //    (admin transfer belongs to the room-lifecycle work, not this layer);
        //  - anyone else claiming 'admin' is downgraded to 'member';
        //  - other roles (member/observer) are preserved as sent.
        const role =
          player.id === room.adminId ? 'admin' : player.role === 'admin' ? 'member' : player.role
        roomManager.joinRoom(roomId, { ...player, role })
        logger.debug(`🙌 Player ${player.name} joined ${roomId}`)
      }

      // Bind the socket identity only after a valid join
      socket.data.roomId = roomId
      socket.data.playerId = player.id
      socket.join(roomId)
      markPresent(roomId, player.id, socket.id)

      // Mint (or reuse) the session secret and hand it back ONLY to this socket
      // via the ack. It is intentionally absent from the room broadcast below.
      const sessionToken = roomManager.getOrCreateToken(roomId, player.id)

      notifyRoomUpdate(roomId)
      callback?.({ success: true, room, token: sessionToken })
    })

    // SUBJECT BACKLOG MANAGEMENT (setup phase) — admin only
    socket.on('add_subjects', (data: unknown) => {
      const parsed = addSubjectsSchema.safeParse(data)
      if (!parsed.success || !requireAdmin(parsed.data.roomId)) return
      const room = roomManager.addSubjects(parsed.data.roomId, parsed.data.subjects)
      if (room) notifyRoomUpdate(parsed.data.roomId)
    })

    socket.on('remove_subject', (data: unknown) => {
      const parsed = removeSubjectSchema.safeParse(data)
      if (!parsed.success || !requireAdmin(parsed.data.roomId)) return
      const room = roomManager.removeSubject(parsed.data.roomId, parsed.data.index)
      if (room) notifyRoomUpdate(parsed.data.roomId)
    })

    // SESSION FLOW — admin only
    socket.on('start_session', (data: unknown) => {
      const parsed = roomActionSchema.safeParse(data)
      if (!parsed.success || !requireAdmin(parsed.data.roomId)) return
      const room = roomManager.startSession(parsed.data.roomId)
      if (room) notifyRoomUpdate(parsed.data.roomId)
    })

    socket.on('next_round', (data: unknown) => {
      const parsed = roomActionSchema.safeParse(data)
      if (!parsed.success || !requireAdmin(parsed.data.roomId)) return
      const room = roomManager.nextRound(parsed.data.roomId)
      if (room) notifyRoomUpdate(parsed.data.roomId)
    })

    socket.on('reset_session', (data: unknown) => {
      const parsed = roomActionSchema.safeParse(data)
      if (!parsed.success || !requireAdmin(parsed.data.roomId)) return
      const room = roomManager.resetSession(parsed.data.roomId)
      if (room) notifyRoomUpdate(parsed.data.roomId)
    })

    // VOTING — identity comes from the socket, never from the payload.
    // The ack callback is optional (fire-and-forget emitters still work) and lets
    // the client reconcile its optimistic vote when the server refuses it.
    socket.on('cast_vote', (data: unknown, callback?: (res: unknown) => void) => {
      const parsed = castVoteSchema.safeParse(data)
      if (!parsed.success) {
        fail(callback, 'invalid_vote')
        return
      }
      const { roomId, playerId } = socket.data
      if (!playerId || roomId !== parsed.data.roomId) {
        fail(callback, 'not_authorized')
        return
      }

      const room = roomManager.getRoom(roomId)
      if (!room) {
        fail(callback, 'room_not_found')
        return
      }
      // Reject votes that don't belong to the room's deck
      if (!isValidVoteForDeck(room.config.deckType, parsed.data.value)) {
        fail(callback, 'invalid_vote_for_deck')
        return
      }

      const updated = roomManager.castVote(roomId, playerId, parsed.data.value)
      if (updated) {
        notifyRoomUpdate(roomId)
        callback?.({ ok: true })
      } else {
        // observer, excluído da rodada pelo admin, ou rodada fora da votação
        fail(callback, 'vote_not_registered')
      }
    })

    // Quem vota NESTA rodada — admin only. Sem ack, como as demais ações de
    // admin: o estado novo volta pelo room_state_updated.
    socket.on('set_round_voter', (data: unknown) => {
      const parsed = setRoundVoterSchema.safeParse(data)
      if (!parsed.success || !requireAdmin(parsed.data.roomId)) return
      const room = roomManager.setRoundVoter(
        parsed.data.roomId,
        parsed.data.playerId,
        parsed.data.voting,
      )
      if (room) notifyRoomUpdate(parsed.data.roomId)
    })

    socket.on('reveal_votes', (data: unknown) => {
      const parsed = roomActionSchema.safeParse(data)
      if (!parsed.success || !requireAdmin(parsed.data.roomId)) return
      const room = roomManager.revealVotes(parsed.data.roomId)
      if (room) notifyRoomUpdate(parsed.data.roomId)
    })

    // LEAVE ROOM — explicit exit (the client's "Sair da Sala"), as opposed to the
    // disconnect below. Removes the player IMMEDIATELY: no grace period, so the
    // others see them go on the spot, an admin hand-off isn't delayed, and the
    // session token is dropped right away (inside roomManager.leaveRoom) — the
    // same identity can rejoin from scratch without tripping the token check.
    socket.on('leave_room', (data: unknown, callback?: (res: unknown) => void) => {
      const parsed = roomActionSchema.safeParse(data)
      if (!parsed.success) {
        fail(callback, 'invalid_payload')
        return
      }
      const { roomId, playerId } = socket.data
      if (!playerId || roomId !== parsed.data.roomId) {
        fail(callback, 'not_authorized')
        return
      }

      const key = presenceKey(roomId, playerId)

      // Stale-sibling guard: only a socket that STILL holds this identity's
      // presence may remove the player. If a sibling tab already left (clearing
      // presence) and the identity may have rejoined on a fresh socket, this
      // socket's id is no longer in the presence set — so its now-stale leave must
      // NOT evict the rejoined player. Drop our dangling identity and ack ok (the
      // leave already effectively happened via the sibling).
      if (!activeSockets.get(key)?.has(socket.id)) {
        socket.data.roomId = null
        socket.data.playerId = null
        callback?.({ ok: true })
        return
      }

      // Leaving is IDENTITY-WIDE: unsubscribe every live socket of this player
      // (this one and any sibling tab) from the Socket.IO room, so no tab keeps
      // receiving room_state_updated for a room the identity already left. Then
      // forget presence and pending grace timers: the player is gone NOW, so
      // the disconnect that follows must not schedule (or keep) a removal for
      // someone already removed.
      for (const sid of activeSockets.get(key) ?? []) {
        io.sockets.sockets.get(sid)?.leave(roomId)
      }
      activeSockets.delete(key)
      const timer = leaveTimers.get(key)
      if (timer) {
        clearTimeout(timer)
        leaveTimers.delete(key)
      }
      socket.data.roomId = null
      socket.data.playerId = null

      roomManager.leaveRoom(roomId, playerId)
      logger.debug(`👋 Player ${playerId} left ${roomId}`)
      notifyRoomUpdate(roomId)
      callback?.({ ok: true })
    })

    // DISCONNECT — don't remove immediately; allow a grace period for reconnection
    // (e.g. a page refresh). Removal is scheduled only if no socket comes back.
    socket.on('disconnect', () => {
      logger.debug(`🔌 Player Disconnected: ${socket.id}`)
      const { roomId, playerId } = socket.data
      if (roomId && playerId) {
        markAbsent(roomId, playerId, socket.id)
      }
    })
  })

  // Cancels every pending grace timer. Returned so a graceful shutdown (and the
  // test teardown) can stop scheduled removals from firing after the server is
  // gone, instead of leaking timers past the process/server lifetime.
  return () => {
    for (const timer of leaveTimers.values()) clearTimeout(timer)
    leaveTimers.clear()
    activeSockets.clear()
  }
}
