# 🃏 Vue Planning Poker

Uma aplicação de Planning Poker moderna, ágil e em tempo real construída com Vue 3, Vite, Pinia, TypeScript, Node.js e Socket.IO.

## ✨ Funcionalidades

- **Real-time:** Conectividade de baixa latência em WebSockets para múltiplos usuários simultâneos na mesma sala.
- **Tipos de Baralho Customizáveis:** Crie rodadas usando as sequências _Fibonacci_, _T-Shirt_ (P, M, G, GG...) ou _Sequencial_.
- **Papéis Dedicados:** Jogue definindo um _Scrum Master (Admin)_, _Membros_ ativos e _Espectadores_ passivos.
- **Gráficos e Histórico:** Armazenamento automático e local (localStorage via Pinia Persisted) de rodadas com exibições estatísticas ricas (Chart.js e `vue-chartjs`).
- **Acessibilidade & Performance:** Totalmente navegável por teclado, _ARIA attributes_ suportados, e navegação via Lazy Loading Componentes no Vue Router.

## 🚀 Rodando o Projeto Localmente

O repositório é composto de **Duas aplicações**: O servidor real-time e a UI em Vue. Ambas as camadas precisam rodar em paralelo.

### Configurando o Backend (Node Server)

O Node atua em memória mantendo as conexões e transmitindo os eventos de votos sem persistência contínua na máquina.

```bash
# Navegue até a pasta do servidor
cd server/

# Instale os pacotes e suba o Express/Socket.IO (iniciará na porta 3001)
npm install
npm run dev
```

### Configurando o Frontend (Vue App)

```bash
# Na raiz principal do projeto frontend
npm install

# Suba o app Vite (em ambiente de desenvolvimento)
npm run dev
```

> O Frontend vai procurar conectar automaticamente com o Node no localhost:3001.

---

## 🧪 Testes

A saúde do software é validada de duas formas e pode ser conferida em linha de comando ou via Interface UI a qualquer momento.

### Unitários (Vitest)

Cobrindo funções utilitárias e todo o core das `Store` (Pinia) e de navegação de Composables (`useRoom` e `useSocket`).

```bash
npm run test:unit
```

### End-to-End (Playwright)

O robô cria duas abas independentes (contextos) realizando interações ponta-a-ponta entre uma máquina Administradora e uma de um Participante simulando um ciclo completo de sala.

```bash
# Para instalar navegadores da engine se necessário pela primeira vez:
npx playwright install chromium

# Rodando os testes
npm run test:e2e
```

## 🛠️ Stack Utilizada

- **Vue 3** (`<script setup>` Composition API)
- **Vite** (Ferramenta de Bundler e Build ultra rápida)
- **Pinia** (Ecossistema modular de estado global)
- **Vue Router** (Manuseio de URL local dinâmico)
- **Socket.IO** (Sincronização cliente-servidor nativa)
- **VeeValidate & Zod** (Gestão pesada e parseamento em Type-level validation dos formulários)
- **Vitest & Playwright** (Camada de qualidade)
- **Vanilla CSS** (Componentização com Variáveis de Root nativo. _Mobile-First_)
