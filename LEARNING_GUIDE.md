# 🃏 Planning Poker — Guia de Aprendizado Vue 3

Documentação de acompanhamento do projeto. Cada fase concluída é registrada aqui com os conceitos praticados, arquivos criados e exemplos de uso.

---

## Fase 1 — Fundação do Projeto

**Objetivo:** Criar a base do projeto com as ferramentas padrão do ecossistema Vue moderno.

### Stack Configurada

| Ferramenta        | Versão | Papel                                        |
| ----------------- | ------ | -------------------------------------------- |
| Vue 3             | 3.5+   | Framework reativo com Composition API        |
| Vite              | 7.x    | Build tool ultra-rápido (substitui Webpack)  |
| TypeScript        | 5.9    | Tipagem estática                             |
| Vue Router        | 5.x    | Roteamento SPA                               |
| Pinia             | 3.x    | Gerenciamento de estado (substituto do Vuex) |
| ESLint + Prettier | —      | Linting e formatação                         |

### Estrutura de Pastas

```
src/
├── assets/          → CSS global e design tokens
├── components/      → Componentes reutilizáveis (BaseButton, BaseCard…)
├── composables/     → Lógica reutilizável (useRoom, useWebSocket…)
├── features/        → Módulos por feature
│   ├── room/        → Componentes e lógica da sala
│   └── history/     → Histórico de rodadas
├── layouts/         → Layouts base (DefaultLayout)
├── router/          → Configuração de rotas
├── stores/          → Stores Pinia
├── types/           → Interfaces TypeScript globais
└── views/           → Páginas (HomeView, RoomView, HistoryView)
```

### Conceitos Praticados

#### Vite — Por que não Webpack?

Vite usa ESModules nativos do browser em dev, eliminando o bundling durante desenvolvimento. O resultado: hot reload instantâneo.

#### Vue Router — Lazy Loading

As rotas de `/room/:id` e `/history` usam **dynamic import** para carregar os componentes apenas quando acessados:

```ts
// src/router/index.ts
{
  path: '/room/:id',
  name: 'room',
  component: () => import('../features/room/RoomView.vue'), // lazy loaded
}
```

**Benefício:** O bundle inicial fica menor, melhorando o tempo de carregamento.

#### Pinia — Setup Global

O Pinia é registrado no `main.ts` como plugin do Vue:

```ts
// src/main.ts
import { createPinia } from 'pinia'
app.use(createPinia())
```

Diferente do Vuex, o Pinia não precisa de `mutations` — ele usa composables nativos com `ref`, `computed` e funções regulares.

### Verificação

- ✅ `npm run dev` — app abre sem erros
- ✅ `npm run lint` — sem warnings
- ✅ `npm run type-check` — sem erros de tipo

---

## Fase 2 — Design System & Layout Base

**Objetivo:** Criar o sistema de design visual e os componentes atômicos reutilizáveis.

### Arquivos Criados

| Arquivo                         | Descrição                                               |
| ------------------------------- | ------------------------------------------------------- |
| `src/assets/base.css`           | Design tokens (cores, tipografia, espaçamento, sombras) |
| `src/assets/main.css`           | Utilitários globais e animações                         |
| `src/components/BaseButton.vue` | Botão com variantes, tamanhos e loading                 |
| `src/components/BaseCard.vue`   | Card com slots nomeados                                 |
| `src/components/BaseInput.vue`  | Input com `defineModel` e validação visual              |
| `src/components/BaseModal.vue`  | Modal com Teleport e transições                         |
| `src/layouts/DefaultLayout.vue` | Layout principal (Navbar + RouterView animado)          |

### Conceitos Praticados

#### CSS Custom Properties — Design Tokens

Todas as cores, tamanhos e sombras são variáveis CSS centralizadas:

```css
:root {
  --c-primary: #6366f1;
  --c-bg: #f8fafc;
  --radius-md: 0.375rem;
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

O **dark mode** funciona automaticamente via media query — as variáveis mudam de valor:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --c-bg: #0f172a;
    --c-text: #f8fafc;
  }
}
```

---

#### `defineProps` + `withDefaults` — Tipagem de Props

```vue
<!-- BaseButton.vue -->
<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
})
</script>
```

**Por que isso importa:** No Vue 2, props eram definidas com objetos JS sem tipagem forte. No Vue 3 com `<script setup>`, temos tipagem completa pelo TypeScript.

---

#### `defineModel()` — v-model Simplificado (Vue 3.4+)

Antes (Vue 3.0–3.3):

```vue
<script setup>
const props = defineProps(['modelValue'])
const emit = defineEmits(['update:modelValue'])
// Sempre precisava de props + emit manual
</script>
```

Agora (Vue 3.4+):

```vue
<!-- BaseInput.vue -->
<script setup>
const modelValue = defineModel<string>()
// Pronto! v-model funciona automaticamente
</script>
```

---

#### Named Slots — Componentes Flexíveis

O `BaseCard` aceita conteúdo em 3 áreas diferentes:

```vue
<BaseCard title="Minha Sala">
  <!-- slot default: corpo do card -->
  <p>Conteúdo principal aqui</p>

  <template #footer>
    <!-- slot nomeado: rodapé do card -->
    <BaseButton>Ação</BaseButton>
  </template>
</BaseCard>
```

**Regra:** Os slots só renderizam se forem usados (`v-if="$slots.footer"`).

---

#### `<Teleport>` — Renderizar Fora da Árvore

O `BaseModal` usa Teleport para renderizar o modal diretamente no `<body>`:

```vue
<Teleport to="body">
  <div class="modal-backdrop">...</div>
</Teleport>
```

**Por quê?** Se o modal ficasse dentro de um componente com `overflow: hidden`, ele seria cortado visualmente. Com Teleport, ele fica no topo do DOM.

---

#### `<Transition>` — Animações Declarativas

O Vue 3 aplica classes CSS automaticamente durante transições:

```vue
<Transition name="modal">
  <div v-if="isOpen" class="modal">...</div>
</Transition>
```

Classes geradas: `.modal-enter-from`, `.modal-enter-active`, `.modal-leave-to`, etc.

---

#### `<RouterView>` com Scoped Slot — Transições de Página

No `DefaultLayout`, usamos o scoped slot para animar a troca de rotas:

```vue
<RouterView v-slot="{ Component }">
  <Transition name="page" mode="out-in">
    <component :is="Component" />
  </Transition>
</RouterView>
```

- `mode="out-in"` garante que a página antiga saia antes da nova entrar
- `<component :is>` renderiza dinamicamente o componente da rota

---

#### `inheritAttrs: false` + `$attrs` — Controle de Atributos

No `BaseInput`, atributos HTML como `maxlength`, `autocomplete`, `aria-*` vão direto para o `<input>`, não para o `<div>` wrapper:

```vue
<script lang="ts">
export default { inheritAttrs: false }
</script>

<template>
  <div class="wrapper">
    <input v-bind="$attrs" />
    <!-- atributos caem aqui -->
  </div>
</template>
```

---

### Resumo de Conceitos — Fase 2

| Conceito Vue 3                            | Componente                          |
| ----------------------------------------- | ----------------------------------- |
| `defineProps` + TypeScript                | BaseButton, BaseCard, BaseInput     |
| `withDefaults`                            | BaseButton                          |
| `defineModel()` (3.4+)                    | BaseInput                           |
| `computed`                                | BaseButton                          |
| Named Slots                               | BaseCard, BaseModal                 |
| `<Teleport>`                              | BaseModal                           |
| `<Transition>`                            | BaseModal, DefaultLayout, BaseInput |
| `v-model` em componentes                  | BaseModal, BaseInput                |
| Lifecycle hooks (`onMounted/onUnmounted`) | BaseModal                           |
| `watch`                                   | BaseModal                           |
| `inheritAttrs` + `$attrs`                 | BaseInput                           |
| `<RouterView>` scoped slot                | DefaultLayout                       |

### Verificação

- ✅ `npm run lint` — sem warnings
- ✅ `npm run type-check` — sem erros de tipo
- ✅ Componentes prontos para uso nas próximas fases
