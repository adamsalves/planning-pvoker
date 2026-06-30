import { describe, it, expect } from 'vitest'
import { JoinAckError, getJoinErrorMessage } from '../joinErrors'

describe('getJoinErrorMessage', () => {
  it('usa o motivo do servidor para um JoinAckError', () => {
    expect(getJoinErrorMessage(new JoinAckError('Sala não encontrada'))).toBe('Sala não encontrada')
  })

  it('cai numa mensagem genérica para erros transitórios (conexão/cold start)', () => {
    expect(getJoinErrorMessage(new Error('xhr poll error'))).toMatch(/tente novamente/i)
  })

  it('trata valores não-Error sem quebrar', () => {
    expect(getJoinErrorMessage('algo estranho')).toMatch(/tente novamente/i)
  })
})
