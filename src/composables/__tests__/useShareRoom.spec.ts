import { describe, it, expect, vi, afterEach } from 'vitest'
import { createApp, ref } from 'vue'
import { useShareRoom } from '../useShareRoom'

// Roda o composable dentro de um contexto de componente (permite onUnmounted).
// O unmount é registrado e chamado no afterEach — assim roda mesmo se um expect lançar.
let activeUnmount: (() => void) | undefined

function withSetup<T>(composable: () => T): T {
  let result!: T
  const app = createApp({
    setup() {
      result = composable()
      return () => null
    },
  })
  app.mount(document.createElement('div'))
  activeUnmount = () => app.unmount()
  return result
}

describe('useShareRoom', () => {
  afterEach(() => {
    activeUnmount?.()
    activeUnmount = undefined
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('inviteUrl monta o link com o roomId na query', () => {
    const s = withSetup(() => useShareRoom('ABC123'))
    expect(s.inviteUrl.value).toContain('room=ABC123')
  })

  it('inviteUrl recomputa quando o roomId (ref) muda', () => {
    const roomId = ref('R1')
    const s = withSetup(() => useShareRoom(roomId))
    expect(s.inviteUrl.value).toContain('room=R1')

    roomId.value = 'R2'
    expect(s.inviteUrl.value).toContain('room=R2')
  })

  it('usa a Web Share API quando disponível (sem fallback, status idle)', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { share, clipboard: { writeText } })

    const s = withSetup(() => useShareRoom('R1'))
    await s.shareRoom()

    expect(share).toHaveBeenCalledOnce()
    expect(writeText).not.toHaveBeenCalled()
    expect(s.shareStatus.value).toBe('idle')
  })

  it('cai para a área de transferência quando não há Web Share (status copied)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const s = withSetup(() => useShareRoom('R1'))
    await s.shareRoom()

    expect(writeText).toHaveBeenCalledOnce()
    expect(s.shareStatus.value).toBe('copied')
  })

  it('cancelar o diálogo nativo (AbortError) não faz fallback nem marca erro', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'))
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { share, clipboard: { writeText } })

    const s = withSetup(() => useShareRoom('R1'))
    await s.shareRoom()

    expect(writeText).not.toHaveBeenCalled()
    expect(s.shareStatus.value).toBe('idle')
  })

  it('erro de share não-abort faz fallback para a área de transferência', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('boom', 'NotAllowedError'))
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, clipboard: { writeText } })

    const s = withSetup(() => useShareRoom('R1'))
    await s.shareRoom()

    expect(writeText).toHaveBeenCalledOnce()
    expect(s.shareStatus.value).toBe('copied')
  })

  it('falha ao copiar marca status de erro', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('no clipboard'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const s = withSetup(() => useShareRoom('R1'))
    await s.shareRoom()

    expect(s.shareStatus.value).toBe('error')
  })

  it('o status volta a idle após o tempo de feedback', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const s = withSetup(() => useShareRoom('R1'))
    await s.shareRoom()
    expect(s.shareStatus.value).toBe('copied')

    vi.advanceTimersByTime(2500)
    expect(s.shareStatus.value).toBe('idle')
  })

  it('chamadas consecutivas reiniciam a janela de feedback', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const s = withSetup(() => useShareRoom('R1'))
    await s.shareRoom() // t=0 → copied, reset agendado p/ t=2500
    vi.advanceTimersByTime(2000)
    await s.shareRoom() // reinicia → reset agendado p/ t=4500 (o de 2500 é cancelado)

    vi.advanceTimersByTime(1000) // t=3000: passou dos 2500 originais, mas foram cancelados
    expect(s.shareStatus.value).toBe('copied')

    vi.advanceTimersByTime(1500) // t=4500
    expect(s.shareStatus.value).toBe('idle')
  })

  it('desmontar cancela o reset pendente (cleanup do onUnmounted)', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const s = withSetup(() => useShareRoom('R1'))
    await s.shareRoom()
    expect(s.shareStatus.value).toBe('copied')

    activeUnmount?.() // desmonta com o timeout de reset ainda pendente
    activeUnmount = undefined

    // O timer foi limpo pelo onUnmounted: avançar não dispara o reset nem lança.
    expect(() => vi.advanceTimersByTime(2500)).not.toThrow()
    expect(s.shareStatus.value).toBe('copied')
  })
})
