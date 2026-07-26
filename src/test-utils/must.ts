// Narrowing por fluxo de controle para uso em teste, no lugar de `!` ou `as`.
//
// O tsconfig do projeto liga `noUncheckedIndexedAccess`, então `findAll(...)[0]`
// é `T | undefined` — correto, e valioso no código de produção. Em teste, porém,
// indexar um resultado que o próprio teste acabou de afirmar existir é rotina, e
// o não-nulo (`!`) é o atalho proibido pela regra de não usar asserções.
//
// Isto resolve os dois lados: o TS estreita de verdade (o throw é uma saída real,
// não uma promessa ao compilador) e a falha vira uma mensagem que diz o que
// faltou, em vez de "Cannot read properties of undefined (reading 'classes')"
// dez linhas adiante. Mesmo espírito dos helpers locais do useSocket.spec.ts.
//
// `what` é OBRIGATÓRIO de propósito: com um default genérico a falha volta a ser
// "Expected value to be defined", que não diz qual índice de qual findAll faltou —
// e o default vence por ser o caminho de menor esforço. Nomeie o que se esperava
// ("summary tab", "deck option 1 (tshirt)").
export function must<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) {
    throw new Error(`Expected ${what} to be defined, got ${String(value)}`)
  }
  return value
}
