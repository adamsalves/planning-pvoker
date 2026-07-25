import { describe, it, expect } from 'vitest'
import {
  isObserver,
  activePlayersOf,
  observersOf,
  isVotingInRound,
  roundVotersOf,
} from '../players'
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

  // Espelha eligibleVotersOf do server: quem a rodada espera votar.
  describe('quem vota na rodada', () => {
    it('isVotingInRound descarta observer E excluído da rodada', () => {
      expect(isVotingInRound(member, [])).toBe(true)
      expect(isVotingInRound(member, [member.id])).toBe(false)
      // Observer nunca vota, esteja ou não na lista de exclusão.
      expect(isVotingInRound(observer, [])).toBe(false)
      expect(isVotingInRound(observer, [observer.id])).toBe(false)
    })

    it('roundVotersOf estreita activePlayersOf pela exclusão', () => {
      expect(roundVotersOf(players, [])).toEqual([admin, member])
      expect(roundVotersOf(players, [member.id])).toEqual([admin])
      expect(roundVotersOf(players, [admin.id, member.id])).toEqual([])
    })

    it('ignora id excluído que não está mais na sala (jogador saiu)', () => {
      // O server não limpa a exclusão no leaveRoom de propósito; o filtro roda
      // sobre os jogadores presentes, então o id órfão é inofensivo.
      expect(roundVotersOf(players, ['fantasma'])).toEqual([admin, member])
    })
  })
})
