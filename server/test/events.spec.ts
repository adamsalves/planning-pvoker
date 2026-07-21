import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { createServer, type Server as HttpServer } from 'http'
import { Server } from 'socket.io'
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client'
import { RoomManager } from '../src/roomManager'
import { setupSocketEvents } from '../src/events'
import type { Player, Room, RoomConfig } from '../src/types'
import type { RoomPersistence, PersistenceSnapshot } from '../src/persistence'

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

// Read-only persistence double: hands the seeded snapshot to hydrate() and
// swallows every write. Lets a test stand up a RoomManager that boots with a
// room already in memory — exactly the post-restart rehydration shape.
class SeedPersistence implements RoomPersistence {
  constructor(private readonly snapshot: PersistenceSnapshot) {}
  loadAll(): Promise<PersistenceSnapshot> {
    return Promise.resolve(this.snapshot)
  }
  saveRoom(): Promise<void> {
    return Promise.resolve()
  }
  deleteRoom(): Promise<void> {
    return Promise.resolve()
  }
  saveToken(): Promise<void> {
    return Promise.resolve()
  }
  deleteToken(): Promise<void> {
    return Promise.resolve()
  }
}

// Replaces the default server (from beforeEach) with one wired to a specific
// manager, reusing the module-level handles so afterEach still tears it down.
// Used by the rehydration tests, which need a manager seeded via hydrate().
async function restartWith(manager: RoomManager) {
  dispose()
  await new Promise<void>((resolve) => io.close(() => resolve()))
  httpServer = createServer()
  io = new Server(httpServer)
  dispose = setupSocketEvents(io, manager)
  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  const address = httpServer.address()
  port = typeof address === 'object' && address ? address.port : 0
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

  it('accepts a join carrying a player tag and stores it on the room player', async () => {
    const client = await connect()
    const ack = await join(client, { roomId: 'r1', player: { ...admin, tag: 'design' }, config })
    expect(ack.success).toBe(true)
    // Guards the whole inbound path: playerSchema KEEPS the tag and the handler
    // spreads it through to the room (a field-by-field rebuild would drop it).
    expect(ack.room?.players.find((p) => p.id === 'a1')?.tag).toBe('design')
  })

  it('drops an unknown player tag but still lets the join succeed', async () => {
    const client = await connect()
    const ack = await join(client, { roomId: 'r1', player: { ...admin, tag: 'devops' }, config })
    // A tag é cosmética e mora no localStorage do cliente; um valor fora da lista
    // atual (deploy-skew) NÃO tranca o join — degrada p/ "sem tag", espelhando o
    // .catch da persistência. Falha se o ingress voltar a um .optional() puro
    // (join rejeitado) ou a z.string() (tag 'devops' aceita literalmente).
    expect(ack.success).toBe(true)
    expect(ack.room?.players.find((p) => p.id === 'a1')?.tag).toBeUndefined()
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
    { event: 'set_round_voter', payload: { roomId: 'r1', playerId: 'm1', voting: false } },
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

describe('set_round_voter', () => {
  // waitForRoomWhere runs the predicate on EVERY broadcast, including the ones
  // from before the session started (no rounds yet) — hence the length guard.
  const excludedIds = (room: Room): string[] =>
    room.rounds.length > 0 ? (room.rounds[0].excludedVoterIds ?? []) : []

  it('broadcasts the excluded voter to the whole room', async () => {
    const { adminClient, memberClient } = await startVotingRoom()
    // Asserted on the MEMBER's socket: the excluded player must learn about it
    // too — that is what hides the deck on their side.
    const excluded = waitForRoomWhere(memberClient, (room) => excludedIds(room).includes('m1'))
    adminClient.emit('set_round_voter', { roomId: 'r1', playerId: 'm1', voting: false })
    await excluded
  })

  it('refuses the excluded player’s vote, and takes it again once re-included', async () => {
    const { adminClient, memberClient } = await startVotingRoom()
    const excluded = waitForRoomWhere(adminClient, (room) => excludedIds(room).includes('m1'))
    adminClient.emit('set_round_voter', { roomId: 'r1', playerId: 'm1', voting: false })
    await excluded

    const refused = await castVote(memberClient, { roomId: 'r1', value: 5 })
    expect(refused.error).toBe('vote_not_registered')

    // Safe as a "wait for change" predicate: the exclusion above already landed,
    // so the next broadcast is the re-inclusion.
    const included = waitForRoomWhere(adminClient, (room) => !excludedIds(room).includes('m1'))
    adminClient.emit('set_round_voter', { roomId: 'r1', playerId: 'm1', voting: true })
    await included

    const accepted = await castVote(memberClient, { roomId: 'r1', value: 5 })
    expect(accepted.ok).toBe(true)
  })

  // A tabela de `votingActions` acima cobre set_round_voter, mas suas asserções
  // (phase/status) passariam mesmo se a ação de um não-admin tivesse rodado —
  // excluir um votante não mexe em nenhuma das duas. Este caso olha o efeito real.
  it('ignores set_round_voter from a non-admin', async () => {
    const { memberClient, memberToken } = await startVotingRoom()
    memberClient.emit('set_round_voter', { roomId: 'r1', playerId: 'a1', voting: false })
    const room = roomOf(
      await join(memberClient, { roomId: 'r1', player: member, token: memberToken }),
    )
    expect(room.rounds[0].excludedVoterIds).toEqual([])
  })

  it('ignores a malformed payload', async () => {
    const { adminClient, adminToken } = await startVotingRoom()
    adminClient.emit('set_round_voter', { roomId: 'r1', playerId: 'm1' }) // no `voting`
    // State read back via a re-join on the SAME socket: FIFO guarantees it is
    // processed after the ignored action, so no arbitrary delay is needed.
    const room = roomOf(await join(adminClient, { roomId: 'r1', player: admin, token: adminToken }))
    expect(room.rounds[0].excludedVoterIds).toEqual([])
  })
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
    // flow (leave → come straight back) was rejected with 'invalid_session'.
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

  it('is identity-wide: leaving via one tab unsubscribes the sibling tab from broadcasts', async () => {
    const adminClient = await connect()
    const adminToken = tokenOf(await join(adminClient, { roomId: 'r1', player: admin, config }))
    const tab1 = await connect()
    const memberToken = tokenOf(await join(tab1, { roomId: 'r1', player: member }))
    const tab2 = await connect()
    await join(tab2, { roomId: 'r1', player: member, token: memberToken })

    await leaveRoom(tab1, { roomId: 'r1' })

    // The whole identity left, not just tab1's socket…
    const room = roomOf(await join(adminClient, { roomId: 'r1', player: admin, token: adminToken }))
    expect(room.players.map((p) => p.id)).toEqual(['a1'])

    // …and the sibling tab must not keep receiving updates for the room. Drive
    // a broadcast and give it a beat to (not) arrive: proving a negative needs
    // a small window after the admin — still subscribed — has received it.
    let tab2Received = false
    tab2.on('room_state_updated', () => {
      tab2Received = true
    })
    const seeded = waitForRoomWhere(adminClient, (r) => r.subjects.length === 1)
    adminClient.emit('add_subjects', { roomId: 'r1', subjects: ['A'] })
    await seeded
    await delay(50)
    expect(tab2Received).toBe(false)
  })

  it('acks an error on a duplicated leave_room from the same socket', async () => {
    const { adminClient, memberClient, adminToken } = await adminAndMember()

    const first = await leaveRoom(memberClient, { roomId: 'r1' })
    expect(first.ok).toBe(true)

    // The socket identity was unbound by the first leave, so the duplicate is
    // just an unauthorized emit — refused, and the room stays as it was.
    const second = await leaveRoom(memberClient, { roomId: 'r1' })
    expect(second.error).toBeDefined()
    expect(second.ok).toBeUndefined()

    const room = roomOf(await join(adminClient, { roomId: 'r1', player: admin, token: adminToken }))
    expect(room.players.map((p) => p.id)).toEqual(['a1'])
  })

  it('lets the same connection rejoin after leaving (leave → join on one socket)', async () => {
    const { memberClient, memberToken } = await adminAndMember()
    await leaveRoom(memberClient, { roomId: 'r1' })

    // "Left by mistake, came straight back" without reloading: the old token
    // was cleared by the leave, so the join carries none and a FRESH one is
    // minted — it must not be the token the identity held before leaving.
    const ack = await join(memberClient, { roomId: 'r1', player: member })
    expect(ack.success).toBe(true)
    expect(tokenOf(ack)).not.toBe(memberToken)
    expect(
      roomOf(ack)
        .players.map((p) => p.id)
        .sort(),
    ).toEqual(['a1', 'm1'])
  })

  it('acks an error when a socket joined to another room tries to leave r1', async () => {
    const { adminClient, adminToken } = await adminAndMember()

    const outsider = await connect()
    await join(outsider, {
      roomId: 'r2',
      player: { id: 'o1', name: 'Olga', role: 'member' },
      config,
    })

    const ack = await leaveRoom(outsider, { roomId: 'r1' })
    expect(ack.error).toBeDefined()
    expect(ack.ok).toBeUndefined()

    const room = roomOf(await join(adminClient, { roomId: 'r1', player: admin, token: adminToken }))
    expect(room.players.map((p) => p.id).sort()).toEqual(['a1', 'm1'])
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

  it('ignores a stale leave from a sibling socket after the identity rejoined', async () => {
    // Two sibling tabs for member m1 (shared session → same id + token).
    const adminClient = await connect()
    const adminToken = tokenOf(await join(adminClient, { roomId: 'r1', player: admin, config }))
    const tab1 = await connect()
    const memberToken = tokenOf(await join(tab1, { roomId: 'r1', player: member }))
    const tab2 = await connect()
    await join(tab2, { roomId: 'r1', player: member, token: memberToken })

    // tab1 leaves — identity-wide, so m1 is removed and the token dropped. tab2's
    // socket still (stalely) believes it is m1@r1.
    await leaveRoom(tab1, { roomId: 'r1' })

    // m1 comes back on a brand-new socket (no token — the leave cleared it).
    const rejoined = await connect()
    const reAck = await join(rejoined, { roomId: 'r1', player: member })
    expect(reAck.success).toBe(true)

    // The STALE sibling now emits leave_room. Its socket id is no longer the
    // identity's live presence, so the leave must be a no-op — it must NOT evict
    // the freshly rejoined m1. (Without the presence guard, this evicts m1.)
    const staleAck = await leaveRoom(tab2, { roomId: 'r1' })
    expect(staleAck.ok).toBe(true) // acked, but changed nothing

    const room = roomOf(await join(adminClient, { roomId: 'r1', player: admin, token: adminToken }))
    expect(room.players.map((p) => p.id).sort()).toEqual(['a1', 'm1'])

    // The rejoined m1 is still a fully live member: the stale no-op didn't drop
    // its room subscription, so it keeps receiving broadcasts.
    const seen = waitForRoomWhere(rejoined, (r) => r.subjects.includes('S1'))
    adminClient.emit('add_subjects', { roomId: 'r1', subjects: ['S1'] })
    expect((await seen).players.map((p) => p.id).sort()).toEqual(['a1', 'm1'])
  })

  it('a stale sibling that disconnects after the identity rejoined keeps the rejoined player', async () => {
    // Same shape as the stale-leave test, but the stale sibling DISCONNECTS
    // (closes) instead of emitting leave_room. Its socket was never part of the
    // rejoined identity's presence, so the disconnect must not schedule a grace
    // removal for the freshly rejoined m1.
    const adminClient = await connect()
    const adminToken = tokenOf(await join(adminClient, { roomId: 'r1', player: admin, config }))
    const tab1 = await connect()
    const memberToken = tokenOf(await join(tab1, { roomId: 'r1', player: member }))
    const tab2 = await connect()
    await join(tab2, { roomId: 'r1', player: member, token: memberToken })

    await leaveRoom(tab1, { roomId: 'r1' })

    const rejoined = await connect()
    expect((await join(rejoined, { roomId: 'r1', player: member })).success).toBe(true)

    // The stale sibling drops off. m1's only live presence is the rejoined
    // socket, so markAbsent finds tab2 absent from the set and schedules nothing.
    tab2.close()
    await delay(GRACE_MS + MARGIN_MS)

    const room = roomOf(await join(adminClient, { roomId: 'r1', player: admin, token: adminToken }))
    expect(room.players.map((p) => p.id).sort()).toEqual(['a1', 'm1'])
  })

  it('a stale sibling that disconnects after an identity-wide leave schedules no spurious removal', async () => {
    // After an identity-wide leave, a still-connected sibling is stale: its
    // socket.data names an identity whose presence was already cleared. When it
    // later disconnects (no rejoin in between), markAbsent must not schedule a
    // redundant grace removal — otherwise a spurious room_state_updated fires
    // after the window and the orphaned timer escapes dispose().
    const adminClient = await connect()
    const adminToken = tokenOf(await join(adminClient, { roomId: 'r1', player: admin, config }))
    const tab1 = await connect()
    const memberToken = tokenOf(await join(tab1, { roomId: 'r1', player: member }))
    const tab2 = await connect()
    await join(tab2, { roomId: 'r1', player: member, token: memberToken })

    // Identity-wide leave: m1 removed, presence for r1::m1 cleared; tab2 stays
    // connected but stale, and nothing rejoins.
    await leaveRoom(tab1, { roomId: 'r1' })

    // Any removal the stale disconnect schedules would broadcast to the admin,
    // who is still subscribed.
    let broadcasts = 0
    adminClient.on('room_state_updated', () => {
      broadcasts++
    })

    tab2.close()
    await delay(GRACE_MS + MARGIN_MS)
    expect(broadcasts).toBe(0)

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

describe('rehydration ghost does not block autoReveal', () => {
  // A player rehydrated from persistence that never reconnects in this process:
  // eligible to vote, but with no live socket and no grace timer, so it must be
  // excluded from the autoReveal quorum.
  const ghost: Player = { id: 'g1', name: 'Casper', role: 'member' }
  const autoRevealConfig: RoomConfig = { deckType: 'fibonacci', autoReveal: true }

  // Builds a voting room [admin, member, ghost] (autoReveal on) with the given
  // votes already recorded, plus admin+member tokens — the state a server would
  // rehydrate after a restart.
  function seedManager(votes: Record<string, string | number>): RoomManager {
    const room: Room = {
      id: 'r1',
      adminId: 'a1',
      config: autoRevealConfig,
      players: [admin, member, ghost],
      subjects: ['A'],
      phase: 'voting',
      rounds: [{ id: 'rnd1', subject: 'A', status: 'voting', votes }],
      currentRoundIndex: 0,
    }
    const tokens = new Map<string, string>([
      ['r1::a1', 'tok-a'],
      ['r1::m1', 'tok-m'],
    ])
    return new RoomManager(new SeedPersistence({ rooms: [room], tokens }))
  }

  it('reveals once the present players vote, ignoring the never-connecting ghost', async () => {
    const manager = seedManager({})
    await manager.hydrate()
    await restartWith(manager)

    // Only admin and member reconnect (with their tokens); the ghost never does.
    const adminClient = await connect()
    await join(adminClient, { roomId: 'r1', player: admin, token: 'tok-a' })
    const memberClient = await connect()
    await join(memberClient, { roomId: 'r1', player: member, token: 'tok-m' })

    const revealed = waitForRoomWhere(adminClient, (room) => room.rounds[0].status === 'revealed')
    adminClient.emit('cast_vote', { roomId: 'r1', value: 3 })
    memberClient.emit('cast_vote', { roomId: 'r1', value: 5 })
    const room = await revealed

    expect(room.rounds[0].status).toBe('revealed')
    // The ghost is still listed (hiding it from the UI is out of scope) and never
    // voted — yet the round revealed because it is not present, so it is excluded
    // from the quorum. Before the fix, the ghost would keep the round stuck.
    expect(room.players.map((p) => p.id).sort()).toEqual(['a1', 'g1', 'm1'])
    expect(room.rounds[0].votes['g1']).toBeUndefined()
  })
})
