// Types mirrored from the Frontend

export type Role = 'admin' | 'member' | 'observer'
export type DeckType = 'fibonacci' | 'tshirt' | 'sequential'
export type RoomPhase = 'setup' | 'voting' | 'completed'

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
  subjects: string[]
  phase: RoomPhase
  rounds: Round[]
  currentRoundIndex: number
}
