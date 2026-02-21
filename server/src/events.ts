import { Server, Socket } from 'socket.io'
import { RoomManager } from './roomManager'
import { Player, RoomConfig } from './types'

export function setupSocketEvents(io: Server, roomManager: RoomManager) {
  io.on('connection', (socket: Socket) => {
    console.log(`⚡ Player Connected: ${socket.id}`)

    // Track which room this socket is attached to
    let currentRoomId: string | null = null
    let currentPlayerId: string | null = null

    const notifyRoomUpdate = (roomId: string) => {
      const room = roomManager.getRoom(roomId)
      if (room) {
        // Broadcast full state to everyone in the room
        io.to(roomId).emit('room_state_updated', room)
      }
    }

    // CREATE OR JOIN ROOM
    socket.on(
      'join_room',
      (data: { roomId: string; player: Player; config?: RoomConfig }, callback) => {
        const { roomId, player, config } = data

        currentRoomId = roomId
        currentPlayerId = player.id
        socket.join(roomId)

        let room = roomManager.getRoom(roomId)

        if (!room) {
          if (!config) {
            // Room does not exist and no config provided
            return callback({ error: 'Sala não encontrada' })
          }
          // Create new room (we assume first joiner is admin)
          room = roomManager.createRoom(roomId, player, config)
          console.log(`🏰 Room Created: ${roomId}`)
        } else {
          // Join existing
          roomManager.joinRoom(roomId, player)
          console.log(`🙌 Player ${player.name} joined ${roomId}`)
        }

        // Notify everyone
        notifyRoomUpdate(roomId)

        // Acknowledgment callback for the client that joined
        callback({ success: true, room })
      },
    )

    // ROUND MANAGEMENT
    socket.on('start_round', (data: { roomId: string; subject: string }) => {
      const room = roomManager.startRound(data.roomId, data.subject)
      if (room) notifyRoomUpdate(data.roomId)
    })

    socket.on('cast_vote', (data: { roomId: string; playerId: string; value: string | number }) => {
      const room = roomManager.castVote(data.roomId, data.playerId, data.value)
      if (room) notifyRoomUpdate(data.roomId)
    })

    socket.on('reveal_votes', (data: { roomId: string }) => {
      const room = roomManager.revealVotes(data.roomId)
      if (room) notifyRoomUpdate(data.roomId)
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
