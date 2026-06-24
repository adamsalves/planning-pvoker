import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { createServer, type Server as HttpServer } from 'http'
import { Server } from 'socket.io'
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client'
import { RoomManager } from '../src/roomManager'
import { setupSocketEvents } from '../src/events'
import type { Room, RoomConfig } from '../src/types'

// Short grace window so reconnection tests don't wait the real 30s.
const GRACE_MS = 120

type JoinAck = { success?: boolean; error?: string; room?: Room }

const config: RoomConfig = { deckType: 'fibonacci', autoReveal: false }
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

let httpServer: HttpServer
let port: number
let clients: ClientSocket[]

beforeAll(() => {
  process.env.RECONNECT_GRACE_MS = String(GRACE_MS)
})

beforeEach(async () => {
  clients = []
  httpServer = createServer()
  const io = new Server(httpServer)
  setupSocketEvents(io, new RoomManager())
  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  const address = httpServer.address()
  port = typeof address === 'object' && address ? address.port : 0
})

afterEach(async () => {
  for (const client of clients) client.close()
  await new Promise<void>((resolve) => httpServer.close(() => resolve()))
})

function connect(): Promise<ClientSocket> {
  const socket = ioClient(`http://localhost:${port}`, {
    forceNew: true,
    transports: ['websocket'],
  })
  clients.push(socket)
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket))
    socket.on('connect_error', reject)
  })
}

function join(socket: ClientSocket, data: unknown): Promise<JoinAck> {
  return new Promise((resolve) => {
    socket.emit('join_room', data, (ack: JoinAck) => resolve(ack))
  })
}

function waitForRoomWhere(socket: ClientSocket, predicate: (room: Room) => boolean): Promise<Room> {
  return new Promise((resolve) => {
    const handler = (room: Room) => {
      if (predicate(room)) {
        socket.off('room_state_updated', handler)
        resolve(room)
      }
    }
    socket.on('room_state_updated', handler)
  })
}

describe('join_room', () => {
  it('creates a room with the creator as admin', async () => {
    const client = await connect()
    const ack = await join(client, {
      roomId: 'r1',
      player: { id: 'a1', name: 'Ana', role: 'admin' },
      config,
    })
    expect(ack.success).toBe(true)
    expect(ack.room?.adminId).toBe('a1')
  })

  it('rejects an invalid payload', async () => {
    const client = await connect()
    const ack = await join(client, { roomId: '', player: { id: '', name: '', role: 'admin' } })
    expect(ack.error).toBeDefined()
    expect(ack.success).toBeUndefined()
  })

  it('downgrades a member who claims the admin role on an existing room', async () => {
    const adminClient = await connect()
    await join(adminClient, {
      roomId: 'r1',
      player: { id: 'a1', name: 'Ana', role: 'admin' },
      config,
    })
    const sneaky = await connect()
    const ack = await join(sneaky, {
      roomId: 'r1',
      player: { id: 'm1', name: 'Mallory', role: 'admin' },
    })
    expect(ack.room?.adminId).toBe('a1')
    expect(ack.room?.players.find((p) => p.id === 'm1')?.role).toBe('member')
  })
})

describe('authorization (requireAdmin)', () => {
  it('ignores start_session from a non-admin but allows it from the admin', async () => {
    const adminClient = await connect()
    await join(adminClient, {
      roomId: 'r1',
      player: { id: 'a1', name: 'Ana', role: 'admin' },
      config,
    })
    const memberClient = await connect()
    await join(memberClient, { roomId: 'r1', player: { id: 'm1', name: 'Bob', role: 'member' } })

    adminClient.emit('add_subjects', { roomId: 'r1', subjects: ['A'] })
    await delay(40)

    // Non-admin attempt: must be ignored
    memberClient.emit('start_session', { roomId: 'r1' })
    await delay(40)
    const stillSetup = await join(adminClient, {
      roomId: 'r1',
      player: { id: 'a1', name: 'Ana', role: 'admin' },
    })
    expect(stillSetup.room?.phase).toBe('setup')

    // Admin attempt: must work
    const started = waitForRoomWhere(memberClient, (room) => room.phase === 'voting')
    adminClient.emit('start_session', { roomId: 'r1' })
    const room = await started
    expect(room.phase).toBe('voting')
  })
})

describe('cast_vote', () => {
  async function startVotingRoom() {
    const adminClient = await connect()
    await join(adminClient, {
      roomId: 'r1',
      player: { id: 'a1', name: 'Ana', role: 'admin' },
      config,
    })
    const memberClient = await connect()
    await join(memberClient, { roomId: 'r1', player: { id: 'm1', name: 'Bob', role: 'member' } })
    adminClient.emit('add_subjects', { roomId: 'r1', subjects: ['A'] })
    await delay(40)
    adminClient.emit('start_session', { roomId: 'r1' })
    await delay(40)
    return { adminClient, memberClient }
  }

  it('attributes the vote to the socket identity and ignores a spoofed playerId', async () => {
    const { memberClient } = await startVotingRoom()
    const voted = waitForRoomWhere(
      memberClient,
      (room) => Object.keys(room.rounds[0]?.votes ?? {}).length > 0,
    )
    // Member spoofs playerId = admin; server must attribute the vote to m1.
    memberClient.emit('cast_vote', { roomId: 'r1', playerId: 'a1', value: 5 })
    const room = await voted
    expect(room.rounds[0].votes['m1']).toBe(5)
    expect(room.rounds[0].votes['a1']).toBeUndefined()
  })

  it('rejects a vote that is not in the room deck', async () => {
    const { adminClient, memberClient } = await startVotingRoom()
    memberClient.emit('cast_vote', { roomId: 'r1', value: 999 })
    await delay(60)
    const ack = await join(adminClient, {
      roomId: 'r1',
      player: { id: 'a1', name: 'Ana', role: 'admin' },
    })
    expect(Object.keys(ack.room?.rounds[0].votes ?? {})).toHaveLength(0)
  })
})

describe('reconnection grace period & admin transfer', () => {
  it('removes a disconnected player only after the grace window', async () => {
    const adminClient = await connect()
    await join(adminClient, {
      roomId: 'r1',
      player: { id: 'a1', name: 'Ana', role: 'admin' },
      config,
    })
    const memberClient = await connect()
    await join(memberClient, { roomId: 'r1', player: { id: 'm1', name: 'Bob', role: 'member' } })

    const removed = waitForRoomWhere(adminClient, (room) => room.players.length === 1)
    memberClient.close()
    const room = await removed
    expect(room.players.map((p) => p.id)).toEqual(['a1'])
  })

  it('cancels removal when the player reconnects within the grace window', async () => {
    const adminClient = await connect()
    await join(adminClient, {
      roomId: 'r1',
      player: { id: 'a1', name: 'Ana', role: 'admin' },
      config,
    })
    const memberClient = await connect()
    await join(memberClient, { roomId: 'r1', player: { id: 'm1', name: 'Bob', role: 'member' } })

    memberClient.close()
    const reconnected = await connect()
    await join(reconnected, { roomId: 'r1', player: { id: 'm1', name: 'Bob', role: 'member' } })

    await delay(GRACE_MS + 80)
    const ack = await join(adminClient, {
      roomId: 'r1',
      player: { id: 'a1', name: 'Ana', role: 'admin' },
    })
    expect(
      ack.room?.players
        .map((p) => p.id)
        .slice()
        .sort(),
    ).toEqual(['a1', 'm1'])
  })

  it('transfers admin to the next player after the admin disconnects', async () => {
    const adminClient = await connect()
    await join(adminClient, {
      roomId: 'r1',
      player: { id: 'a1', name: 'Ana', role: 'admin' },
      config,
    })
    const memberClient = await connect()
    await join(memberClient, { roomId: 'r1', player: { id: 'm1', name: 'Bob', role: 'member' } })

    const transferred = waitForRoomWhere(memberClient, (room) => room.adminId === 'm1')
    adminClient.close()
    const room = await transferred
    expect(room.adminId).toBe('m1')
    expect(room.players.find((p) => p.id === 'm1')?.role).toBe('admin')
  })
})
