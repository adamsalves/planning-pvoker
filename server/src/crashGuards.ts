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
//
// The catch: keeping the process alive is only right for errors it can survive, and
// this listener cannot tell them apart. A failed `server.listen` (EADDRINUSE, a bad
// PORT) surfaces as an 'error' EVENT on the server, and an unhandled one becomes an
// uncaughtException — which this guard would swallow, leaving a live process with no
// port bound and a single log line to explain it. So every fatal-by-nature source
// needs its own explicit exit: index.ts registers server.on('error') for exactly
// that, and module-scope failures still crash outright because they run BEFORE this
// is installed. Add a guard like that alongside any new listener you introduce here.
//
// These are a NET, not a fix. Anything logged here is a bug to chase — the guard
// exists so that chasing it doesn't have to happen during an outage.

// Narrow port instead of depending on NodeJS.Process: keeps this unit-testable
// with a plain fake and free of `as` casts (project rule).
export interface CrashGuardTarget {
  on(event: string, listener: (payload: unknown) => void): unknown
}

export function installCrashGuards(target: CrashGuardTarget): void {
  // The payload goes to the logger as a SECOND argument rather than interpolated:
  // console.error renders an Error with its full stack and any other value through
  // util.inspect, where `${String(err)}` would flatten a plain object — the shape
  // Upstash rejections arrive in — to a useless "[object Object]".
  target.on('uncaughtException', (err) => {
    logger.error('💥 Uncaught exception — server kept alive:', err)
  })

  target.on('unhandledRejection', (reason) => {
    logger.error('💥 Unhandled rejection — server kept alive:', reason)
  })
}
