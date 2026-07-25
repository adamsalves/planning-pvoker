import express from 'express'
import http from 'http'
import { Server, type DefaultEventsMap } from 'socket.io'
import cors, { CorsOptions } from 'cors'
import { RoomManager } from './roomManager'
import { createPersistence } from './persistence'
import { setupSocketEvents } from './events'
import { installCrashGuards } from './crashGuards'
import { logger } from './logger'
import type { SocketData } from './types'

const app = express()
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  // O site Netlify é "planningpvoker" (SEM hífen); o backend Render é
  // "planning-pvoker" (COM hífen). Não unificar um pelo outro.
  'https://planningpvoker.netlify.app',
  'https://planning-pvoker.onrender.com',
]
const originEnvValues = [
  process.env.CLIENT_ORIGIN,
  process.env.CLIENT_ORIGINS,
  process.env.CORS_ORIGIN,
  process.env.RENDER_EXTERNAL_URL,
]

function normalizeOrigin(origin: string) {
  try {
    const url = new URL(origin)
    return url.origin
  } catch {
    return origin.trim().replace(/\/$/, '')
  }
}

const allowedOrigins = new Set(
  [...DEFAULT_ALLOWED_ORIGINS, ...originEnvValues.flatMap((value) => value?.split(',') ?? [])]
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean),
)

function isAllowedOrigin(origin: string | undefined) {
  if (!origin) return true

  const normalizedOrigin = normalizeOrigin(origin)
  return (
    allowedOrigins.has(normalizedOrigin) ||
    /^https:\/\/[a-z0-9-]+--planningpvoker\.netlify\.app$/i.test(normalizedOrigin)
  )
}

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true)
      return
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`))
  },
  methods: ['GET', 'POST'],
}

app.use(cors(corsOptions))

const server = http.createServer(app)
const io = new Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>(server, {
  cors: corsOptions,
})

// Initialize central state manager with persistence: Upstash Redis when the
// env vars are set (write-through snapshots), otherwise an in-memory no-op that
// preserves the original behavior.
const roomManager = new RoomManager(createPersistence())

// Health check endpoint
app.get('/health', (req, res) => {
  res.send('Planning Poker Backend is running! 🃏')
})

const PORT = process.env.PORT || 3001

async function start() {
  // First thing in start() — before hydration, before any socket is accepted — so
  // a throw in a socket handler can't take every room down with it (see crashGuards
  // for why this one keeps serving). Module scope above still crashes outright,
  // which is what a bad config or a corrupt import deserves.
  installCrashGuards(process)

  // Rehydrate persisted rooms/tokens BEFORE accepting connections, so a client
  // reconnecting right after a redeploy finds its room. A failure here must NOT
  // abort the boot — degrade to empty in-memory state and keep serving.
  try {
    await roomManager.hydrate()
  } catch (err) {
    logger.error(`Hydrate failed — starting with empty state: ${String(err)}`)
  }

  // Setup all socket handlers (after hydrate, before we start listening).
  const disposeSocketEvents = setupSocketEvents(io, roomManager)

  // listen() reports failure as an 'error' EVENT, not as a rejection — so this does
  // NOT reach start().catch below, and an unhandled one would be turned into an
  // uncaughtException and swallowed by the crash guard, leaving a live process with
  // no port bound. Failing to bind is unrecoverable by definition: exit, so the
  // platform sees a failed deploy immediately instead of a silent zombie.
  server.on('error', (err) => {
    logger.error('Fatal listen error:', err)
    process.exit(1)
  })

  server.listen(PORT, () => {
    logger.info(`🚀 Server listening on port ${PORT}`)
    logger.info(`Allowed CORS origins: ${Array.from(allowedOrigins).join(', ')}`)
  })

  // Graceful shutdown (e.g. SIGTERM on container redeploy): clear pending grace
  // timers and close connections so the process can exit cleanly.
  const shutdown = (signal: string) => {
    logger.info(`👋 ${signal} received — shutting down`)
    disposeSocketEvents()
    io.close(() => process.exit(0))
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

start().catch((err) => {
  logger.error(`Fatal startup error: ${String(err)}`)
  process.exit(1)
})
