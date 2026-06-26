/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL do servidor Socket.IO (backend). Default de dev: http://localhost:3001 */
  readonly VITE_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
