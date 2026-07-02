import { Server, Socket } from 'socket.io'
import { RoomManager } from './roomManager'
import {
  joinRoomSchema,
  roomActionSchema,
  addSubjectsSchema,
  removeSubjectSchema,
  castVoteSchema,
  isValidVoteForDeck,
} from './validation'
import { logger } from './logger'

export function setupSocketEvents(io: Server, roomManager: RoomManager) {
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

  const notifyRoomUpdate = (roomId: string) => {
    const room = roomManager.getRoom(roomId)
    if (room) {
      // Broadcast full state to everyone in the room
      io.to(roomId).emit('room_state_updated', room)
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
    if (sockets) {
      sockets.delete(socketId)
      if (sockets.size > 0) return // still connected on another socket
      activeSockets.delete(key)
    }
    const timer = setTimeout(() => {
      leaveTimers.delete(key)
      if (activeSockets.has(key)) return // reconnected during the grace period
      roomManager.leaveRoom(roomId, playerId)
      notifyRoomUpdate(roomId)
    }, RECONNECT_GRACE_MS)
    leaveTimers.set(key, timer)
  }

  io.on('connection', (socket: Socket) => {
    logger.debug(`⚡ Player Connected: ${socket.id}`)

    // Track which room/player this socket is authenticated as.
    // Set only after a successful join_room — the single source of truth
    // for authorization (never trust ids coming from the payload).
    let currentRoomId: string | null = null
    let currentPlayerId: string | null = null

    // Authorizes admin-only actions: the socket must be joined to the room
    // AND be its admin. Returns the room when allowed, otherwise null.
    const requireAdmin = (roomId: string) => {
      const room = roomManager.getRoom(roomId)
      if (!room) return null
      if (currentRoomId !== roomId || currentPlayerId !== room.adminId) {
        logger.warn(`⛔ Admin action denied on ${roomId} by socket ${socket.id}`)
        return null
      }
      return room
    }

    // CREATE OR JOIN ROOM
    socket.on('join_room', (data: unknown, callback?: (res: unknown) => void) => {
      const parsed = joinRoomSchema.safeParse(data)
      if (!parsed.success) {
        callback?.({ error: 'Dados de entrada inválidos' })
        return
      }
      const { roomId, player, config, token } = parsed.data

      let room = roomManager.getRoom(roomId)

      if (!room) {
        if (!config) {
          // Room does not exist and no config provided
          callback?.({ error: 'Sala não encontrada' })
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
          callback?.({ error: 'Sessão inválida' })
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
      currentRoomId = roomId
      currentPlayerId = player.id
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
        callback?.({ error: 'Voto inválido' })
        return
      }
      if (!currentPlayerId || currentRoomId !== parsed.data.roomId) {
        callback?.({ error: 'Não autorizado' })
        return
      }

      const room = roomManager.getRoom(parsed.data.roomId)
      if (!room) {
        callback?.({ error: 'Sala não encontrada' })
        return
      }
      // Reject votes that don't belong to the room's deck
      if (!isValidVoteForDeck(room.config.deckType, parsed.data.value)) {
        callback?.({ error: 'Voto inválido para o baralho' })
        return
      }

      const updated = roomManager.castVote(parsed.data.roomId, currentPlayerId, parsed.data.value)
      if (updated) {
        notifyRoomUpdate(parsed.data.roomId)
        callback?.({ ok: true })
      } else {
        // observer, ou rodada fora da fase de votação
        callback?.({ error: 'Voto não registrado' })
      }
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
        callback?.({ error: 'Dados de entrada inválidos' })
        return
      }
      if (!currentPlayerId || currentRoomId !== parsed.data.roomId) {
        callback?.({ error: 'Não autorizado' })
        return
      }
      const { roomId } = parsed.data
      const playerId = currentPlayerId

      // Leaving is IDENTITY-WIDE: unsubscribe every live socket of this player
      // (this one and any sibling tab) from the Socket.IO room, so no tab keeps
      // receiving room_state_updated for a room the identity already left. Then
      // forget presence and pending grace timers: the player is gone NOW, so
      // the disconnect that follows must not schedule (or keep) a removal for
      // someone already removed.
      const key = presenceKey(roomId, playerId)
      for (const sid of activeSockets.get(key) ?? []) {
        io.sockets.sockets.get(sid)?.leave(roomId)
      }
      activeSockets.delete(key)
      const timer = leaveTimers.get(key)
      if (timer) {
        clearTimeout(timer)
        leaveTimers.delete(key)
      }
      currentRoomId = null
      currentPlayerId = null

      roomManager.leaveRoom(roomId, playerId)
      logger.debug(`👋 Player ${playerId} left ${roomId}`)
      notifyRoomUpdate(roomId)
      callback?.({ ok: true })
    })

    // DISCONNECT — don't remove immediately; allow a grace period for reconnection
    // (e.g. a page refresh). Removal is scheduled only if no socket comes back.
    socket.on('disconnect', () => {
      logger.debug(`🔌 Player Disconnected: ${socket.id}`)
      if (currentRoomId && currentPlayerId) {
        markAbsent(currentRoomId, currentPlayerId, socket.id)
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
