import { createClient } from 'redis'
import pino from 'pino'

const logger = pino()

const redis = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' })

redis.on('error', (err) => logger.error({ err }, 'Redis error'))

export async function connectRedis() {
  await redis.connect()
  logger.info('Redis connected')
}

export default redis
