// Stable, language-agnostic ack error codes. The wire protocol speaks CODES, not
// human-readable copy — the frontend maps each to localized text (see the client's
// src/composables/joinErrors.ts). Sending pt-BR strings here would couple the
// server to the UI's language and re-break i18n whenever a message is reworded.
//
// Dependency-free ON PURPOSE: the client's drift-guard test imports JOIN_ERROR_CODES
// from here into the CLIENT Vitest runner (same coupling contract as
// src/types/__tests__/deck-drift.spec.ts). This module must stay importable from the
// client — never add imports that aren't available at the repo root.
export type AckErrorCode =
  | 'invalid_payload'
  | 'room_not_found'
  | 'invalid_session'
  | 'invalid_vote'
  | 'not_authorized'
  | 'invalid_vote_for_deck'
  | 'vote_not_registered'

// The subset of codes the join_room handler can ack. These are the ONLY codes the
// client must map to a specific message (src/composables/joinErrors.ts); any other
// code falls back to the generic "join refused" copy. Typed as AckErrorCode[] so a
// typo fails type-check, and consumed by the client drift-guard so a rename here
// that isn't mirrored in the client map fails a test instead of silently degrading.
export const JOIN_ERROR_CODES: readonly AckErrorCode[] = [
  'invalid_payload',
  'room_not_found',
  'invalid_session',
]
