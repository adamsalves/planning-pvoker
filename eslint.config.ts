import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginOxlint from 'eslint-plugin-oxlint'
import skipFormatting from 'eslint-config-prettier/flat'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),

  {
    // src/test-utils/ mora dentro do projeto de produção (o tsconfig.app.json só
    // exclui `src/**/__tests__/*`), então nada impede um .vue de importar o `must`
    // e levá-lo para o bundle. Isto fecha a porta: helper de teste só em teste.
    name: 'app/test-utils-are-test-only',
    files: ['**/*.{vue,ts,mts,tsx}'],
    ignores: ['**/__tests__/**', 'src/test-utils/**', 'e2e/**', 'vitest.setup.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/test-utils/*', '**/test-utils/*'],
              message:
                'Helpers de teste não entram em código de produção — eles seguem para o bundle. Use-os só em __tests__/, e2e/ ou no vitest.setup.ts.',
            },
          ],
        },
      ],
    },
  },

  {
    name: 'app/rule-overrides',
    rules: {
      // Empty interfaces that extend a single type are intentional: module
      // augmentation (e.g. src/i18n/vue-i18n.d.ts) carries the extended schema
      // and declares no members of its own.
      '@typescript-eslint/no-empty-object-type': [
        'error',
        { allowInterfaces: 'with-single-extends' },
      ],
    },
  },

  skipFormatting,
)
