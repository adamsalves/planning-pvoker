// Types mirrored from the Frontend

// O VOCABULÁRIO do contrato de rede, como const arrays em vez de uniões soltas —
// mesmo padrão que PLAYER_TAGS já usava, agora estendido aos outros quatro.
//
// Duas razões, nesta ordem:
//   1. Os `z.enum` de validation.ts e persistence.ts DERIVAM daqui. Antes cada um
//      repetia os literais na mão, então papéis e decks estavam declarados TRÊS
//      vezes só no servidor — e foi uma terceira cópia esquecida que deixou um
//      status de rodada fantasma sobreviver no cliente por meses (ver o guarda de
//      deriva em src/types/__tests__).
//   2. Const array existe em runtime, e é isso que torna a deriva contra o cliente
//      ASSERTÁVEL. Uma união de tipos some na compilação e nenhum teste a alcança.
//
// Ao acrescentar um valor aqui, acrescente no espelho do cliente (src/types/index.ts)
// — o guarda de deriva falha até que os dois batam, que é o ponto dele.
//
// @public: exportados de propósito (módulo de tipos do domínio); alguns são usados
// só aqui e no guarda de deriva. O tag evita o knip reportá-los como over-export
// sem precisar do ignoreExportsUsedInFile global.
/** @public */
export const PLAYER_ROLES = ['admin', 'member', 'observer'] as const
/** @public */
export const DECK_TYPES = ['fibonacci', 'tshirt', 'sequential'] as const
/** @public */
export const ROOM_PHASES = ['setup', 'voting', 'completed'] as const
/** @public */
export const ROUND_STATUSES = ['voting', 'revealed'] as const

/** @public */
export type Role = (typeof PLAYER_ROLES)[number]
export type DeckType = (typeof DECK_TYPES)[number]
/** @public */
export type RoomPhase = (typeof ROOM_PHASES)[number]
/** @public */
export type RoundStatus = (typeof ROUND_STATUSES)[number]

// Área/disciplina auto-declarada pelo jogador na entrada. Enum fixo (single
// source) reusado pela validação de entrada (validation.ts) e pela guarda de
// persistência; o cliente espelhará esta lista e a traduzirá (i18n `tags.*`) na
// fatia 2. `other` é o escape para quem não se encaixa. A espelhar em
// src/types/index.ts.
export const PLAYER_TAGS = ['dev', 'design', 'qa', 'product', 'other'] as const
/** @public */
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
  status: RoundStatus
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

// The room AS BROADCAST. `Room` is the stored shape — what persistence writes and
// rehydrates — and presence is emphatically NOT part of it: it lives in sockets and
// grace timers inside the events.ts closure, is process-local, and is meaningless
// the moment the process dies. Persisting it would rehydrate a lie.
//
// So the wire type is the stored one PLUS a per-broadcast projection, built fresh in
// notifyRoomUpdate. Keeping it a separate interface is what stops `absentPlayerIds`
// from ever reaching saveRoom: nothing that holds a `Room` can produce this.
//
// Who is in here: a seated player with no live socket and no pending grace timer.
// In practice that is exactly a rehydration ghost — a live socket counts as present,
// someone mid-refresh is inside the grace window, and once the grace expires
// leaveRoom removes the player outright. See the note on RoomManager.hydrate.
export interface RoomBroadcast extends Room {
  absentPlayerIds: string[]
}

// Per-socket authenticated identity, stored on `socket.data` (the idiomatic
// Socket.IO place) instead of ad-hoc handler closures. Set only after a valid
// join_room — the single source of truth for authorization; ids from payloads
// are never trusted. Both null until a successful join.
export interface SocketData {
  roomId: string | null
  playerId: string | null
}
