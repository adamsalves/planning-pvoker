import type { Player } from '@/types'

// Fonte única do filtro de papéis (antes repetido em RoomView, PokerTable e PlayerList).
export const isObserver = (player: Player): boolean => player.role === 'observer'

// Jogadores que "sentam à mesa" — exclui espectadores. NÃO é o mesmo que "quem
// vota": o admin pode tirar alguém de uma rodada e essa pessoa continua sentada
// (ver roundVotersOf). Use este para assento/roster, aquele para quórum.
export const activePlayersOf = (players: Player[]): Player[] =>
  players.filter((p) => !isObserver(p))

export const observersOf = (players: Player[]): Player[] => players.filter(isObserver)

// Espelha eligibleVotersOf do server: quem a rodada espera votar — nem
// espectador (da sala) nem excluído pelo admin (desta rodada).
export const isVotingInRound = (player: Player, excludedIds: string[]): boolean =>
  !isObserver(player) && !excludedIds.includes(player.id)

export const roundVotersOf = (players: Player[], excludedIds: string[]): Player[] =>
  players.filter((p) => isVotingInRound(p, excludedIds))
