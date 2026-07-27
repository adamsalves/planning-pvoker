# Estratégia de Release

Processo de versionamento, release e deploy do Planning Poker. Para **como a infra
está montada** (Netlify, Render, Upstash e as variáveis de ambiente de cada um),
veja [`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md).

## Princípios

- **Uma versão para o produto inteiro** (frontend + backend deployados juntos), em
  [SemVer](https://semver.org/lang/pt-BR/). A fonte da verdade é a `version` do
  `package.json` da raiz; o `server/package.json` é mantido em sincronia.
- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, …) —
  é o que dá o bump de versão e gera o changelog automaticamente.
- **`main` é produção.** Tudo que entra na `main` é publicado automaticamente.

## Branching (GitFlow leve)

```
feat|fix|chore/*  →  PR  →  develop  →  PR de release  →  main (produção)
```

- Branches de trabalho saem da `develop` (ver convenção do projeto).
- Todo PR para `develop` exige **CI verde** + review.
- `develop` é a branch de integração (staging).
- `main` é produção: só recebe via **PR de release** a partir da `develop`.
- Nunca commitar direto em `develop` ou `main`.
- **Squash-merge** nos PRs de feature → `develop` (1 Conventional Commit por PR). Evita
  changelog duplicado: o release-please parseia tanto o commit da branch quanto o título do PR
  embutido no merge commit — com squash sobra só uma entrada por feature.

> **PRs empilhados** (um PR cuja base é a branch de outro): re-aponte a base para
> `develop` **antes** de apagar a branch intermediária. Apagá-la primeiro **fecha** o
> PR dependente, e aí ele trava — não se reabre um PR cuja base sumiu, nem se troca a
> base de um PR fechado (a saída é recriar o ref com `gh api -X POST .../git/refs`).
> Depois do re-apontamento, o CI só volta a rodar num evento de `synchronize` ou
> `reopened`: re-apontar sozinho não dispara nada. E como a base foi mergeada por
> **squash**, o histórico do PR de cima diverge — traga a `develop` de volta com um
> merge antes de mergear o segundo.

## Versionamento (SemVer)

| Mudança                       | Bump      | Exemplo       |
| ----------------------------- | --------- | ------------- |
| `fix:`                        | **PATCH** | 1.0.0 → 1.0.1 |
| `feat:`                       | **MINOR** | 1.0.0 → 1.1.0 |
| `feat!:` / `BREAKING CHANGE:` | **MAJOR** | 1.0.0 → 2.0.0 |

`chore:`, `docs:`, `test:`, `refactor:` não geram release sozinhos (entram no
changelog da próxima versão).

## Processo de release (develop → main)

1. Garantir a `develop` verde (`npm run validate`) e o smoke manual de produção
   (seção "Verificação depois de um deploy" do `DEPLOYMENT_PLAN.md`).
2. Abrir um **PR de release** `develop → main` (título `release: vX.Y.Z`).
3. CI verde no PR (o workflow roda em PRs para `main`).
4. **Merge** → o auto-deploy publica (ver abaixo).
5. O **release-please** (ver "Automação") abre/atualiza um PR de release que faz o
   bump de versão + atualiza o `CHANGELOG.md`; ao mergear esse PR, ele cria a
   **tag `vX.Y.Z`** e a **GitHub Release** com as notas.
6. **Back-merge `main → develop`** (PR) logo após o release: traz o bump de versão + o
   `CHANGELOG.md` que o release-please escreveu só na `main` de volta pra `develop`, evitando
   drift entre as branches e conflitos no próximo PR de release.

## Automação (release-please)

A partir da v1.0.0, o [release-please](https://github.com/googleapis/release-please)
roda via GitHub Action a cada push na `main` e cuida de:

- calcular a próxima versão a partir dos Conventional Commits;
- manter um PR de release com o `CHANGELOG.md` e o bump de versão
  (`package.json` da raiz + `server/package.json`);
- ao mergear o PR de release, criar a **tag** e a **GitHub Release**.

> **CI no PR de release:** o PR aberto pelo release-please usa o `GITHUB_TOKEN`, que por
> segurança **não dispara** os workflows de CI (eles ficam `action_required` / não rodam). Como
> esse PR só altera versão/changelog e o código já passou no CI no push da `main`, isso **não
> bloqueia** o merge. Se quiser CI também nesses PRs, configure um **PAT** dedicado no release-please.

> **Bootstrap:** a **v1.0.0** é criada manualmente (esta entrada de changelog +
> tag), porque é o primeiro release. O release-please é ativado logo depois e passa
> a cuidar de **1.0.1 em diante** automaticamente.

## Changelog

`CHANGELOG.md` no formato [Keep a Changelog](https://keepachangelog.com/pt-BR/),
agrupado por versão. A partir da v1.0.0 é gerado pelo release-please a partir dos
commits — por isso a disciplina de Conventional Commits importa.

## Deploy (produção)

| Camada                        | Plataforma | Branch | Gatilho             |
| ----------------------------- | ---------- | ------ | ------------------- |
| Frontend (Vue/Vite)           | Netlify    | `main` | auto-deploy no push |
| Backend (Express + Socket.IO) | Render     | `main` | auto-deploy no push |

Variáveis de ambiente (definidas nos painéis, **não** no repo):

- **Netlify:** `VITE_WS_URL` = URL do backend no Render (ex.: `https://planning-pvoker.onrender.com`).
  É a única obrigatória do lado do front.
- **Render:** nenhuma é obrigatória — o servidor sobe sem nenhuma delas. `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN` **ligam a persistência** (em uso desde a v1.3.0; sem elas o servidor
  roda só em memória); as origens de CORS (`CLIENT_ORIGIN`/`CLIENT_ORIGINS`/`CORS_ORIGIN`) são
  aditivas às que já vêm no default; `RECONNECT_GRACE_MS`, `ROOM_TTL_SECONDS` e `NODE_ENV` ajustam
  comportamento. O `PORT` e o `RENDER_EXTERNAL_URL` são providos pelo Render.
  Tabela completa no `DEPLOYMENT_PLAN.md`.

## Rollback

- **Frontend:** Netlify → _Deploys_ → "Publish deploy" no deploy anterior (instantâneo).
- **Backend:** Render → _Events/Deploys_ → "Rollback" / redeploy da versão anterior.
- **Código:** reverter o merge de release na `main` (`git revert -m 1 <merge>`),
  abrir PR e republicar.

## Hotfix (urgência em produção)

```
hotfix/*  (a partir de main)  →  PR → main  →  back-merge na develop
```

Gera um **PATCH** (ex.: 1.2.3 → 1.2.4). Sempre trazer o fix de volta para a
`develop` para não regredir no próximo release.

## Checklist pré-release

- [ ] `npm run validate` verde (oxlint · eslint · knip · type-check · unit do cliente ·
      build/type-check/testes do servidor · e2e).
- [ ] Smoke manual de produção (criar sala, votar, revelar, sincronizar em 2 abas;
      `/health` do backend respondendo).
- [ ] CI verde no PR de release.
- [ ] Changelog/tag gerados (release-please) após o merge.
