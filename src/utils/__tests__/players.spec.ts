import { describe, it, expect } from 'vitest'
import { isObserver, activePlayersOf, observersOf } from '../players'
import type { Player } from '@/types'

const admin: Player = { id: '1', name: 'Ana', role: 'admin' }
const member: Player = { id: '2', name: 'Beto', role: 'member' }
const observer: Player = { id: '3', name: 'Cae', role: 'observer' }
const players: Player[] = [admin, member, observer]

describe('utils/players', () => {
  it('isObserver identifica só o papel observer', () => {
    expect(isObserver(admin)).toBe(false)
    expect(isObserver(member)).toBe(false)
    expect(isObserver(observer)).toBe(true)
  })

  it('activePlayersOf exclui observers (admin e member entram)', () => {
    expect(activePlayersOf(players)).toEqual([admin, member])
  })

  it('observersOf retorna só observers', () => {
    expect(observersOf(players)).toEqual([observer])
  })

  it('lida com lista vazia', () => {
    expect(activePlayersOf([])).toEqual([])
    expect(observersOf([])).toEqual([])
  })
})
