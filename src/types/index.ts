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
  rounds: Round[]
  currentRoundIndex: number
}

// Deck definitions
export const DECKS: Record<DeckType, { label: string; values: (string | number)[] }> = {
  fibonacci: {
    label: 'Fibonacci',
    values: [1, 2, 3, 5, 8, 13, 21, '☕'],
  },
  tshirt: {
    label: 'T-Shirt Sizes',
    values: ['PP', 'P', 'M', 'G', 'GG', 'XGG', '☕'],
  },
  sequential: {
    label: 'Sequencial',
    values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, '☕'],
  },
}
