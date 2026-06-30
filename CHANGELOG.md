# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui. O formato segue
[Keep a Changelog](https://keepachangelog.com/pt-BR/) e o projeto adota
[SemVer](https://semver.org/lang/pt-BR/). A partir da v1.0.0, as entradas abaixo
desta são geradas automaticamente pelo [release-please](./RELEASE.md).

## [1.1.0](https://github.com/adamsalves/planning-pvoker/compare/v1.0.0...v1.1.0) (2026-06-30)


### Features

* **ui:** enxugar footer e usar a carta como favicon ([672a434](https://github.com/adamsalves/planning-pvoker/commit/672a434b8ee8cf67c845e201a84ae3492b65512a))
* **ui:** footer enxuto + favicon da carta (F7) ([2c49b6c](https://github.com/adamsalves/planning-pvoker/commit/2c49b6c9eacf552254534a77560d18ecb08639af))
* **ui:** linkar autoria do footer ao GitHub ([e7e6fad](https://github.com/adamsalves/planning-pvoker/commit/e7e6fadf51293aa1291abca42f8c2cd2c54de476))
* **ui:** toggle de tema dark/light + navbar responsivo ([26667a9](https://github.com/adamsalves/planning-pvoker/commit/26667a917b5bf93e964fc3f745db7268911f2b8c))
* **ui:** toggle de tema dark/light + navbar responsivo (F9 + F4.5) ([c1ede6b](https://github.com/adamsalves/planning-pvoker/commit/c1ede6b91b13b8f933210cb34f070e56ff8bb1f9))


### Bug Fixes

* **server:** point CORS allowlist at the real Netlify origin ([46ec502](https://github.com/adamsalves/planning-pvoker/commit/46ec502a1001a5ebe7d2aedf905b3eadade1450e))

## [1.0.0] - 2026-06-26

Primeiro release de produção. Consolida o app de Planning Poker em tempo real e
toda a rodada de segurança, deploy, CI, correções de fluxo e testes (auditoria de
2026-06-23, Fases 1–6).

### Added

- App de Planning Poker em tempo real (salas, votação, reveal, rounds) via Socket.IO.
- Baralhos Fibonacci, T-Shirt e Sequencial; papéis admin/membro/espectador; opção de
  auto-reveal; histórico de sessões com gráficos (localStorage); rotas lazy e a11y.
- **Overlay de loading temático** para mascarar o cold start / reconexão do backend,
  com re-join automático na sala após reconectar.
- Token de sessão por jogador, impedindo escalada de admin no rejoin.
- Suíte de testes do servidor (Vitest) e pipeline de CI (GitHub Actions).
- Husky: `lint-staged` no pre-commit e `validate` completo no pre-push.

### Changed

- Auto-reveal passou a ser responsabilidade única do servidor (sem lógica duplicada
  no cliente).
- Logger condicional a `import.meta.env.DEV` (silencia ruído de debug em produção).
- Frontend conecta ao backend via `VITE_WS_URL` (config de produção); `.env` deixou
  de ser versionado.

### Fixed

- Grace period de reconexão e transferência de admin quando o admin sai da sala.
- Guard de "sala só de espectadores" (não revela sem votos) e rejoin movido para
  `onMounted`.
- Re-join na reconexão transparente, evitando que o jogador vire "fantasma" após a
  janela de graça do servidor.
- Vulnerabilidades do `npm audit` do cliente (22 → 0).

### Security

- Autorização de admin em todos os eventos administrativos; correção de _vote
  spoofing_ (identidade vem do socket, não do payload); validação Zod nas bordas do
  backend.
- Token de sessão anti-escalada: um membro não consegue mais reivindicar o `adminId`
  no rejoin.

[1.0.0]: https://github.com/adamsalves/planning-pvoker/releases/tag/v1.0.0
