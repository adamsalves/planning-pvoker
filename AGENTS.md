# AGENTS.md

Instruções para agentes automatizados trabalhando neste repositório. Humanos: o [README](./README.md) é a porta de entrada.

O projeto são **duas aplicações** num repositório só — o cliente Vue na raiz e o servidor Node em `server/`, cada um com seu `package.json` e seu `node_modules`. Não é npm workspaces (decisão deliberada: o deploy do Render builda `server/` isolado). Comandos do servidor sempre com `npm --prefix server`.

## Verificação

O comando único que cobre tudo, na mesma ordem do hook de pre-push:

```bash
npm run validate
```

Ele roda, em sequência: `oxlint` · `eslint` · `knip` · `type-check` · testes do cliente · build, type-check e testes do **servidor** · e2e do Playwright. Qualquer falha aborta o resto.

Durante o trabalho, os passos separados são mais rápidos de interpretar:

```bash
npm run type-check              # cliente — cobre src/ E os *.spec.ts
npm run lint                    # oxlint + eslint com --fix
npm run test:unit               # cliente, em watch
npm run knip                    # código morto / exports não usados

npm --prefix server run type-check   # servidor — cobre src/ E test/
npm --prefix server test             # servidor
npm --prefix server run build        # servidor, emite para dist/
```

**Confira sempre o exit code, não o texto da saída.** Um resumo de ferramenta já escondeu uma suíte quebrada neste projeto. Um comando por verificação:

```bash
npm run type-check; echo "EXIT=$?"
```

O e2e exige os browsers do Playwright (`npx playwright install chromium`) — sem eles o `git push` falha no pre-push.

## Regras que não se negociam

- **Sem type assertions.** `as` (exceto `as const`) e non-null `!` são proibidos e barrados pelo ESLint (`consistent-type-assertions: never`, `no-non-null-assertion`). Quando um cast parecer necessário, o tipo de origem quase sempre está modelado errado. Alternativas em uso: type guards (`typeof`, `in`, funções `is`), validação zod nas bordas, narrowing por fluxo de controle, e o helper `must(value, 'rótulo')` de `src/test-utils/` para indexação em teste.
- **Helpers de teste não entram em produção.** `src/test-utils/*` só pode ser importado de specs, `e2e/` ou do `vitest.setup.ts` — o ESLint barra o resto.
- **Nunca commitar direto em `develop` ou `main`.** Toda mudança sai numa branch a partir da `develop`.
- **Conventional Commits** — é o que gera versão e changelog. Ver [RELEASE.md](./RELEASE.md).
- **`CHANGELOG.md` é gerado** pelo release-please. Não edite à mão.

## Contratos que o compilador não protege

- **Os tipos de rede são declarados duas vezes** — `server/src/types.ts` e `src/types/index.ts` — sem enforcement entre os arquivos. Ao mexer num, confira o outro. Os vocabulários (const arrays: papéis, decks, fases, status, tags) têm guarda de runtime em `src/types/__tests__/`; **campos de interface não têm**, e já derivaram silenciosamente antes.
- **Os specs de deriva importam `server/src` a partir do runner do cliente.** Por isso `server/src/types.ts` não tem nenhum import, e `validation.ts` só depende do que existe na raiz (zod). Adicionar uma dependência só-servidor a esses arquivos quebra a suíte do cliente.
- **O servidor guarda os objetos `Player` que recebe por referência.** Uma fixture compartilhada entre testes vaza mutação.

## Testes

Suíte verde não é suíte discriminante. Ao adicionar cobertura, **verifique por mutação**: quebre de propósito o comportamento que o teste alega cobrir e confirme que ele falha — e que os outros não. Uma fixture de um elemento só esconde a diferença entre `.some()`, `.every()`, `[0]` e o último.

Testes acompanham a mudança no mesmo commit. Comentários explicam o **porquê**, não o quê.

Sobre o idioma dos comentários: o repositório é misto e não vale uniformizar agora.

| Onde                                                                                          | Idioma predominante |
| --------------------------------------------------------------------------------------------- | ------------------- |
| Cliente (`src/`)                                                                              | português           |
| `server/src/validation.ts`, `logger.ts`                                                       | português           |
| `server/src/roomManager.ts`, `persistence.ts`, `events.ts`, `crashGuards.ts`, `errorCodes.ts` | inglês              |
| `server/src/types.ts`                                                                         | misto               |

**Siga o idioma do trecho que você está editando** — um comentário em pt-BR no meio de trezentas linhas em inglês salta aos olhos no diff. Prosa de documentação (`.md`) é sempre em português.
