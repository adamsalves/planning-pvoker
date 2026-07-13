import { computed, toValue, type MaybeRefOrGetter } from 'vue'

export type VoteValue = string | number
export type Votes = Record<string, VoteValue>

// Type guard único (regra do projeto: sem casts `as`).
export const isNumericVote = (v: VoteValue): v is number => typeof v === 'number'

// Helpers puros — reusáveis fora de um contexto reativo (sem refs), p.ex. para
// calcular a média de uma rodada avulsa.
export function numericVotesOf(votes: Votes): number[] {
  return Object.values(votes).filter(isNumericVote)
}

export function averageOf(votes: Votes): number | null {
  const nums = numericVotesOf(votes)
  if (nums.length === 0) return null
  const sum = nums.reduce((acc, v) => acc + v, 0)
  // Arredonda a 1 casa decimal — fonte única (antes cada componente arredondava
  // de um jeito: Math.round(x*10)/10, x.toFixed(1) e sum/n cru).
  return Math.round((sum / nums.length) * 10) / 10
}

/**
 * Estatísticas de um conjunto de votos como fonte única — antes duplicadas e
 * divergentes em vários componentes. Aceita ref, getter ou valor cru e recomputa
 * reativamente quando os votos mudam.
 */
export function useVoteStats(votesSource: MaybeRefOrGetter<Votes>) {
  const values = computed(() => Object.values(toValue(votesSource)))
  const numericVotes = computed(() => values.value.filter(isNumericVote))
  const count = computed(() => values.value.length)

  const average = computed(() => averageOf(toValue(votesSource)))

  const min = computed(() =>
    numericVotes.value.length > 0 ? Math.min(...numericVotes.value) : null,
  )
  const max = computed(() =>
    numericVotes.value.length > 0 ? Math.max(...numericVotes.value) : null,
  )

  // Consenso = todos os votos iguais (numéricos OU textuais) e pelo menos um voto.
  // Vale também para decks textuais (T-Shirt): todos "M" contam como consenso.
  const hasConsensus = computed(() => {
    if (values.value.length === 0) return false
    const first = values.value[0]
    return values.value.every((v) => v === first)
  })
  const consensusValue = computed(() => (hasConsensus.value ? (values.value[0] ?? null) : null))

  // Distribuição: quantas vezes cada valor aparece, ordenada por contagem desc.
  const distribution = computed(() => {
    const dist: Record<string, number> = {}
    for (const vote of values.value) {
      const key = String(vote)
      dist[key] = (dist[key] || 0) + 1
    }
    return Object.entries(dist)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
  })
  const maxCount = computed(() =>
    distribution.value.length > 0 ? Math.max(...distribution.value.map((d) => d.count)) : 0,
  )

  return {
    values,
    numericVotes,
    count,
    average,
    min,
    max,
    hasConsensus,
    consensusValue,
    distribution,
    maxCount,
  }
}
