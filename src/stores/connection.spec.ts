import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useConnectionStore } from './connection'

describe('connection store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('starts connecting and is therefore waiting', () => {
    const store = useConnectionStore()
    expect(store.status).toBe('connecting')
    expect(store.isWaiting).toBe(true)
    expect(store.isDown).toBe(false)
  })

  it('setConnected stops waiting and resets attempts', () => {
    const store = useConnectionStore()
    store.registerFailedAttempt()
    store.setConnected()
    expect(store.status).toBe('connected')
    expect(store.isWaiting).toBe(false)
    expect(store.attempts).toBe(0)
  })

  it('setReconnecting is a waiting state', () => {
    const store = useConnectionStore()
    store.setConnected()
    store.setReconnecting()
    expect(store.status).toBe('reconnecting')
    expect(store.isWaiting).toBe(true)
  })

  it('setReconnected: back online, resets attempts, and bumps the reconnect signal', () => {
    const store = useConnectionStore()
    store.registerFailedAttempt()
    const before = store.reconnectNonce
    store.setReconnected()
    expect(store.status).toBe('connected')
    expect(store.attempts).toBe(0)
    expect(store.reconnectNonce).toBe(before + 1)
  })

  it('flips to down only after crossing the reconnect budget', () => {
    const store = useConnectionStore()
    for (let i = 0; i < 4; i++) {
      store.registerFailedAttempt()
      expect(store.isDown).toBe(false)
    }
    store.registerFailedAttempt() // 5th attempt crosses the budget
    expect(store.status).toBe('down')
    expect(store.isDown).toBe(true)
    // 'down' is still a loading state (the socket keeps retrying), not an error.
    expect(store.isWaiting).toBe(true)
  })

  it('recovers from down when a connection finally succeeds', () => {
    const store = useConnectionStore()
    for (let i = 0; i < 6; i++) store.registerFailedAttempt()
    expect(store.isDown).toBe(true)
    store.setConnected()
    expect(store.status).toBe('connected')
    expect(store.isDown).toBe(false)
    expect(store.attempts).toBe(0)
  })

  it('reset returns to the initial connecting state', () => {
    const store = useConnectionStore()
    store.setConnected()
    store.reset()
    expect(store.status).toBe('connecting')
    expect(store.attempts).toBe(0)
  })
})
