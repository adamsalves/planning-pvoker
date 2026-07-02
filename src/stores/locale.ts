import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { i18n, type AppLocale } from '@/i18n'

// Primeira visita (nada persistido): segue o idioma do navegador — qualquer
// variante de português (pt, pt-BR, pt-PT…) cai no pt-BR; o resto cai no inglês.
function detectLocale(): AppLocale {
  const lang = typeof navigator !== 'undefined' ? navigator.language : 'pt-BR'
  return lang.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en'
}

// Aplica o locale à instância global do vue-i18n e ao <html lang> (leitores de
// tela e o :lang do CSS dependem dele) — mesmo desenho do applyTheme (F9).
function applyLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale
  }
}

export const useLocaleStore = defineStore(
  'locale',
  () => {
    // Preferência do usuário. A detecção só vale na primeira visita: depois, o
    // persistedstate re-hidrata por cima e o watch imediato reconcilia o i18n.
    const locale = ref<AppLocale>(detectLocale())

    function setLocale(value: AppLocale) {
      locale.value = value
    }

    function toggle() {
      locale.value = locale.value === 'pt-BR' ? 'en' : 'pt-BR'
    }

    watch(locale, applyLocale, { immediate: true })

    return { locale, setLocale, toggle }
  },
  {
    persist: true, // pinia-plugin-persistedstate: localStorage['locale'] = { locale }
  },
)
