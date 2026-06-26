import { describe, it, expect, vi, afterEach } from 'vitest'
import { logger } from '../src/logger'

const originalNodeEnv = process.env.NODE_ENV

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv
  vi.restoreAllMocks()
})

describe('server logger', () => {
  it('silences debug in production', () => {
    process.env.NODE_ENV = 'production'
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logger.debug('noise')
    expect(spy).not.toHaveBeenCalled()
  })

  it('emits debug outside production', () => {
    process.env.NODE_ENV = 'development'
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    logger.debug('noise')
    expect(spy).toHaveBeenCalledWith('noise')
  })

  it('always emits info, warn and error (even in production)', () => {
    process.env.NODE_ENV = 'production'
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    logger.info('up')
    logger.warn('denied')
    logger.error('boom')
    expect(log).toHaveBeenCalledWith('up')
    expect(warn).toHaveBeenCalledWith('denied')
    expect(error).toHaveBeenCalledWith('boom')
  })
})
