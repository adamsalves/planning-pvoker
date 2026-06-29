import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

export type ThemePreference = 'light' | 'dark' | 'system'

// Mantidos em sincronia com os tokens --c-bg de base.css (usados no <meta theme-color>).
const COLOR_DARK = '#0f172a'
const COLOR_LIGHT = '#f8fafc'

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolve(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return preference
}

function apply(preference: ThemePreference) {
  const resolved = resolve(preference)
  document.documentElement.dataset.theme = resolved
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', resolved === 'dark' ? COLOR_DARK : COLOR_LIGHT)
}

export const useThemeStore = defineStore(
  'theme',
  () => {
    // Preferência do usuário (persistida). O que vai pro <html> é sempre o tema
    // resolvido ('light'/'dark'); 'system' só existe aqui na preferência.
    const preference = ref<ThemePreference>('system')

    function setPreference(value: ThemePreference) {
      preference.value = value
    }

    function cycle() {
      preference.value =
        preference.value === 'light' ? 'dark' : preference.value === 'dark' ? 'system' : 'light'
    }

    // Sincroniza o DOM com a preferência (também roda no boot da store, depois da
    // hidratação do persistedstate, reconciliando com o que o anti-FOUC já aplicou).
    watch(preference, (value) => apply(value), { immediate: true })

    // Em "system", acompanha a troca de tema do SO em tempo real.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (preference.value === 'system') apply('system')
    })

    return { preference, setPreference, cycle }
  },
  {
    persist: true, // pinia-plugin-persistedstate: localStorage['theme'] = { preference }
  },
)
