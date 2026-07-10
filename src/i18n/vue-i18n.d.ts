// Type-safe i18n KEYS (editor autocomplete). Teaches vue-i18n the app's message
// schema so `t()`, `$t()` and `i18n.global.t()` suggest the real keys from the
// catalog and support go-to-definition.
//
// Scope, honestly: vue-i18n's `t()` is typed `key: Key extends string`, so it
// still ACCEPTS any string at compile time — required for this app's dynamic keys
// (e.g. `t(\`decks.${x}\`)`, `t(errorKey)`). So this augmentation powers
// autocomplete/IntelliSense but does NOT turn a mistyped literal into a type error.
// Catalog PARITY (en must mirror pt-BR) is separately guaranteed by `en:
// MessageSchema` in ./locales/en.ts — a missing or extra key fails the build there.
//
// pt-BR is the master schema (`MessageSchema = typeof ptBR`). Picked up by
// tsconfig.app.json through the `src/**/*` include.
import type { MessageSchema } from './locales/pt-BR'

declare module 'vue-i18n' {
  // Declaration-merge vue-i18n's schema hook (per its TypeScript guide). The empty
  // body is intentional: the interface exists only to carry the extended schema.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- interface merging: this only extends the master schema, no members of its own
  export interface DefineLocaleMessage extends MessageSchema {}
}
