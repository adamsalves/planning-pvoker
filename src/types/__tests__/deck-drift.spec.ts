import { describe, it, expect } from 'vitest'
import { DECKS, DECK_TYPES } from '@/types'
// Cross-package import on purpose: this guard fails if the server's per-deck
// valid vote values drift from the client's single source of truth (DECKS).
//
// Coupling contract: this spec runs in the CLIENT Vitest runner (and the CI
// "client" job, which installs only the root deps), yet it reaches into the
// server. So server/src/validation.ts must stay importable from here — it may
// only depend on packages available at the repo root (today: zod) and on
// server-local files without extra deps. If validation.ts ever imports a
// server-only dependency, this import breaks the client runner even with the
// server green; move the shared deck values into a dependency-free module then.
import { DECK_VALUES } from '../../../server/src/validation'

describe('deck drift guard (client DECKS vs server DECK_VALUES)', () => {
  it('covers exactly the same deck types', () => {
    expect(Object.keys(DECK_VALUES).sort()).toEqual([...DECK_TYPES].sort())
  })

  for (const deck of DECK_TYPES) {
    it(`has identical values for "${deck}"`, () => {
      expect(DECK_VALUES[deck]).toEqual(DECKS[deck].values)
    })
  }
})
