// Types mirrored from the Frontend

export type Role = 'admin' | 'member' | 'observer'
export type DeckType = 'fibonacci' | 'tshirt' | 'sequential'

export interface Player {
  id: string
  name: string
  role: Role
}

export interface RoomConfig {
  deckType: DeckType
  autoReveal: boolean
}

export interface Round {
  id: string
  subject: string
  status: 'voting' | 'revealed'
  votes: Record<string, string | number>
}

export interface Room {
  id: string
  adminId: string
  config: RoomConfig
  players: Player[]
  rounds: Round[]
  currentRoundIndex: number
}
