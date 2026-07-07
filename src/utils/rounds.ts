import type { Room, Round } from '@/types'

// Uma rodada revelada com seu número de exibição (1-based) = a posição REAL no
// array `rounds`, não a posição no subconjunto filtrado.
export interface NumberedRound {
  round: Round
  number: number
}

// Fonte única do "resumo ao vivo" da sala: só rodadas já REVELADAS entram. O
// servidor transmite `round.votes` mesmo antes do reveal (é o cliente que
// esconde), então incluir a rodada em votação vazaria a média/valores. Numera
// pelo índice real ANTES de filtrar — robusto caso uma rodada fique sem revelar.
// O contador da aba deriva do `.length` disto, pra nunca divergir do que o
// RoomSummary lista (o filtro é a barreira contra vazamento de votos).
export function revealedRoundsOf(room: Room | null | undefined): NumberedRound[] {
  return (room?.rounds ?? [])
    .map((round, index) => ({ round, number: index + 1 }))
    .filter(({ round }) => round.status === 'revealed')
}
