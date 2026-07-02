import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RoomSetup from '../RoomSetup.vue'
import SubjectForm from '../SubjectForm.vue'
import { useRoomStore } from '@/stores/room'
import type { Room } from '@/types'

function roomWith(overrides: Partial<Room> = {}): Room {
  return {
    id: 'r1',
    adminId: 'p1',
    config: { deckType: 'fibonacci', autoReveal: false },
    players: [{ id: 'p1', name: 'Ana', role: 'admin' }],
    subjects: [],
    phase: 'setup',
    rounds: [],
    currentRoundIndex: -1,
    ...overrides,
  }
}

const stubs = { SubjectForm: true, PlayerList: true }

function mountSetup(isAdmin: boolean, room: Room) {
  setActivePinia(createPinia())
  useRoomStore().syncRoom(room)
  return mount(RoomSetup, { props: { isAdmin }, global: { stubs } })
}

describe('RoomSetup.vue', () => {
  it('admin vê o SubjectForm (e não a mensagem de espera)', () => {
    const wrapper = mountSetup(true, roomWith())
    expect(wrapper.findComponent(SubjectForm).exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Scrum Master está preparando')
  })

  it('não-admin vê a mensagem de espera com o preview do backlog (pluralizado)', () => {
    const wrapper = mountSetup(false, roomWith({ subjects: ['Login', 'Cadastro'] }))
    expect(wrapper.findComponent(SubjectForm).exists()).toBe(false)
    expect(wrapper.text()).toContain('O Scrum Master está preparando')
    expect(wrapper.text()).toContain('2 subjects cadastrados')
    expect(wrapper.text()).toContain('Login')
  })

  it('re-emite add/remove/start vindos do SubjectForm', () => {
    const wrapper = mountSetup(true, roomWith())
    const form = wrapper.findComponent(SubjectForm)

    form.vm.$emit('add', 'Nova tarefa')
    form.vm.$emit('remove', 1)
    form.vm.$emit('start')

    expect(wrapper.emitted('add')?.[0]).toEqual(['Nova tarefa'])
    expect(wrapper.emitted('remove')?.[0]).toEqual([1])
    expect(wrapper.emitted('start')).toHaveLength(1)
  })
})
