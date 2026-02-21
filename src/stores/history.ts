import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Round } from '@/types'

export interface SessionHistory {
  id: string
  date: string
  roomId: string
  deckType: string
  rounds: Round[]
}

export const useHistoryStore = defineStore(
  'history',
  () => {
    const sessions = ref<SessionHistory[]>([])

    // Save a completed session (usually triggered when leaving a room that had rounds)
    function saveSession(session: SessionHistory) {
      // Don't save empty sessions
      if (session.rounds.length === 0) return

      // Update existing if re-saving from same room session, or unshift new
      const existingIdx = sessions.value.findIndex((s) => s.id === session.id)
      if (existingIdx !== -1) {
        sessions.value[existingIdx] = session
      } else {
        sessions.value.unshift(session)
      }
    }

    function clearHistory() {
      sessions.value = []
    }

    function getSession(id: string) {
      return sessions.value.find((s) => s.id === id)
    }

    return {
      sessions,
      saveSession,
      clearHistory,
      getSession,
    }
  },
  {
    persist: true, // Requires pinia-plugin-persistedstate
  },
)
