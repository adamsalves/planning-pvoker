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

  webServer: [
    {
      command: 'npm run dev',
      port: 5173,
      reuseExistingServer: true,
    },
    {
      command: 'npm run dev --prefix server',
      port: 3001,
      reuseExistingServer: true,
    },
  ],
})
