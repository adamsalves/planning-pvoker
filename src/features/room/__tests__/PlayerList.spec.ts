import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { i18n } from '@/i18n'
import IconCheck from '~icons/lucide/check'
import IconHourglass from '~icons/lucide/hourglass'
import PlayerList from '../PlayerList.vue'
import type { Player } from '@/types'
import { must } from '@/test-utils/must'

describe('PlayerList.vue', () => {
  const admin: Player = { id: '1', name: 'Admin', role: 'admin' }
  const member: Player = { id: '2', name: 'Member', role: 'member' }
  const observer: Player = { id: '3', name: 'Observer', role: 'observer' }
  const mockPlayers: Player[] = [admin, member, observer]

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
        players: [member],
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
        players: [member],
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
        players: [member],
        votes: { '2': 5 },
        status: 'revealed',
      },
    })

    expect(wrapper.text()).toContain('5')
    expect(wrapper.find('.voted-badge').exists()).toBe(false)
  })

  it('marks the admin crown as decorative with a sr-only alternative', () => {
    const wrapper = mount(PlayerList, {
      props: { players: [admin], votes: {}, status: 'waiting' },
    })

    expect(wrapper.find('.admin-badge').attributes('aria-hidden')).toBe('true')
    expect(wrapper.text()).toContain('(admin)')
  })

  it('marks status icons as decorative with sr-only alternatives', () => {
    const wrapper = mount(PlayerList, {
      props: { players: [member], votes: {}, status: 'voting' },
    })

    expect(wrapper.find('.pending-badge [aria-hidden="true"]').exists()).toBe(true)
    expect(wrapper.find('.pending-badge .sr-only').text()).toBe('Aguardando voto')
  })

  it('marks the observer eye icon as decorative with a sr-only alternative', () => {
    const wrapper = mount(PlayerList, {
      props: { players: [observer], votes: {}, status: 'waiting' },
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
      expect(must(toggles[0], 'voter toggle 0 (Admin)').attributes('aria-checked')).toBe('true')
      expect(must(toggles[1], 'voter toggle 1 (Member)').attributes('aria-checked')).toBe('false')

      // Tirar quem vota pede voting=false; devolver quem está fora pede true.
      await must(toggles[0], 'voter toggle 0 (Admin)').trigger('click')
      expect(wrapper.emitted('toggle-voter')?.[0]).toEqual(['1', false])
      await must(toggles[1], 'voter toggle 1 (Member)').trigger('click')
      expect(wrapper.emitted('toggle-voter')?.[1]).toEqual(['2', true])
    })

    // role="switch" em vez de checkbox justamente para não guardar estado no DOM:
    // se o servidor não aplicar o toggle, o controle tem de continuar refletindo
    // o estado REAL, e o próximo clique tem de repetir a mesma intenção.
    it('não dessincroniza quando o servidor não aplica o toggle', async () => {
      const wrapper = mount(PlayerList, {
        props: {
          players: [admin],
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
          players: [member],
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
          players: [member],
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
        props: { players: [member], votes: {}, status: 'voting' },
      })
      expect(wrapper.find('.voter-toggle').exists()).toBe(false)

      await wrapper.setProps({ votersEditable: true })
      expect(wrapper.find('.voter-toggle').exists()).toBe(true)
    })

    // Afordância: sem texto visível a admin não descobre que dá pra tirar alguém
    // da rodada — e o title sozinho não serve, porque touch não tem hover.
    it('explica o toggle com hint visível e title, só quando editável', async () => {
      const wrapper = mount(PlayerList, {
        props: { players: [member], votes: {}, status: 'voting' },
      })
      expect(wrapper.find('.voters-hint').exists()).toBe(false)

      await wrapper.setProps({ votersEditable: true })
      expect(wrapper.find('.voters-hint').text()).toBe('Desmarque quem não vota nesta rodada')
      expect(wrapper.find('.voter-toggle').attributes('title')).toBe('Member vota nesta rodada')
    })

    it('mostra "não vota" no lugar de pendente, sem sair da seção de jogadores', () => {
      const wrapper = mount(PlayerList, {
        props: {
          players: [member],
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

  describe('badge de área (tag)', () => {
    it('mostra o badge da área do jogador ativo, com prefixo sr-only', () => {
      const wrapper = mount(PlayerList, {
        props: {
          players: [{ id: '1', name: 'Ana', role: 'member', tag: 'design' }],
          votes: {},
          status: 'waiting',
        },
      })

      const badge = wrapper.find('.player-tag-badge')
      expect(badge.exists()).toBe(true)
      expect(badge.text()).toContain('Design')
      expect(badge.find('.sr-only').text()).toBe('Área:')
    })

    it('não mostra badge quando o jogador não tem área', () => {
      const wrapper = mount(PlayerList, {
        props: {
          players: [{ id: '1', name: 'Ana', role: 'member' }],
          votes: {},
          status: 'waiting',
        },
      })
      expect(wrapper.find('.player-tag-badge').exists()).toBe(false)
    })

    it('mostra o badge também para espectadores', () => {
      const wrapper = mount(PlayerList, {
        props: {
          players: [{ id: '1', name: 'Olga', role: 'observer', tag: 'product' }],
          votes: {},
          status: 'waiting',
        },
      })
      const badge = wrapper.find('.observer-item .player-tag-badge')
      expect(badge.exists()).toBe(true)
      expect(badge.text()).toContain('Produto')
    })

    // v-memo: player.tag TEM de estar nas deps, senão a linha não repinta quando
    // a área chega/muda depois do mount (mesma armadilha dos outros v-memo).
    it('repinta o badge quando a área muda DEPOIS do mount', async () => {
      const wrapper = mount(PlayerList, {
        props: {
          players: [{ id: '1', name: 'Ana', role: 'member' }],
          votes: {},
          status: 'voting',
        },
      })
      expect(wrapper.find('.player-tag-badge').exists()).toBe(false)

      await wrapper.setProps({ players: [{ id: '1', name: 'Ana', role: 'member', tag: 'qa' }] })
      expect(wrapper.find('.player-tag-badge').text()).toContain('QA')
    })
  })

  // Fantasma de rehidratação: continua SENTADO (o servidor não o remove), mas o
  // broadcast o marca ausente. A lista mostra, a contagem não conta.
  describe('jogador ausente', () => {
    const props = {
      players: mockPlayers,
      votes: {},
      status: 'voting' as const,
      absentPlayerIds: ['2'],
    }

    it('continua listado, ao contrário do espectador', () => {
      const wrapper = mount(PlayerList, { props })

      // Escopado à seção de ativos: a de espectadores usa a mesma classe de item.
      const activeItems = wrapper.findAll('.player-section:not(.observers) .player-item')

      expect(wrapper.text()).toContain('Member')
      expect(activeItems).toHaveLength(2) // Admin + Member, o ausente entre eles
      expect(wrapper.findAll('.absent-item')).toHaveLength(1)
    })

    // O ponto da feature: a sala não pode parecer mais cheia do que está. Com 2
    // ativos e 1 ausente o título diz 1 — e a lista segue com as duas linhas.
    it('sai da CONTAGEM do título sem sair da lista', () => {
      const wrapper = mount(PlayerList, { props })

      expect(wrapper.text()).toContain('Jogadores (1)')
      expect(wrapper.text()).not.toContain('Jogadores (2)')
    })

    // Precedência: "ausente" tem de vencer "aguardando voto", senão a UI anuncia
    // que se espera o voto de quem não está na sala — a mentira que isto corrige.
    it('anuncia "ausente" em vez de "aguardando voto"', () => {
      const wrapper = mount(PlayerList, { props })
      const absent = wrapper.get('.absent-item')

      expect(absent.find('.absent-badge').exists()).toBe(true)
      expect(absent.find('.pending-badge').exists()).toBe(false)
      expect(absent.get('.absent-badge').find('.sr-only').text()).toBe('Ausente')
    })

    // Sem a prop, ninguém é ausente — cobre o servidor antigo durante um deploy e
    // toda fixture que não conhece o campo.
    it('não marca ninguém quando a prop não vem (default)', () => {
      const wrapper = mount(PlayerList, {
        props: { players: mockPlayers, votes: {}, status: 'voting' as const },
      })

      expect(wrapper.findAll('.absent-item')).toHaveLength(0)
      expect(wrapper.text()).toContain('Jogadores (2)')
    })

    // v-memo: isPlayerAbsent TEM de estar nas deps. Quem reconecta depois do mount
    // precisa deixar de aparecer apagado sem esperar outro motivo de repaint.
    it('repinta a linha quando a ausência muda DEPOIS do mount', async () => {
      const wrapper = mount(PlayerList, { props })
      expect(wrapper.findAll('.absent-item')).toHaveLength(1)

      await wrapper.setProps({ absentPlayerIds: [] })

      expect(wrapper.findAll('.absent-item')).toHaveLength(0)
      expect(wrapper.text()).toContain('Jogadores (2)')
    })
  })
})
