// Types mirrored from the Frontend

export type Role = 'admin' | 'member' | 'observer'
export type DeckType = 'fibonacci' | 'tshirt' | 'sequential'
export type RoomPhase = 'setup' | 'voting' | 'completed'

// Área/disciplina auto-declarada pelo jogador na entrada. Enum fixo (single
// source) reusado pela validação de entrada (validation.ts) e pela guarda de
// persistência; o cliente espelhará esta lista e a traduzirá (i18n `tags.*`) na
// fatia 2. `other` é o escape para quem não se encaixa. A espelhar em
// src/types/index.ts.
export const PLAYER_TAGS = ['dev', 'design', 'qa', 'product', 'other'] as const
export type PlayerTag = (typeof PLAYER_TAGS)[number]

export interface Player {
  id: string
  name: string
  role: Role
  // OPCIONAL e puramente informativa: identifica a área da pessoa (dev, design,
  // ...), não afeta voto/quórum/autoReveal. Ausente = sem tag, o que inclui
  // players de snapshots anteriores a esta feature.
  tag?: PlayerTag
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
  // Jogadores que o admin tirou DESTA rodada. É uma lista de EXCLUSÃO (e não de
  // votantes) de propósito: quem entra na sala depois não está nela, então entra
  // votando, e `[]` significa "todos votam" em vez de "ninguém vota". Opcional
  // porque rodadas persistidas antes da feature não têm o campo (= ninguém fora).
  excludedVoterIds?: string[]
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

// Per-socket authenticated identity, stored on `socket.data` (the idiomatic
// Socket.IO place) instead of ad-hoc handler closures. Set only after a valid
// join_room — the single source of truth for authorization; ids from payloads
// are never trusted. Both null until a successful join.
export interface SocketData {
  roomId: string | null
  playerId: string | null
}
