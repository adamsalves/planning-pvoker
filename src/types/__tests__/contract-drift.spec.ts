import { describe, it, expect } from 'vitest'
import { DECK_TYPES, PLAYER_ROLES, PLAYER_TAGS, ROOM_PHASES, ROUND_STATUSES } from '@/types'
// Cross-package import on purpose — same contract as deck-drift.spec.ts, which
// guards the per-deck VOTE VALUES. This one guards the VOCABULARY: the sets of
// literals that travel over the socket and get re-declared on both sides.
//
// Coupling contract: this spec runs in the CLIENT Vitest runner (and the CI
// "client" job, which installs only the root deps), yet it reaches into the
// server. server/src/types.ts is the safest possible target for that — it has
// ZERO imports, so it can never drag a server-only dependency into this runner.
// Keep it that way; if it ever needs an import, move these consts to a
// dependency-free module instead of adding one here.
import * as server from '../../../server/src/types'

// Why this exists: these five vocabularies are declared twice with nothing
// enforcing agreement, and the drift is not hypothetical. The client carried a
// RoundStatus of 'waiting' that the server never emitted, in any commit — a
// phantom third state that survived until someone went looking. A type union
// disappears at compile time, so nothing could have caught it; const arrays exist
// at runtime, which is what makes this assertable at all.
//
// A mismatch here is NOT necessarily "the test is wrong". It means one side can
// now produce (or accept) a value the other does not know about — decide which
// side is right, then fix that side.
const VOCABULARIES: ReadonlyArray<{
  name: string
  client: readonly string[]
  server: readonly string[]
}> = [
  { name: 'player roles', client: PLAYER_ROLES, server: server.PLAYER_ROLES },
  { name: 'deck types', client: DECK_TYPES, server: server.DECK_TYPES },
  { name: 'room phases', client: ROOM_PHASES, server: server.ROOM_PHASES },
  { name: 'round statuses', client: ROUND_STATUSES, server: server.ROUND_STATUSES },
  { name: 'player tags', client: PLAYER_TAGS, server: server.PLAYER_TAGS },
]

describe('contract vocabulary drift guard (client × server)', () => {
  for (const { name, client, server: serverValues } of VOCABULARIES) {
    // Sorted: the two sides may legitimately list in different orders — only
    // MEMBERSHIP is the contract. Nothing on either side indexes these by position.
    it(`agrees on ${name}`, () => {
      expect([...client].sort()).toEqual([...serverValues].sort())
    })
  }

  // The list above is the whole point, so a vocabulary silently dropped from it
  // would disable a guard without failing anything. Pin the count.
  it('guards every vocabulary the two sides share', () => {
    expect(VOCABULARIES).toHaveLength(5)
  })

  // WHAT THIS GUARD DOES NOT COVER, so nobody reads it as broader than it is: only
  // VOCABULARIES — the const arrays. Interface FIELDS are invisible to it, because a
  // type has no runtime value to compare. So `Room.absentPlayerIds` (optional on the
  // client, required as `RoomBroadcast.absentPlayerIds` on the server), `tag`,
  // `excludedVoterIds` and every other field are held in sync by the cross-reference
  // comments on both declarations and by nothing else. Adding a field on one side
  // and forgetting the other compiles clean and fails silently at runtime — the exact
  // shape of the bug that motivated this file. If a field-level guard ever becomes
  // worth it, it needs a runtime witness (a sample object both sides validate), not
  // another type.
})
