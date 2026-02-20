# 🃏 Planning Poker

Aplicação de Planning Poker em tempo real para estimativas ágeis com seu time.

Projeto guiado para estudo de **Vue 3** com foco em conceitos e boas práticas do mercado atual.

## ✨ Features

- 🏠 **Criar ou entrar em salas** com código compartilhável
- 👑 **Papéis**: Admin (Scrum Master), Jogador e Espectador
- 🎴 **Baralhos customizáveis**: Fibonacci, T-Shirt Sizes ou Sequencial
- ✅ **Validação de formulários** com VeeValidate + Zod
- 💾 **Persistência automática** de dados do jogador via localStorage
- 🌙 **Dark mode** automático via CSS Custom Properties
- ⚡ **Transições e animações** entre rotas e componentes

## 🛠️ Stack

| Tecnologia                                                                  | Papel                                          |
| --------------------------------------------------------------------------- | ---------------------------------------------- |
| [Vue 3](https://vuejs.org/)                                                 | Framework — Composition API + `<script setup>` |
| [Vite](https://vitejs.dev/)                                                 | Build tool                                     |
| [TypeScript](https://www.typescriptlang.org/)                               | Tipagem estática                               |
| [Pinia](https://pinia.vuejs.org/)                                           | Gerenciamento de estado                        |
| [Vue Router](https://router.vuejs.org/)                                     | Roteamento SPA                                 |
| [VeeValidate](https://vee-validate.logaretm.com/) + [Zod](https://zod.dev/) | Validação de formulários                       |

## 📁 Estrutura

```
src/
├── assets/         # CSS global e design tokens
├── components/     # Componentes reutilizáveis (BaseButton, BaseCard, BaseInput, BaseModal)
├── composables/    # Lógica reutilizável (useRoom)
├── features/       # Módulos por feature
│   ├── room/       # Sala de votação
│   └── history/    # Histórico de sessões
├── layouts/        # Layout principal (DefaultLayout)
├── router/         # Configuração de rotas
├── stores/         # Stores Pinia (user, room)
├── types/          # Tipos TypeScript do domínio
└── views/          # Páginas (HomeView)
```

## 🚀 Setup

```bash
# Instalar dependências
npm install

# Rodar em modo de desenvolvimento
npm run dev

# Lint e formatação
npm run lint
npm run format

# Verificar tipos
npm run type-check

# Build para produção
npm run build
```

## 📖 Guia de Aprendizado

O arquivo [`LEARNING_GUIDE.md`](./LEARNING_GUIDE.md) documenta todos os conceitos Vue 3 praticados em cada fase do projeto, com exemplos de código e explicações detalhadas.

## 📋 Roadmap

- [x] **Fase 1** — Fundação (Vite, Vue 3, TypeScript, Router, Pinia)
- [x] **Fase 2** — Design System & Layout (Componentes base, CSS tokens, Transitions)
- [x] **Fase 3** — Criação & Entrada na Sala (Forms, VeeValidate + Zod, Composables)
- [ ] **Fase 4** — Sala de Votação (Cartas animadas, máquina de estados, papéis)
- [ ] **Fase 5** — Tempo Real com WebSocket (Socket.io, sincronização)
- [ ] **Fase 6** — Histórico & Estatísticas (Persistência, gráficos)
- [ ] **Fase 7** — Testes (Vitest, Vue Test Utils, Playwright)
- [ ] **Fase 8** — Boas Práticas & Finalização (a11y, performance, responsividade)

## 📄 Licença

MIT
