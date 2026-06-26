# Estratégia de Release

Processo de versionamento, release e deploy do Planning Poker. Para o **setup de
infra** (como Netlify e Render foram configurados na 1ª vez), veja
[`DEPLOYMENT_PLAN.md`](./DEPLOYMENT_PLAN.md).

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
   (passos de integração do `DEPLOYMENT_PLAN.md`).
2. Abrir um **PR de release** `develop → main` (título `release: vX.Y.Z`).
3. CI verde no PR (o workflow roda em PRs para `main`).
4. **Merge** → o auto-deploy publica (ver abaixo).
5. O **release-please** (ver "Automação") abre/atualiza um PR de release que faz o
   bump de versão + atualiza o `CHANGELOG.md`; ao mergear esse PR, ele cria a
   **tag `vX.Y.Z`** e a **GitHub Release** com as notas.

## Automação (release-please)

A partir da v1.0.0, o [release-please](https://github.com/googleapis/release-please)
roda via GitHub Action a cada push na `main` e cuida de:

- calcular a próxima versão a partir dos Conventional Commits;
- manter um PR de release com o `CHANGELOG.md` e o bump de versão
  (`package.json` da raiz + `server/package.json`);
- ao mergear o PR de release, criar a **tag** e a **GitHub Release**.

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
- **Render:** origens de CORS (`CLIENT_ORIGIN`/`CORS_ORIGIN`), `RECONNECT_GRACE_MS`
  (opcional) e — quando a persistência (Redis) entrar — `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN`. O `PORT` é provido pelo Render.

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

- [ ] `npm run validate` verde (lint + type-check + testes cliente/servidor + build).
- [ ] Smoke manual de produção (criar sala, votar, revelar, sincronizar em 2 abas;
      `/health` do backend respondendo).
- [ ] CI verde no PR de release.
- [ ] Changelog/tag gerados (release-please) após o merge.
