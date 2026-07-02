import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { createServer, type Server as HttpServer } from 'http'
import { Server } from 'socket.io'
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client'
import { RoomManager } from '../src/roomManager'
import { setupSocketEvents } from '../src/events'
import type { Player, Room, RoomConfig } from '../src/types'

// Short grace window so reconnection tests don't wait the real 30s. Kept
// comfortably above local round-trip latency (plus a margin) so the
// "reconnect within the window" cases aren't racy on slower CI.
const GRACE_MS = 250
const MARGIN_MS = 120

const config: RoomConfig = { deckType: 'fibonacci', autoReveal: false }
const admin: Player = { id: 'a1', name: 'Ana', role: 'admin' }
const member: Player = { id: 'm1', name: 'Bob', role: 'member' }

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

type JoinAck = { success?: boolean; error?: string; room?: Room; token?: string }

let httpServer: HttpServer
let io: Server
let dispose: () => void
let port: number
let clients: ClientSocket[]

beforeAll(() => {
  process.env.RECONNECT_GRACE_MS = String(GRACE_MS)
})

beforeEach(async () => {
  clients = []
  httpServer = createServer()
  io = new Server(httpServer)
  dispose = setupSocketEvents(io, new RoomManager())
  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  const address = httpServer.address()
  port = typeof address === 'object' && address ? address.port : 0
})

afterEach(async () => {
  // Close clients first (disabling client-side reconnection), then close the
  // server so every 'disconnect' handler runs, then clear any grace timers
  // those disconnects scheduled — otherwise a timer could fire against an
  // already-closed server and leak past the test.
  for (const client of clients) client.close()
  await new Promise<void>((resolve) => io.close(() => resolve()))
  dispose()
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

type VoteAck = { ok?: boolean; error?: string }
function castVote(socket: ClientSocket, data: unknown): Promise<VoteAck> {
  return new Promise((resolve) => {
    socket.emit('cast_vote', data, (ack: VoteAck) => resolve(ack))
  })
}

type LeaveAck = { ok?: boolean; error?: string }
function leaveRoom(socket: ClientSocket, data: unknown): Promise<LeaveAck> {
  return new Promise((resolve) => {
    socket.emit('leave_room', data, (ack: LeaveAck) => resolve(ack))
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

// Narrows a join ack to its room without a non-null assertion (the project
// forbids `as`/`!`); throws with the offending ack if the room is missing.
function roomOf(ack: JoinAck): Room {
  if (!ack.room) throw new Error(`expected a room in ack, got ${JSON.stringify(ack)}`)
  return ack.room
}

// Same idea for the session token: a successful join always returns one, and
// rejoins must echo it back, so a missing token is a test-setup failure.
function tokenOf(ack: JoinAck): string {
  if (!ack.token) throw new Error(`expected a token in ack, got ${JSON.stringify(ack)}`)
  return ack.token
}

// Creates room r1 (admin a1) and joins member m1. Returns the per-player
// session tokens so callers can thread them through rejoins (once a player has
// a token, every later join for that id must present it).
async function adminAndMember() {
  const adminClient = await connect()
  const adminToken = tokenOf(await join(adminClient, { roomId: 'r1', player: admin, config }))
  const memberClient = await connect()
  const memberToken = tokenOf(await join(memberClient, { roomId: 'r1', player: member }))
  return { adminClient, memberClient, adminToken, memberToken }
}

// Drives r1 into the voting phase with a single subject ('A'). add_subjects and
// start_session are emitted on the same socket, so per-connection FIFO ordering
// guarantees the subject exists before the session starts — no delay needed.
async function startVotingRoom() {
  const { adminClient, memberClient, adminToken, memberToken } = await adminAndMember()
  const voting = waitForRoomWhere(adminClient, (room) => room.phase === 'voting')
  adminClient.emit('add_subjects', { roomId: 'r1', subjects: ['A'] })
  adminClient.emit('start_session', { roomId: 'r1' })
  await voting
  return { adminClient, memberClient, adminToken, memberToken }
}

describe('join_room', () => {
  it('creates a room with the creator as admin', async () => {
    const client = await connect()
    const ack = await join(client, { roomId: 'r1', player: admin, config })
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
    await join(adminClient, { roomId: 'r1', player: admin, config })
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
  it('lets the admin start the session', async () => {
    const { adminClient } = await adminAndMember()
    const voting = waitForRoomWhere(adminClient, (room) => room.phase === 'voting')
    adminClient.emit('add_subjects', { roomId: 'r1', subjects: ['A'] })
    adminClient.emit('start_session', { roomId: 'r1' })
    const room = await voting
    expect(room.phase).toBe('voting')
  })

  // Admin-only actions in the SETUP phase. The room is seeded with one subject
  // so each action would visibly change state if it ran; a non-admin emit must
  // leave phase=setup and subjects=['A']. State is read back via a re-join on
  // the SAME (member) socket, processed only after the ignored action (FIFO),
  // so no arbitrary delay is needed.
  const setupActions: Array<{ event: string; payload: Record<string, unknown> }> = [
    { event: 'add_subjects', payload: { roomId: 'r1', subjects: ['X'] } },
    { event: 'remove_subject', payload: { roomId: 'r1', index: 0 } },
    { event: 'start_session', payload: { roomId: 'r1' } },
    { event: 'reset_session', payload: { roomId: 'r1' } },
  ]
  for (const { event, payload } of setupActions) {
    it(`ignores ${event} from a non-admin (setup phase)`, async () => {
      const { adminClient, memberClient, memberToken } = await adminAndMember()
      const seeded = waitForRoomWhere(adminClient, (room) => room.subjects.length === 1)
      adminClient.emit('add_subjects', { roomId: 'r1', subjects: ['A'] })
      await seeded

      memberClient.emit(event, payload)
      const room = roomOf(
        await join(memberClient, { roomId: 'r1', player: member, token: memberToken }),
      )
      expect(room.phase).toBe('setup')
      expect(room.subjects).toEqual(['A'])
    })
  }

  // Admin-only actions in the VOTING phase: a non-admin emit must leave the
  // phase and the current round status untouched.
  const votingActions: Array<{ event: string; payload: Record<string, unknown> }> = [
    { event: 'reveal_votes', payload: { roomId: 'r1' } },
    { event: 'next_round', payload: { roomId: 'r1' } },
  ]
  for (const { event, payload } of votingActions) {
    it(`ignores ${event} from a non-admin (voting phase)`, async () => {
      const { memberClient, memberToken } = await startVotingRoom()
      memberClient.emit(event, payload)
      const room = roomOf(
        await join(memberClient, { roomId: 'r1', player: member, token: memberToken }),
      )
      expect(room.phase).toBe('voting')
      expect(room.rounds[room.currentRoundIndex].status).toBe('voting')
    })
  }
})

describe('cast_vote', () => {
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

  it('accepts a non-numeric deck value (coffee)', async () => {
    const { memberClient } = await startVotingRoom()
    const voted = waitForRoomWhere(
      memberClient,
      (room) => Object.keys(room.rounds[0]?.votes ?? {}).length > 0,
    )
    memberClient.emit('cast_vote', { roomId: 'r1', value: '☕' })
    const room = await voted
    expect(room.rounds[0].votes['m1']).toBe('☕')
  })

  it('rejects a vote that is not in the room deck', async () => {
    const { memberClient, memberToken } = await startVotingRoom()
    memberClient.emit('cast_vote', { roomId: 'r1', value: 999 })
    // FIFO: the re-join ack is handled after the (ignored) cast_vote.
    const room = roomOf(
      await join(memberClient, { roomId: 'r1', player: member, token: memberToken }),
    )
    expect(Object.keys(room.rounds[0].votes)).toHaveLength(0)
  })

  it('acks { ok: true } on a valid vote', async () => {
    const { memberClient } = await startVotingRoom()
    const ack = await castVote(memberClient, { roomId: 'r1', value: 5 })
    expect(ack.ok).toBe(true)
    expect(ack.error).toBeUndefined()
  })

  it('acks an error for a vote outside the deck (so the client can undo the optimistic vote)', async () => {
    const { memberClient } = await startVotingRoom()
    const ack = await castVote(memberClient, { roomId: 'r1', value: 999 })
    expect(ack.error).toBeDefined()
    expect(ack.ok).toBeUndefined()
  })

  it('acks an error when a socket that never joined tries to vote', async () => {
    await startVotingRoom()
    const stranger = await connect()
    const ack = await castVote(stranger, { roomId: 'r1', value: 5 })
    expect(ack.error).toBeDefined()
    expect(ack.ok).toBeUndefined()
  })
})

describe('reconnection grace period & admin transfer', () => {
  it('removes a disconnected player only after the grace window', async () => {
    const { adminClient, memberClient } = await adminAndMember()
    const removed = waitForRoomWhere(adminClient, (room) => room.players.length === 1)
    memberClient.close()
    const room = await removed
    expect(room.players.map((p) => p.id)).toEqual(['a1'])
  })

  it('cancels removal when the player reconnects within the grace window', async () => {
    const { adminClient, memberClient, adminToken, memberToken } = await adminAndMember()

    memberClient.close()
    const reconnected = await connect()
    // Reconnecting on a fresh socket as the same player must present the token.
    await join(reconnected, { roomId: 'r1', player: member, token: memberToken })

    await delay(GRACE_MS + MARGIN_MS)
    const room = roomOf(await join(adminClient, { roomId: 'r1', player: admin, token: adminToken }))
    expect(room.players.map((p) => p.id).sort()).toEqual(['a1', 'm1'])
  })

  it('keeps a player who is still connected on another socket (multi-tab)', async () => {
    const adminClient = await connect()
    const adminToken = tokenOf(await join(adminClient, { roomId: 'r1', player: admin, config }))
    const tab1 = await connect()
    const memberToken = tokenOf(await join(tab1, { roomId: 'r1', player: member }))
    const tab2 = await connect()
    // The second tab is the same identity, so it must reuse the token — this
    // also proves the token does NOT lock out legitimate multi-tab sessions.
    await join(tab2, { roomId: 'r1', player: member, token: memberToken })

    // One tab closes, but m1 is still present on tab2 → no removal is scheduled
    // (exercises markAbsent's `sockets.size > 0` early return).
    tab1.close()
    await delay(GRACE_MS + MARGIN_MS)
    const room = roomOf(await join(adminClient, { roomId: 'r1', player: admin, token: adminToken }))
    expect(room.players.map((p) => p.id).sort()).toEqual(['a1', 'm1'])
  })

  it('transfers admin to the next player after the admin disconnects', async () => {
    const { adminClient, memberClient } = await adminAndMember()
    const transferred = waitForRoomWhere(memberClient, (room) => room.adminId === 'm1')
    adminClient.close()
    const room = await transferred
    expect(room.adminId).toBe('m1')
    expect(room.players.find((p) => p.id === 'm1')?.role).toBe('admin')
  })
})

describe('leave_room (explicit exit)', () => {
  it('removes the player immediately, without waiting the grace window', async () => {
    const { adminClient, memberClient, adminToken } = await adminAndMember()

    const ack = await leaveRoom(memberClient, { roomId: 'r1' })
    expect(ack.ok).toBe(true)

    // The ack fires only after the removal ran, so the state can be read back
    // right away — no grace-window delay involved.
    const room = roomOf(await join(adminClient, { roomId: 'r1', player: admin, token: adminToken }))
    expect(room.players.map((p) => p.id)).toEqual(['a1'])
  })

  it('broadcasts the updated room to the remaining players', async () => {
    const { adminClient, memberClient } = await adminAndMember()
    const removed = waitForRoomWhere(adminClient, (room) => room.players.length === 1)
    await leaveRoom(memberClient, { roomId: 'r1' })
    const room = await removed
    expect(room.players.map((p) => p.id)).toEqual(['a1'])
  })

  it('transfers admin immediately when the admin leaves', async () => {
    const { adminClient, memberClient } = await adminAndMember()
    const transferred = waitForRoomWhere(memberClient, (room) => room.adminId === 'm1')

    const ack = await leaveRoom(adminClient, { roomId: 'r1' })
    expect(ack.ok).toBe(true)

    const room = await transferred
    expect(room.players.find((p) => p.id === 'm1')?.role).toBe('admin')
  })

  it('clears the session token, so the same identity can rejoin from scratch', async () => {
    const { memberClient } = await adminAndMember()
    await leaveRoom(memberClient, { roomId: 'r1' })

    // Rejoin right away with the same player id and NO token. Before leave_room
    // existed, the token lingered for the whole grace window and this exact
    // flow (leave → come straight back) was rejected with "Sessão inválida".
    const rejoined = await connect()
    const ack = await join(rejoined, { roomId: 'r1', player: member })
    expect(ack.success).toBe(true)
    expect(
      roomOf(ack)
        .players.map((p) => p.id)
        .sort(),
    ).toEqual(['a1', 'm1'])
  })

  it('deletes the room when the last player leaves', async () => {
    const { adminClient, memberClient } = await adminAndMember()
    await leaveRoom(memberClient, { roomId: 'r1' })
    await leaveRoom(adminClient, { roomId: 'r1' })

    // Joining without a config must now fail: the room is gone.
    const probe = await connect()
    const ack = await join(probe, { roomId: 'r1', player: member })
    expect(ack.error).toBeDefined()
    expect(ack.success).toBeUndefined()
  })

  it('acks an error (and changes nothing) for a socket that is not in that room', async () => {
    const { adminClient, adminToken } = await adminAndMember()
    const stranger = await connect()

    const ack = await leaveRoom(stranger, { roomId: 'r1' })
    expect(ack.error).toBeDefined()
    expect(ack.ok).toBeUndefined()

    const room = roomOf(await join(adminClient, { roomId: 'r1', player: admin, token: adminToken }))
    expect(room.players.map((p) => p.id).sort()).toEqual(['a1', 'm1'])
  })

  it('acks an error for an invalid payload', async () => {
    const { memberClient } = await adminAndMember()
    const ack = await leaveRoom(memberClient, { nope: true })
    expect(ack.error).toBeDefined()
    expect(ack.ok).toBeUndefined()
  })

  it('does not remove anyone else when the closing socket follows the leave', async () => {
    const { adminClient, memberClient, adminToken } = await adminAndMember()

    // Mirrors the real client: emit leave_room, then disconnect. The later
    // disconnect must not schedule a second removal against the room.
    await leaveRoom(memberClient, { roomId: 'r1' })
    memberClient.close()
    await delay(GRACE_MS + MARGIN_MS)

    const room = roomOf(await join(adminClient, { roomId: 'r1', player: admin, token: adminToken }))
    expect(room.players.map((p) => p.id)).toEqual(['a1'])
  })
})

describe('unauthenticated socket (never joined)', () => {
  it('ignores cast_vote and admin actions from a socket that never joined', async () => {
    await startVotingRoom()
    const stranger = await connect()

    // No join_room → no socket identity is bound. Per-connection FIFO means the
    // join below is handled only after these (ignored) emits.
    stranger.emit('cast_vote', { roomId: 'r1', playerId: 'm1', value: 5 })
    stranger.emit('reset_session', { roomId: 'r1' })
    const room = roomOf(
      await join(stranger, {
        roomId: 'r1',
        player: { id: 's1', name: 'Stranger', role: 'observer' },
      }),
    )

    expect(room.phase).toBe('voting') // reset_session was ignored
    expect(Object.keys(room.rounds[0].votes)).toHaveLength(0) // cast_vote was ignored
  })
})

describe('session token (anti-escalation)', () => {
  it('returns a session token on a successful join', async () => {
    const client = await connect()
    const ack = await join(client, { roomId: 'r1', player: admin, config })
    expect(ack.success).toBe(true)
    expect(typeof ack.token).toBe('string')
    expect(ack.token).toBeTruthy()
  })

  it('lets a player rejoin with the matching token (refresh keeps identity)', async () => {
    const first = await connect()
    const token = tokenOf(await join(first, { roomId: 'r1', player: admin, config }))

    // New socket, same identity + token: a refresh within the grace window.
    const refreshed = await connect()
    const room = roomOf(await join(refreshed, { roomId: 'r1', player: admin, token }))
    expect(room.adminId).toBe('a1')
    expect(room.players.find((p) => p.id === 'a1')?.role).toBe('admin')
  })

  it('rejects an impostor claiming the admin id without a token', async () => {
    const adminClient = await connect()
    const adminToken = tokenOf(await join(adminClient, { roomId: 'r1', player: admin, config }))

    // Someone tries to seize the admin identity. Without the admin's token the
    // server must refuse — this is the escalation the token prevents.
    const impostor = await connect()
    const ack = await join(impostor, {
      roomId: 'r1',
      player: { id: 'a1', name: 'Mallory', role: 'admin' },
    })
    expect(ack.error).toBeDefined()
    expect(ack.success).toBeUndefined()
    expect(ack.room).toBeUndefined()

    // The legit admin is untouched and the impostor never bound to the room.
    const room = roomOf(await join(adminClient, { roomId: 'r1', player: admin, token: adminToken }))
    expect(room.adminId).toBe('a1')
    expect(room.players.find((p) => p.id === 'a1')?.name).toBe('Ana')
  })

  it('rejects an impostor claiming the admin id with a wrong token', async () => {
    const adminClient = await connect()
    await join(adminClient, { roomId: 'r1', player: admin, config })

    const impostor = await connect()
    const ack = await join(impostor, {
      roomId: 'r1',
      player: { id: 'a1', name: 'Mallory', role: 'admin' },
      token: 'definitely-not-the-real-token',
    })
    expect(ack.error).toBeDefined()
    expect(ack.success).toBeUndefined()
  })

  it('never includes the token in the room_state_updated broadcast', async () => {
    const adminClient = await connect()
    const broadcast = waitForRoomWhere(adminClient, () => true)
    await join(adminClient, { roomId: 'r1', player: admin, config })
    const room = await broadcast
    expect(room).not.toHaveProperty('token')
    for (const player of room.players) expect(player).not.toHaveProperty('token')
  })
})
