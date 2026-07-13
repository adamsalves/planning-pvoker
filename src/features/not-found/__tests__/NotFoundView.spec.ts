import { describe, it, expect } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import NotFoundView from '../NotFoundView.vue'
import router from '@/router'

describe('NotFoundView (F4.3)', () => {
  it('renders the title, message and a link back home', () => {
    const wrapper = mount(NotFoundView, {
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    expect(wrapper.get('h1').text()).toContain('Página não encontrada')
    expect(wrapper.text()).toContain('O link pode estar quebrado')
    const home = wrapper.getComponent(RouterLinkStub)
    expect(home.props('to')).toBe('/')
    expect(home.text()).toContain('Voltar ao início')
  })
})

describe('router catch-all → 404 (F4.3)', () => {
  it('resolves unknown paths to the not-found route (antes = tela branca)', () => {
    expect(router.resolve('/definitely/not/a/route').name).toBe('not-found')
    expect(router.resolve('/room').name).toBe('not-found') // /room sem :id não casa
    expect(router.resolve('/history').name).toBe('not-found') // rota removida (F6.2)
  })

  it('still resolves the known routes normally', () => {
    expect(router.resolve('/').name).toBe('home')
    expect(router.resolve('/room/abc123').name).toBe('room')
  })
})
