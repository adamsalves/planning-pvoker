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

// Estes dois espelham o CONTRATO DE REDE — o servidor é quem produz os valores
// (`Round['status']` e `Room['phase']` em server/src/types.ts, validados no
// roomSchema da persistência). Um valor a mais aqui não cria um estado novo: cria
// um ramo que o servidor nunca emite e que o cliente carrega achando que existe.
// Foi o que aconteceu com um 'waiting' em RoundStatus, removido em 2026-07-26 —
// nada nunca o produziu ou consumiu COMO RoundStatus (o servidor jamais teve a
// string em `server/src/`, em commit nenhum).
// Const arrays como o resto do arquivo, e não uniões soltas, por um motivo a mais
// aqui: união de tipo some na compilação, então nenhum teste alcança. Como estes
// dois espelham o servidor, é o valor em runtime que torna a deriva ASSERTÁVEL —
// ver o guarda em __tests__/contract-drift.spec.ts, que compara com as listas de
// server/src/types.ts e falha se um lado ganhar um valor que o outro não tem.
/** @public */
export const ROUND_STATUSES = ['voting', 'revealed'] as const
/** @public */
export const ROOM_PHASES = ['setup', 'voting', 'completed'] as const

export type RoundStatus = (typeof ROUND_STATUSES)[number]
export type RoomPhase = (typeof ROOM_PHASES)[number]

// ATENÇÃO: 'waiting' continua VIVO no cliente — só não é contrato de rede. É um
// pseudo-estado de UI que significa "ainda não há rodada", nascido do
// `currentRound?.status ?? 'waiting'` do RoomVoting e do `status="waiting"` que o
// RoomSetup passa direto. PokerTable, RoundHeader, RoundControls e PlayerList
// recebem ESTE tipo, não RoundStatus, e as chaves i18n `room.table.waiting` e
// `room.round.status.waiting` existem para ele. Não saia limpando o 'waiting'
// achando que é resíduo do que foi removido acima: são coisas diferentes.
//
// Declarado aqui, e não como união inline em cada componente (que era como estava),
// para que a relação com o contrato de rede seja IMPOSTA em vez de coincidente —
// se RoundStatus ganhar um valor, os quatro componentes o acompanham sozinhos.
export type UiRoundStatus = RoundStatus | 'waiting'

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
  // Sentados que NÃO estão presentes: sem socket vivo e fora da janela de graça.
  // Na prática é o fantasma de rehidratação — quem está com a aba aberta tem
  // socket, quem deu refresh está na graça, e quem passou dela o servidor já
  // removeu. Espelha `RoomBroadcast` em server/src/types.ts, e SÓ existe no
  // broadcast: é estado do processo (sockets/timers), nunca persistido — do lado
  // do servidor `Room` não tem este campo, de propósito.
  //
  // Opcional pelo mesmo motivo de `excludedVoterIds`: nem toda sala que o cliente
  // segura veio de um servidor que manda o campo (fixture de teste, e um cliente
  // novo contra um servidor antigo durante um deploy). Ausente = ninguém ausente.
  absentPlayerIds?: string[]
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
