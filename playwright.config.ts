import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'html',
  use: {
    actionTimeout: 0,
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    // A UI detecta o idioma por navigator.language (F8/i18n). O Chrome do Playwright
    // usa en-US por padrão → sem isto a app subiria em inglês e os seletores em
    // português falhariam. Fixa pt-BR para o e2e ser determinístico.
    locale: 'pt-BR',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  // `reuseExistingServer` fica ligado só FORA do CI. Em dev é conveniência: quem
  // já está com `npm run dev:all` rodando não paga o boot duas vezes. No CI é
  // risco — qualquer processo ocupando a 5173 ou a 3001 satisfaz o webServer, e
  // a suíte passa sem nunca ter subido o código sob teste. Um e2e que aprova o
  // que não executou é pior do que e2e nenhum.
  webServer: [
    {
      command: 'npm run dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev --prefix server',
      port: 3001,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
