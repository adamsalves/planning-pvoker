import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import IconCrown from '~icons/lucide/crown'
import IconUser from '~icons/lucide/user'
import IconEye from '~icons/lucide/eye'
import IconPencil from '~icons/lucide/pencil'
import IconVote from '~icons/lucide/vote'
import IconCheck from '~icons/lucide/check'
import IconShare from '~icons/lucide/share-2'
import RoomView from '../RoomView.vue'
import RoomVoting from '../RoomVoting.vue'
import VotingArea from '../VotingArea.vue'
import BaseModal from '@/components/BaseModal.vue'
import BaseButton from '@/components/BaseButton.vue'
import { useRoomStore } from '@/stores/room'
import { useUserStore } from '@/stores/user'
import { useConnectionStore } from '@/stores/connection'
import { JoinAckError } from '@/composables/joinErrors'
import type { Room } from '@/types'
import { must } from '@/test-utils/must'

const mockRouterPush = vi.fn()
const mockRevealVotes = vi.fn()
// The rejoin effect awaits this Promise; resolve by default so mounting is a no-op.
const mockSocketJoinRoom = vi.fn().mockResolvedValue(undefined)
// castVote agora retorna Promise; resolve por padrão (sucesso) para o handleVote
// não cair no .catch nos testes que não exercitam a rejeição.
const mockCastVote = vi.fn().mockResolvedValue(undefined)
const mockDisconnect = vi.fn()
const mockLeaveRoom = vi.fn()
const mockSetRoundVoter = vi.fn()

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
    setRoundVoter: mockSetRoundVoter,
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

  it('drops the session token AND the stale room, then goes home on a JoinAckError', async () => {
    // Server explicitly refuses the rejoin (stale token / room gone).
    mockSocketJoinRoom.mockRejectedValueOnce(new JoinAckError('invalid_session'))

    mountRoomView({ sessionToken: 'stale-token' }) // mountRoomView já sincroniza uma sala
    await flushPromises()

    const userStore = useUserStore()
    expect(mockRouterPush).toHaveBeenCalledWith({
      name: 'home',
      query: { notice: 'session-expired' },
    })
    expect(userStore.sessionToken).toBeNull()
    // currentRoom E activeRoomId precisam ser limpos: o banner de "sala ativa" lê o
    // activeRoomId (persistido), então sem limpá-lo a Home mostraria o retorno "Voltar
    // à Sala" apontando pra sala morta, junto do aviso "sessão expirou" (F5.4).
    expect(useRoomStore().currentRoom).toBeNull()
    expect(userStore.activeRoomId).toBeNull()
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

  // Regressão (pego no smoke): o upsert do servidor sobrescreve a tag a cada join,
  // então o re-join (mount + reconexão) TEM de reenviá-la, senão ela some logo após
  // o create/join inicial. Vem persistida do userStore.
  it('re-sends the persisted area tag on rejoin so the server upsert keeps it', async () => {
    setActivePinia(createPinia())
    useUserStore().setPlayer('Ana', 'player-1', 'admin', 'dev')
    useRoomStore().syncRoom(createRoom())

    mount(RoomView, { global: { stubs: childStubs } })
    await flushPromises()

    expect(mockSocketJoinRoom).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ id: 'player-1', name: 'Ana', role: 'admin', tag: 'dev' }),
    )
  })

  // A tag também tem de sobreviver a uma reconexão transparente (novo socket id):
  // o rejoin roda de novo e, sem reenviar a tag, o upsert do servidor a apagaria.
  it('re-sends the area tag on a transparent reconnect too', async () => {
    setActivePinia(createPinia())
    useUserStore().setPlayer('Ana', 'player-1', 'admin', 'dev')
    useRoomStore().syncRoom(createRoom())

    mount(RoomView, { global: { stubs: childStubs } })
    await flushPromises()
    mockSocketJoinRoom.mockClear() // ignora o join do mount

    useConnectionStore().setReconnected()
    await flushPromises()

    expect(mockSocketJoinRoom).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ id: 'player-1', tag: 'dev' }),
    )
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
    mockCastVote.mockRejectedValueOnce(new Error('invalid_vote_for_deck'))
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
    expect(must(mockLeaveRoom.mock.invocationCallOrder[0], 'leave call order')).toBeLessThan(
      must(mockDisconnect.mock.invocationCallOrder[0], 'disconnect call order'),
    )
    // F3.10 — token e vínculo com a sala descartados no leave.
    expect(userStore.sessionToken).toBeNull()
    expect(userStore.activeRoomId).toBeNull()
  })
})

describe('RoomView.vue voting tabs (F6 — live room summary)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSocketJoinRoom.mockResolvedValue(undefined)
  })

  function mountVotingRoom(mountOptions: Record<string, unknown> = {}) {
    setActivePinia(createPinia())
    useUserStore().setPlayer('Ana', 'player-1', 'admin')
    const room = createRoom()
    room.phase = 'voting'
    room.subjects = ['Login', 'Checkout']
    room.rounds = [
      { id: 'r-1', subject: 'Login', status: 'revealed', votes: { 'player-1': 5 } },
      { id: 'r-2', subject: 'Checkout', status: 'voting', votes: {} },
    ]
    room.currentRoundIndex = 1
    useRoomStore().syncRoom(room)
    return mount(RoomView, { global: { stubs: childStubs }, ...mountOptions })
  }

  it('shows a Voting/Summary tablist during the voting phase, with the revealed-round count', () => {
    const wrapper = mountVotingRoom()
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs).toHaveLength(2)
    expect(must(tabs[0], 'voting tab').text()).toContain('Votação')
    expect(must(tabs[1], 'summary tab').text()).toContain('Resumo')
    // Só a rodada revelada conta — a rodada em votação não entra no resumo.
    expect(must(tabs[1], 'summary tab').text()).toContain('(1)')
  })

  it('defaults to the voting panel and switches to the summary on click', async () => {
    const wrapper = mountVotingRoom()
    const tab = (i: number) => must(wrapper.findAll('[role="tab"]')[i], `tab ${i}`)

    expect(tab(0).attributes('aria-selected')).toBe('true')
    expect(tab(1).attributes('aria-selected')).toBe('false')
    // v-show esconde o painel inativo (display:none inline no root do componente).
    expect(wrapper.get('#room-panel-summary').attributes('style')).toContain('display: none')

    await tab(1).trigger('click')

    expect(tab(0).attributes('aria-selected')).toBe('false')
    expect(tab(1).attributes('aria-selected')).toBe('true')
    expect(wrapper.get('#room-panel-voting').attributes('style')).toContain('display: none')
    expect(wrapper.get('#room-panel-summary').attributes('style') ?? '').not.toContain(
      'display: none',
    )
  })

  it('switches tabs with Arrow keys (WAI-ARIA keyboard support)', async () => {
    const wrapper = mountVotingRoom()
    const tablist = wrapper.get('[role="tablist"]')

    await tablist.trigger('keydown', { key: 'ArrowRight' })
    expect(
      must(wrapper.findAll('[role="tab"]')[1], 'summary tab').attributes('aria-selected'),
    ).toBe('true')

    await tablist.trigger('keydown', { key: 'ArrowLeft' })
    expect(must(wrapper.findAll('[role="tab"]')[0], 'voting tab').attributes('aria-selected')).toBe(
      'true',
    )
  })

  it('does not render the tablist outside the voting phase', () => {
    const wrapper = mountRoomView() // sala em fase de setup
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
  })

  it('updates the tab counter live when the current round becomes revealed', async () => {
    const wrapper = mountVotingRoom()
    const roomStore = useRoomStore()
    const summaryTab = () => must(wrapper.findAll('[role="tab"]')[1], 'summary tab')

    expect(summaryTab().text()).toContain('(1)')

    // Admin revela a rodada atual (r-2) → ela entra no resumo e o contador sobe.
    const revealed = createRoom()
    revealed.phase = 'voting'
    revealed.subjects = ['Login', 'Checkout']
    revealed.rounds = [
      { id: 'r-1', subject: 'Login', status: 'revealed', votes: { 'player-1': 5 } },
      { id: 'r-2', subject: 'Checkout', status: 'revealed', votes: { 'player-1': 8 } },
    ]
    revealed.currentRoundIndex = 1
    roomStore.syncRoom(revealed)
    await nextTick()

    expect(summaryTab().text()).toContain('(2)')
  })

  it('resets to the voting tab when a fresh voting phase starts (session reset)', async () => {
    const wrapper = mountVotingRoom()
    const roomStore = useRoomStore()
    const tab = (i: number) => must(wrapper.findAll('[role="tab"]')[i], `tab ${i}`)

    // Vai pro resumo.
    await tab(1).trigger('click')
    expect(tab(1).attributes('aria-selected')).toBe('true')

    // Sessão concluída: não é fase de votação → o tablist some.
    const completed = createRoom()
    completed.phase = 'completed'
    completed.rounds = [
      { id: 'r-1', subject: 'Login', status: 'revealed', votes: { 'player-1': 5 } },
    ]
    roomStore.syncRoom(completed)
    await nextTick()
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)

    // Nova sessão (reset) reentra em votação → a aba deve voltar pra "Votação",
    // não ficar presa no resumo da sessão anterior.
    const fresh = createRoom()
    fresh.phase = 'voting'
    fresh.subjects = ['Login']
    fresh.rounds = [{ id: 'r-2', subject: 'Login', status: 'voting', votes: {} }]
    fresh.currentRoundIndex = 0
    roomStore.syncRoom(fresh)
    await nextTick()

    expect(must(wrapper.findAll('[role="tab"]')[0], 'voting tab').attributes('aria-selected')).toBe(
      'true',
    )
  })

  it('moves focus to the newly selected tab on Arrow navigation (roving tabindex)', async () => {
    const wrapper = mountVotingRoom({ attachTo: document.body })
    const tablist = wrapper.get('[role="tablist"]')

    await tablist.trigger('keydown', { key: 'ArrowRight' })
    await flushPromises() // o .focus() roda num nextTick após trocar a aba

    const tabs = wrapper.findAll('[role="tab"]')
    const votingTab = must(tabs[0], 'voting tab')
    const summaryTab = must(tabs[1], 'summary tab')
    // Roving tabindex: o alvo vira focável (0) e o outro sai da ordem de tab (-1)...
    expect(summaryTab.attributes('tabindex')).toBe('0')
    expect(votingTab.attributes('tabindex')).toBe('-1')
    // ...e o foco de fato se moveu pra ele.
    expect(document.activeElement).toBe(summaryTab.element)

    wrapper.unmount() // limpa o DOM anexado ao document.body
  })
})

describe('RoomView.vue direct hit without identity (F5.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to Home preserving the room code in ?room= (not a bare /)', () => {
    setActivePinia(createPinia())
    // Sem setPlayer → sem playerId/playerName: link/bookmark de /room/:id aberto direto.
    mount(RoomView, { global: { stubs: childStubs } })

    // Antes ia pra '/' cru (perdia o id); agora manda pra Home com ?room=<id>, que o
    // HomeView usa pra abrir na aba "Entrar" já preenchida.
    expect(mockRouterPush).toHaveBeenCalledWith({ name: 'home', query: { room: 'abc123' } })
  })
})

describe('RoomView.vue role and phase badges (ícones theme-aware)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // O teste do compartilhar troca navigator.share/clipboard: restaura depois pra não
  // deixar o estado vazar pra quem rodar em seguida (a ordem dos arquivos varia).
  afterEach(() => {
    for (const prop of ['share', 'clipboard']) {
      Object.defineProperty(navigator, prop, { configurable: true, value: undefined })
    }
  })

  // Papel e fase deixaram de trazer emoji na string i18n: o ícone é irmão do rótulo
  // e sai do mesmo computed (roleBadge/phaseBadge). O rótulo textual permanece — é
  // ele que dá o nome acessível do badge.
  function mountAs(
    options: {
      role?: 'admin' | 'member' | 'observer'
      phase?: Room['phase']
    } = {},
  ) {
    setActivePinia(createPinia())

    const role = options.role ?? 'admin'
    const userStore = useUserStore()
    userStore.setPlayer('Ana', 'player-1', role)

    const room = createRoom()
    // O papel do badge vem do SERVIDOR (adminId + role na lista de jogadores), não
    // do localStorage — por isso os dois lados são preparados juntos aqui.
    room.players = [{ id: 'player-1', name: 'Ana', role }]
    if (role !== 'admin') room.adminId = 'someone-else'
    if (options.phase) room.phase = options.phase

    useRoomStore().syncRoom(room)

    return mount(RoomView, { global: { stubs: childStubs } })
  }

  it.each([
    ['admin' as const, IconCrown, 'Admin'],
    ['observer' as const, IconEye, 'Espectador'],
    ['member' as const, IconUser, 'Jogador'],
  ])('mostra o ícone e o rótulo do papel %s', (role, Icon, label) => {
    const badge = mountAs({ role }).find('.badge-role')

    expect(badge.findComponent(Icon).exists()).toBe(true)
    expect(badge.text()).toBe(label)
  })

  it.each([
    ['setup' as const, IconPencil, 'Preparação'],
    ['voting' as const, IconVote, 'Votação'],
    ['completed' as const, IconCheck, 'Concluída'],
  ])('mostra o ícone e o rótulo da fase %s', (phase, Icon, label) => {
    const badge = mountAs({ phase }).find('.badge-phase')

    expect(badge.findComponent(Icon).exists()).toBe(true)
    expect(badge.text()).toBe(label)
  })

  it('esconde os ícones dos badges da tecnologia assistiva', () => {
    const wrapper = mountAs()

    for (const selector of ['.badge-role', '.badge-phase']) {
      expect(wrapper.find(`${selector} svg`).attributes('aria-hidden')).toBe('true')
    }
  })

  it('mostra o ícone de compartilhar só no estado ocioso do botão', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })

    const wrapper = mountAs()
    expect(wrapper.findComponent(IconShare).exists()).toBe(true)

    // Copiado: o rótulo vira o feedback ("Link copiado!") e o ícone sai de cena, pra
    // não sugerir que o botão ainda oferece a ação.
    await getShareButton(wrapper).trigger('click')
    await flushPromises()

    expect(wrapper.findComponent(IconShare).exists()).toBe(false)
  })
})

describe('RoomView.vue quem vota na rodada', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSocketJoinRoom.mockResolvedValue(undefined)
  })

  // Ana (admin, local), Bob e Cida — todos jogadores. `excluded` sai da rodada.
  function votingRoom(excluded: string[], votes: Record<string, string | number> = {}): Room {
    return {
      id: 'abc123',
      adminId: 'player-1',
      config: { deckType: 'fibonacci', autoReveal: false },
      players: [
        { id: 'player-1', name: 'Ana', role: 'admin' },
        { id: 'player-2', name: 'Bob', role: 'member' },
        { id: 'player-3', name: 'Cida', role: 'observer' },
      ],
      subjects: ['A'],
      phase: 'voting',
      rounds: [{ id: 'r1', subject: 'A', status: 'voting', votes, excludedVoterIds: excluded }],
      currentRoundIndex: 0,
    }
  }

  function mountVoting(room: Room, playerId = 'player-1') {
    setActivePinia(createPinia())
    useUserStore().setPlayer('Ana', playerId, playerId === 'player-1' ? 'admin' : 'member')
    useRoomStore().syncRoom(room)
    return mount(RoomView, { global: { stubs: childStubs } })
  }

  it('desconta os excluídos do voterCount (denominador do reveal)', async () => {
    // 3 jogadores, sendo 1 observer → 2 votantes; excluir o Bob deixa 1.
    const wrapper = mountVoting(votingRoom(['player-2']))
    await flushPromises()

    const voting = wrapper.findComponent(RoomVoting)
    expect(voting.props('voterCount')).toBe(1)
    expect(voting.props('nonVoterIds')).toEqual(['player-2'])
  })

  it('allVotersVoted ignora o voto que falta de quem foi excluído', async () => {
    // Só a Ana votou. Com o Bob dentro seria false; com ele fora, a rodada
    // está completa do ponto de vista de quem ela ainda espera.
    const semExclusao = mountVoting(votingRoom([], { 'player-1': 5 }))
    await flushPromises()
    expect(semExclusao.findComponent(RoomVoting).props('allVotersVoted')).toBe(false)

    const comExclusao = mountVoting(votingRoom(['player-2'], { 'player-1': 5 }))
    await flushPromises()
    expect(comExclusao.findComponent(RoomVoting).props('allVotersVoted')).toBe(true)
  })

  it('marca isVotingThisRound=false para o próprio usuário excluído', async () => {
    const dentro = mountVoting(votingRoom([]), 'player-2')
    await flushPromises()
    expect(dentro.findComponent(RoomVoting).props('isVotingThisRound')).toBe(true)

    const fora = mountVoting(votingRoom(['player-2']), 'player-2')
    await flushPromises()
    expect(fora.findComponent(RoomVoting).props('isVotingThisRound')).toBe(false)
  })

  it('encaminha o toggle-voter para o socket com o roomId da rota', async () => {
    const wrapper = mountVoting(votingRoom([]))
    await flushPromises()

    wrapper.findComponent(RoomVoting).vm.$emit('toggle-voter', 'player-2', false)
    await flushPromises()

    expect(mockSetRoundVoter).toHaveBeenCalledWith('abc123', 'player-2', false)
  })

  it('rodada sem o campo (pré-feature) não exclui ninguém', async () => {
    const room = votingRoom([])
    delete room.rounds[0]!.excludedVoterIds
    const wrapper = mountVoting(room)
    await flushPromises()

    expect(wrapper.findComponent(RoomVoting).props('nonVoterIds')).toEqual([])
    expect(wrapper.findComponent(RoomVoting).props('voterCount')).toBe(2)
  })
})

describe('RoomView.vue papel local × papel do servidor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSocketJoinRoom.mockResolvedValue(undefined)
  })

  function mountWith(localRole: 'admin' | 'member' | 'observer', room: Room) {
    setActivePinia(createPinia())
    useUserStore().setPlayer('Cida', 'player-3', localRole)
    useRoomStore().syncRoom(room)
    return mount(RoomView, { global: { stubs: childStubs } })
  }

  function votingRoom(players: Room['players'], adminId: string): Room {
    return {
      id: 'abc123',
      adminId,
      config: { deckType: 'fibonacci', autoReveal: false },
      players,
      subjects: ['A'],
      phase: 'voting',
      rounds: [{ id: 'r1', subject: 'A', status: 'voting', votes: {}, excludedVoterIds: [] }],
      currentRoundIndex: 0,
    }
  }

  // Regressão do quórum que nunca fechava: a Cida entrou como espectadora, o admin
  // saiu e o SERVIDOR a promoveu (roomManager.leaveRoom). O quórum do servidor já
  // contava com ela, mas o papel do localStorage seguia 'observer' — a UI não dava
  // o deck pra ela votar, e a rodada ficava esperando um voto impossível.
  it('segue o papel do servidor quando o local está defasado (observer promovido)', async () => {
    const wrapper = mountWith(
      'observer',
      votingRoom(
        [
          { id: 'player-3', name: 'Cida', role: 'admin' },
          { id: 'player-2', name: 'Bob', role: 'member' },
        ],
        'player-3',
      ),
    )
    await flushPromises()

    const voting = wrapper.findComponent(RoomVoting)
    expect(voting.props('isObserver')).toBe(false)
    expect(voting.props('isVotingThisRound')).toBe(true)
    // Ela agora é o denominador junto com o Bob — o mesmo que o servidor espera.
    expect(voting.props('voterCount')).toBe(2)
    expect(wrapper.find('.badge-role').classes()).toContain('admin')
  })

  // O outro lado: papel local otimista não coloca ninguém na rodada.
  it('trata como espectador quem o servidor lista como observer', async () => {
    const wrapper = mountWith(
      'member',
      votingRoom(
        [
          { id: 'player-1', name: 'Ana', role: 'admin' },
          { id: 'player-3', name: 'Cida', role: 'observer' },
        ],
        'player-1',
      ),
    )
    await flushPromises()

    const voting = wrapper.findComponent(RoomVoting)
    expect(voting.props('isObserver')).toBe(true)
    expect(voting.props('isVotingThisRound')).toBe(false)
    expect(voting.props('voterCount')).toBe(1)
  })

  // Fallback: entre o mount e o primeiro room_state_updated o usuário ainda não
  // está na lista — aí o papel local é tudo o que existe. Este caso passaria
  // TAMBÉM com o bug antigo (o papel local dava a mesma resposta): é cobertura do
  // ramo do fallback, não guarda de regressão — os dois casos acima é que são.
  it('usa o papel local enquanto o servidor não lista o jogador', async () => {
    const wrapper = mountWith(
      'observer',
      votingRoom([{ id: 'player-1', name: 'Ana', role: 'admin' }], 'player-1'),
    )
    await flushPromises()

    expect(wrapper.findComponent(RoomVoting).props('isObserver')).toBe(true)
    expect(wrapper.find('.badge-role').text()).toBe('Espectador')
  })
})

describe('RoomView.vue voto otimista × exclusão', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSocketJoinRoom.mockResolvedValue(undefined)
    mockCastVote.mockResolvedValue(undefined)
  })

  function room(excluded: string[], votes: Record<string, string | number> = {}): Room {
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
      rounds: [{ id: 'r1', subject: 'A', status: 'voting', votes, excludedVoterIds: excluded }],
      currentRoundIndex: 0,
    }
  }

  // O servidor apaga o voto de quem é excluído. Sem limpar o otimista, a carta
  // continuaria acesa numa rodada que a pessoa não está mais votando — e ela
  // acharia que votou.
  it('limpa o voto otimista quando o jogador é tirado da rodada', async () => {
    setActivePinia(createPinia())
    useUserStore().setPlayer('Bob', 'player-2', 'member')
    const roomStore = useRoomStore()
    roomStore.syncRoom(room([]))
    const wrapper = mount(RoomView, { global: { stubs: childStubs } })
    await flushPromises()

    wrapper.findComponent(RoomVoting).vm.$emit('vote', 8)
    await flushPromises()
    expect(wrapper.findComponent(RoomVoting).props('selectedVote')).toBe(8)

    // Admin tira o Bob: o servidor devolve a rodada sem o voto dele.
    roomStore.syncRoom(room(['player-2']))
    await flushPromises()

    expect(wrapper.findComponent(RoomVoting).props('isVotingThisRound')).toBe(false)
    expect(wrapper.findComponent(RoomVoting).props('selectedVote')).toBeNull()
  })

  // O outro caminho de poda do servidor: sair da sala (grace expirada) apaga o voto
  // da rodada em andamento. Aqui isVotingThisRound continua TRUE — a pessoa não é
  // observer nem foi excluída —, então o watch acima não cobre; sem o watch de
  // serverVote a carta seguiria acesa sobre um voto que o servidor não tem mais.
  // Cenário real: blip de rede > grace, o socket reconecta e o rejoin recoloca a
  // pessoa na sala sem nunca recarregar a instância Vue.
  it('limpa o voto otimista quando o servidor poda o voto de quem saiu e voltou', async () => {
    setActivePinia(createPinia())
    useUserStore().setPlayer('Bob', 'player-2', 'member')
    const roomStore = useRoomStore()
    roomStore.syncRoom(room([]))
    const wrapper = mount(RoomView, { global: { stubs: childStubs } })
    await flushPromises()

    // O otimista PRECISA existir para o cenário valer: é ele que sobreviveria à
    // poda. Um voto que só veio do servidor some sozinho quando o servidor o apaga.
    wrapper.findComponent(RoomVoting).vm.$emit('vote', 8)
    await flushPromises()
    roomStore.syncRoom(room([], { 'player-2': 8 })) // servidor confirma
    await flushPromises()
    expect(wrapper.findComponent(RoomVoting).props('selectedVote')).toBe(8)

    // Grace expirou → leaveRoom podou o voto; o rejoin devolve a pessoa à sala.
    roomStore.syncRoom(room([], {}))
    await flushPromises()

    expect(wrapper.findComponent(RoomVoting).props('isVotingThisRound')).toBe(true)
    expect(wrapper.findComponent(RoomVoting).props('selectedVote')).toBeNull()
  })
})
