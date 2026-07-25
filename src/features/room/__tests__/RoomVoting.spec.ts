import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import IconEye from '~icons/lucide/eye'
import IconHourglass from '~icons/lucide/hourglass'
import RoomVoting from '../RoomVoting.vue'
import VotingArea from '../VotingArea.vue'
import VoteReveal from '../VoteReveal.vue'
import RoundControls from '../RoundControls.vue'
import PokerTable from '../PokerTable.vue'
import PlayerList from '../PlayerList.vue'
import { useRoomStore } from '@/stores/room'
import type { Room, RoundStatus } from '@/types'

function votingRoom(
  status: RoundStatus,
  votes: Record<string, string | number> = {},
  excludedVoterIds: string[] = [],
): Room {
  return {
    id: 'r1',
    adminId: 'p1',
    config: { deckType: 'fibonacci', autoReveal: false },
    players: [{ id: 'p1', name: 'Ana', role: 'admin' }],
    subjects: ['A'],
    phase: 'voting',
    rounds: [{ id: 'rd1', subject: 'A', status, votes, excludedVoterIds }],
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
  isVotingThisRound: boolean
  selectedVote: string | number | null
  nonVoterIds: string[]
  voterCount: number
  allVotersVoted: boolean
}>

function mountVoting(props: PropsOverride, room: Room) {
  setActivePinia(createPinia())
  useRoomStore().syncRoom(room)
  return mount(RoomVoting, {
    props: {
      isAdmin: false,
      isObserver: false,
      isVotingThisRound: true,
      selectedVote: null,
      nonVoterIds: [],
      voterCount: 1,
      allVotersVoted: false,
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

  // Espectador da SALA: o RoomView deriva isVotingThisRound de isObserver, então
  // a combinação coerente é as duas props juntas.
  it('espectador em votação vê a mensagem de observador, não a área de votação', () => {
    const wrapper = mountVoting(
      { isObserver: true, isVotingThisRound: false },
      votingRoom('voting'),
    )
    expect(wrapper.findComponent(VotingArea).exists()).toBe(false)
    expect(wrapper.text()).toContain('Você está como espectador')
  })

  it('tirado da rodada vê a mensagem própria — nem deck, nem a de espectador', () => {
    const wrapper = mountVoting(
      { isObserver: false, isVotingThisRound: false, nonVoterIds: ['p1'] },
      votingRoom('voting', {}, ['p1']),
    )
    expect(wrapper.findComponent(VotingArea).exists()).toBe(false)
    expect(wrapper.text()).toContain('Você não vota nesta rodada')
    // Não pode cair na mensagem de espectador: é outro estado (papel da sala).
    expect(wrapper.text()).not.toContain('Você está como espectador')
  })

  // As três ramificações (deck / espectador / fora-da-rodada) têm de ser
  // mutuamente exclusivas: um espectador NÃO pode ver os dois cards.
  it('espectador vê só o card de espectador, nunca também o de fora-da-rodada', () => {
    const wrapper = mountVoting(
      { isObserver: true, isVotingThisRound: false, nonVoterIds: ['p1'] },
      votingRoom('voting', {}, ['p1']),
    )
    expect(wrapper.text()).toContain('Você está como espectador')
    expect(wrapper.text()).not.toContain('Você não vota nesta rodada')
  })

  it('repassa nonVoterIds à mesa e à lista, e a lista só é editável pelo admin', () => {
    const wrapper = mountVoting(
      { isAdmin: true, nonVoterIds: ['p2'] },
      votingRoom('voting', {}, ['p2']),
    )
    expect(wrapper.findComponent(PokerTable).props('nonVoterIds')).toEqual(['p2'])
    expect(wrapper.findComponent(PlayerList).props('votersEditable')).toBe(true)
  })

  it('não deixa a lista editável para não-admin nem com a rodada revelada', () => {
    const naoAdmin = mountVoting({ isAdmin: false }, votingRoom('voting'))
    expect(naoAdmin.findComponent(PlayerList).props('votersEditable')).toBe(false)

    // Revelada: quem a rodada esperava já é histórico, não se mexe mais.
    const revelada = mountVoting({ isAdmin: true }, votingRoom('revealed', { p1: 5 }))
    expect(revelada.findComponent(PlayerList).props('votersEditable')).toBe(false)
  })

  it('re-emite o toggle-voter da lista de jogadores', () => {
    const wrapper = mountVoting({ isAdmin: true }, votingRoom('voting'))
    wrapper.findComponent(PlayerList).vm.$emit('toggle-voter', 'p2', false)
    expect(wrapper.emitted('toggle-voter')?.[0]).toEqual(['p2', false])
  })

  it('usa voterCount (e não o total de jogadores) como denominador do VoteReveal', () => {
    const wrapper = mountVoting({ voterCount: 2 }, votingRoom('revealed', { p1: 5 }))
    expect(wrapper.findComponent(VoteReveal).props('playerCount')).toBe(2)
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
    expect(espera.findComponent(IconHourglass).attributes('aria-hidden')).toBe('true')
    expect(espera.findComponent(IconEye).exists()).toBe(false)

    const espectador = mountVoting({ isObserver: true }, votingRoom('voting'))
    expect(espectador.findComponent(IconHourglass).exists()).toBe(false)
  })
})
