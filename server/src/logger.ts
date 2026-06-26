// Logger fino para o servidor. Em produção (`NODE_ENV=production`) silencia os
// logs de debug por-conexão (ruído nos logs + evita registrar nomes/ids de
// jogadores). `info` (startup/shutdown), `warn` (auditoria de segurança) e
// `error` seguem sempre. Lê NODE_ENV por chamada para ser testável.
function isProd(): boolean {
  return process.env.NODE_ENV === 'production'
}

export const logger = {
  debug(...args: unknown[]) {
    if (!isProd()) console.log(...args)
  },
  info(...args: unknown[]) {
    console.log(...args)
  },
  warn(...args: unknown[]) {
    console.warn(...args)
  },
  error(...args: unknown[]) {
    console.error(...args)
  },
}
