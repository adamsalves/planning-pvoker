import { describe, it, expect, beforeEach } from 'vitest'
import router from '../index'

describe('router', () => {
  beforeEach(async () => {
    await router.push('/')
    await router.isReady()
  })

  it('defines a non-empty meta.title for every route', () => {
    for (const route of router.getRoutes()) {
      expect(route.meta.title).toBeTruthy()
    }
  })

  it('updates document.title after navigating', async () => {
    await router.push({ name: 'history' })
    expect(document.title).toBe('Histórico · Planning Poker')

    await router.push({ name: 'home' })
    expect(document.title).toBe('Início · Planning Poker')
  })

  it('scrolls to top on navigation', async () => {
    const result = await router.options.scrollBehavior?.(
      router.currentRoute.value,
      router.currentRoute.value,
      null,
    )
    expect(result).toEqual({ top: 0 })
  })

  it('honra a posição salva no voltar/avançar', async () => {
    const saved = { left: 0, top: 240 }
    const result = await router.options.scrollBehavior?.(
      router.currentRoute.value,
      router.currentRoute.value,
      saved,
    )
    expect(result).toBe(saved)
  })

  it('inclui o código da sala no title da rota room', async () => {
    await router.push({ name: 'room', params: { id: 'a1b2c3d4' } })
    expect(document.title).toBe('Sala a1b2c3d4 · Planning Poker')
  })
})
