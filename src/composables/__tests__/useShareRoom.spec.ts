import { describe, it, expect, vi, afterEach } from 'vitest'
import { createApp } from 'vue'
import { useShareRoom } from '../useShareRoom'

// Roda o composable dentro de um contexto de componente (permite onUnmounted).
function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
  let result!: T
  const app = createApp({
    setup() {
      result = composable()
      return () => null
    },
  })
  app.mount(document.createElement('div'))
  return { result, unmount: () => app.unmount() }
}

describe('useShareRoom', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('inviteUrl monta o link com o roomId na query', () => {
    const { result, unmount } = withSetup(() => useShareRoom('ABC123'))
    expect(result.inviteUrl.value).toContain('room=ABC123')
    unmount()
  })

  it('usa a Web Share API quando disponível (sem fallback, status idle)', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { share, clipboard: { writeText } })

    const { result, unmount } = withSetup(() => useShareRoom('R1'))
    await result.shareRoom()

    expect(share).toHaveBeenCalledOnce()
    expect(writeText).not.toHaveBeenCalled()
    expect(result.shareStatus.value).toBe('idle')
    unmount()
  })

  it('cai para a área de transferência quando não há Web Share (status copied)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const { result, unmount } = withSetup(() => useShareRoom('R1'))
    await result.shareRoom()

    expect(writeText).toHaveBeenCalledOnce()
    expect(result.shareStatus.value).toBe('copied')
    unmount()
  })

  it('cancelar o diálogo nativo (AbortError) não faz fallback nem marca erro', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'))
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { share, clipboard: { writeText } })

    const { result, unmount } = withSetup(() => useShareRoom('R1'))
    await result.shareRoom()

    expect(writeText).not.toHaveBeenCalled()
    expect(result.shareStatus.value).toBe('idle')
    unmount()
  })

  it('erro de share não-abort faz fallback para a área de transferência', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('boom', 'NotAllowedError'))
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share, clipboard: { writeText } })

    const { result, unmount } = withSetup(() => useShareRoom('R1'))
    await result.shareRoom()

    expect(writeText).toHaveBeenCalledOnce()
    expect(result.shareStatus.value).toBe('copied')
    unmount()
  })

  it('falha ao copiar marca status de erro', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('no clipboard'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const { result, unmount } = withSetup(() => useShareRoom('R1'))
    await result.shareRoom()

    expect(result.shareStatus.value).toBe('error')
    unmount()
  })

  it('o status volta a idle após o tempo de feedback', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const { result, unmount } = withSetup(() => useShareRoom('R1'))
    await result.shareRoom()
    expect(result.shareStatus.value).toBe('copied')

    vi.advanceTimersByTime(2500)
    expect(result.shareStatus.value).toBe('idle')
    unmount()
  })
})
