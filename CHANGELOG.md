# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui. O formato segue
[Keep a Changelog](https://keepachangelog.com/pt-BR/) e o projeto adota
[SemVer](https://semver.org/lang/pt-BR/). A partir da v1.0.0, as entradas abaixo
desta são geradas automaticamente pelo [release-please](./RELEASE.md).

## [1.4.0](https://github.com/adamsalves/planning-pvoker/compare/v1.3.0...v1.4.0) (2026-07-25)


### Features

* **server:** admin escolhe quem vota na rodada (fatia 1/2) ([#56](https://github.com/adamsalves/planning-pvoker/issues/56)) ([af15842](https://github.com/adamsalves/planning-pvoker/commit/af15842c38387b630c4564f494e0ba1a8334975c))
* **server:** tag de área do jogador (fatia 1/2) ([#58](https://github.com/adamsalves/planning-pvoker/issues/58)) ([93080fb](https://github.com/adamsalves/planning-pvoker/commit/93080fbb5d0cffce9de60adb4a936848b33eb45b))
* **ui:** admin escolhe quem vota na rodada (fatia 2/2) ([#57](https://github.com/adamsalves/planning-pvoker/issues/57)) ([addda3c](https://github.com/adamsalves/planning-pvoker/commit/addda3c279e952ada13977446c19beefbcfb5331))
* **ui:** ícones theme-aware na home + forms (fatia 2/3) ([#53](https://github.com/adamsalves/planning-pvoker/issues/53)) ([bc652e3](https://github.com/adamsalves/planning-pvoker/commit/bc652e31dddcdae72574113e541df00ebb82a691))
* **ui:** ícones theme-aware na votação + resumos (fatia 3b/2) ([#55](https://github.com/adamsalves/planning-pvoker/issues/55)) ([f20878e](https://github.com/adamsalves/planning-pvoker/commit/f20878e6d285216af65a0515a57da97d31549c91))
* **ui:** ícones theme-aware no shell — navbar + 404 (fatia 1/3) ([#52](https://github.com/adamsalves/planning-pvoker/issues/52)) ([221606e](https://github.com/adamsalves/planning-pvoker/commit/221606eca0436cbd46744318e803a0a8ee1c1496))
* **ui:** ícones theme-aware no shell da sala + setup (fatia 3a/2) ([#54](https://github.com/adamsalves/planning-pvoker/issues/54)) ([090eb0b](https://github.com/adamsalves/planning-pvoker/commit/090eb0b2ea7dc09410f5c9139bbd90b9d7666e48))
* **ui:** tag de área do jogador (fatia 2/2) ([#59](https://github.com/adamsalves/planning-pvoker/issues/59)) ([cbd7e3b](https://github.com/adamsalves/planning-pvoker/commit/cbd7e3be43520d0d3e63c59ddc1296e8e876526c))
* **ui:** unifica "Voltar à Sala" num banner único do layout ([#60](https://github.com/adamsalves/planning-pvoker/issues/60)) ([962f3e9](https://github.com/adamsalves/planning-pvoker/commit/962f3e906d7ba0d973ac8fd3aa7a01706bfae9dc))


### Bug Fixes

* **deps:** corrige 2 vulns HIGH de tooling (brace-expansion, js-yaml) ([#63](https://github.com/adamsalves/planning-pvoker/issues/63)) ([82254d2](https://github.com/adamsalves/planning-pvoker/commit/82254d293b4c5e55900143a92059726473ad4df6))
* **server:** make autoReveal quorum presence-aware ([#51](https://github.com/adamsalves/planning-pvoker/issues/51)) ([fd6f72c](https://github.com/adamsalves/planning-pvoker/commit/fd6f72c9b1be1133064285bcfe6827f22d52826e))
* **ui:** rodada de 1 votante não dispara falso consenso ([#65](https://github.com/adamsalves/planning-pvoker/issues/65)) ([6afebf5](https://github.com/adamsalves/planning-pvoker/commit/6afebf50ce039125ddd7ed91c949cfeed3ffd38a))

## [1.3.0](https://github.com/adamsalves/planning-pvoker/compare/v1.2.0...v1.3.0) (2026-07-11)


### Features

* **server:** persistência write-through com Upstash Redis (6.6) ([#46](https://github.com/adamsalves/planning-pvoker/issues/46)) ([f631490](https://github.com/adamsalves/planning-pvoker/commit/f631490666c4a47c45be6928960cf6065ff7511c))

## [1.2.0](https://github.com/adamsalves/planning-pvoker/compare/v1.1.0...v1.2.0) (2026-07-10)


### Features

* **a11y:** acessibilidade P1 — foco, ARIA, reduced-motion (F2) ([#27](https://github.com/adamsalves/planning-pvoker/issues/27)) ([d42a390](https://github.com/adamsalves/planning-pvoker/commit/d42a3904341dffd8e1b2f49159acf6cd8a84defb))
* **i18n:** vue-i18n pt-BR/EN — infra + toggle na navbar + tradução completa do frontend (F8) ([#35](https://github.com/adamsalves/planning-pvoker/issues/35)) ([915aa9c](https://github.com/adamsalves/planning-pvoker/commit/915aa9c6925f284c6e33ab4cb0252ab5feb9b6d8))
* **nav:** corrige navegação da sala + rota 404 (F5 + F4.3) ([#39](https://github.com/adamsalves/planning-pvoker/issues/39)) ([b09d848](https://github.com/adamsalves/planning-pvoker/commit/b09d84879c20d1a8c6ef1beba44939041ab7ab37))
* **room:** aba "Resumo da Sala" ao vivo na fase de votação (F6.1) ([#38](https://github.com/adamsalves/planning-pvoker/issues/38)) ([827743c](https://github.com/adamsalves/planning-pvoker/commit/827743c3312d552e0477a639119330652d167ec9))
* **room:** confirmação ao sair da sala + limpa sessão no leave (F3.4/F3.10) ([#33](https://github.com/adamsalves/planning-pvoker/issues/33)) ([881ab2d](https://github.com/adamsalves/planning-pvoker/commit/881ab2d66eb0275819e5466404217a8b9a1b4d1e))
* **room:** evento leave_room — saída explícita sem o grace de 30s ([#34](https://github.com/adamsalves/planning-pvoker/issues/34)) ([e6535af](https://github.com/adamsalves/planning-pvoker/commit/e6535af2dbb51977e26cdea931751a0c37f96634))
* **room:** mesa responsiva no mobile + guardas de revelar/iniciar (F4) ([#40](https://github.com/adamsalves/planning-pvoker/issues/40)) ([b9775bc](https://github.com/adamsalves/planning-pvoker/commit/b9775bc5ece44b87c14d05e0cb49c6be0e08e971))


### Bug Fixes

* bugs de UX do frontend — confetti, feedback, gráfico e voto (F1) ([#26](https://github.com/adamsalves/planning-pvoker/issues/26)) ([b83b595](https://github.com/adamsalves/planning-pvoker/commit/b83b595551224ded235b65dd1e60b3f1ef125ac1))
* **server:** identidade em socket.data + guarda contra leave stale de aba irmã ([#37](https://github.com/adamsalves/planning-pvoker/issues/37)) ([2072326](https://github.com/adamsalves/planning-pvoker/commit/2072326251c3e00145c3a8f401050940077260e4))

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
