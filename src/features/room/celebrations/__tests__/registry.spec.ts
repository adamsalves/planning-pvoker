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

describe('celebration registry', () => {
  // Table-driven sobre o VOCABULÁRIO, não sobre uma lista mantida à mão: um id
  // novo em CELEBRATIONS entra aqui sozinho. A asserção de IDENTIDADE é o que
  // pega a omissão — sem entrada no mapa, a resolução devolve o objeto do
  // classic, e é exatamente esse silêncio que o teste quebra.
  it.each([...CELEBRATIONS])('"%s" resolves to an implementation of its own', (celebration) => {
    const impl = resolvedImplementation(celebration)

    vi.mocked(confetti).mockClear()
    expect(() => impl.run()).not.toThrow()
    expect(confetti).toHaveBeenCalled()

    if (celebration !== 'classic') {
      expect(impl).not.toBe(resolvedImplementation('classic'))
    }
  })

  it('rounds without a celebration (pre-feature server) also degrade to classic', () => {
    expect(resolvedImplementation(undefined)).toBe(resolvedImplementation('classic'))
  })

  // Um id que este cliente não conhece cruza a rede nos DOIS sentidos: servidor
  // mais novo com uma variante que ainda não chegou aqui, ou servidor mais velho
  // com uma que já saiu daqui (foi o caso das quatro sprites retiradas).
  // Animação E texto degradam juntos — nenhum dos dois pode vazar estado
  // desconhecido.
  it('an id this client does not know degrades to classic animation AND message 0', () => {
    expect(resolvedImplementation('lasers')).toBe(resolvedImplementation('classic'))
    expect(bannerMessageKey('lasers')).toBe('room.reveal.messages.0')
    expect(resolvedImplementation('dolphin')).toBe(resolvedImplementation('classic'))
    expect(bannerMessageKey('dolphin')).toBe('room.reveal.messages.0')
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
