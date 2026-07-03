import { describe, it, expect } from 'vitest'
import { JoinAckError, getJoinErrorKey } from '../joinErrors'
import { ptBR } from '@/i18n/locales/pt-BR'

describe('getJoinErrorKey', () => {
  it('mapeia os motivos conhecidos do servidor para as chaves i18n', () => {
    expect(getJoinErrorKey(new JoinAckError('Sala não encontrada'))).toBe('errors.roomNotFound')
    expect(getJoinErrorKey(new JoinAckError('Sessão inválida'))).toBe('errors.invalidSession')
    expect(getJoinErrorKey(new JoinAckError('Dados de entrada inválidos'))).toBe(
      'errors.invalidPayload',
    )
  })

  it('cai numa chave genérica de recusa para um JoinAckError desconhecido', () => {
    expect(getJoinErrorKey(new JoinAckError('motivo novo que o cliente não conhece'))).toBe(
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
      getJoinErrorKey(new JoinAckError('Sala não encontrada')),
      getJoinErrorKey(new JoinAckError('Sessão inválida')),
      getJoinErrorKey(new JoinAckError('Dados de entrada inválidos')),
      getJoinErrorKey(new JoinAckError('desconhecido')),
      getJoinErrorKey(undefined),
    ]
    for (const key of returnable) {
      expect(key.startsWith('errors.')).toBe(true)
      expect(Object.keys(ptBR.errors)).toContain(key.replace('errors.', ''))
    }
  })
})
