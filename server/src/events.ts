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

export function setupSocketEvents(io: Server, roomManager: RoomManager) {
  io.on('connection', (socket: Socket) => {
    console.log(`⚡ Player Connected: ${socket.id}`)

    // Track which room/player this socket is authenticated as.
    // Set only after a successful join_room — the single source of truth
    // for authorization (never trust ids coming from the payload).
    let currentRoomId: string | null = null
    let currentPlayerId: string | null = null

    const notifyRoomUpdate = (roomId: string) => {
      const room = roomManager.getRoom(roomId)
      if (room) {
        // Broadcast full state to everyone in the room
        io.to(roomId).emit('room_state_updated', room)
      }
    }

    // Authorizes admin-only actions: the socket must be joined to the room
    // AND be its admin. Returns the room when allowed, otherwise null.
    const requireAdmin = (roomId: string) => {
      const room = roomManager.getRoom(roomId)
      if (!room) return null
      if (currentRoomId !== roomId || currentPlayerId !== room.adminId) {
        console.warn(`⛔ Admin action denied on ${roomId} by socket ${socket.id}`)
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
      const { roomId, player, config } = parsed.data

      let room = roomManager.getRoom(roomId)

      if (!room) {
        if (!config) {
          // Room does not exist and no config provided
          callback?.({ error: 'Sala não encontrada' })
          return
        }
        // Create new room — the creator is always the admin
        room = roomManager.createRoom(roomId, { ...player, role: 'admin' }, config)
        console.log(`🏰 Room Created: ${roomId}`)
      } else {
        // Joining an existing room. Role resolution here is intentional and final:
        //  - the room's admin (e.g. returning after a refresh) always keeps 'admin';
        //    the creator-admin cannot self-downgrade to observer on rejoin, by design
        //    (admin transfer belongs to the room-lifecycle work, not this layer);
        //  - anyone else claiming 'admin' is downgraded to 'member';
        //  - other roles (member/observer) are preserved as sent.
        const role =
          player.id === room.adminId ? 'admin' : player.role === 'admin' ? 'member' : player.role
        roomManager.joinRoom(roomId, { ...player, role })
        console.log(`🙌 Player ${player.name} joined ${roomId}`)
      }

      // Bind the socket identity only after a valid join
      currentRoomId = roomId
      currentPlayerId = player.id
      socket.join(roomId)

      notifyRoomUpdate(roomId)
      callback?.({ success: true, room })
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

    // VOTING — identity comes from the socket, never from the payload
    socket.on('cast_vote', (data: unknown) => {
      const parsed = castVoteSchema.safeParse(data)
      if (!parsed.success) return
      if (!currentPlayerId || currentRoomId !== parsed.data.roomId) return

      const room = roomManager.getRoom(parsed.data.roomId)
      if (!room) return
      // Reject votes that don't belong to the room's deck
      if (!isValidVoteForDeck(room.config.deckType, parsed.data.value)) return

      const updated = roomManager.castVote(parsed.data.roomId, currentPlayerId, parsed.data.value)
      if (updated) notifyRoomUpdate(parsed.data.roomId)
    })

    socket.on('reveal_votes', (data: unknown) => {
      const parsed = roomActionSchema.safeParse(data)
      if (!parsed.success || !requireAdmin(parsed.data.roomId)) return
      const room = roomManager.revealVotes(parsed.data.roomId)
      if (room) notifyRoomUpdate(parsed.data.roomId)
    })

    // DISCONNECT
    socket.on('disconnect', () => {
      console.log(`🔌 Player Disconnected: ${socket.id}`)
      if (currentRoomId && currentPlayerId) {
        // In a real app we might want to delay removal (reconnection grace period)
        // Here we just remove them immediately
        roomManager.leaveRoom(currentRoomId, currentPlayerId)
        notifyRoomUpdate(currentRoomId)
      }
    })
  })
}
