import { Room, Player, RoomConfig, Round } from './types'

export class RoomManager {
  private rooms: Map<string, Room> = new Map()

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  public createRoom(roomId: string, adminPlayer: Player, config: RoomConfig): Room {
    const newRoom: Room = {
      id: roomId,
      adminId: adminPlayer.id,
      config,
      players: [adminPlayer],
      rounds: [],
      currentRoundIndex: -1,
    }
    this.rooms.set(roomId, newRoom)
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

    return room
  }

  public leaveRoom(roomId: string, playerId: string): Room | null {
    const room = this.rooms.get(roomId)
    if (!room) return null

    room.players = room.players.filter((p) => p.id !== playerId)

    // If room becomes empty, consider destroying it (optional cleanup)
    if (room.players.length === 0) {
      this.rooms.delete(roomId)
      return null
    }

    return room
  }

  public startRound(roomId: string, subject: string): Room | null {
    const room = this.rooms.get(roomId)
    if (!room) return null

    const newRound: Round = {
      id: crypto.randomUUID(),
      subject,
      status: 'voting',
      votes: {},
    }

    room.rounds.push(newRound)
    room.currentRoundIndex = room.rounds.length - 1

    return room
  }

  public castVote(roomId: string, playerId: string, value: string | number): Room | null {
    const room = this.rooms.get(roomId)
    if (!room || room.currentRoundIndex === -1) return null

    const round = room.rounds[room.currentRoundIndex]
    if (round.status !== 'voting') return null

    round.votes[playerId] = value

    // Check autoReveal if everyone has voted
    if (room.config.autoReveal) {
      const activePlayers = room.players.filter((p) => p.role !== 'observer')
      const allVoted = activePlayers.every((p) => round.votes[p.id] !== undefined)
      if (allVoted) {
        round.status = 'revealed'
      }
    }

    return room
  }

  public revealVotes(roomId: string): Room | null {
    const room = this.rooms.get(roomId)
    if (!room || room.currentRoundIndex === -1) return null

    const round = room.rounds[room.currentRoundIndex]
    round.status = 'revealed'

    return room
  }
}
