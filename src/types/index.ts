// Types for the Planning Poker application

// Constantes como "single source of truth" — tanto os tipos quanto o Zod derivam delas
export const DECK_TYPES = ['fibonacci', 'tshirt', 'sequential'] as const
// Valor referenciado só neste arquivo (deriva o tipo `Role`); @public evita que o
// knip reporte o export como desnecessário (antes coberto por ignoreExportsUsedInFile).
/** @public */
export const PLAYER_ROLES = ['admin', 'member', 'observer'] as const
export const JOINABLE_ROLES = ['member', 'observer'] as const
// Área/disciplina auto-declarada pelo jogador na entrada. Enum fixo (single
// source): o schema dos forms e o badge da PlayerList derivam desta lista, e o
// catálogo i18n `tags.*` a traduz. Espelha PLAYER_TAGS em server/src/types.ts.
export const PLAYER_TAGS = ['dev', 'design', 'qa', 'product', 'other'] as const

// Tipos derivados das constantes — sempre sincronizados
export type DeckType = (typeof DECK_TYPES)[number]
export type PlayerRole = (typeof PLAYER_ROLES)[number]
export type JoinableRole = (typeof JOINABLE_ROLES)[number]
export type PlayerTag = (typeof PLAYER_TAGS)[number]

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
  // Área opcional e auto-declarada (dev, design, ...). Puramente informativa —
  // não afeta voto/quórum. Espelha server/src/types.ts.
  tag?: PlayerTag
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
