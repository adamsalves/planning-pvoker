// oxlint-disable-next-line typescript-eslint/triple-slash-reference
/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  // Icons(): ícones do Lucide compilados como SVG inline em build-time via imports
  // explícitos `~icons/lucide/*`. Só os usados entram no bundle; herdam 1em +
  // currentColor (recolorem com o tema — a razão de trocar os emojis). defaultClass
  // 'app-icon' padroniza alinhamento/encolhimento (regra em base.css). O vitest
  // compartilha este config, então os specs resolvem os `~icons/*`.
  plugins: [vue(), Icons({ compiler: 'vue3', defaultClass: 'app-icon' }), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'e2e/*', 'server/**'],
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})
