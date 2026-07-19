import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import IconEye from '~icons/lucide/eye'
import IconHourglass from '~icons/lucide/hourglass'
import RoomVoting from '../RoomVoting.vue'
import VotingArea from '../VotingArea.vue'
import VoteReveal from '../VoteReveal.vue'
import RoundControls from '../RoundControls.vue'
import { useRoomStore } from '@/stores/room'
import type { Room, RoundStatus } from '@/types'

function votingRoom(status: RoundStatus, votes: Record<string, string | number> = {}): Room {
  return {
    id: 'r1',
    adminId: 'p1',
    config: { deckType: 'fibonacci', autoReveal: false },
    players: [{ id: 'p1', name: 'Ana', role: 'admin' }],
    subjects: ['A'],
    phase: 'voting',
    rounds: [{ id: 'rd1', subject: 'A', status, votes }],
    currentRoundIndex: 0,
  }
}

const stubs = {
  RoundHeader: true,
  PokerTable: true,
  VotingArea: true,
  VoteReveal: true,
  RoundControls: true,
  PlayerList: true,
}

type PropsOverride = Partial<{
  isAdmin: boolean
  isObserver: boolean
  selectedVote: string | number | null
  activePlayerCount: number
  allActiveVoted: boolean
}>

function mountVoting(props: PropsOverride, room: Room) {
  setActivePinia(createPinia())
  useRoomStore().syncRoom(room)
  return mount(RoomVoting, {
    props: {
      isAdmin: false,
      isObserver: false,
      selectedVote: null,
      activePlayerCount: 1,
      allActiveVoted: false,
      ...props,
    },
    global: { stubs },
  })
}

describe('RoomVoting.vue', () => {
  it('jogador em votação vê a área de votação', () => {
    const wrapper = mountVoting({ isObserver: false }, votingRoom('voting'))
    expect(wrapper.findComponent(VotingArea).exists()).toBe(true)
  })

  it('espectador em votação vê a mensagem de observador, não a área de votação', () => {
    const wrapper = mountVoting({ isObserver: true }, votingRoom('voting'))
    expect(wrapper.findComponent(VotingArea).exists()).toBe(false)
    expect(wrapper.text()).toContain('Você está como espectador')
  })

  it('após revelar mostra o VoteReveal', () => {
    const wrapper = mountVoting({}, votingRoom('revealed', { p1: 5 }))
    expect(wrapper.findComponent(VoteReveal).exists()).toBe(true)
  })

  it('passa o selectedVote para a área de votação', () => {
    const wrapper = mountVoting({ selectedVote: 13 }, votingRoom('voting'))
    expect(wrapper.findComponent(VotingArea).props('selectedValue')).toBe(13)
  })

  it('re-emite o vote da área de votação', () => {
    const wrapper = mountVoting({}, votingRoom('voting'))
    wrapper.findComponent(VotingArea).vm.$emit('vote', 8)
    expect(wrapper.emitted('vote')?.[0]).toEqual([8])
  })

  it('admin vê os controles de rodada e re-emite reveal/next-round/finish', () => {
    const wrapper = mountVoting({ isAdmin: true }, votingRoom('voting'))
    const controls = wrapper.findComponent(RoundControls)
    expect(controls.exists()).toBe(true)

    controls.vm.$emit('reveal')
    controls.vm.$emit('next-round')
    controls.vm.$emit('finish')

    expect(wrapper.emitted('reveal')).toHaveLength(1)
    expect(wrapper.emitted('next-round')).toHaveLength(1)
    expect(wrapper.emitted('finish')).toHaveLength(1)
  })

  it('passa anyVoted=true ao RoundControls quando já há um voto lançado', () => {
    const wrapper = mountVoting({ isAdmin: true }, votingRoom('voting', { p1: 5 }))
    expect(wrapper.findComponent(RoundControls).props('anyVoted')).toBe(true)
  })

  it('passa anyVoted=false ao RoundControls quando ninguém votou ainda', () => {
    const wrapper = mountVoting({ isAdmin: true }, votingRoom('voting'))
    expect(wrapper.findComponent(RoundControls).props('anyVoted')).toBe(false)
  })

  it('sem rodada ativa e não-admin mostra a mensagem de espera do início', () => {
    const room = votingRoom('voting')
    room.rounds = []
    room.currentRoundIndex = -1
    const wrapper = mountVoting({ isAdmin: false }, room)

    expect(wrapper.text()).toContain('Aguardando o Scrum Master iniciar a votação')
    expect(wrapper.findComponent(VotingArea).exists()).toBe(false)
  })

  it('admin sem rodada ativa: não renderiza RoundControls (a guarda protege o anyVoted)', () => {
    const room = votingRoom('voting')
    room.rounds = []
    room.currentRoundIndex = -1
    const wrapper = mountVoting({ isAdmin: true }, room)

    // currentRound é undefined → `v-if="isAdmin && currentRound"` barra o RoundControls,
    // então o fallback `?? {}` do anyVoted nunca é acionado em runtime (rede de segurança).
    expect(wrapper.findComponent(RoundControls).exists()).toBe(false)
  })

  // Ícones: asserção pelo COMPONENTE (não por `find('svg')`, que passaria com
  // qualquer ícone — inclusive um de significado trocado) + o negativo do irmão.
  it('mensagem de espectador leva o ícone de olho, decorativo', () => {
    const wrapper = mountVoting({ isObserver: true }, votingRoom('voting'))

    const icon = wrapper.findComponent(IconEye)
    expect(icon.exists()).toBe(true)
    expect(icon.attributes('aria-hidden')).toBe('true')
    // O significado vem do texto ao lado, não do ícone.
    expect(wrapper.text()).toContain('Você está como espectador')
  })

  it('espera do não-admin usa a ampulheta; o espectador em votação, não', () => {
    const semRodada = votingRoom('voting')
    semRodada.rounds = []
    semRodada.currentRoundIndex = -1
    const espera = mountVoting({ isAdmin: false }, semRodada)
    expect(espera.findComponent(IconHourglass).exists()).toBe(true)
    expect(espera.findComponent(IconEye).exists()).toBe(false)

    const espectador = mountVoting({ isObserver: true }, votingRoom('voting'))
    expect(espectador.findComponent(IconHourglass).exists()).toBe(false)
  })
})
