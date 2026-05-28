import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import pino from 'pino'
import { connectRedis } from './lib/redis'
import authRoutes from './modules/auth/auth.routes'
import {
  helmetMiddleware,
  corsMiddleware,
  globalRateLimit,
  authRateLimit,
  errorHandler,
} from './middleware/security'

const app = express()
const logger = pino()
const PORT = process.env.PORT ?? 3000

app.set('trust proxy', 1)

app.use(helmetMiddleware)
app.use(corsMiddleware)
app.use(globalRateLimit)
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

app.use('/auth', authRateLimit, authRoutes)

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.use(errorHandler)

async function start() {
  await connectRedis()
  app.listen(PORT, () => logger.info(`Server running on port ${PORT}`))
}

start().catch((err) => {
  logger.error(err, 'Falha ao iniciar o servidor')
  process.exit(1)
})
