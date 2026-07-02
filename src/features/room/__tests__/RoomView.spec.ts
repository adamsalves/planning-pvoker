import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RoomView from '../RoomView.vue'
import VotingArea from '../VotingArea.vue'
import BaseModal from '@/components/BaseModal.vue'
import BaseButton from '@/components/BaseButton.vue'
import { useRoomStore } from '@/stores/room'
import { useUserStore } from '@/stores/user'
import { useConnectionStore } from '@/stores/connection'
import { JoinAckError } from '@/composables/joinErrors'
import type { Room } from '@/types'

const mockRouterPush = vi.fn()
const mockRevealVotes = vi.fn()
// The rejoin effect awaits this Promise; resolve by default so mounting is a no-op.
const mockSocketJoinRoom = vi.fn().mockResolvedValue(undefined)
// castVote agora retorna Promise; resolve por padrão (sucesso) para o handleVote
// não cair no .catch nos testes que não exercitam a rejeição.
const mockCastVote = vi.fn().mockResolvedValue(undefined)
const mockDisconnect = vi.fn()
const mockLeaveRoom = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { id: 'abc123' },
  }),
  useRouter: () => ({
    push: mockRouterPush,
  }),
}))

vi.mock('@/composables/useSocket', () => ({
  useSocket: () => ({
    addSubjects: vi.fn(),
    removeSubject: vi.fn(),
    startSession: vi.fn(),
    nextRound: vi.fn(),
    resetSession: vi.fn(),
    castVote: mockCastVote,
    revealVotes: mockRevealVotes,
    disconnect: mockDisconnect,
    joinRoom: mockSocketJoinRoom,
    leaveRoom: mockLeaveRoom,
  }),
}))

const childStubs = {
  SubjectForm: true,
  RoundHeader: true,
  VotingArea: true,
  PlayerList: true,
  PokerTable: true,
  VoteReveal: true,
  RoundControls: true,
  SessionSummary: true,
}

function createRoom(): Room {
  return {
    id: 'abc123',
    adminId: 'player-1',
    config: { deckType: 'fibonacci', autoReveal: false },
    players: [{ id: 'player-1', name: 'Ana', role: 'admin' }],
    subjects: [],
    phase: 'setup',
    rounds: [],
    currentRoundIndex: -1,
  }
}

function mountRoomView(options?: { sessionToken?: string }) {
  setActivePinia(createPinia())

  const userStore = useUserStore()
  userStore.setPlayer('Ana', 'player-1', 'admin')
  if (options?.sessionToken) userStore.setSessionToken(options.sessionToken)

  const roomStore = useRoomStore()
  roomStore.syncRoom(createRoom())

  return mount(RoomView, { global: { stubs: childStubs } })
}

function getShareButton(wrapper: ReturnType<typeof mountRoomView>) {
  const button = wrapper.findAll('button').find((item) => item.text().includes('Compartilhar'))
  if (!button) throw new Error('Share button not found')
  return button
}

const expectedInviteUrl = new URL(import.meta.env.BASE_URL, window.location.origin)
expectedInviteUrl.searchParams.set('room', 'abc123')

describe('RoomView.vue sharing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
  })

  it('uses native share when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: share,
    })

    const wrapper = mountRoomView()

    await getShareButton(wrapper).trigger('click')
    await flushPromises()

    expect(share).toHaveBeenCalledWith({
      title: 'Planning Poker',
      text: 'Entre na minha sala de Planning Poker',
      url: expectedInviteUrl.toString(),
    })
  })

  it('copies invite link when native share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    const wrapper = mountRoomView()

    await getShareButton(wrapper).trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith(expectedInviteUrl.toString())
    expect(wrapper.text()).toContain('Link copiado!')
  })
})

describe('RoomView.vue rejoin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSocketJoinRoom.mockResolvedValue(undefined)
  })

  it('drops the session token and goes home on a JoinAckError (real session failure)', async () => {
    // Server explicitly refuses the rejoin (stale token / room gone).
    mockSocketJoinRoom.mockRejectedValueOnce(new JoinAckError('Sessão inválida'))

    mountRoomView({ sessionToken: 'stale-token' })
    await flushPromises()

    const userStore = useUserStore()
    expect(mockRouterPush).toHaveBeenCalledWith({
      name: 'home',
      query: { notice: 'session-expired' },
    })
    expect(userStore.sessionToken).toBeNull()
  })

  it('stays put on a connection failure (cold start): no navigation, keeps the token', async () => {
    // Not a server ACK error — a transient connection problem while the Render
    // backend wakes up. The overlay covers it and the retry resolves; the user
    // must NOT be bounced out of the room.
    mockSocketJoinRoom.mockRejectedValueOnce(new Error('xhr poll error'))

    mountRoomView({ sessionToken: 'live-token' })
    await flushPromises()

    const userStore = useUserStore()
    expect(mockRouterPush).not.toHaveBeenCalled()
    expect(userStore.sessionToken).toBe('live-token')
  })

  it('re-emits join_room on a transparent reconnect (new socket id server-side)', async () => {
    mountRoomView({ sessionToken: 'live-token' })
    await flushPromises()
    mockSocketJoinRoom.mockClear() // ignore the initial onMounted join

    // A successful socket reconnect bumps the store's nonce; without re-joining,
    // the server would drop this player after the grace window.
    useConnectionStore().setReconnected()
    await flushPromises()

    expect(mockSocketJoinRoom).toHaveBeenCalledTimes(1)
  })
})

describe('RoomView.vue auto-reveal (server is the single source)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSocketJoinRoom.mockResolvedValue(undefined)
  })

  function votingRoom(votes: Record<string, string | number>): Room {
    return {
      id: 'abc123',
      adminId: 'player-1',
      config: { deckType: 'fibonacci', autoReveal: true },
      players: [{ id: 'player-1', name: 'Ana', role: 'admin' }],
      subjects: ['A'],
      phase: 'voting',
      rounds: [{ id: 'r1', subject: 'A', status: 'voting', votes }],
      currentRoundIndex: 0,
    }
  }

  it('does not emit reveal_votes from the client when all active players have voted', async () => {
    setActivePinia(createPinia())
    useUserStore().setPlayer('Ana', 'player-1', 'admin')
    const roomStore = useRoomStore()

    // Start in voting with no votes yet, then transition to "everyone voted".
    roomStore.syncRoom(votingRoom({}))
    mount(RoomView, { global: { stubs: childStubs } })
    await flushPromises()

    // The only active player (admin) now voted. A former client-side watch would
    // have auto-revealed here; the server is the single source now, so the client
    // must NOT emit reveal_votes.
    roomStore.syncRoom(votingRoom({ 'player-1': 5 }))
    await flushPromises()

    expect(mockRevealVotes).not.toHaveBeenCalled()
  })
})

describe('RoomView.vue optimistic vote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSocketJoinRoom.mockResolvedValue(undefined)
    mockCastVote.mockResolvedValue(undefined)
  })

  function votingRoom(votes: Record<string, string | number>): Room {
    return {
      id: 'abc123',
      adminId: 'player-1',
      config: { deckType: 'fibonacci', autoReveal: false },
      players: [
        { id: 'player-1', name: 'Ana', role: 'admin' },
        { id: 'player-2', name: 'Bob', role: 'member' },
      ],
      subjects: ['A'],
      phase: 'voting',
      rounds: [{ id: 'r1', subject: 'A', status: 'voting', votes }],
      currentRoundIndex: 0,
    }
  }

  it('highlights the clicked card immediately, before the server confirms', async () => {
    setActivePinia(createPinia())
    useUserStore().setPlayer('Bob', 'player-2', 'member')
    useRoomStore().syncRoom(votingRoom({})) // ninguém votou ainda
    const wrapper = mount(RoomView, { global: { stubs: childStubs } })
    await flushPromises()

    const votingArea = wrapper.findComponent(VotingArea)
    expect(votingArea.exists()).toBe(true)
    expect(votingArea.props('selectedValue')).toBeNull()

    // Clique numa carta → VotingArea emite 'vote'. Nenhum room_state_updated ainda.
    votingArea.vm.$emit('vote', 8)
    await flushPromises()

    // Otimista: a seleção reflete o clique sem esperar o round-trip do servidor.
    expect(votingArea.props('selectedValue')).toBe(8)
  })

  it('lets the server-confirmed vote take over the optimistic one', async () => {
    setActivePinia(createPinia())
    useUserStore().setPlayer('Bob', 'player-2', 'member')
    const roomStore = useRoomStore()
    roomStore.syncRoom(votingRoom({}))
    const wrapper = mount(RoomView, { global: { stubs: childStubs } })
    await flushPromises()

    const votingArea = wrapper.findComponent(VotingArea)
    votingArea.vm.$emit('vote', 8)
    await flushPromises()

    // O servidor confirma o voto — a seleção continua, agora vinda do servidor.
    roomStore.syncRoom(votingRoom({ 'player-2': 8 }))
    await flushPromises()
    expect(votingArea.props('selectedValue')).toBe(8)
  })

  it('clears the optimistic vote when the server rejects the cast', async () => {
    setActivePinia(createPinia())
    useUserStore().setPlayer('Bob', 'player-2', 'member')
    useRoomStore().syncRoom(votingRoom({}))
    mockCastVote.mockRejectedValueOnce(new Error('Voto inválido para o baralho'))
    const wrapper = mount(RoomView, { global: { stubs: childStubs } })
    await flushPromises()

    const votingArea = wrapper.findComponent(VotingArea)
    votingArea.vm.$emit('vote', 999)
    await flushPromises()

    // Servidor recusou → o otimista é desfeito (a carta volta a apagar).
    expect(votingArea.props('selectedValue')).toBeNull()
  })
})

describe('RoomView.vue heading structure', () => {
  it('renders the room title as the page h1 (F2.7 — navbar logo is not a heading)', () => {
    const wrapper = mountRoomView()

    expect(wrapper.find('h1.room-title').exists()).toBe(true)
  })
})

describe('RoomView.vue leave confirmation (F3.4 / F3.10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSocketJoinRoom.mockResolvedValue(undefined)
  })

  // Cabeçalho: botão não teleportado (fica no DOM do wrapper).
  function getHeaderLeaveButton(wrapper: ReturnType<typeof mountRoomView>) {
    const button = wrapper.findAll('button').find((item) => item.text().includes('Sair da Sala'))
    if (!button) throw new Error('Header leave button not found')
    return button
  }

  // Botões do modal: teleportados p/ o body → achados via árvore de componentes.
  function getModalButton(wrapper: ReturnType<typeof mountRoomView>, label: string) {
    const button = wrapper.findAllComponents(BaseButton).find((item) => item.text() === label)
    if (!button) throw new Error(`Modal button "${label}" not found`)
    return button
  }

  it('opens a confirmation modal instead of leaving immediately', async () => {
    const wrapper = mountRoomView({ sessionToken: 'live-token' })
    await flushPromises()

    const modal = wrapper.findComponent(BaseModal)
    expect(modal.props('modelValue')).toBe(false)

    await getHeaderLeaveButton(wrapper).trigger('click')

    expect(modal.props('modelValue')).toBe(true)
    // Ainda não saiu: sem navegação, sem desconectar, sem avisar o servidor.
    expect(mockRouterPush).not.toHaveBeenCalled()
    expect(mockDisconnect).not.toHaveBeenCalled()
    expect(mockLeaveRoom).not.toHaveBeenCalled()
    expect(useUserStore().sessionToken).toBe('live-token')

    wrapper.unmount() // limpa o conteúdo teleportado do modal aberto
  })

  it('cancels without leaving and keeps the session', async () => {
    const wrapper = mountRoomView({ sessionToken: 'live-token' })
    await flushPromises()

    await getHeaderLeaveButton(wrapper).trigger('click')
    await getModalButton(wrapper, 'Cancelar').trigger('click')

    expect(wrapper.findComponent(BaseModal).props('modelValue')).toBe(false)
    expect(mockRouterPush).not.toHaveBeenCalled()
    expect(mockDisconnect).not.toHaveBeenCalled()
    expect(mockLeaveRoom).not.toHaveBeenCalled()
    expect(useUserStore().sessionToken).toBe('live-token')
  })

  it('leaves and clears session token + active room only after confirming', async () => {
    const wrapper = mountRoomView({ sessionToken: 'live-token' })
    const userStore = useUserStore()
    userStore.setActiveRoom('abc123')
    await flushPromises()

    await getHeaderLeaveButton(wrapper).trigger('click')
    await getModalButton(wrapper, 'Sim, sair').trigger('click')
    await flushPromises()

    expect(mockDisconnect).toHaveBeenCalledTimes(1)
    expect(mockRouterPush).toHaveBeenCalledWith({ name: 'home' })
    // leave_room avisa o servidor (remoção imediata, sem o grace de 30s) e tem
    // de ir ANTES do disconnect — depois dele o pacote não sai.
    expect(mockLeaveRoom).toHaveBeenCalledWith('abc123')
    expect(mockLeaveRoom.mock.invocationCallOrder[0]).toBeLessThan(
      mockDisconnect.mock.invocationCallOrder[0],
    )
    // F3.10 — token e vínculo com a sala descartados no leave.
    expect(userStore.sessionToken).toBeNull()
    expect(userStore.activeRoomId).toBeNull()
  })
})
