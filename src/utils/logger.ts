// Logger fino para o cliente. Silencia ruído de debug em produção — o Vite
// expõe `import.meta.env.DEV` (true apenas em desenvolvimento). Erros continuam
// sempre visíveis no console do navegador para facilitar diagnóstico em prod.
export const logger = {
  debug(...args: unknown[]) {
    if (import.meta.env.DEV) console.debug(...args)
  },
  error(...args: unknown[]) {
    console.error(...args)
  },
}
