import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRoom } from '../useRoom'
import { useUserStore } from '@/stores/user'

vi.mock('uuid', () => ({
  v4: () => 'mocked-uuid-1234',
}))

const mockRouterPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}))

const mockSocketJoin = vi.fn()
vi.mock('../useSocket', () => ({
  useSocket: () => ({
    joinRoom: mockSocketJoin,
  }),
}))

describe('useRoom', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('creates room locally and asks socket to create room on server', () => {
    const { createRoom } = useRoom()
    const userStore = useUserStore()

    createRoom('Adam', 'fibonacci', true)

    // Tests user creation
    expect(userStore.playerName).toBe('Adam')
    expect(userStore.playerId).toBe('mocked-uuid-1234') // Full UUID string
    expect(userStore.playerRole).toBe('admin')

    // Expect socket called
    expect(mockSocketJoin).toHaveBeenCalledWith(
      'mocked-u', // substring 8 -> 'mocked-u'
      { id: 'mocked-uuid-1234', name: 'Adam', role: 'admin' },
      { deckType: 'fibonacci', autoReveal: true },
    )

    // Expect navigation occurs
    expect(mockRouterPush).toHaveBeenCalledWith({ name: 'room', params: { id: 'mocked-u' } })
  })

  it('joins existing room', () => {
    const { joinRoom } = useRoom()
    const userStore = useUserStore()

    joinRoom('Maria', 'room-xyz', 'observer')

    // Check user data saved locally
    expect(userStore.playerName).toBe('Maria')
    expect(userStore.playerRole).toBe('observer')
    expect(userStore.playerId).toBe('mocked-uuid-1234')

    // Emits join call
    expect(mockSocketJoin).toHaveBeenCalledWith('room-xyz', {
      id: 'mocked-uuid-1234',
      name: 'Maria',
      role: 'observer',
    })

    // Navigates
    expect(mockRouterPush).toHaveBeenCalledWith({ name: 'room', params: { id: 'room-xyz' } })
  })
})
