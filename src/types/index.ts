// Types for the Planning Poker application

export type PlayerRole = 'admin' | 'member' | 'observer'

export type DeckType = 'fibonacci' | 'tshirt' | 'sequential'

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
