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

// joinRoom is async now (callers await the ack before navigating), so the mock
// resolves a Promise.
const mockSocketJoin = vi.fn().mockResolvedValue(undefined)
vi.mock('../useSocket', () => ({
  useSocket: () => ({
    joinRoom: mockSocketJoin,
  }),
}))

describe('useRoom', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockSocketJoin.mockResolvedValue(undefined)
  })

  it('creates room locally and asks socket to create room on server', async () => {
    const { createRoom } = useRoom()
    const userStore = useUserStore()

    await createRoom('Adam', 'fibonacci', true)

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

  it('joins existing room', async () => {
    const { joinRoom } = useRoom()
    const userStore = useUserStore()

    await joinRoom('Maria', 'room-xyz', 'observer')

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

  it('threads the area tag into the local player and the socket join (create)', async () => {
    const { createRoom } = useRoom()
    const userStore = useUserStore()

    await createRoom('Adam', 'fibonacci', true, 'design')

    expect(userStore.playerTag).toBe('design')
    expect(mockSocketJoin).toHaveBeenCalledWith(
      'mocked-u',
      { id: 'mocked-uuid-1234', name: 'Adam', role: 'admin', tag: 'design' },
      { deckType: 'fibonacci', autoReveal: true },
    )
  })

  it('threads the area tag into the local player and the socket join (join)', async () => {
    const { joinRoom } = useRoom()
    const userStore = useUserStore()

    await joinRoom('Maria', 'room-xyz', 'observer', 'qa')

    expect(userStore.playerTag).toBe('qa')
    expect(mockSocketJoin).toHaveBeenCalledWith('room-xyz', {
      id: 'mocked-uuid-1234',
      name: 'Maria',
      role: 'observer',
      tag: 'qa',
    })
  })

  it('propagates the error and does not navigate when the join is rejected', async () => {
    mockSocketJoin.mockRejectedValueOnce(new Error('Sessão inválida'))
    const { joinRoom } = useRoom()

    // Propaga o erro (o HomeView dá o feedback); não navega.
    await expect(joinRoom('Maria', 'room-xyz', 'observer')).rejects.toThrow('Sessão inválida')

    expect(mockSocketJoin).toHaveBeenCalled()
    expect(mockRouterPush).not.toHaveBeenCalled()
  })

  it('propagates the error and does not navigate when create is rejected', async () => {
    mockSocketJoin.mockRejectedValueOnce(new Error('Falha ao criar'))
    const { createRoom } = useRoom()

    await expect(createRoom('Adam', 'fibonacci', false)).rejects.toThrow('Falha ao criar')

    expect(mockRouterPush).not.toHaveBeenCalled()
  })
})
