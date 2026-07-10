import type { Player } from '@/types'

// Fonte única do filtro de papéis (antes repetido em RoomView, PokerTable e PlayerList).
export const isObserver = (player: Player): boolean => player.role === 'observer'

// Jogadores que "sentam à mesa" e votam — exclui espectadores.
export const activePlayersOf = (players: Player[]): Player[] =>
  players.filter((p) => !isObserver(p))

export const observersOf = (players: Player[]): Player[] => players.filter(isObserver)
