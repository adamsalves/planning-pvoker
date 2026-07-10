import { onScopeDispose, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { canMatchMedia } from '@/composables/matchMedia'

export type ThemePreference = 'light' | 'dark' | 'system'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function systemPrefersDark(): boolean {
  return canMatchMedia() && window.matchMedia(DARK_QUERY).matches
}

function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return preference
}

// Aplica o tema resolvido ao <html> e sincroniza o <meta theme-color> com o token
// --c-bg vigente (lido do CSSOM — sem hardcode, evita drift com base.css).
function applyTheme(preference: ThemePreference) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = resolveTheme(preference)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim()
    if (bg) meta.setAttribute('content', bg)
  }
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
        preference.value === 'system' ? 'light' : preference.value === 'light' ? 'dark' : 'system'
    }

    // Sincroniza o DOM com a preferência (também roda no boot da store, depois da
    // hidratação do persistedstate, reconciliando com o que o anti-FOUC já aplicou).
    watch(preference, applyTheme, { immediate: true })

    // Em "system", acompanha a troca de tema do SO em tempo real, com cleanup do listener.
    if (canMatchMedia()) {
      const mql = window.matchMedia(DARK_QUERY)
      const onSystemChange = () => {
        if (preference.value === 'system') applyTheme('system')
      }
      mql.addEventListener('change', onSystemChange)
      onScopeDispose(() => mql.removeEventListener('change', onSystemChange))
    }

    return { preference, setPreference, cycle }
  },
  {
    persist: true, // pinia-plugin-persistedstate: localStorage['theme'] = { preference }
  },
)
