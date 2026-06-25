import { z } from 'zod'
import { DeckType } from './types'

// Limites defensivos: as salas vivem in-memory, então payloads sem limite
// permitiriam um cliente malicioso estourar a memória do processo.
const MAX_ID = 64
const MAX_NAME = 40
const MAX_ROOM_ID = 64
const MAX_SUBJECT = 200
const MAX_SUBJECTS_PER_CALL = 50
const MAX_VOTE_STR = 10
const MAX_TOKEN = 128

// Valores válidos por baralho — espelha DECKS em src/types/index.ts.
// Usado para rejeitar votos forjados que não pertencem ao deck da sala.
export const DECK_VALUES: Record<DeckType, (string | number)[]> = {
  fibonacci: [1, 2, 3, 5, 8, 13, 21, '☕'],
  tshirt: ['PP', 'P', 'M', 'G', 'GG', 'XGG', '☕'],
  sequential: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, '☕'],
}

export function isValidVoteForDeck(deckType: DeckType, value: string | number): boolean {
  return DECK_VALUES[deckType].some((v) => v === value)
}

const roomId = z.string().trim().min(1).max(MAX_ROOM_ID)

const playerSchema = z.object({
  id: z.string().trim().min(1).max(MAX_ID),
  name: z.string().trim().min(1).max(MAX_NAME),
  role: z.enum(['admin', 'member', 'observer']),
})

const roomConfigSchema = z.object({
  deckType: z.enum(['fibonacci', 'tshirt', 'sequential']),
  autoReveal: z.boolean(),
})

export const joinRoomSchema = z.object({
  roomId,
  player: playerSchema,
  config: roomConfigSchema.optional(),
  // Segredo de sessão por (sala, jogador), emitido no ack do join e reenviado
  // nos rejoins. Opcional: a 1ª entrada de um jogador não tem token ainda.
  // NUNCA é broadcastado no room_state_updated (anti-escalada de admin).
  token: z.string().trim().min(1).max(MAX_TOKEN).optional(),
})

// start_session, next_round, reset_session, reveal_votes
export const roomActionSchema = z.object({ roomId })

export const addSubjectsSchema = z.object({
  roomId,
  subjects: z
    .array(z.string().trim().min(1).max(MAX_SUBJECT))
    .min(1)
    .max(MAX_SUBJECTS_PER_CALL),
})

export const removeSubjectSchema = z.object({
  roomId,
  index: z.number().int().nonnegative(),
})

export const castVoteSchema = z.object({
  roomId,
  // playerId é aceito por compatibilidade, mas IGNORADO pelo servidor:
  // a identidade vem sempre do socket (anti-spoofing).
  playerId: z.string().trim().min(1).max(MAX_ID).optional(),
  value: z.union([z.string().trim().min(1).max(MAX_VOTE_STR), z.number().finite()]),
})
