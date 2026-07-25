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

  it('logs an uncaught exception with its stack and does NOT rethrow', () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
    const proc = new FakeProcess()
    installCrashGuards(proc)

    const boom = new Error('boom')
    expect(() => proc.emit('uncaughtException', boom)).not.toThrow()

    const logged = error.mock.calls.map((call) => String(call[0])).join('\n')
    expect(logged).toContain('boom')
    expect(logged).toContain(boom.stack ?? 'no stack')
  })

  it('logs an unhandled rejection, including a non-Error reason', () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
    const proc = new FakeProcess()
    installCrashGuards(proc)

    // Rejections carry arbitrary values, not just Errors — the guard must not
    // assume `.stack` exists.
    expect(() => proc.emit('unhandledRejection', 'just a string')).not.toThrow()
    expect(error.mock.calls.map((call) => String(call[0])).join('\n')).toContain('just a string')
  })

  it('accepts the real process object (the port matches what Node offers)', () => {
    // Compile-time check, essentially: if CrashGuardTarget drifted from what
    // process.on offers, this line would stop type-checking.
    const target: CrashGuardTarget = process
    expect(typeof target.on).toBe('function')
  })
})
