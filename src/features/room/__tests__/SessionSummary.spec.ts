import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import IconCircleCheck from '~icons/lucide/circle-check'
import IconRotateCw from '~icons/lucide/rotate-cw'
import SessionSummary from '../SessionSummary.vue'
import VoteReveal from '../VoteReveal.vue'
import BaseButton from '@/components/BaseButton.vue'
import type { Round } from '@/types'

function round(id: string, subject: string, votes: Record<string, string | number>): Round {
  return { id, subject, status: 'revealed', votes }
}

describe('SessionSummary.vue', () => {
  const rounds: Round[] = [
    round('r1', 'Login', { p1: 5, p2: 5 }),
    round('r2', 'Signup', { p1: 3, p2: 8 }),
  ]

  it('mostra o título e o total de subjects no plural', () => {
    const wrapper = mount(SessionSummary, { props: { rounds } })
    expect(wrapper.text()).toContain('Sessão Concluída!')
    expect(wrapper.text()).toContain('2 subjects votados')
  })

  it('usa singular com um único subject', () => {
    const wrapper = mount(SessionSummary, { props: { rounds: [rounds[0]!] } })
    expect(wrapper.text()).toContain('1 subject votado')
    expect(wrapper.text()).not.toContain('1 subjects')
  })

  it('renderiza um recap por rodada com índice/total e o subject', () => {
    const wrapper = mount(SessionSummary, { props: { rounds } })
    expect(wrapper.findAllComponents(VoteReveal)).toHaveLength(2)
    expect(wrapper.text()).toContain('1/2')
    expect(wrapper.text()).toContain('2/2')
    expect(wrapper.text()).toContain('Login')
    expect(wrapper.text()).toContain('Signup')
  })

  it('cada recap não celebra (sem confetti) nem recebe player-count (histórico)', () => {
    const wrapper = mount(SessionSummary, { props: { rounds } })
    const reveal = wrapper.findComponent(VoteReveal)
    expect(reveal.props('celebrate')).toBe(false)
    expect(reveal.props('playerCount')).toBeUndefined()
  })

  it('emite newSession e leave nos respectivos botões', async () => {
    const wrapper = mount(SessionSummary, { props: { rounds } })
    const buttons = wrapper.findAllComponents(BaseButton)
    await buttons.find((b) => b.text().includes('Nova Sessão'))?.trigger('click')
    await buttons.find((b) => b.text().includes('Sair da Sala'))?.trigger('click')
    expect(wrapper.emitted()).toHaveProperty('newSession')
    expect(wrapper.emitted()).toHaveProperty('leave')
  })

  it('sessão sem rodadas: zero recaps e contagem zero', () => {
    const wrapper = mount(SessionSummary, { props: { rounds: [] } })
    expect(wrapper.findAllComponents(VoteReveal)).toHaveLength(0)
    expect(wrapper.text()).toContain('0 subjects votados')
  })

  it('cabeçalho e botão de nova sessão trazem os próprios ícones, decorativos', () => {
    const wrapper = mount(SessionSummary, { props: { rounds } })

    const check = wrapper.findComponent(IconCircleCheck)
    expect(check.exists()).toBe(true)
    expect(check.attributes('aria-hidden')).toBe('true')

    const rotate = wrapper.findComponent(IconRotateCw)
    expect(rotate.exists()).toBe(true)
    expect(rotate.attributes('aria-hidden')).toBe('true')
    // O ícone é do botão de nova sessão, não do "Sair da Sala" (ghost, sem ícone).
    const novaSessao = wrapper
      .findAllComponents(BaseButton)
      .find((b) => b.text().includes('Nova Sessão'))
    expect(novaSessao?.findComponent(IconRotateCw).exists()).toBe(true)
  })
})
