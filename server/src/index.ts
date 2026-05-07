import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors, { CorsOptions } from 'cors'
import { RoomManager } from './roomManager'
import { setupSocketEvents } from './events'

const app = express()
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://planning-pvoker.netlify.app',
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
    /^https:\/\/[a-z0-9-]+--planning-pvoker\.netlify\.app$/i.test(normalizedOrigin)
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
const io = new Server(server, {
  cors: corsOptions,
})

// Initialize central state manager
const roomManager = new RoomManager()

// Setup all socket handlers
setupSocketEvents(io, roomManager)

// Health check endpoint
app.get('/health', (req, res) => {
  res.send('Planning Poker Backend is running! 🃏')
})

const PORT = process.env.PORT || 3001

server.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`)
  console.log(`Allowed CORS origins: ${Array.from(allowedOrigins).join(', ')}`)
})
