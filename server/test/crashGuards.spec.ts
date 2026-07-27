import { describe, it, expect, vi, afterEach } from 'vitest'
import { installCrashGuards, type CrashGuardTarget } from '../src/crashGuards'
import { logger } from '../src/logger'

// Stands in for `process`: records the listeners so a test can fire them without
// arming anything on the real process (which would outlive the test file).
class FakeProcess implements CrashGuardTarget {
  listeners = new Map<string, (payload: unknown) => void>()
  on(event: string, listener: (payload: unknown) => void): this {
    this.listeners.set(event, listener)
    return this
  }
  emit(event: string, payload: unknown): void {
    this.listeners.get(event)?.(payload)
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('installCrashGuards', () => {
  it('registers a listener for both fatal-by-default events', () => {
    const proc = new FakeProcess()
    installCrashGuards(proc)
    expect([...proc.listeners.keys()].sort()).toEqual(['uncaughtException', 'unhandledRejection'])
  })

  it('logs an uncaught exception and does NOT rethrow', () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
    const proc = new FakeProcess()
    installCrashGuards(proc)

    const boom = new Error('boom')
    expect(() => proc.emit('uncaughtException', boom)).not.toThrow()

    // One call, with the error passed THROUGH rather than stringified — that is what
    // lets console.error render the stack (and inspect a non-Error payload).
    expect(error).toHaveBeenCalledTimes(1)
    const [message, payload] = error.mock.calls[0]
    expect(String(message)).toContain('Uncaught exception')
    expect(payload).toBe(boom)
  })

  it('logs an unhandled rejection whose reason is not an Error, without flattening it', () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
    const proc = new FakeProcess()
    installCrashGuards(proc)

    // Rejections carry arbitrary values. A plain object is the case that matters:
    // interpolating it would log "[object Object]" and lose the only diagnostics
    // there are (@upstash/redis rejects with shapes like this).
    const reason = { code: 'ERR_X', detail: 'redis said no' }
    expect(() => proc.emit('unhandledRejection', reason)).not.toThrow()

    expect(error).toHaveBeenCalledTimes(1)
    expect(error.mock.calls[0][1]).toBe(reason)
  })

  it('accepts the real process object (the port matches what Node offers)', () => {
    // The assignment is the point: if CrashGuardTarget drifted from process.on,
    // this stops type-checking in an editor. Note it does NOT fail the build —
    // server/tsconfig.json only includes src/**, and vitest transpiles without
    // type-checking, so nothing in CI reads this line as a type error. The runtime
    // assertion below is what actually guards the wiring in index.ts.
    const target: CrashGuardTarget = process
    expect(typeof target.on).toBe('function')
  })
})
