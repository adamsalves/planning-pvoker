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

---

## Fase 3 — Criação & Entrada na Sala

**Objetivo:** Implementar formulários de criação/entrada em sala com validação, roles de usuário e persistência de estado.

### Arquivos Criados

| Arquivo                          | Descrição                                                   |
| -------------------------------- | ----------------------------------------------------------- |
| `src/types/index.ts`             | Tipos TypeScript do domínio (Player, Room, Round, DeckType) |
| `src/stores/user.ts`             | Store do jogador com persistência via localStorage          |
| `src/stores/room.ts`             | Store da sala com state machine completa                    |
| `src/composables/useRoom.ts`     | Composable encapsulando lógica de criação/entrada           |
| `src/views/HomeView.vue`         | Tela inicial com forms de criar/entrar na sala              |
| `src/features/room/RoomView.vue` | Tela da sala com info do jogador e badges                   |

### Dependências Adicionadas

| Pacote                        | Papel                                         |
| ----------------------------- | --------------------------------------------- |
| `vee-validate`                | Gerenciamento de formulários reativo          |
| `@vee-validate/zod`           | Adaptador VeeValidate → Zod                   |
| `zod`                         | Schema de validação type-safe                 |
| `uuid`                        | Geração de IDs únicos                         |
| `pinia-plugin-persistedstate` | Salvar stores automaticamente no localStorage |

### Conceitos Praticados

#### Composables — Lógica Reutilizável Fora dos Componentes

Composables são funções que usam a Composition API (`ref`, `computed`, `watch`, etc.) para encapsular lógica reutilizável:

```ts
// src/composables/useRoom.ts
export function useRoom() {
  const router = useRouter()
  const userStore = useUserStore()

  function createRoom(playerName: string, deckType: DeckType, autoReveal: boolean) {
    const roomId = uuidv4().substring(0, 8)
    userStore.setPlayer(playerName, playerId, 'admin')
    roomStore.createRoom(roomId, { id: playerId, name: playerName, role: 'admin' }, config)
    router.push({ name: 'room', params: { id: roomId } })
  }

  return { createRoom, joinRoom }
}
```

**Regra de ouro:** Se uma lógica é usada em mais de um componente, ela vira composable. Se é específica de um componente, fica no próprio componente.

---

#### Pinia — Composition API Style + Persistência

Diferente do Vuex, o Pinia usa a mesma Composition API que os componentes:

```ts
// src/stores/user.ts
export const useUserStore = defineStore(
  'user',
  () => {
    const playerName = ref('') // state
    const playerId = ref('') // state

    function setPlayer(name, id, role) {
      // action
      playerName.value = name
      playerId.value = id
    }

    return { playerName, playerId, setPlayer }
  },
  {
    persist: true, // ← salva automaticamente no localStorage!
  },
)
```

**`pinia-plugin-persistedstate`:** Configurado uma única vez no `main.ts`, persiste qualquer store que tenha `persist: true`.

---

#### VeeValidate + Zod — Validação Type-Safe

O combo VeeValidate + Zod é o padrão do mercado para validação em Vue 3:

```ts
// 1. Definir schema com Zod
const schema = toTypedSchema(
  z.object({
    playerName: z.string().min(2, 'Mínimo 2 caracteres'),
    deckType: z.enum(['fibonacci', 'tshirt', 'sequential']),
  }),
)

// 2. Conectar ao VeeValidate
const { handleSubmit, errors, defineField } = useForm({
  validationSchema: schema,
  initialValues: { playerName: '', deckType: 'fibonacci' },
})

// 3. Vincular campos ao template
const [playerName, playerNameAttrs] = defineField('playerName')
```

**`defineField`:** Retorna um `ref` reativo e atributos extras (validação, dirty state, etc.) que você binda no template com `v-model` + `v-bind`.

**`errors`:** Objeto reativo calculado automaticamente pelo VeeValidate a cada mudança no campo.

---

#### Navegação Programática

Após criar a sala, o composable navega sem que o usuário clique em um `<RouterLink>`:

```ts
router.push({ name: 'room', params: { id: roomId } })
```

**`name` vs `path`:** Usar o nome da rota torna o código imune a mudanças no path. Se `/room/:id` virar `/sala/:id`, basta mudar no router — todos os `push` continuam funcionando.

---

#### Rota Dinâmica com `useRoute`

O componente da sala acessa o parâmetro `:id` da URL:

```ts
const route = useRoute()
const roomId = route.params.id as string
```

---

### Resumo de Conceitos — Fase 3

| Conceito                      | Onde                                   |
| ----------------------------- | -------------------------------------- |
| Composables                   | `useRoom.ts`                           |
| Pinia Composition API         | `useUserStore`, `useRoomStore`         |
| `pinia-plugin-persistedstate` | `main.ts` + `useUserStore`             |
| VeeValidate + Zod             | `HomeView.vue`                         |
| `defineField`                 | `HomeView.vue`                         |
| `toTypedSchema`               | `HomeView.vue`                         |
| Navegação programática        | `useRoom.ts`                           |
| Rotas dinâmicas (`:id`)       | `router/index.ts` + `RoomView.vue`     |
| `<Transition>` entre tabs     | `HomeView.vue`                         |
| Radio buttons customizados    | `HomeView.vue` (deck + role selection) |
| Toggle switch CSS             | `HomeView.vue` (auto-reveal)           |

### Verificação

- ✅ `npm run lint` + `npm run type-check` — sem erros
- ✅ Criar sala → navega para `/room/:id` com badge de Admin
- ✅ Nome do jogador persiste no localStorage
