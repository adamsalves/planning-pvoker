import { ref, computed, onUnmounted, toValue, type MaybeRefOrGetter } from 'vue'

export type ShareStatus = 'idle' | 'copied' | 'error'

// Quanto tempo o feedback ("Link copiado!" / erro) fica visível antes de voltar a 'idle'.
const FEEDBACK_MS = 2500

/**
 * Compartilhar a sala: monta o link de convite, tenta a Web Share API nativa e cai
 * para a área de transferência, expondo um status efêmero para o botão. Extraído do
 * RoomView (F3.3) — sem mudança de comportamento.
 */
export function useShareRoom(roomId: MaybeRefOrGetter<string>) {
  const shareStatus = ref<ShareStatus>('idle')
  let feedbackTimeout: ReturnType<typeof setTimeout> | undefined

  const inviteUrl = computed(() => {
    const url = new URL(import.meta.env.BASE_URL, window.location.origin)
    url.searchParams.set('room', toValue(roomId))
    return url.toString()
  })

  function flashStatus(status: 'copied' | 'error') {
    shareStatus.value = status
    if (feedbackTimeout) clearTimeout(feedbackTimeout)
    feedbackTimeout = setTimeout(() => {
      shareStatus.value = 'idle'
    }, FEEDBACK_MS)
  }

  async function copyInviteLink() {
    await navigator.clipboard.writeText(inviteUrl.value)
    flashStatus('copied')
  }

  async function shareRoom() {
    shareStatus.value = 'idle'

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Planning Poker',
          text: 'Entre na minha sala de Planning Poker',
          url: inviteUrl.value,
        })
        return
      } catch (error) {
        // Usuário cancelou o diálogo nativo: não é erro, não faz fallback.
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }

    try {
      await copyInviteLink()
    } catch {
      flashStatus('error')
    }
  }

  onUnmounted(() => {
    if (feedbackTimeout) clearTimeout(feedbackTimeout)
  })

  return { shareStatus, inviteUrl, shareRoom }
}
