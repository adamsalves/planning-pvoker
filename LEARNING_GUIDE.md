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
├── composables/     → Lógica reutilizável (useRoom, useSocket…)
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

**Nota:** O array de dependências do `v-memo` inclui **todos** os valores reativos que afetam a renderização de cada item. Se nenhum mudar, o Vue pula completamente o re-render daquele `<li>`.

**A armadilha, aprendida depois:** essa lista é uma dependência manual, e o compilador não a verifica. Cada estado novo que a linha passou a mostrar — a tag da área, "fora desta rodada", "ausente" — precisou ser **acrescentado à mão**, e esquecer significa uma linha que simplesmente não repinta. Foi por isso que o `locale` entrou na lista: sem ele, o nome acessível do toggle (interpolado com `t()`) congelava no idioma antigo enquanto o badge ao lado já tinha traduzido. A regra que ficou: **todo valor reativo lido dentro do `<li>` vai nas deps**, e todo estado novo ganha um teste que muda a prop DEPOIS do mount.

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

---

## Fase 6 — Tempo Real de Verdade: Presença, Reconexão e Identidade

**Objetivo:** sair do "funciona com todo mundo online e a rede boa" para o que acontece de verdade — abas que fecham, redes que caem, servidores que reiniciam.

### Conceitos Praticados — Fase 6

#### O cliente não é fonte da verdade sobre quem ele é

A primeira versão confiava no `playerId` que o cliente mandava. O problema: o `adminId` da sala viaja no broadcast para todo mundo. Qualquer um podia entrar de novo dizendo `player.id = <adminId>` e virar admin.

A correção é um **token de sessão por (sala, jogador)**, guardado fora do objeto `Room` justamente para nunca ser serializado no broadcast:

```ts
// server/src/roomManager.ts
private tokens: Map<string, string> = new Map()
```

O token é devolvido só no _ack_ do `join_room` (que vai para um socket só), e é ele que prova a identidade num rejoin. O papel também passou a ser **derivado do servidor**, não aceito do cliente:

```ts
// server/src/events.ts — normalização no join
const role = player.id === room.adminId ? 'admin' : player.role === 'admin' ? 'member' : player.role
```

**A lição:** todo dado que o cliente manda é uma _sugestão_. O que decide é o estado do servidor mais um segredo que só o dono da identidade tem.

#### Presença ≠ estar na lista

Um refresh não pode expulsar ninguém da sala, mas alguém que fechou a aba também não pode travar a rodada para sempre. Isso virou uma **janela de graça**: ao perder o último socket, o jogador entra num timer; se voltar antes, nada aconteceu.

```ts
// server/src/events.ts
const isPresent = (roomId: string, playerId: string): boolean => {
  const key = presenceKey(roomId, playerId)
  return activeSockets.has(key) || leaveTimers.has(key)
}
```

Presença é estado do **processo** — sockets e timers. Por isso ela é injetada no `RoomManager` por uma porta estreita (`PresenceOracle`) em vez de o `RoomManager` conhecer sockets:

```ts
export interface PresenceOracle {
  isPresent(roomId: string, playerId: string): boolean
}
```

O padrão aqui é **inversão de dependência**: o núcleo do domínio declara o que precisa saber, e a camada de transporte fornece. Um efeito colateral valioso é que o `RoomManager` continua testável sem nenhum socket — o default responde "todos presentes", e os testes injetam o que quiserem.

#### O mesmo conceito em três momentos diferentes

Um "quem conta" aparece em lugares que parecem iguais e não são. Confundi-los foi a origem de vários bugs:

| Conceito          | Função                               | Pergunta que responde                 |
| ----------------- | ------------------------------------ | ------------------------------------- |
| Sentado à mesa    | `activePlayersOf`                    | quem aparece na mesa (não-espectador) |
| Votante da rodada | `roundVotersOf` / `eligibleVotersOf` | de quem a rodada espera voto          |
| Presente          | `presentPlayersOf`                   | quem está de fato conectado agora     |

São três eixos independentes: um espectador está sentado? Não. Alguém tirado da rodada está sentado? Sim, mas não vota. Um fantasma vota? Está elegível, mas não está lá.

### Verificação — Fase 6

- ✅ Rejoin com token válido preserva identidade e papel; sem token, é recusado.
- ✅ Refresh dentro da janela de graça não remove o jogador nem trava a rodada.
- ✅ Testes de socket ponta a ponta (cliente Socket.IO real contra servidor real), não só unitários do `RoomManager`.

---

## Fase 7 — Persistência Sem Banco de Dados

**Objetivo:** o plano free do Render hiberna e reinicia. Uma sala não podia morrer junto com o processo.

### Conceitos Praticados — Fase 7

#### Write-through, e não "o banco é a verdade"

A escolha de arquitetura foi manter as `Map`s em memória como autoritativas e **espelhar** cada mutação para o Redis, em vez de ler do Redis a cada operação:

```
mutação → Map (síncrono, autoritativo) → snapshot no Redis (async, best-effort)
```

O ganho é que a API pública do `RoomManager` continua **síncrona** e os testes existentes não mudaram uma linha. O custo é que uma escrita perdida só custa durabilidade, nunca correção — e é por isso que ela pode ser best-effort.

Escritas concorrentes para a mesma sala são **coalescidas**: no máximo um save em voo por sala, e uma sala mutada durante o save é remarcada e re-salva com o estado mais novo. Colapsar snapshots intermediários é seguro porque só o último importa para quem reidrata.

#### O que vem de fora é `unknown` até prova em contrário

Um snapshot lido do Redis é dado externo — pode estar corrompido, ter schema antigo, ter sido escrito por uma versão anterior. Ele passa por zod antes de virar `Room`:

```ts
const parsedRoom = roomSchema.safeParse(raw)
if (!parsedRoom.success) {
  /* descarta esta sala, segue o boot */
}
```

Duas decisões que só aparecem quando você tenta:

**Campos novos entram como opcionais.** `excludedVoterIds` e `tag` são `.optional()` porque snapshots gravados antes da feature não os têm — um `required` faria o `safeParse` falhar e **todas as salas vivas morreriam no deploy** que introduziu o campo.

**Enum de produto degrada, enum estrutural rejeita.** A tag usa `.optional().catch(undefined)`: se um valor sair da lista, o jogador perde a tag em vez de a sala inteira ser descartada. Já `role` e `deckType` não levam `.catch` — são estruturais, e um valor inválido ali significa dado que não dá para interpretar.

#### Guardas de relação, não só de forma

Zod valida campo a campo. Ele não pega `currentRoundIndex: 1` com `rounds: []` — cada campo é válido sozinho, só a **relação** está quebrada. E esse caso arma um `TypeError` dentro de um handler de socket, que derruba o processo:

```ts
.refine(
  (room) =>
    room.currentRoundIndex === -1 ||
    (room.currentRoundIndex >= 0 && room.currentRoundIndex < room.rounds.length),
  { message: 'currentRoundIndex must be -1 or a valid index into rounds' },
)
```

A régua que ficou: **rejeitar é para o dano que a sala não absorve.** Um índice fora de faixa derruba o processo → rejeita. Um `excludedVoterIds` órfão é inerte → passa. E há um terceiro caminho, aprendido depois: um `adminId` apontando para ninguém não derruba nada, mas deixa a sala impossível de dirigir — esse caso é **reparado** no boot, não descartado, porque descartar custaria o backlog e o histórico inteiros por causa de uma string.

### Verificação — Fase 7

- ✅ Redeploy do backend com sala ativa: a sala volta, com backlog e rodadas.
- ✅ Sem as variáveis do Redis, o servidor roda igual à v1 (100% memória).
- ✅ Snapshot malformado é descartado com o motivo no log, e o boot segue com as outras salas.

---

## Fase 8 — i18n, Tema e Ícones

**Objetivo:** o produto falar duas línguas, respeitar a preferência de tema do sistema e parar de depender de emoji do SO para comunicar estado.

### Conceitos Praticados — Fase 8

#### Catálogo tipado por chave

O `vue-i18n` aceita qualquer string em `t()` — um typo vira texto faltando em produção, silenciosamente. A augmentação de módulo transforma isso em erro de compilação:

```ts
// src/i18n/vue-i18n.d.ts
export type MessageSchema = typeof ptBR
```

O catálogo pt-BR é a **fonte do schema**, e o `en` é tipado contra ele: chave faltando ou sobrando no inglês não compila.

#### Erro guardado como chave, traduzido no render

O caso que quebra a intuição: uma mensagem de validação já na tela precisa **re-traduzir** quando o idioma muda. Guardar a string traduzida congela o idioma do momento em que o erro apareceu. A solução é guardar a **chave** e traduzir na renderização.

#### Ícone é dado ou é decoração — nunca os dois

Emoji são renderizados pelo SO, com cor fixa: num tema escuro eles brigam com tudo. A troca foi para SVG inline em build-time (`unplugin-icons` + Lucide), herdando `currentColor` — recolorem com o tema de graça.

A regra que decidiu o que trocar: **emoji fica quando é marca ou dado** (o 🃏 do logo, o ☕ que é um valor real do baralho); **vira ícone quando é rótulo de estado** (votou, aguardando, espectador). E todo ícone decorativo sai da árvore de acessibilidade com `aria-hidden="true"`, com o significado no texto ao lado — quem usa leitor de tela ouve o rótulo, não "imagem".

### Verificação — Fase 8

- ✅ Trocar idioma com erro de validação na tela re-traduz o erro.
- ✅ Tema claro/escuro/automático persistido, e os ícones acompanham.
- ✅ Nenhum emoji de estado no DOM (asserção nos testes de componente).

---

## Fase 9 — A Qualidade Que o Compilador Não Dá de Graça

**Objetivo:** fechar os vãos onde "está verde" não significava "está certo".

### Conceitos Praticados — Fase 9

#### Suíte verde ≠ suíte discriminante

O aprendizado mais transferível do projeto inteiro. Um teste que passa não prova nada sozinho: ele pode estar asseverando algo que é verdade **independentemente** do código sob teste.

Um caso real daqui: um teste conferia a posição do primeiro jogador na mesa depois de filtrar os ausentes. Passava. Só que o ângulo é `π/2 + (index/total)·2π` — para `index 0` isso é `π/2` **para qualquer total**. O teste não podia falhar.

A ferramenta contra isso é **teste por mutação**: quebre de propósito o comportamento que o teste alega cobrir e confirme que ele falha.

```bash
# quebra a linha, roda a suíte, confere o exit code, reverte
npm run type-check; echo "EXIT=$?"
```

Um corolário: **fixture de um elemento esconde bug.** Com uma lista de um item, `.some()`, `.every()`, `[0]` e "o último" são indistinguíveis.

#### O gate que passava sem checar nada

Por meses o `npm run type-check` retornava 0 sem nunca olhar os `*.spec.ts`. A causa não era design do `vue-tsc` — era uma linha de config: dois projetos TypeScript gravando no **mesmo** `tsBuildInfoFile`, então o `--build` lia o carimbo de um ao checar o outro, concluía "atualizado" e pulava.

A lição não é sobre TypeScript. É que **um gate precisa ser testado como qualquer outro código**: plante um erro e confirme que ele reprova. Um gate que nunca reprovou nada é indistinguível de um gate que não existe.

#### Proibir asserção de tipo, e o que aparece no lugar

`as` e `!` silenciam o compilador exatamente onde a informação é mais valiosa. A regra virou lint (`consistent-type-assertions: never` + `no-non-null-assertion`), e o que a substitui é mais interessante do que a proibição:

```ts
// src/test-utils/must.ts — narrowing por FLUXO DE CONTROLE, não por asserção
export function must<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Expected ${what} to be defined, got ${String(value)}`)
  }
  return value
}
```

A diferença com `!` não é ideológica: o `throw` é uma saída **real**, então a falha vira `Expected summary tab to be defined` em vez de `Cannot read properties of undefined` dez linhas adiante. O rótulo é obrigatório de propósito — com um default genérico, o default vence e a mensagem volta a não dizer nada.

Outros dois padrões que apareceram ao remover os casts: **o helper cast-free que o arquivo já tinha** costuma ser exatamente o que o cast reimplementava à mão; e **nomear o valor** elimina `array[N]!` melhor do que embrulhá-lo.

#### O contrato que o compilador não vê

Os tipos de rede são declarados dos dois lados — `server/src/types.ts` e `src/types/index.ts` — sem nada ligando um ao outro. Uma união de tipos **some na compilação**, então nenhum teste alcança. A solução foi declarar os vocabulários como const arrays, que existem em runtime:

```ts
export const ROUND_STATUSES = ['voting', 'revealed'] as const
export type RoundStatus = (typeof ROUND_STATUSES)[number]
```

Com valor em runtime, a deriva vira **assertável** — um teste compara as listas dos dois lados e falha se divergirem. Foi o que expôs um `'waiting'` que o cliente carregava e o servidor nunca emitiu, em commit nenhum.

O limite continua registrado: o guarda cobre **vocabulários**, não campos de interface. Um campo adicionado de um lado só compila limpo e falha em runtime.

### Verificação — Fase 9

- ✅ `npm run type-check` cobre `src/` e os specs, nos dois lados, e reprova erro plantado.
- ✅ `eslint` reprova `as` (fora de `as const`) e `!`.
- ✅ `knip` reprova export não usado.
- ✅ Cobertura nova acompanhada de mutação que prova que ela discrimina.
