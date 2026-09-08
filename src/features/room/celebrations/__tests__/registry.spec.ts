import { describe, it, expect, vi } from 'vitest'
import confetti from 'canvas-confetti'
import { CELEBRATIONS } from '@/types'
import type { Celebration } from '@/types'
import { i18n } from '@/i18n'
import { CONSENSUS_MESSAGES, bannerMessageKey, resolvedImplementation } from '../registry'

// O registry é a única consumidora de canvas-confetti daqui; mockado, os run()
// ficam baratos e o "chamou ou não chamou" vira assertável. shapeFromText é
// usado pelo 'suits' e precisa existir no mock (a real rasteriza em canvas).
vi.mock('canvas-confetti', () => ({
  default: Object.assign(vi.fn(), {
    shapeFromText: vi.fn(({ text }: { text: string }) => ({ path: `#${text}` })),
  }),
}))

// Os 7 confetti existem desde o PR B; as 4 sprites são do PR C e HOJE devem
// degradar — se alguém mover a implementação de C para antes da hora, os
// testes delas mudam junto, e o PR C reescreve as expectativas.
const CONFETTI_IDS = ['classic', 'fireworks', 'rain', 'cannons', 'blast', 'stars', 'suits'] as const
const SPRITE_IDS = ['dolphin', 'rocket', 'cards', 'balloons'] as const

describe('celebration registry', () => {
  it.each([...CELEBRATIONS])('"%s" resolves to a known kind', (celebration) => {
    expect(['confetti', 'sprite']).toContain(resolvedImplementation(celebration).kind)
  })

  it('covers the whole vocabulary — registry and contract can never disagree by omission', () => {
    expect([...CONFETTI_IDS, ...SPRITE_IDS].sort()).toEqual([...CELEBRATIONS].sort())
  })

  it.each(CONFETTI_IDS)('"%s" runs confetti with its own implementation', (celebration) => {
    const impl = resolvedImplementation(celebration)
    expect(impl.kind).toBe('confetti')
    // Identidade ≠ classic para todo id não-classic: entry removida do map
    // silenciosamente viria esta mesma objeto (o fallback) e o teste cai.
    if (celebration !== 'classic') {
      expect(impl).not.toBe(resolvedImplementation('classic'))
    }
    if (impl.kind === 'confetti') {
      vi.mocked(confetti).mockClear()
      expect(() => impl.run()).not.toThrow()
      expect(confetti).toHaveBeenCalled()
    }
  })

  it.each(SPRITE_IDS)('"%s" degrades to classic until PR C implements it', (celebration) => {
    expect(resolvedImplementation(celebration)).toBe(resolvedImplementation('classic'))
  })

  it('rounds without a celebration (pre-feature server) also degrade to classic', () => {
    expect(resolvedImplementation(undefined)).toBe(resolvedImplementation('classic'))
  })

  // A janela "servidor novo, cliente velho": se um 12º id cruzar a rede antes
  // do vocabulário do cliente acompanhar, animação E texto degradam juntos —
  // nenhum dos dois pode vazar estado desconhecido.
  it('an id this client does not know degrades to classic animation AND message 0', () => {
    expect(resolvedImplementation('lasers')).toBe(resolvedImplementation('classic'))
    expect(bannerMessageKey('lasers')).toBe('room.reveal.messages.0')
  })
})

describe('banner message derived from the celebration id', () => {
  it('classic keeps the historic phrase at index 0', () => {
    expect(bannerMessageKey('classic')).toBe('room.reveal.messages.0')
    expect(i18n.global.t('room.reveal.messages.0', 'pt-BR')).toBe('Consenso!')
  })

  // A derivação lê POSIÇÃO: diferente dos outros vocabulários (onde só
  // MEMBRO importa), reordenar CELEBRATIONS remapeia frases. O clássico tem
  // que ficar no índice 0 — é a frase/visual históricos e o fallback de todo
  // desconhecido. Os demais podem crescer só pelo fim.
  it('pins the order the derivation depends on: classic is index 0', () => {
    expect(CELEBRATIONS[0]).toBe('classic')
    expect(CELEBRATIONS.indexOf('classic')).toBe(0)
  })

  // O derivador usa t() de chave inexistente sem reclamar (fallback vira a
  // própria chave) — a paridade catálogo↔constante tem que ser assertada aqui.
  it.each([...CELEBRATIONS])('the message key for "%s" exists in both catalogs', (celebration) => {
    const key = bannerMessageKey(celebration)
    expect(i18n.global.te(key, 'pt-BR')).toBe(true)
    expect(i18n.global.te(key, 'en')).toBe(true)
  })

  it('catalog carries exactly CONSENSUS_MESSAGES messages per locale', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      const messages = i18n.global.messages.value[locale].room.reveal.messages
      expect(Object.keys(messages)).toHaveLength(CONSENSUS_MESSAGES)
    }
  })

  it('distinct celebrations spread over distinct messages (the derivation is the point)', () => {
    const keys: Celebration[] = ['classic', 'fireworks', 'rain', 'cannons']
    const messages = new Set(keys.map(bannerMessageKey))
    expect(messages.size).toBe(4)
  })
})
