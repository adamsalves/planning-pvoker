import { logger } from './logger'

// Last-resort process guards. A throw inside a Socket.IO event handler is NOT
// caught by the library — it reaches the process as an uncaughtException and, with
// no listener, terminates it. That is a bad trade here: one failed operation in one
// room would end every OTHER room's session too (rooms live in memory; the Redis
// snapshot brings them back, but only after a free-tier cold start that outlasts
// the reconnect grace, so everyone is dropped).
//
// So these listeners log loudly and KEEP SERVING. That is deliberately not the
// usual Node advice ("log and exit"), and it is only defensible because of what
// this server does: handlers are short, synchronous mutations of a per-room object
// — a failed one leaves that room untouched, not the process half-initialized.
// Anything that needs the process to actually stop (a corrupt module, an
// unrecoverable listen error) still does: those happen during start(), which has
// its own catch + process.exit.
//
// These are a NET, not a fix. Anything logged here is a bug to chase — the guard
// exists so that chasing it doesn't have to happen during an outage.

// Narrow port instead of depending on NodeJS.Process: keeps this unit-testable
// with a plain fake and free of `as` casts (project rule).
export interface CrashGuardTarget {
  on(event: string, listener: (payload: unknown) => void): unknown
}

export function installCrashGuards(target: CrashGuardTarget): void {
  target.on('uncaughtException', (err) => {
    logger.error(`💥 Uncaught exception — server kept alive: ${String(err)}`)
    if (err instanceof Error && err.stack) logger.error(err.stack)
  })

  target.on('unhandledRejection', (reason) => {
    logger.error(`💥 Unhandled rejection — server kept alive: ${String(reason)}`)
    if (reason instanceof Error && reason.stack) logger.error(reason.stack)
  })
}
