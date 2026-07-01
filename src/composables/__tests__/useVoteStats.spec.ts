import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useVoteStats, numericVotesOf, averageOf, isNumericVote, type Votes } from '../useVoteStats'

describe('useVoteStats', () => {
  it('conjunto vazio → nulos/zeros, sem consenso', () => {
    const s = useVoteStats({})
    expect(s.count.value).toBe(0)
    expect(s.average.value).toBeNull()
    expect(s.min.value).toBeNull()
    expect(s.max.value).toBeNull()
    expect(s.hasConsensus.value).toBe(false)
    expect(s.consensusValue.value).toBeNull()
    expect(s.distribution.value).toEqual([])
    expect(s.maxCount.value).toBe(0)
    expect(s.numericVotes.value).toEqual([])
  })

  it('votos numéricos distintos → média/min/max, sem consenso', () => {
    const s = useVoteStats({ a: 1, b: 2, c: 3 })
    expect(s.count.value).toBe(3)
    expect(s.average.value).toBe(2)
    expect(s.min.value).toBe(1)
    expect(s.max.value).toBe(3)
    expect(s.hasConsensus.value).toBe(false)
    expect(s.numericVotes.value).toEqual([1, 2, 3])
  })

  it('todos numéricos iguais → consenso', () => {
    const s = useVoteStats({ a: 5, b: 5, c: 5 })
    expect(s.hasConsensus.value).toBe(true)
    expect(s.consensusValue.value).toBe(5)
    expect(s.average.value).toBe(5)
    expect(s.min.value).toBe(5)
    expect(s.max.value).toBe(5)
  })

  it('voto 0 conta como numérico (type-guard por typeof, não truthy)', () => {
    const s = useVoteStats({ a: 0, b: 0 })
    expect(s.numericVotes.value).toEqual([0, 0])
    expect(s.hasConsensus.value).toBe(true)
    expect(s.consensusValue.value).toBe(0) // preserva 0 (não vira null pelo ??)
    expect(s.average.value).toBe(0)
    expect(s.min.value).toBe(0)
    expect(s.max.value).toBe(0)
  })

  it('votos mistos (num + texto) → estatísticas só dos numéricos, sem consenso', () => {
    const s = useVoteStats({ a: 1, b: 'M', c: 3 })
    expect(s.count.value).toBe(3)
    expect(s.numericVotes.value).toEqual([1, 3])
    expect(s.average.value).toBe(2)
    expect(s.min.value).toBe(1)
    expect(s.max.value).toBe(3)
    expect(s.hasConsensus.value).toBe(false)
  })

  it('consenso textual → hasConsensus, sem média numérica', () => {
    const s = useVoteStats({ a: 'M', b: 'M' })
    expect(s.hasConsensus.value).toBe(true)
    expect(s.consensusValue.value).toBe('M')
    expect(s.average.value).toBeNull()
    expect(s.min.value).toBeNull()
    expect(s.max.value).toBeNull()
  })

  it('votos textuais distintos → sem consenso, sem média', () => {
    const s = useVoteStats({ a: 'P', b: 'M' })
    expect(s.hasConsensus.value).toBe(false)
    expect(s.average.value).toBeNull()
  })

  it('média arredonda a 1 casa decimal (fonte única)', () => {
    expect(useVoteStats({ a: 1, b: 2 }).average.value).toBe(1.5)
    expect(useVoteStats({ a: 1, b: 1, c: 2 }).average.value).toBe(1.3) // 1.333...
    expect(useVoteStats({ a: 1, b: 2, c: 2 }).average.value).toBe(1.7) // 1.666...
  })

  it('distribution ordena por contagem desc e maxCount reflete o topo', () => {
    const s = useVoteStats({ a: 5, b: 5, c: 3, d: 5, e: 3 })
    expect(s.distribution.value).toEqual([
      { value: '5', count: 3 },
      { value: '3', count: 2 },
    ])
    expect(s.maxCount.value).toBe(3)
  })

  it('recomputa reativamente quando os votos mudam', () => {
    const votes = ref<Votes>({ a: 1 })
    const s = useVoteStats(votes)
    expect(s.count.value).toBe(1)
    expect(s.hasConsensus.value).toBe(true)

    votes.value = { a: 1, b: 8 }
    expect(s.count.value).toBe(2)
    expect(s.average.value).toBe(4.5)
    expect(s.hasConsensus.value).toBe(false)
  })
})

describe('helpers puros', () => {
  it('isNumericVote distingue número de string', () => {
    expect(isNumericVote(5)).toBe(true)
    expect(isNumericVote('M')).toBe(false)
  })

  it('numericVotesOf filtra só os numéricos (inclui 0)', () => {
    expect(numericVotesOf({ a: 1, b: 'M', c: 3 })).toEqual([1, 3])
    expect(numericVotesOf({ a: 'P', b: 'M' })).toEqual([])
    expect(numericVotesOf({ a: 0, b: 4 })).toEqual([0, 4])
  })

  it('averageOf: média arredondada, null quando não há numéricos', () => {
    expect(averageOf({ a: 2, b: 4 })).toBe(3)
    expect(averageOf({ a: 1, b: 1, c: 2 })).toBe(1.3)
    expect(averageOf({ a: 0, b: 2 })).toBe(1) // 0 entra na média
    expect(averageOf({})).toBeNull()
    expect(averageOf({ a: 'M', b: 'G' })).toBeNull()
  })
})
