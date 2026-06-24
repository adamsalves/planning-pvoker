# AGENTS.md

This file defines how Ralph operates in this project.

## Validation Commands

Run these after each task to ensure quality:

```bash
npm run type-check
npm run lint
npm run test:unit
```

For changes under `server/` (separate package, no test suite yet):

```bash
npm --prefix server run build
```

## Build Instructions

1. Run `npm install` to install dependencies
2. Run `npm run build` to build (if applicable)
3. Run `npm run test:unit` to verify

## Code Patterns

- Follow existing code style
- Add tests for new functionality
- Keep functions small and focused
- Use meaningful names

## Task Completion

A task is complete when:
1. All validation commands pass
2. Code is committed (if auto-commit enabled)
3. No TODO comments left unaddressed
