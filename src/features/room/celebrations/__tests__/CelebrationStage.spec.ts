import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import confetti from 'canvas-confetti'
import { resolvedImplementation } from '../registry'
import type { SpriteImplementation } from '../registry'
import CelebrationStage from '../CelebrationStage.vue'

// O stage agenda accents que chamam canvas-confetti; o mock com shapeFromText
// é o mesmo do registry.spec (a lib rasteriza texto em canvas real).
vi.mock('canvas-confetti', () => ({
  default: Object.assign(vi.fn(), {
    shapeFromText: vi.fn(({ text }: { text: string }) => ({ path: `#${text}` })),
  }),
}))

function sprite(celebration: 'dolphin' | 'rocket' | 'cards' | 'balloons'): SpriteImplementation {
  const impl = resolvedImplementation(celebration)
  if (impl.kind !== 'sprite') {
    throw new Error(`"${celebration}" deveria ser sprite — o stage só aceita sprite`)
  }
  return impl
}

describe('CelebrationStage.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(confetti).mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renderiza a arte em SVG com cenário decorativo, fora do caminho interativo', () => {
    const wrapper = mount(CelebrationStage, { props: { implementation: sprite('dolphin') } })

    // aria-hidden: a celebração é extra ao banner, nunca anúncio.
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    // A arte é SVG com partes animadas (SpriteArt), não emoji estático.
    const art = wrapper.get('.celebration-sprite svg.sprite-art')
    expect(art.classes()).toContain('sprite-art--dolphin')
    // O scrim (fundo animado só em opacity) é o "overlay" do modo espetáculo.
    const scrim = wrapper.get('.celebration-scrim')
    expect(scrim.attributes('data-tone')).toBe('sea')
    // data-path é o gancho do CSS; descolar do registry = coreografia errada.
    expect(wrapper.get('.celebration-sprite').attributes('data-path')).toBe('arc')
  })

  it.each([
    ['dolphin', 'arc', 'sea'],
    ['rocket', 'launch', 'dark'],
    ['cards', 'flip', 'felt'],
    ['balloons', 'rise', 'sky'],
  ] as const)('%s: trajetória "%s" com cenário "%s"', (id, path, tone) => {
    const wrapper = mount(CelebrationStage, { props: { implementation: sprite(id) } })
    expect(wrapper.get('.celebration-sprite').attributes('data-path')).toBe(path)
    expect(wrapper.get('.celebration-scrim').attributes('data-tone')).toBe(tone)
  })

  it('tamanho e duração do registry chegam ao CSS como variáveis', () => {
    const impl = sprite('rocket')
    const wrapper = mount(CelebrationStage, { props: { implementation: impl } })
    const style = wrapper.get('.celebration-sprite').attributes('style')
    expect(style).toContain(`--sprite-duration: ${impl.durationMs}ms`)
    expect(style).toContain(`--sprite-size: ${impl.sizeVmin}vmin`)
  })

  it('balloons desenha o trio com balanço próprio dentro do mesmo SVG', () => {
    const wrapper = mount(CelebrationStage, { props: { implementation: sprite('balloons') } })
    expect(wrapper.findAll('.balloon')).toHaveLength(3)
    // A defasagem é interna à arte agora (delay por grupo), não via --i.
    expect(wrapper.findAll('.celebration-sprite')).toHaveLength(1)
  })

  it('cards desenha o leque dos três ases', () => {
    const wrapper = mount(CelebrationStage, { props: { implementation: sprite('cards') } })
    expect(wrapper.findAll('.card')).toHaveLength(3)
  })

  // Os ganchos de classe das peças móveis. Se um seletor deixar de casar — arte
  // regerada, grupo renomeado — o desenho continua correto e PARADO, e nenhum
  // outro teste aqui cai. Este cai.
  it.each([
    ['dolphin', ['.dolphin', '.dolphin-tail', '.dolphin-flipper', '.dolphin-eye']],
    ['rocket', ['.rocket', '.rocket-flame', '.rocket-flame-core']],
    ['cards', ['.card']],
    ['balloons', ['.balloon', '.balloon-bulb', '.balloon-string']],
  ] as const)('%s: as peças que o CSS anima existem no DOM', (id, hooks) => {
    const wrapper = mount(CelebrationStage, { props: { implementation: sprite(id) } })
    for (const hook of hooks) {
      expect(wrapper.findAll(hook).length, hook).toBeGreaterThan(0)
    }
  })

  it('cada arte escolhida renderiza o desenho certo', () => {
    for (const id of ['dolphin', 'rocket', 'cards', 'balloons'] as const) {
      const wrapper = mount(CelebrationStage, { props: { implementation: sprite(id) } })
      // get() lança se o seletor faltar — a asserção é o próprio get
      wrapper.get(`.sprite-art--${id}`)
      wrapper.unmount()
    }
  })

  // Os acentos são a espinha do espetáculo (trilha, splash, pop, boom). Este
  // teste fixa que eles saem na timeline do registry — não antes, não vazar
  // depois do desmonte.
  it('agenda os accents na timeline; nada dispara antes da hora', () => {
    const impl = sprite('rocket')
    mount(CelebrationStage, { props: { implementation: impl } })

    vi.advanceTimersByTime(Math.min(...impl.accents.map((a) => a.atMs)) - 100)
    expect(confetti).not.toHaveBeenCalled()

    vi.advanceTimersByTime(200)
    expect(confetti).toHaveBeenCalledTimes(1)
  })

  it('desmontar no meio da coreografia cancela os accents pendentes', () => {
    const wrapper = mount(CelebrationStage, { props: { implementation: sprite('rocket') } })
    wrapper.unmount()
    vi.advanceTimersByTime(10_000)
    expect(confetti).not.toHaveBeenCalled()
  })
})
