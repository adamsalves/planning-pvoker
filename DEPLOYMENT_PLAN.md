# Plano de Publicacao no Netlify com Backend Socket.IO

## Resumo

Publicar o frontend Vue/Vite no Netlify e manter o backend Socket.IO como um Web Service Node separado no Render.

Essa e a menor mudanca viavel porque o app depende de conexoes em tempo real e o backend atual mantem salas em memoria. Netlify Functions sao serverless por requisicao e nao substituem diretamente um servidor Socket.IO long-lived.

## Arquitetura

- Frontend: Vue/Vite publicado no Netlify.
- Backend: Express + Socket.IO publicado no Render como Web Service Node.
- Comunicacao em tempo real: o frontend usa `VITE_WS_URL` para conectar no backend Render.
- Estado v1: `RoomManager` em memoria, sem banco de dados.

## Mudancas Necessarias

### Frontend no Netlify

- Adicionar `netlify.toml` na raiz.
- Configurar build command: `npm run build`.
- Configurar publish directory: `dist`.
- Adicionar rewrite SPA: `/*` -> `/index.html` com status `200`.
- Definir no Netlify a variavel de ambiente:

```bash
VITE_WS_URL=https://<backend-render>.onrender.com
```

### Backend no Render

- Publicar `server/` como Web Service Node.
- Configurar Root Directory: `server`.
- Configurar Build Command: `npm install && npm run build`.
- Configurar Start Command: `npm start`.
- Configurar Health Check Path: `/health`.
- Usar `process.env.PORT`, ja existente em `server/src/index.ts`.

### Backend e Socket.IO

- Manter `RoomManager` em memoria para a v1, sem banco.
- Ajustar CORS antes da publicacao para aceitar somente:
  - `http://localhost:5173` em desenvolvimento.
  - URL oficial do Netlify em producao.
- Definir no backend Render a variavel de ambiente:

```bash
CLIENT_ORIGIN=https://<site-netlify>.netlify.app
```

- Remover o CORS aberto atual (`origin: '*'`) antes do deploy de producao.

## Variaveis de Ambiente

### Netlify

```bash
VITE_WS_URL=https://<backend-render>.onrender.com
```

### Render

```bash
CLIENT_ORIGIN=https://<site-netlify>.netlify.app
```

O Render tambem fornece `PORT`; o backend ja deve continuar usando `process.env.PORT`.

## Passos de Deploy

### 1. Preparar o Frontend

1. Criar `netlify.toml` na raiz com build, publish e rewrite SPA.
2. Garantir que o cliente Socket.IO use `import.meta.env.VITE_WS_URL` em producao.
3. Configurar `VITE_WS_URL` no painel do Netlify.
4. Rodar validacoes locais.
5. Publicar o site no Netlify.

### 2. Preparar o Backend

1. Ajustar CORS para `CLIENT_ORIGIN` e `http://localhost:5173`.
2. Criar o Web Service no Render apontando para `server/`.
3. Configurar build e start commands.
4. Configurar `CLIENT_ORIGIN` no painel do Render.
5. Confirmar que `/health` responde com sucesso.

### 3. Validar Integracao

1. Abrir o site Netlify.
2. Criar uma sala.
3. Entrar na mesma sala em outro navegador ou aba usando o link compartilhado.
4. Confirmar que subjects, votos, reveal, next round e reset sincronizam em tempo real.
5. Confirmar que o frontend usa `VITE_WS_URL` de producao, nao `localhost`.
6. Confirmar que o backend aceita a origem Netlify e rejeita origens nao previstas.

## Plano de Testes

### Local

```bash
npm run build
npm run lint
npm run test:unit -- --run
npm --prefix server run build
```

### Producao

- Abrir o site Netlify.
- Criar uma sala.
- Entrar na mesma sala em outro navegador ou aba usando o link compartilhado.
- Confirmar que subjects, votos, reveal, next round e reset sincronizam em tempo real.
- Confirmar que `/health` do backend retorna sucesso.
- Confirmar que o frontend usa `VITE_WS_URL` de producao, nao `localhost`.

## Limitacoes da v1

- As salas ficam em memoria.
- As salas desaparecem se o backend reiniciar, escalar horizontalmente ou fizer redeploy.
- Sem banco de dados, nao ha recuperacao de estado depois de queda do processo.
- Se houver necessidade de multiplas instancias do backend no futuro, sera preciso adicionar persistencia e/ou adapter compartilhado para Socket.IO.

## Fora do Escopo Nesta Etapa

- Migrar Socket.IO para Netlify Functions.
- Trocar Socket.IO por Ably, Pusher ou Supabase Realtime.
- Adicionar banco de dados.
- Implementar persistencia de salas.

## Referencias

- Netlify Vite/build settings: https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/
- Netlify SPA rewrites: https://docs.netlify.com/configure-builds/javascript-spas/
- Netlify Functions limits/model: https://docs.netlify.com/build/functions/overview/
- Render WebSockets: https://render.com/docs/websocket
- Render Node/Express deploy: https://render.com/docs/deploy-node-express-app
