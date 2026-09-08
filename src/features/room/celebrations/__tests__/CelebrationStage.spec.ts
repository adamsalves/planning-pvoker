import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { resolvedImplementation } from '../registry'
import type { SpriteImplementation } from '../registry'
import CelebrationStage from '../CelebrationStage.vue'

function sprite(celebration: 'dolphin' | 'rocket' | 'cards' | 'balloons'): SpriteImplementation {
  const impl = resolvedImplementation(celebration)
  if (impl.kind !== 'sprite') {
    throw new Error(`"${celebration}" deveria ser sprite — o stage só aceita sprite`)
  }
  return impl
}

describe('CelebrationStage.vue', () => {
  // .get() lança se o seletor faltar: asserting existence and reading the node
  // num passo, sem precisar de narrowing.
  it('renderiza o sprite decorativo, fora do caminho interativo', () => {
    const wrapper = mount(CelebrationStage, { props: { implementation: sprite('dolphin') } })

    // aria-hidden: a celebração é extra ao texto do banner, nunca anúncio.
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toContain('🐬')
    // O data-path é o gancho do CSS (arc/straight/rise) — se ele descolar do
    // registry, a animação errada (ou nenhuma) entra em cena silenciosamente.
    expect(wrapper.get('.celebration-sprite').attributes('data-path')).toBe('arc')
  })

  it.each([
    ['dolphin', 'arc'],
    ['rocket', 'straight'],
    ['cards', 'straight'],
    ['balloons', 'rise'],
  ] as const)('%s anima pela trajetória "%s" com a duração do registry', (id, path) => {
    const impl = sprite(id)
    const wrapper = mount(CelebrationStage, { props: { implementation: impl } })
    const el = wrapper.get('.celebration-sprite')
    expect(el.attributes('data-path')).toBe(path)
    expect(el.attributes('style')).toContain(`--sprite-duration: ${impl.durationMs}ms`)
  })
})
