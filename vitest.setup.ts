import { config } from '@vue/test-utils'
import { i18n } from '@/i18n'

// Locale determinístico: o jsdom reporta 'en-US' em navigator.language, o que
// faria a detecção da store cair em 'en' — mas os specs asseram os textos na
// língua padrão do produto (pt-BR). Fixado ANTES dos imports dos test files
// (setupFiles rodam primeiro), então qualquer useLocaleStore detecta pt-BR.
Object.defineProperty(window.navigator, 'language', {
  configurable: true,
  value: 'pt-BR',
})

// Toda montagem ganha o plugin do i18n (componentes chamam useI18n()); os specs
// não precisam registrá-lo um a um. Testes que trocam o locale devem restaurar
// 'pt-BR' ao final — a instância é o singleton do app.
config.global.plugins.push(i18n)
