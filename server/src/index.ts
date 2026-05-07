import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors, { CorsOptions } from 'cors'
import { RoomManager } from './roomManager'
import { setupSocketEvents } from './events'

const app = express()
const clientOrigins = (process.env.CLIENT_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const allowedOrigins = ['http://localhost:5173', ...clientOrigins]

function isAllowedOrigin(origin: string | undefined) {
  return !origin || allowedOrigins.includes(origin)
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
})
