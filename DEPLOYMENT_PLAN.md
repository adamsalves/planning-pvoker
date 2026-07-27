# Deploy — Netlify + Render + Upstash

Como o Planning Poker está publicado hoje. Este arquivo descreve a montagem **em vigor**; para o processo de versionar e promover uma release, veja [RELEASE.md](./RELEASE.md).

> Histórico: este documento nasceu como _plano_ de publicação, antes da v1.0.0 (2026-06-26). O plano foi executado, e desde a v1.3.0 o backend também tem persistência — o que invalidou boa parte das limitações originais. Reescrito como referência do estado atual.

## Arquitetura

| Camada       | Onde                          | O quê                                      |
| ------------ | ----------------------------- | ------------------------------------------ |
| Frontend     | **Netlify**                   | SPA Vue/Vite, build estático               |
| Backend      | **Render** (Web Service Node) | Express 5 + Socket.IO, processo long-lived |
| Persistência | **Upstash Redis** (REST)      | Snapshots write-through das salas          |

O frontend fala com o backend por WebSocket, usando `VITE_WS_URL` embutido no build.

**Por que o backend não é serverless:** Socket.IO precisa de um processo de vida longa mantendo as conexões. Netlify Functions são por-requisição e não substituem isso. Foi essa restrição que definiu a separação Netlify/Render.

**Por que uma instância só:** o estado autoritativo das salas vive em memória no `RoomManager`. Escalar horizontalmente exigiria um adapter de Socket.IO compartilhado (Redis pub/sub) além da persistência que já existe — o Redis de hoje é durabilidade, não coordenação entre instâncias.

## Frontend (Netlify)

Configuração no `netlify.toml` (versionado):

- Build command: `npm run build` — inclui o `type-check`, então erro de tipo (em `src/` **ou** nos specs) derruba o deploy.
- Publish directory: `dist`.
- Rewrite de SPA: `/*` → `/index.html` com status `200`.

Variável de ambiente (painel do Netlify, **não** no repo):

```bash
VITE_WS_URL=https://planning-pvoker.onrender.com
```

Só variáveis com prefixo `VITE_` chegam ao cliente, e elas ficam **embutidas no bundle** — nada de segredo aqui.

## Backend (Render)

| Configuração      | Valor                          |
| ----------------- | ------------------------------ |
| Root Directory    | `server`                       |
| Build Command     | `npm install && npm run build` |
| Start Command     | `npm start`                    |
| Health Check Path | `/health`                      |

O `PORT` é provido pelo Render e já é lido em `server/src/index.ts`.

### Variáveis de ambiente

| Variável                                           | Obrigatória         | Papel                                                                                                                         |
| -------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `CLIENT_ORIGIN` / `CLIENT_ORIGINS` / `CORS_ORIGIN` | não                 | Origens **adicionais** no CORS (lista separada por vírgula). Ver a nota abaixo — as de produção já vêm no default.            |
| `RENDER_EXTERNAL_URL`                              | provida pelo Render | Entra na mesma lista de origens aceitas.                                                                                      |
| `UPSTASH_REDIS_REST_URL`                           | não                 | Ativa a persistência. Ausente = só memória.                                                                                   |
| `UPSTASH_REDIS_REST_TOKEN`                         | não                 | Par da anterior. As duas juntas, ou nenhuma.                                                                                  |
| `RECONNECT_GRACE_MS`                               | não                 | Janela de graça da reconexão (padrão 30s).                                                                                    |
| `ROOM_TTL_SECONDS`                                 | não                 | Expiração das salas no Redis (padrão 24h), renovada a cada escrita.                                                           |
| `NODE_ENV`                                         | não (`production`)  | Em `production`, silencia os logs de debug por-conexão — que incluem nome e id de jogador. `info`/`warn`/`error` seguem indo. |
| `PORT`                                             | provida pelo Render | —                                                                                                                             |

**Sobre o CORS:** nenhuma dessas variáveis é obrigatória. O front publicado, os deploy-previews do Netlify (por regex) e o `localhost` de desenvolvimento já estão no default de `server/src/index.ts` — as variáveis são **aditivas**, para quando surgir uma origem nova (outro domínio, um preview fora do padrão). Uma origem não prevista é rejeitada com erro de CORS.

O log do boot diz qual modo de persistência está ativo: procure a linha `🗄️ Persistence:` nos logs do Render. Ela aponta ou para o Redis (snapshots write-through) ou para o modo só-memória, neste caso nomeando as variáveis que faltam. O texto exato vive em `server/src/persistence.ts` — não vale copiar para cá, porque diverge no primeiro dia em que alguém editar o log.

## O que a persistência resolve — e o que não

**Resolve:** um redeploy ou o cold start do plano free do Render não perdem mais as salas. O boot reidrata as salas e os tokens de sessão, e quem reconecta encontra a sala onde estava.

**Não resolve:**

- **Presença.** Sockets e timers de graça são estado do processo e morrem com ele. Uma sala reidratada volta com todos os jogadores que tinha, inclusive quem não vai reconectar — o "fantasma". Ele é excluído do quórum, tem o voto descartado no reveal, e a UI o mostra como ausente, mas continua **sentado** à mesa. O TTL do Redis não resolve isso durante a sessão: ele é renovado a cada escrita, então uma sala ativa nunca expira no meio do uso. Na prática o fantasma fica até a sala ser abandonada por inteiro.
- **Múltiplas instâncias.** Ver acima: falta o adapter compartilhado.
- **Cold start.** O plano free do Render hiberna; a primeira conexão depois disso demora (~60s). O cliente cobre isso com um overlay de reconexão em vez de falhar.

## Verificação depois de um deploy

Local, antes de promover:

```bash
npm run validate
```

Em produção:

1. Abrir o site do Netlify e criar uma sala.
2. Entrar na mesma sala em outro navegador (ou aba anônima) pelo link de convite.
3. Confirmar que subject, voto, reveal, próxima rodada e reset sincronizam entre as duas.
4. Confirmar que `/health` do backend responde.
5. Confirmar no DevTools que o WebSocket aponta para a URL do Render, não para `localhost`.
6. Se o Redis estiver ativo: forçar um redeploy do backend e confirmar que a sala sobrevive.

## Rollback

Coberto em [RELEASE.md](./RELEASE.md#rollback) — Netlify e Render têm rollback de um clique nos respectivos painéis.

## Referências

- [Netlify — Vite/build settings](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/)
- [Netlify — SPA rewrites](https://docs.netlify.com/configure-builds/javascript-spas/)
- [Render — WebSockets](https://render.com/docs/websocket)
- [Render — deploy Node/Express](https://render.com/docs/deploy-node-express-app)
- [Upstash Redis — REST API](https://upstash.com/docs/redis/features/restapi)
