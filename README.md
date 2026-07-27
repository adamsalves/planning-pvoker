# 🃏 Vue Planning Poker

Planning Poker em tempo real para estimativa ágil: uma sala, um baralho, e o time votando junto. Vue 3 + TypeScript no cliente, Express 5 + Socket.IO no servidor.

**Produção:** [planningpvoker.netlify.app](https://planningpvoker.netlify.app) · backend em [planning-pvoker.onrender.com](https://planning-pvoker.onrender.com)

## ✨ Funcionalidades

- **Tempo real** — Socket.IO mantém a sala sincronizada entre todos os participantes; o servidor é a fonte da verdade e transmite o estado inteiro a cada mudança.
- **Mesa interativa** — visualização oval com posicionamento radial dos jogadores e animação 3D no flip das cartas.
- **Três baralhos** — _Fibonacci_, _T-Shirt_ (PP → XGG) e _Sequencial_, escolhidos na criação da sala. ☕ está em todos, para "não dá pra estimar".
- **Papéis** — _Admin_ (quem cria a sala) conduz a sessão; _Jogador_ vota; _Espectador_ acompanha sem entrar no quórum.
- **Quem vota nesta rodada** — a admin pode tirar alguém de uma rodada específica sem transformá-lo em espectador. A pessoa continua sentada à mesa, só não é esperada.
- **Área do jogador** — tag opcional e auto-declarada na entrada (dev, design, QA, produto, outro). Puramente informativa: não afeta voto nem quórum.
- **Auto-reveal** — opção de revelar automaticamente quando todos os votantes **presentes** tiverem votado.
- **Estatísticas** — média, mínimo, máximo e distribuição depois do reveal, com confetti quando há consenso real (2+ votos iguais).
- **Resumo ao vivo** — aba de resumo dentro da sala com o histórico das rodadas já reveladas.
- **Reconexão resiliente** — um refresh ou queda de rede não tira você da sala: há uma janela de graça, e a sessão é provada por um token privado (não pelo `playerId`, que trafega no broadcast).
- **Persistência opcional** — com Redis configurado, as salas sobrevivem a um redeploy ou cold start do servidor. Sem ele, o app roda 100% em memória.
- **Tema e idioma** — claro/escuro/automático e pt-BR/en, ambos persistidos.
- **Acessibilidade** — navegação por teclado, `WAI-ARIA` nos controles (tablist com roving tabindex, `role="switch"`, `aria-busy`, `aria-describedby`, `aria-pressed`, `aria-invalid`), e ícones decorativos fora da árvore de acessibilidade.
- **Performance** — rotas 100% lazy-loaded, `v-memo` na lista de jogadores (a que mais repinta) e `shallowRef` no estado da sala, que é substituído inteiro a cada broadcast e não precisa de reatividade profunda.

## 📁 Estrutura

```text
├── e2e/                         → Testes Playwright (fluxo entre duas abas)
├── public/                      → Assets estáticos servidos como estão
├── server/                      → Backend (Express 5 + Socket.IO)
│   ├── src/
│   │   ├── index.ts             → HTTP + Socket.IO, CORS, /health
│   │   ├── events.ts            → Handlers dos eventos, presença e janela de graça
│   │   ├── roomManager.ts       → Estado das salas (autoritativo, em memória)
│   │   ├── persistence.ts       → Snapshots write-through no Redis (opcional)
│   │   ├── validation.ts        → Schemas zod das bordas do socket
│   │   ├── errorCodes.ts        → Códigos de erro do contrato de rede
│   │   ├── crashGuards.ts       → Guardas de processo (boot e runtime)
│   │   ├── logger.ts            → Log com nível por ambiente
│   │   └── types.ts             → Tipos do domínio + contrato de rede
│   └── test/                    → Suíte do servidor (Vitest)
└── src/                         → Frontend (Vue 3)
    ├── assets/                  → CSS global e design tokens
    ├── components/              → Componentes atômicos (BaseButton, BaseCard, BaseInput, BaseModal)
    ├── composables/             → useRoom, useSocket, useVoteStats, useShareRoom, joinErrors, matchMedia
    ├── features/
    │   ├── home/                → Criar/entrar na sala
    │   ├── room/                → Sala de votação (mesa, lista, controles, resumo)
    │   └── not-found/           → 404
    ├── i18n/                    → Catálogos pt-BR/en (o pt-BR é o schema do en)
    ├── layouts/                 → Navbar + RouterView animado
    ├── router/                  → Rotas (100% lazy-loaded)
    ├── stores/                  → Pinia: room, user, connection, theme, locale
    ├── test-utils/              → Helpers só de teste (proibidos em produção via lint)
    ├── types/                   → Tipos do domínio + guardas de deriva contra o servidor
    └── utils/                   → players, rounds, logger
```

## 🚀 Rodando localmente

São **duas aplicações**. O jeito mais curto é subir as duas de uma vez:

```bash
npm install
npm --prefix server install
npm run dev:all          # Vite (5173) + Express/Socket.IO (3001) em paralelo
```

Ou separadamente:

```bash
npm --prefix server run dev    # backend na 3001
npm run dev                    # frontend na 5173
```

O frontend conecta via `VITE_WS_URL` (padrão `http://localhost:3001`). Copie `.env.example` para `.env` se precisar mudar.

### Persistência (opcional)

Sem configuração o servidor roda em memória — as salas somem se o processo reiniciar. Para mantê-las, defina as duas variáveis do [Upstash Redis](https://upstash.com/) no ambiente do servidor:

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Com elas presentes o servidor grava snapshots write-through e reidrata as salas no boot. O log do boot diz qual modo está ativo.

Para o deploy em produção (Netlify + Render), veja [DEPLOYMENT_PLAN.md](./DEPLOYMENT_PLAN.md).

## 🧪 Testes

| Suíte                     | Comando                    | O que cobre                                                                                                    |
| ------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Unit/componente (cliente) | `npm run test:unit`        | stores, composables, utils, componentes (base, home, sala, layout, 404), rotas e guardas de deriva de contrato |
| Servidor                  | `npm --prefix server test` | `RoomManager`, eventos de socket ponta a ponta, persistência, guardas de processo                              |
| E2E                       | `npm run test:e2e`         | fluxo completo entre duas abas (admin + participante)                                                          |
| Cobertura                 | `npm run test:coverage`    | relatório v8 do cliente                                                                                        |

```bash
npx playwright install chromium   # só na primeira vez
```

> ⚠️ O e2e entra no `npm run validate`, que é o hook de **pre-push** (Husky) — sem os browsers do Playwright instalados, o `git push` falha. O CI **não** roda e2e. Ele tem três jobs: `client` (type-check, oxlint, eslint, unit), `server` (build, type-check, testes) e `knip`, que instala os dois workspaces e checa código morto nos dois.

### Verificação completa

```bash
npm run validate    # oxlint · eslint · knip · type-check · unit · server (build+type-check+test) · e2e
```

## 🛠️ Stack

| Categoria        | Tecnologia                            | Papel                                             |
| ---------------- | ------------------------------------- | ------------------------------------------------- |
| **Framework**    | Vue 3 (Composition API)               | `<script setup>` + TypeScript 5.9                 |
| **Build**        | Vite 7                                | Dev server + bundler                              |
| **Estado**       | Pinia 3 + persistedstate              | Estado global + localStorage                      |
| **Roteamento**   | Vue Router 5                          | SPA com lazy loading                              |
| **Tempo real**   | Socket.IO 4                           | Cliente e servidor                                |
| **Validação**    | VeeValidate + Zod                     | Formulários e bordas do socket                    |
| **i18n**         | vue-i18n 11                           | pt-BR/en, com o catálogo en tipado contra o pt-BR |
| **Ícones**       | unplugin-icons + Lucide               | SVG inline em build-time, recolorem com o tema    |
| **Servidor**     | Express 5 + Socket.IO                 | Node.js                                           |
| **Persistência** | Upstash Redis (opcional)              | Snapshots write-through                           |
| **Testes**       | Vitest + @vue/test-utils + Playwright | Unit/componente + e2e                             |
| **Qualidade**    | ESLint + oxlint + Prettier + knip     | Lint, formatação e código morto                   |
| **CSS**          | Vanilla CSS                           | Design tokens + custom properties                 |

## 📜 Scripts

| Comando                 | Descrição                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Vite dev server                                                                                                        |
| `npm run dev:all`       | Frontend + backend em paralelo                                                                                         |
| `npm run build`         | Build de produção (roda type-check junto)                                                                              |
| `npm run preview`       | Serve o build local                                                                                                    |
| `npm run type-check`    | `vue-tsc --build` (cobre `src/` **e** os specs)                                                                        |
| `npm run lint`          | oxlint + ESLint com auto-fix                                                                                           |
| `npm run format`        | Prettier em `src/`                                                                                                     |
| `npm run knip`          | Código morto e exports não usados                                                                                      |
| `npm run test:unit`     | Vitest em watch                                                                                                        |
| `npm run test:coverage` | Cobertura v8                                                                                                           |
| `npm run test:e2e`      | Playwright                                                                                                             |
| `npm run validate`      | oxlint · eslint · knip · type-check · unit · servidor (build + type-check + testes) · e2e — nesta ordem, a do pre-push |

Scripts do servidor rodam com `npm --prefix server run <script>`: `dev`, `build`, `start`, `type-check`, `test`.

## 📐 Convenções

- **Sem type assertions.** `as` (fora de `as const`) e non-null `!` são proibidos e barrados no ESLint. Use type guards, validação zod ou narrowing por fluxo de controle.
- **Conventional Commits** — é o que gera versão e changelog. Ver [RELEASE.md](./RELEASE.md).
- **Branches saem da `develop`**; `main` é produção.
- O `CHANGELOG.md` é **gerado** pelo release-please — não edite à mão.

## 📚 Documentação

| Arquivo                                    | Conteúdo                                                |
| ------------------------------------------ | ------------------------------------------------------- |
| [RELEASE.md](./RELEASE.md)                 | Versionamento, branching, release e rollback            |
| [DEPLOYMENT_PLAN.md](./DEPLOYMENT_PLAN.md) | Como o deploy está montado (Netlify + Render + Upstash) |
| [LEARNING_GUIDE.md](./LEARNING_GUIDE.md)   | Diário de aprendizado Vue 3, fase a fase                |
| [AGENTS.md](./AGENTS.md)                   | Comandos e convenções para agentes automatizados        |
