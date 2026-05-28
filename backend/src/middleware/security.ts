import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'

export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
})

const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:8080').split(',')

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('CORS: origem não permitida'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Muitas tentativas. Aguarde 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
})

export const globalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { message: 'Limite de requisições atingido.' },
  standardHeaders: true,
  legacyHeaders: false,
})

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({ message: 'Dados inválidos', errors: err.flatten().fieldErrors })
    return
  }

  const status = err.status ?? 500
  const message = status < 500 ? err.message : 'Erro interno do servidor'
  res.status(status).json({ message })
}
