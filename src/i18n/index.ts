import { createI18n } from 'vue-i18n'
import { ptBR } from './locales/pt-BR'
import { en } from './locales/en'

// Valor referenciado só neste arquivo (deriva `AppLocale`); @public evita que o
// knip reporte o export como desnecessário (antes coberto por ignoreExportsUsedInFile).
/** @public */
export const APP_LOCALES = ['pt-BR', 'en'] as const
export type AppLocale = (typeof APP_LOCALES)[number]

// Instância única do app (Composition API — legacy: false). O locale inicial é
// pt-BR (língua padrão do produto); quem decide o locale efetivo é a store de
// locale (detecção por navigator.language + preferência persistida), que
// sincroniza `i18n.global.locale` num watch — ver stores/locale.ts.
export const i18n = createI18n({
  legacy: false,
  locale: 'pt-BR',
  fallbackLocale: 'pt-BR',
  messages: {
    'pt-BR': ptBR,
    en,
  },
})
