import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { RoomManager } from './roomManager'
import { setupSocketEvents } from './events'

const app = express()
app.use(cors())

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: '*', // For dev we allow any origin (Vue frontend)
    methods: ['GET', 'POST'],
  },
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
