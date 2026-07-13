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

```text
src/
├── assets/          → CSS global e design tokens
├── components/      → Componentes reutilizáveis (BaseButton, BaseCard…)
├── composables/     → Lógica reutilizável (useRoom, useWebSocket…)
├── features/        → Módulos por feature
│   ├── home/        → Tela inicial (criar/entrar)
│   ├── room/        → Componentes e lógica da sala
│   └── not-found/   → Página 404
├── layouts/         → Layouts base (DefaultLayout)
├── router/          → Configuração de rotas
├── stores/          → Stores Pinia
└── types/           → Interfaces TypeScript globais
```

### Conceitos Praticados — Fase 1

#### Vite — Por que não Webpack?

Vite usa ESModules nativos do browser em dev, eliminando o bundling durante desenvolvimento. O resultado: hot reload instantâneo.

#### Vue Router — Lazy Loading

**Todas** as rotas usam **dynamic import** para carregar os componentes apenas quando acessados:

```ts
// src/router/index.ts
{
  path: '/',
  name: 'home',
  component: () => import('../features/home/HomeView.vue'), // lazy loaded
},
{
  path: '/room/:id',
  name: 'room',
  component: () => import('../features/room/RoomView.vue'), // lazy loaded
},
{
  // catch-all → 404
  path: '/:pathMatch(.*)*',
  name: 'not-found',
  component: () => import('../features/not-found/NotFoundView.vue'), // lazy loaded
}
```

**Benefício:** O bundle inicial fica menor, melhorando o tempo de carregamento. Nenhuma view é importada estaticamente.

#### Pinia — Setup Global

O Pinia é registrado no `main.ts` como plugin do Vue:

```ts
// src/main.ts
import { createPinia } from 'pinia'
app.use(createPinia())
```

Diferente do Vuex, o Pinia não precisa de `mutations` — ele usa composables nativos com `ref`, `computed` e funções regulares.

### Verificação — Fase 1

- ✅ `npm run dev` — app abre sem erros
- ✅ `npm run lint` — sem warnings
- ✅ `npm run type-check` — sem erros de tipo

---

## Fase 2 — Design System & Layout Base

**Objetivo:** Criar o sistema de design visual e os componentes atômicos reutilizáveis.

### Arquivos Criados — Fase 2

| Arquivo                         | Descrição                                               |
| ------------------------------- | ------------------------------------------------------- |
| `src/assets/base.css`           | Design tokens (cores, tipografia, espaçamento, sombras) |
| `src/assets/main.css`           | Utilitários globais e animações                         |
| `src/components/BaseButton.vue` | Botão com variantes, tamanhos e loading                 |
| `src/components/BaseCard.vue`   | Card com slots nomeados                                 |
| `src/components/BaseInput.vue`  | Input com `defineModel` e validação visual              |
| `src/components/BaseModal.vue`  | Modal com Teleport e transições                         |
| `src/layouts/DefaultLayout.vue` | Layout principal (Navbar + RouterView animado)          |

### Conceitos Praticados — Fase 2

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

### Verificação — Fase 2

- ✅ `npm run lint` — sem warnings
- ✅ `npm run type-check` — sem erros de tipo
- ✅ Componentes prontos para uso nas próximas fases

---

## Fase 3 — Criação & Entrada na Sala

**Objetivo:** Implementar formulários de criação/entrada em sala com validação, roles de usuário e persistência de estado.

### Arquivos Criados — Fase 3

| Arquivo                          | Descrição                                                    |
| -------------------------------- | ------------------------------------------------------------ |
| `src/types/index.ts`             | Tipos TypeScript do domínio (Player, Room, Round, DeckType)  |
| `src/stores/user.ts`             | Store do jogador com persistência via localStorage           |
| `src/stores/room.ts`             | Store da sala — sincroniza estado vindo do servidor          |
| `src/composables/useRoom.ts`     | Composable encapsulando lógica de criação/entrada via Socket |
| `src/views/HomeView.vue`         | Tela inicial com forms de criar/entrar na sala               |
| `src/features/room/RoomView.vue` | Tela da sala com info do jogador e badges                    |

### Dependências Adicionadas

| Pacote                        | Papel                                         |
| ----------------------------- | --------------------------------------------- |
| `vee-validate`                | Gerenciamento de formulários reativo          |
| `@vee-validate/zod`           | Adaptador VeeValidate → Zod                   |
| `zod`                         | Schema de validação type-safe                 |
| `uuid`                        | Geração de IDs únicos                         |
| `pinia-plugin-persistedstate` | Salvar stores automaticamente no localStorage |

### Conceitos Praticados — Fase 3

#### Composables — Lógica Reutilizável Fora dos Componentes

Composables são funções que usam a Composition API (`ref`, `computed`, `watch`, etc.) para encapsular lógica reutilizável:

```ts
// src/composables/useRoom.ts
export function useRoom() {
  const router = useRouter()
  const userStore = useUserStore()
  const { joinRoom: socketJoin } = useSocket()

  function createRoom(playerName: string, deckType: DeckType, autoReveal: boolean) {
    const roomId = uuidv4().substring(0, 8)
    const playerId = uuidv4()
    const config: RoomConfig = { deckType, autoReveal }

    userStore.setPlayer(playerName, playerId, 'admin')
    socketJoin(roomId, { id: playerId, name: playerName, role: 'admin' }, config)
    router.push({ name: 'room', params: { id: roomId } })
  }

  return { createRoom, joinRoom }
}
```

**Arquitetura Server-Driven:** O composable não cria a sala localmente — ele emite um evento Socket.IO (`join_room`) e o servidor responde com o estado completo via `room_state_updated`. A store `room.ts` apenas sincroniza esse estado com `syncRoom()`.

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

### Verificação — Fase 3

- ✅ `npm run lint` + `npm run type-check` — sem erros
- ✅ Criar sala → navega para `/room/:id` com badge de Admin
- ✅ Nome do jogador persiste no localStorage

---

## Fase 4 — Sala de Votação (Core)

**Objetivo:** Construir a experiência completa de votação: cartas animadas, lista de jogadores, revelação de votos com estatísticas e celebrações.

### Arquivos Criados — Fase 4

| Arquivo                               | Descrição                                           |
| ------------------------------------- | --------------------------------------------------- |
| `src/features/room/SubjectForm.vue`   | Formulário para o admin definir o subject da rodada |
| `src/features/room/RoundHeader.vue`   | Header com rodada atual, subject e status           |
| `src/features/room/PokerCard.vue`     | Carta de poker com flip 3D e estados visuais        |
| `src/features/room/PokerTable.vue`    | Mesa oval com posicionamento radial dos jogadores   |
| `src/features/room/VotingArea.vue`    | Grid de cartas dinâmica baseada no baralho          |
| `src/features/room/PlayerList.vue`    | Lista de jogadores + seção de espectadores          |
| `src/features/room/VoteReveal.vue`    | Estatísticas, distribuição e confetti               |
| `src/features/room/RoundControls.vue` | Controles de admin (revelar / nova rodada)          |

### Conceitos Praticados — Fase 4

#### Animação CSS 3D — Flip de Carta

O `PokerCard` usa `transform-style: preserve-3d` para criar o efeito de virar a carta:

```css
.card-inner {
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
}

.poker-card.revealed .card-inner {
  transform: rotateY(180deg);
}

.card-front,
.card-back {
  backface-visibility: hidden;
}

.card-back {
  transform: rotateY(180deg); /* já virada — aparece quando o inner gira */
}
```

**Como funciona:** O `.card-inner` é um container com duas faces. Ambas usam `backface-visibility: hidden`. A face traseira já começa girada 180°. Quando adicionamos a classe `.revealed`, o container inteiro gira, escondendo a frente e mostrando o verso.

---

#### `<TransitionGroup>` — Animando Listas

Diferente do `<Transition>` (um elemento), o `<TransitionGroup>` anima **múltiplos elementos** de uma lista:

```vue
<TransitionGroup name="player" tag="ul" class="player-list">
  <li v-for="player in players" :key="player.id">
    {{ player.name }}
  </li>
</TransitionGroup>
```

**Regra:** Cada item **precisa** de um `:key` único. O Vue aplica `.player-enter-from`, `.player-leave-to` automaticamente.

---

#### Composição de Componentes — O RoomView

O `RoomView` não tem lógica visual própria — ele orquestra **8 componentes filhos** usando `v-if` baseado no estado:

```vue
<!-- Admin: Subject Form (quando não há rodada ou após revelar) -->
<SubjectForm
  v-if="isAdmin && (!currentRound || currentRound.status === 'revealed')"
  @submit="handleStartRound"
/>

<!-- Mesa central com posicionamento radial -->
<PokerTable
  v-if="currentRound"
  :players="players"
  :votes="currentRound.votes"
  :status="currentRound.status"
/>

<!-- Cartas de votação (apenas durante votação e para jogadores) -->
<VotingArea
  v-if="currentRound?.status === 'voting' && !isObserver"
  :deck-type="deckType"
  :selected-value="selectedVote"
  @vote="handleVote"
/>

<!-- Estatísticas (após revelar) -->
<VoteReveal
  v-if="currentRound?.status === 'revealed'"
  :votes="currentRound.votes"
  :player-count="activePlayerCount"
/>
```

**Princípio:** Cada componente é responsável por **uma coisa** e recebe dados via props. A lógica de "quando mostrar" fica no pai.

---

#### `watch` com Side Effects — Auto-Reveal

O `watch` observa quando todos votaram e dispara a revelação automática:

```ts
watch(allActiveVoted, (allVoted) => {
  if (allVoted && autoReveal.value && currentRound.value?.status === 'voting') {
    revealVotes(roomId.value) // emite via Socket.IO
  }
})
```

**Boas práticas com `watch`:**

- Ideal para **side effects** (ações que não são renderização)
- Quando precisa reagir a mudanças **específicas**, use `watch`
- Quando precisa de um valor **derivado**, use `computed`

---

#### `computed` Chains — Dados Derivados

O `VoteReveal` usa computed encadeados para calcular estatísticas:

```ts
const numericVotes = computed(() =>
  Object.values(props.votes).filter((v): v is number => typeof v === 'number'),
)

const average = computed(() => {
  if (numericVotes.value.length === 0) return null
  const sum = numericVotes.value.reduce((acc, v) => acc + v, 0)
  return Math.round((sum / numericVotes.value.length) * 10) / 10
})
```

**Type guard inline:** `(v): v is number` é um type predicate — diz ao TypeScript que após o `filter`, o array contém apenas `number`.

---

#### `canvas-confetti` — Celebrações Visuais

Biblioteca leve que dispara confetti no canvas do browser:

```ts
import confetti from 'canvas-confetti'

confetti({
  particleCount: 100,
  spread: 70,
  origin: { y: 0.6 },
})
```

Dispara quando detectamos **consenso** (todos votaram a mesma carta).

---

#### CSS Grid — Layout Responsivo 2 Colunas

O layout da sala usa Grid com coluna fixa para o sidebar:

```css
.room-content {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: var(--space-5);
}

/* Responsivo: volta para 1 coluna */
@media (max-width: 768px) {
  .room-content {
    grid-template-columns: 1fr;
  }
}
```

O `position: sticky` no sidebar mantém a lista de jogadores visível durante scroll.

---

### Resumo de Conceitos — Fase 4

| Conceito                         | Onde                                 |
| -------------------------------- | ------------------------------------ |
| CSS 3D Transform (`preserve-3d`) | `PokerCard.vue`                      |
| `<TransitionGroup>`              | `PlayerList.vue`, `PokerTable.vue`   |
| Posicionamento radial (Math)     | `PokerTable.vue`                     |
| Composição de componentes        | `RoomView.vue` orquestrando 8 filhos |
| `v-if` com state machine         | `RoomView.vue`                       |
| `watch` com side effects         | `RoomView.vue` (auto-reveal)         |
| Computed chains                  | `VoteReveal.vue` (stats)             |
| Type predicates                  | `VoteReveal.vue` (`v is number`)     |
| `canvas-confetti`                | `VoteReveal.vue`                     |
| CSS Grid 2 colunas               | `RoomView.vue`                       |
| `position: sticky`               | Sidebar do `RoomView.vue`            |
| Optional chaining (`?.`)         | `RoomView.vue`                       |
| `defineEmits` tipado             | Todos os componentes de room         |

### Verificação — Fase 4

- ✅ `npm run lint` + `npm run type-check` — sem erros
- ✅ Fluxo completo: Subject → Votação → Revelar → Estatísticas
- ✅ Confetti dispara ao atingir consenso
- ✅ Layout responsivo com sidebar sticky

---

## Fase 5 — Otimização & Qualidade

**Objetivo:** Refinar a aplicação para máxima performance, acessibilidade e robustez técnica.

### Conceitos Praticados

#### Performance — `v-memo` & `shallowRef`

Para evitar re-renders desnecessários em listas de alta frequência (como a lista de jogadores em tempo real):

```vue
<!-- PlayerList.vue -->
<li
  v-for="player in activePlayers"
  :key="player.id"
  v-memo="[player.name, player.role, status, hasVoted(player.id), getVote(player.id)]"
>
  ...
</li>
```

**Nota:** O array de dependências do `v-memo` inclui **todos** os valores reativos que afetam a renderização de cada item — nome, role, status da rodada, se votou e o valor do voto. Se nenhum desses mudar, o Vue pula completamente o re-render daquele `<li>`.

E para estados complexos que não precisam de reatividade profunda (deep tracking), usamos `shallowRef`:

```ts
// src/stores/room.ts
const currentRoom = shallowRef<Room | null>(null)
```

**Resultado:** Redução drástica no uso de CPU durante atualizações de estado intensas.

#### Acessibilidade — WAI-ARIA

Implementação de labels e estados para tecnologias assistivas:

- `aria-busy` e `aria-disabled` em botões de loading.
- `aria-describedby` para vincular mensagens de erro a inputs.
- `aria-pressed` para Toggle Buttons (cartas selecionadas).

#### Qualidade — Refatoração de Testes (Vitest)

Substituição de tipos `any` por tipagem forte em mocks de Socket.IO e melhoria na configuração do Vitest para isolar testes unitários de E2E.

### Verificação

- ✅ `npm run test:unit` — 100% de sucesso com mocks tipados.
- ✅ Lighthouse / Accessibility audit — Menus e botões totalmente semânticos.
- ✅ Bundle analysis — Redução no tamanho inicial via Lazy Loading generalizado.
