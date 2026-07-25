import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import router from '@/router'
import DefaultLayout from '../DefaultLayout.vue'
import { useRoomStore } from '@/stores/room'
import { useUserStore } from '@/stores/user'
import { useThemeStore } from '@/stores/theme'
import type { Room, RoomPhase } from '@/types'
import IconSun from '~icons/lucide/sun'
import IconMoon from '~icons/lucide/moon'
import IconSunMoon from '~icons/lucide/sun-moon'
import IconTarget from '~icons/lucide/target'
import IconChartColumn from '~icons/lucide/chart-column'

let wrapper: VueWrapper | undefined

function mountLayout() {
  wrapper = mount(DefaultLayout, {
    attachTo: document.body,
    global: { plugins: [router], stubs: { RouterView: true } },
  })
  return wrapper
}

function makeRoom(phase: RoomPhase): Room {
  return {
    id: 'abc123',
    adminId: 'p1',
    config: { deckType: 'fibonacci', autoReveal: false },
    players: [],
    subjects: [],
    phase,
    rounds: [],
    currentRoundIndex: -1,
  }
}

function activeRoomBanner(w: VueWrapper) {
  return w.findAll('a').find((a) => a.classes().includes('room-notice'))
}

describe('DefaultLayout.vue', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await router.push('/')
    await router.isReady()
  })

  // Desmontar sempre no afterEach (não inline): se uma asserção falhar no meio, o
  // attachTo deixaria o layout órfão no document.body, poluindo os testes seguintes.
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  it('does not move focus to <main> on the initial mount', async () => {
    const w = mountLayout()
    await nextTick()
    await nextTick()

    expect(document.activeElement).not.toBe(w.get('main').element)
  })

  it('moves focus to <main> and announces the route title on navigation', async () => {
    const w = mountLayout()

    await router.push('/unknown/route')
    await nextTick()
    await nextTick()

    expect(document.activeElement).toBe(w.get('main').element)
    expect(w.find('[aria-live="polite"]').text()).toBe('Não encontrado')
  })

  it('moves focus to <main> and announces "Sala {código}" when only the route param changes', async () => {
    await router.push({ name: 'room', params: { id: 'room-a' } })
    const w = mountLayout()

    await router.push({ name: 'room', params: { id: 'room-b' } })
    await nextTick()
    await nextTick()

    expect(document.activeElement).toBe(w.get('main').element)
    expect(w.find('[aria-live="polite"]').text()).toBe('Sala room-b')
  })

  // F8 — toggle de idioma na navbar. O i18n é o singleton do app (instalado no
  // vitest.setup), então o teste restaura pt-BR ao final para não vazar.
  it('switches the UI language via the navbar locale toggle', async () => {
    const w = mountLayout()

    const toggle = w.get('.locale-toggle')
    expect(toggle.text()).toBe('EN') // mostra o idioma ALVO
    expect(w.text()).toContain('feito por') // rodapé em pt-BR

    await toggle.trigger('click')
    await nextTick()

    expect(toggle.text()).toBe('PT')
    expect(w.text()).toContain('made by')
    expect(w.text()).not.toContain('feito por')
    expect(document.documentElement.lang).toBe('en')

    await toggle.trigger('click')
    await nextTick()
    expect(w.text()).toContain('feito por')
    expect(document.documentElement.lang).toBe('pt-BR')
  })

  // Item #5 — banner ÚNICO de "sala ativa" no topo do <main>: aparece em QUALQUER
  // rota com sala ativa (Home, 404), MENOS a própria sala; vira "Ver Resumo" quando
  // concluída. Unifica os dois afordances antigos da F5 (botão do navbar + banner da Home).
  it('does not show the active-room banner when there is no active room', async () => {
    await router.push('/unknown/route')
    const w = mountLayout()
    expect(activeRoomBanner(w)).toBeUndefined()
  })

  it('hides the active-room banner while on the room route itself', async () => {
    useRoomStore().syncRoom(makeRoom('voting'))
    await router.push({ name: 'room', params: { id: 'abc123' } })
    const w = mountLayout()
    expect(activeRoomBanner(w)).toBeUndefined()
  })

  // Antes (F5) o botão do header era escondido na Home; unificado, o banner PASSA a
  // aparecer nela (era o banner só-da-Home que cobria isso, agora é o mesmo elemento).
  it('SHOWS the active-room banner on Home when a session is active (item #5)', () => {
    useRoomStore().syncRoom(makeRoom('voting'))
    const w = mountLayout() // beforeEach já posicionou em '/'
    const banner = activeRoomBanner(w)
    expect(banner).toBeDefined()
    expect(banner?.text()).toContain('Voltar à Sala')
    expect(banner?.attributes('href')).toBe('/room/abc123')
  })

  it('shows the active-room banner from another route (404) while a session is in progress', async () => {
    useRoomStore().syncRoom(makeRoom('voting'))
    await router.push('/unknown/route')
    const w = mountLayout()
    const banner = activeRoomBanner(w)
    expect(banner).toBeDefined()
    expect(banner?.text()).toContain('Voltar à Sala')
    expect(banner?.attributes('href')).toBe('/room/abc123')
    expect(w.findComponent(IconTarget).exists()).toBe(true) // em andamento → alvo
  })

  it('labels the banner "Ver Resumo" when the session is completed', async () => {
    useRoomStore().syncRoom(makeRoom('completed'))
    await router.push('/unknown/route')
    const w = mountLayout()
    const banner = activeRoomBanner(w)
    expect(banner).toBeDefined()
    expect(banner?.text()).toContain('Ver Resumo')
    expect(banner?.attributes('href')).toBe('/room/abc123')
    expect(w.findComponent(IconChartColumn).exists()).toBe(true) // concluída → gráfico
  })

  // O sinal do banner é o activeRoomId PERSISTIDO, não o currentRoom in-memory: assim
  // ele sobrevive a um reload/hard-nav (o currentRoom zera no boot, mas o activeRoomId
  // fica no localStorage). Sem a sala carregada (só o id persistido), o rótulo degrada
  // p/ "Voltar à Sala" — sem currentRoom não dá pra saber se está concluída.
  it('shows the banner from the persisted activeRoomId even without a loaded room (survives reload)', async () => {
    useUserStore().setActiveRoom('abc123') // só o id persistido; currentRoom fica null
    await router.push('/unknown/route')
    const w = mountLayout()
    const banner = activeRoomBanner(w)
    expect(banner).toBeDefined()
    expect(banner?.attributes('href')).toBe('/room/abc123')
    expect(banner?.text()).toContain('Voltar à Sala')
  })

  // O toggle de tema mostra o ícone da preferência atual (sun/moon/sun-moon),
  // recolorindo via currentColor — antes eram emojis ☀️/🌙/🌗 de cor fixa. (Também
  // é o smoke de que o unplugin-icons gera <svg> no vitest, base das próximas fatias.)
  // Obs.: o logo 🃏 (marca/joker) fica como emoji de propósito — não é convertido.
  it('renders the theme icon matching the current preference', async () => {
    const w = mountLayout()
    const theme = useThemeStore()

    expect(w.findComponent(IconSunMoon).exists()).toBe(true) // default = 'system'

    theme.setPreference('light')
    await nextTick()
    expect(w.findComponent(IconSun).exists()).toBe(true)
    expect(w.findComponent(IconSunMoon).exists()).toBe(false)

    theme.setPreference('dark')
    await nextTick()
    expect(w.findComponent(IconMoon).exists()).toBe(true)
  })
})
