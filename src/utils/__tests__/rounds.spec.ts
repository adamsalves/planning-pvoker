import { describe, it, expect } from 'vitest'
import { revealedRoundsOf } from '../rounds'
import type { Room, Round } from '@/types'
import { must } from '@/test-utils/must'

function round(id: string, status: Round['status']): Round {
  return { id, subject: id, status, votes: {} }
}

function roomWith(rounds: Round[]): Room {
  return {
    id: 'r1',
    adminId: 'p1',
    config: { deckType: 'fibonacci', autoReveal: false },
    players: [],
    subjects: rounds.map((r) => r.subject),
    phase: 'voting',
    rounds,
    currentRoundIndex: rounds.length - 1,
  }
}

describe('utils/rounds', () => {
  it('retorna vazio para sala nula/indefinida', () => {
    expect(revealedRoundsOf(null)).toEqual([])
    expect(revealedRoundsOf(undefined)).toEqual([])
  })

  it('lida com sala sem rodadas', () => {
    expect(revealedRoundsOf(roomWith([]))).toEqual([])
  })

  it('inclui só rodadas reveladas (a rodada em votação não vaza)', () => {
    const result = revealedRoundsOf(roomWith([round('a', 'revealed'), round('b', 'voting')]))
    expect(result).toHaveLength(1)
    expect(must(result[0], 'first revealed round').round.id).toBe('a')
  })

  it('numera pelo índice REAL, não pela posição no subconjunto filtrado', () => {
    const result = revealedRoundsOf(
      roomWith([round('a', 'revealed'), round('b', 'voting'), round('c', 'revealed')]),
    )
    expect(result.map((r) => r.number)).toEqual([1, 3])
    expect(result.map((r) => r.round.id)).toEqual(['a', 'c'])
  })
})
