import { describe, it, expect } from 'vitest'
import { DECKS, DECK_TYPES } from '@/types'
// Cross-package import on purpose: this guard fails if the server's per-deck
// valid vote values drift from the client's single source of truth (DECKS).
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
