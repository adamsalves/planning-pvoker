import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RoomView from '../RoomView.vue'
import { useRoomStore } from '@/stores/room'
import { useUserStore } from '@/stores/user'
import type { Room } from '@/types'

const mockRouterPush = vi.fn()
const mockSocketJoinRoom = vi.fn()

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
    castVote: vi.fn(),
    revealVotes: vi.fn(),
    disconnect: vi.fn(),
    joinRoom: mockSocketJoinRoom,
  }),
}))

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

function mountRoomView() {
  setActivePinia(createPinia())

  const userStore = useUserStore()
  userStore.setPlayer('Ana', 'player-1', 'admin')

  const roomStore = useRoomStore()
  roomStore.syncRoom(createRoom())

  return mount(RoomView, {
    global: {
      stubs: {
        SubjectForm: true,
        RoundHeader: true,
        VotingArea: true,
        PlayerList: true,
        PokerTable: true,
        VoteReveal: true,
        RoundControls: true,
        SessionSummary: true,
      },
    },
  })
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
