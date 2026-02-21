# 🃏 Vue Planning Poker

Uma aplicação de Planning Poker moderna, ágil e em tempo real construída com Vue 3, Vite, Pinia, TypeScript, Node.js e Socket.IO.

## ✨ Funcionalidades

- **Real-time:** Conectividade de baixa latência com WebSockets (Socket.IO) para múltiplos usuários simultâneos na mesma sala.
- **Mesa Interativa:** Visualização oval da mesa de poker com posicionamento radial dos jogadores e animações 3D de cartas.
- **Tipos de Baralho Customizáveis:** Crie rodadas usando as sequências _Fibonacci_, _T-Shirt_ (PP, P, M, G, GG, XGG) ou _Sequencial_.
- **Papéis Dedicados:** Jogue como _Scrum Master (Admin)_, _Membro_ ativo ou _Espectador_ passivo.
- **Auto-Reveal:** Opção de revelar os votos automaticamente quando todos os jogadores votarem.
- **Estatísticas ao Vivo:** Média, mínimo, máximo e distribuição de votos exibidos após revelação, com confetti quando há consenso 🎉
- **Gráficos e Histórico:** Persistência local (localStorage via Pinia Persisted) de sessões com gráficos de rodadas (Chart.js + `vue-chartjs`).
- **Acessibilidade (A11y):** Navegação completa por teclado, atributos _WAI-ARIA_ dinâmicos (`aria-busy`, `aria-describedby`, `aria-pressed`, `aria-invalid`).
- **Performance:** _Lazy Loading_ de todas as rotas, `v-memo` para listas de alta frequência e `shallowRef` para estados complexos.

## 📁 Estrutura do Projeto

```text
├── server/                  → Backend Node.js (Express 5 + Socket.IO)
│   └── src/
│       ├── index.ts         → Servidor HTTP + Socket.IO
│       ├── events.ts        → Handlers dos eventos WebSocket
│       ├── roomManager.ts   → Gerenciamento de salas em memória
│       └── types.ts         → Tipos compartilhados
└── src/                     → Frontend Vue 3
    ├── assets/              → CSS global e design tokens
    ├── components/          → Componentes atômicos (BaseButton, BaseCard, BaseInput, BaseModal)
    ├── composables/         → Lógica reutilizável (useRoom, useSocket)
    ├── features/
    │   ├── room/            → Sala de votação (8 componentes)
    │   └── history/         → Histórico de sessões com gráficos
    ├── layouts/             → Layout principal (Navbar + RouterView animado)
    ├── router/              → Configuração de rotas (100% lazy-loaded)
    ├── stores/              → Stores Pinia (room, user, history)
    ├── types/               → Interfaces TypeScript do domínio
    └── views/               → Página inicial (HomeView)
```

## 🚀 Rodando o Projeto Localmente

O repositório é composto de **duas aplicações** que precisam rodar em paralelo.

### Backend (Node.js)

O servidor atua em memória, mantendo salas e conexões. Não há persistência em banco de dados.

```bash
cd server/
npm install
npm run dev        # Express + Socket.IO na porta 3001
```

### Frontend (Vue App)

```bash
npm install
npm run dev        # Vite dev server
```

> O frontend conecta automaticamente ao backend via `VITE_WS_URL` (padrão: `http://localhost:3001`).

---

## 🧪 Testes

### Unitários (Vitest)

Cobrindo stores (Pinia), composables (`useRoom`, `useSocket`) e componentes de room.

```bash
npm run test:unit       # Modo watch
npm run test:coverage   # Relatório de cobertura (v8)
```

### End-to-End (Playwright)

Simulação ponta-a-ponta entre um Admin e um Participante em duas abas independentes.

```bash
npx playwright install chromium   # Primeira vez
npm run test:e2e
```

---

## 🛠️ Stack

| Categoria      | Tecnologia                 | Papel                                     |
| -------------- | -------------------------- | ----------------------------------------- |
| **Framework**  | Vue 3 (Composition API)    | `<script setup>` + TypeScript 5.9         |
| **Build**      | Vite 7                     | Dev server + bundler                      |
| **Estado**     | Pinia 3 + Persisted State  | Estado global + persistência localStorage |
| **Roteamento** | Vue Router 5               | SPA com lazy loading                      |
| **Real-time**  | Socket.IO                  | Comunicação bidirecional cliente-servidor |
| **Validação**  | VeeValidate + Zod          | Formulários type-safe                     |
| **Gráficos**   | Chart.js + vue-chartjs     | Visualização de histórico                 |
| **Servidor**   | Express 5 + Socket.IO      | Backend em memória (Node.js)              |
| **Testes**     | Vitest + Playwright        | Unitários + E2E                           |
| **Linting**    | ESLint + oxlint + Prettier | Qualidade e formatação                    |
| **CSS**        | Vanilla CSS                | Design tokens + custom properties         |

## 📜 Scripts Disponíveis

| Comando                 | Descrição                         |
| ----------------------- | --------------------------------- |
| `npm run dev`           | Inicia o Vite dev server          |
| `npm run build`         | Build de produção com type-check  |
| `npm run lint`          | Roda oxlint + ESLint com auto-fix |
| `npm run format`        | Formata código com Prettier       |
| `npm run test:unit`     | Testes unitários (Vitest watch)   |
| `npm run test:coverage` | Cobertura de testes (v8)          |
| `npm run test:e2e`      | Testes E2E (Playwright)           |
| `npm run type-check`    | Verificação de tipos (vue-tsc)    |
