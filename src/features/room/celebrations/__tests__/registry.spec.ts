import { describe, it, expect, vi } from 'vitest'
import confetti from 'canvas-confetti'
import { CELEBRATIONS } from '@/types'
import type { Celebration } from '@/types'
import { i18n } from '@/i18n'
import { must } from '@/test-utils/must'
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

  // A identidade acima só compara com o classic: `blast: STARS` no mapa (cabo
  // trocado, não omissão) passa por ela. Distinção par a par fecha esse flanco.
  it('no two celebrations share an implementation', () => {
    const distinct = new Set(CELEBRATIONS.map((id) => resolvedImplementation(id)))
    expect(distinct.size).toBe(CELEBRATIONS.length)
  })

  // A regressão que este teste existe para impedir, e que a suíte inteira
  // deixava passar: a receita antiga do 'rain' nascia acima da borda de cima
  // SEM velocidade própria e com o `angle` default, que na canvas-confetti
  // aponta para CIMA (`y += sin(-angle) * velocity`). A leva subia para fora da
  // tela e só a gravidade a trazia de volta, já quase transparente — chuva que
  // não se via. São as TRÊS grandezas juntas que fazem a chuva aparecer, então
  // o teste prende as três; qualquer uma sozinha volta a passar com a receita
  // quebrada. O segundo disparo é defasado, daí o timer falso.
  it('rain falls: born above the top edge, with speed of its own, pointing down', () => {
    vi.useFakeTimers()
    try {
      vi.mocked(confetti).mockClear()
      resolvedImplementation('rain').run()
      vi.advanceTimersByTime(500)

      const calls = vi.mocked(confetti).mock.calls
      expect(calls.length).toBeGreaterThan(1)
      for (const [options] of calls) {
        const opts = must(options, 'as opções do confetti do rain')
        expect(must(opts.origin, 'origin').y).toBeLessThan(0)
        expect(must(opts.startVelocity, 'startVelocity')).toBeGreaterThan(0)
        // sin(-angle) > 0 é literalmente a conta que a lib faz para o eixo y,
        // e y cresce para BAIXO no canvas.
        const angle = must(opts.angle, 'angle')
        expect(Math.sin((-angle * Math.PI) / 180)).toBeGreaterThan(0)
      }
    } finally {
      vi.useRealTimers()
    }
  })

  // O canvas da canvas-confetti é global e sobrevive ao desmonte de quem
  // disparou. Cancelar tem que MATAR a leva agendada, não só parar de olhar
  // para ela: por isso a asserção é "nada mais sai depois", com o relógio
  // adiantado além da janela da receita mais longa.
  it.each([...CELEBRATIONS])('"%s" hands back the cancellation of its own volleys', (id) => {
    vi.useFakeTimers()
    try {
      const cancel = resolvedImplementation(id).run()
      expect(typeof cancel).toBe('function')

      vi.mocked(confetti).mockClear()
      cancel()
      vi.advanceTimersByTime(5_000)

      expect(confetti).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
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
