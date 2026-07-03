import { describe, it, expect } from 'vitest'
import { JoinAckError, getJoinErrorKey } from '../joinErrors'
import { ptBR } from '@/i18n/locales/pt-BR'

describe('getJoinErrorKey', () => {
  it('mapeia os códigos conhecidos do servidor para as chaves i18n', () => {
    expect(getJoinErrorKey(new JoinAckError('room_not_found'))).toBe('errors.roomNotFound')
    expect(getJoinErrorKey(new JoinAckError('invalid_session'))).toBe('errors.invalidSession')
    expect(getJoinErrorKey(new JoinAckError('invalid_payload'))).toBe('errors.invalidPayload')
  })

  it('cai numa chave genérica de recusa para um JoinAckError desconhecido', () => {
    expect(getJoinErrorKey(new JoinAckError('some_new_code_the_client_ignores'))).toBe(
      'errors.joinRefused',
    )
  })

  it('cai na chave transitória para erros de conexão/cold start', () => {
    expect(getJoinErrorKey(new Error('xhr poll error'))).toBe('errors.transient')
  })

  it('trata valores não-Error sem quebrar', () => {
    expect(getJoinErrorKey('algo estranho')).toBe('errors.transient')
  })

  it('toda chave retornável existe no catálogo (sem tradução furada)', () => {
    const returnable = [
      getJoinErrorKey(new JoinAckError('room_not_found')),
      getJoinErrorKey(new JoinAckError('invalid_session')),
      getJoinErrorKey(new JoinAckError('invalid_payload')),
      getJoinErrorKey(new JoinAckError('unknown_code')),
      getJoinErrorKey(undefined),
    ]
    for (const key of returnable) {
      expect(key.startsWith('errors.')).toBe(true)
      expect(Object.keys(ptBR.errors)).toContain(key.replace('errors.', ''))
    }
  })
})
