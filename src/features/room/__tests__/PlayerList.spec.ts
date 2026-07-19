import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { i18n } from '@/i18n'
import IconCheck from '~icons/lucide/check'
import IconHourglass from '~icons/lucide/hourglass'
import PlayerList from '../PlayerList.vue'
import type { Player } from '@/types'

describe('PlayerList.vue', () => {
  const mockPlayers: Player[] = [
    { id: '1', name: 'Admin', role: 'admin' },
    { id: '2', name: 'Member', role: 'member' },
    { id: '3', name: 'Observer', role: 'observer' },
  ]

  it('separates active players and observers', () => {
    const wrapper = mount(PlayerList, {
      props: {
        players: mockPlayers,
        votes: {},
        status: 'waiting',
      },
    })

    const html = wrapper.html()
    expect(html).toContain('Jogadores (2)')
    expect(html).toContain('Espectadores (1)')
    expect(html).toContain('Admin')
    expect(html).toContain('Member')
    expect(html).toContain('Observer')
  })

  // Os badges de status são ícones (SVG), não mais emoji. A asserção alveja o ícone
  // ESPECÍFICO (não "algum svg"): trocar um pelo outro inverte o significado do badge
  // — "votou" onde deveria ser "aguardando" — e o teste tem de pegar isso.
  it('shows pending badge during voting without vote', () => {
    const wrapper = mount(PlayerList, {
      props: {
        players: [mockPlayers[1]!],
        votes: {},
        status: 'voting',
      },
    })

    const badge = wrapper.find('.pending-badge')
    expect(badge.findComponent(IconHourglass).exists()).toBe(true)
    expect(badge.findComponent(IconCheck).exists()).toBe(false)
    expect(wrapper.text()).toContain('Aguardando voto')
  })

  it('shows voted badge during voting with voted', () => {
    const wrapper = mount(PlayerList, {
      props: {
        players: [mockPlayers[1]!],
        votes: { '2': 8 }, // Player 2 voted 8
        status: 'voting',
      },
    })

    const badge = wrapper.find('.voted-badge')
    expect(badge.findComponent(IconCheck).exists()).toBe(true)
    expect(badge.findComponent(IconHourglass).exists()).toBe(false)
    expect(wrapper.text()).toContain('Votou')
    expect(wrapper.text()).not.toContain('8') // should not show value yet
  })

  it('shows vote value when revealed', () => {
    const wrapper = mount(PlayerList, {
      props: {
        players: [mockPlayers[1]!],
        votes: { '2': 5 },
        status: 'revealed',
      },
    })

    expect(wrapper.text()).toContain('5')
    expect(wrapper.find('.voted-badge').exists()).toBe(false)
  })

  it('marks the admin crown as decorative with a sr-only alternative', () => {
    const wrapper = mount(PlayerList, {
      props: { players: [mockPlayers[0]!], votes: {}, status: 'waiting' },
    })

    expect(wrapper.find('.admin-badge').attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toContain('(admin)')
  })

  it('marks status icons as decorative with sr-only alternatives', () => {
    const wrapper = mount(PlayerList, {
      props: { players: [mockPlayers[1]!], votes: {}, status: 'voting' },
    })

    expect(wrapper.find('.pending-badge [aria-hidden="true"]').exists()).toBe(true)
    expect(wrapper.find('.pending-badge .sr-only').text()).toBe('Aguardando voto')
  })

  it('marks the observer eye icon as decorative with a sr-only alternative', () => {
    const wrapper = mount(PlayerList, {
      props: { players: [mockPlayers[2]!], votes: {}, status: 'waiting' },
    })

    expect(wrapper.find('.observer-badge').attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toContain('Espectador')
  })

  describe('quem vota na rodada', () => {
    it('só mostra o toggle quando votersEditable', () => {
      const semToggle = mount(PlayerList, {
        props: { players: mockPlayers, votes: {}, status: 'voting' },
      })
      // Default false: o RoomSetup usa o mesmo componente e não tem rodada.
      expect(semToggle.find('.voter-toggle').exists()).toBe(false)

      const comToggle = mount(PlayerList, {
        props: { players: mockPlayers, votes: {}, status: 'voting', votersEditable: true },
      })
      // Um por jogador ativo — espectadores não entram na escolha.
      expect(comToggle.findAll('.voter-toggle')).toHaveLength(2)
    })

    it('emite toggle-voter com o estado OPOSTO ao atual', async () => {
      const wrapper = mount(PlayerList, {
        props: {
          players: mockPlayers,
          votes: {},
          status: 'voting',
          nonVoterIds: ['2'],
          votersEditable: true,
        },
      })

      const toggles = wrapper.findAll('.voter-toggle')
      // Admin ('1') vota → ligado; Member ('2') excluído → desligado.
      expect(toggles[0]!.attributes('aria-checked')).toBe('true')
      expect(toggles[1]!.attributes('aria-checked')).toBe('false')

      // Tirar quem vota pede voting=false; devolver quem está fora pede true.
      await toggles[0]!.trigger('click')
      expect(wrapper.emitted('toggle-voter')?.[0]).toEqual(['1', false])
      await toggles[1]!.trigger('click')
      expect(wrapper.emitted('toggle-voter')?.[1]).toEqual(['2', true])
    })

    // role="switch" em vez de checkbox justamente para não guardar estado no DOM:
    // se o servidor não aplicar o toggle, o controle tem de continuar refletindo
    // o estado REAL, e o próximo clique tem de repetir a mesma intenção.
    it('não dessincroniza quando o servidor não aplica o toggle', async () => {
      const wrapper = mount(PlayerList, {
        props: {
          players: [mockPlayers[0]!],
          votes: {},
          status: 'voting',
          nonVoterIds: [],
          votersEditable: true,
        },
      })

      const toggle = wrapper.find('.voter-toggle')
      await toggle.trigger('click')
      // Nenhuma prop nova chegou (o broadcast não veio).
      expect(wrapper.find('.voter-toggle').attributes('aria-checked')).toBe('true')
      expect(wrapper.emitted('toggle-voter')?.[1]).toBeUndefined()

      await wrapper.find('.voter-toggle').trigger('click')
      expect(wrapper.emitted('toggle-voter')?.[1]).toEqual(['1', false])
    })

    // O v-memo da linha só repinta se a dependência estiver listada — estes casos
    // montam no estado A e vão para o B, que é o que os testes de estado final
    // (todos os outros) não conseguem pegar.
    it('repinta a linha quando a exclusão muda DEPOIS do mount', async () => {
      const wrapper = mount(PlayerList, {
        props: {
          players: [mockPlayers[1]!],
          votes: {},
          status: 'voting',
          nonVoterIds: [],
          votersEditable: true,
        },
      })
      expect(wrapper.find('.non-voter-badge').exists()).toBe(false)

      await wrapper.setProps({ nonVoterIds: ['2'] })
      expect(wrapper.find('.non-voter-badge').exists()).toBe(true)
      expect(wrapper.find('.voter-toggle').attributes('aria-checked')).toBe('false')
      expect(wrapper.find('.player-item').classes()).toContain('non-voter-item')
    })

    // O nome acessível do toggle sai de t(), que o v-memo pularia se o locale não
    // estivesse nas deps — um controle interativo ficaria anunciado no idioma
    // antigo enquanto o resto da linha já traduziu. O afterEach global restaura.
    it('retraduz o nome acessível do toggle ao trocar de idioma', async () => {
      const wrapper = mount(PlayerList, {
        props: {
          players: [mockPlayers[1]!],
          votes: {},
          status: 'voting',
          votersEditable: true,
        },
      })
      expect(wrapper.find('.voter-toggle').text()).toBe('Member vota nesta rodada')

      i18n.global.locale.value = 'en'
      await nextTick()
      expect(wrapper.find('.voter-toggle').text()).toBe('Member votes in this round')
    })

    it('mostra/esconde o toggle quando votersEditable muda DEPOIS do mount', async () => {
      const wrapper = mount(PlayerList, {
        props: { players: [mockPlayers[1]!], votes: {}, status: 'voting' },
      })
      expect(wrapper.find('.voter-toggle').exists()).toBe(false)

      await wrapper.setProps({ votersEditable: true })
      expect(wrapper.find('.voter-toggle').exists()).toBe(true)
    })

    it('mostra "não vota" no lugar de pendente, sem sair da seção de jogadores', () => {
      const wrapper = mount(PlayerList, {
        props: {
          players: [mockPlayers[1]!],
          votes: {},
          status: 'voting',
          nonVoterIds: ['2'],
        },
      })

      const badge = wrapper.find('.non-voter-badge')
      expect(badge.exists()).toBe(true)
      expect(badge.find('.sr-only').text()).toBe('Não vota nesta rodada')
      // Não pode aparecer como "aguardando voto": ninguém espera o voto dele.
      expect(wrapper.find('.pending-badge').exists()).toBe(false)
      // E segue contando como jogador, não como espectador.
      expect(wrapper.html()).toContain('Jogadores (1)')
    })
  })
})
