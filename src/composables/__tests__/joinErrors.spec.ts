import { describe, it, expect } from 'vitest'
import { JoinAckError, getJoinErrorKey } from '../joinErrors'
import { ptBR } from '@/i18n/locales/pt-BR'
// Cross-package import on purpose (same coupling contract as
// src/types/__tests__/deck-drift.spec.ts): this spec runs in the CLIENT runner yet
// reaches into the server's error-code source of truth, so a rename there that isn't
// mirrored in joinErrors' map fails HERE instead of silently degrading to the generic
// "join refused" copy. server/src/errorCodes.ts stays dependency-free to remain
// importable from the client.
import { JOIN_ERROR_CODES } from '../../../server/src/errorCodes'

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

describe('drift-guard: códigos de join do servidor ⇄ joinErrors', () => {
  it('todo código que o join_room acka mapeia uma chave i18n específica (não o fallback)', () => {
    // Se o servidor renomear/adicionar um código de join sem espelhar no mapa do
    // cliente, getJoinErrorKey cai em 'errors.joinRefused' e este teste quebra.
    expect(JOIN_ERROR_CODES.length).toBeGreaterThan(0)
    for (const code of JOIN_ERROR_CODES) {
      const key = getJoinErrorKey(new JoinAckError(code))
      expect(key).not.toBe('errors.joinRefused')
      expect(Object.keys(ptBR.errors)).toContain(key.replace('errors.', ''))
    }
  })
})
