import type { Player } from '@/types'

// Fonte única do filtro de papéis (antes repetido em RoomView, PokerTable e PlayerList).
export const isObserver = (player: Player): boolean => player.role === 'observer'

// Jogadores que "sentam à mesa" — exclui espectadores. NÃO é o mesmo que "quem
// vota": o admin pode tirar alguém de uma rodada e essa pessoa continua sentada
// (ver roundVotersOf). Use este para assento/roster, aquele para quórum.
export const activePlayersOf = (players: Player[]): Player[] =>
  players.filter((p) => !isObserver(p))

export const observersOf = (players: Player[]): Player[] => players.filter(isObserver)

// Presença, o TERCEIRO eixo — independente de papel (espectador) e de exclusão
// (tirado da rodada). Um ausente é quem o servidor diz que não tem socket vivo nem
// janela de graça: na prática, o fantasma que sobrou de um restart. Ele continua
// SENTADO (o servidor não o remove, senão um time em pleno reconnect perderia a
// sala), mas não conta como gente na mesa.
// Quem realmente está ali. Use para CONTAGEM ("Jogadores (N)") e para assento na
// mesa; use activePlayersOf quando o que importa é o roster, incluindo quem está
// fora no momento — a lista de jogadores mostra o ausente, só não o conta.
export const presentPlayersOf = (players: Player[], absentIds: string[]): Player[] =>
  players.filter((p) => !absentIds.includes(p.id))

// Espelha eligibleVotersOf do server: quem a rodada espera votar — nem
// espectador (da sala) nem excluído pelo admin (desta rodada).
export const isVotingInRound = (player: Player, excludedIds: string[]): boolean =>
  !isObserver(player) && !excludedIds.includes(player.id)

export const roundVotersOf = (players: Player[], excludedIds: string[]): Player[] =>
  players.filter((p) => isVotingInRound(p, excludedIds))
