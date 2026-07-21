import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { useUserStore } from './user'

describe('user store', () => {
  beforeEach(() => {
    localStorage.clear()
    const pinia = createPinia()
    pinia.use(piniaPluginPersistedstate)
    setActivePinia(pinia)
  })

  it('começa vazio: sem nome/id, papel member, sem sala nem token', () => {
    const store = useUserStore()
    expect(store.playerName).toBe('')
    expect(store.playerId).toBe('')
    expect(store.playerRole).toBe('member')
    expect(store.playerTag).toBeUndefined()
    expect(store.activeRoomId).toBeNull()
    expect(store.sessionToken).toBeNull()
  })

  it('setPlayer grava a área (tag) e clearPlayer a limpa', () => {
    const store = useUserStore()
    store.setPlayer('Ana', 'p1', 'member', 'design')
    expect(store.playerTag).toBe('design')

    store.clearPlayer()
    expect(store.playerTag).toBeUndefined()
  })

  it('setPlayer grava nome, id e papel', () => {
    const store = useUserStore()
    store.setPlayer('Ana', 'p1', 'observer')
    expect(store.playerName).toBe('Ana')
    expect(store.playerId).toBe('p1')
    expect(store.playerRole).toBe('observer')
  })

  it('setActiveRoom e setSessionToken atualizam o valor e aceitam null', () => {
    const store = useUserStore()
    store.setActiveRoom('room-1')
    store.setSessionToken('tok-1')
    expect(store.activeRoomId).toBe('room-1')
    expect(store.sessionToken).toBe('tok-1')

    store.setActiveRoom(null)
    store.setSessionToken(null)
    expect(store.activeRoomId).toBeNull()
    expect(store.sessionToken).toBeNull()
  })

  it('clearPlayer reseta identidade e token, mas NÃO mexe em activeRoomId', () => {
    const store = useUserStore()
    store.setPlayer('Ana', 'p1', 'admin')
    store.setSessionToken('tok-1')
    store.setActiveRoom('room-1')

    store.clearPlayer()

    expect(store.playerName).toBe('')
    expect(store.playerId).toBe('')
    expect(store.playerRole).toBe('member')
    expect(store.sessionToken).toBeNull()
    // Só setActiveRoom(null) limpa a sala — o leave da RoomView chama os dois.
    expect(store.activeRoomId).toBe('room-1')
  })
})
