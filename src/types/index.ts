// Types for the Planning Poker application

// Constantes como "single source of truth" — tanto os tipos quanto o Zod derivam delas
export const DECK_TYPES = ['fibonacci', 'tshirt', 'sequential'] as const
export const PLAYER_ROLES = ['admin', 'member', 'observer'] as const
export const JOINABLE_ROLES = ['member', 'observer'] as const

// Tipos derivados das constantes — sempre sincronizados
export type DeckType = (typeof DECK_TYPES)[number]
export type PlayerRole = (typeof PLAYER_ROLES)[number]
export type JoinableRole = (typeof JOINABLE_ROLES)[number]

export type RoundStatus = 'waiting' | 'voting' | 'revealed'
export type RoomPhase = 'setup' | 'voting' | 'completed'

// Estado da conexão Socket.IO (fonte única no connection store). 'connecting' =
// primeiro contato / cold start do Render; 'reconnecting' = caiu e está voltando;
// 'down' = passou do budget de tentativas (segue tentando, só muda a percepção).
export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'down'

export interface Player {
  id: string
  name: string
  role: PlayerRole
}

export interface Vote {
  playerId: string
  value: string | number | null
}

export interface Round {
  id: string
  subject: string
  status: RoundStatus
  votes: Record<string, string | number> // playerId -> vote value
  // Jogadores que o admin tirou DESTA rodada. Lista de EXCLUSÃO (e não de
  // votantes) de propósito: quem entra na sala depois não está nela, então
  // entra votando, e `[]` significa "todos votam". Opcional porque rodadas
  // criadas antes da feature não têm o campo. Espelha server/src/types.ts.
  excludedVoterIds?: string[]
}

export interface RoomConfig {
  deckType: DeckType
  autoReveal: boolean
}

export interface Room {
  id: string
  adminId: string
  config: RoomConfig
  players: Player[]
  subjects: string[]
  phase: RoomPhase
  rounds: Round[]
  currentRoundIndex: number
}

// Deck definitions — o rótulo exibido vem do catálogo i18n (chaves `decks.*`).
export const DECKS: Record<DeckType, { values: (string | number)[] }> = {
  fibonacci: {
    values: [1, 2, 3, 5, 8, 13, 21, '☕'],
  },
  tshirt: {
    values: ['PP', 'P', 'M', 'G', 'GG', 'XGG', '☕'],
  },
  sequential: {
    values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, '☕'],
  },
}
