import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { PlayerRole } from '@/types'

export const useUserStore = defineStore(
  'user',
  () => {
    // State
    const playerName = ref('')
    const playerId = ref('')
    const playerRole = ref<PlayerRole>('member')

    // Actions
    function setPlayer(name: string, id: string, role: PlayerRole) {
      playerName.value = name
      playerId.value = id
      playerRole.value = role
    }

    function clearPlayer() {
      playerName.value = ''
      playerId.value = ''
      playerRole.value = 'member'
    }

    return {
      playerName,
      playerId,
      playerRole,
      setPlayer,
      clearPlayer,
    }
  },
  {
    persist: true, // pinia-plugin-persistedstate: salva no localStorage automaticamente
  },
)
