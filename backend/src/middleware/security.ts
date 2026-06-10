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

// Fora de produção, libera qualquer origem de LAN privada (localhost/10.x/172.16-31.x/
// 192.168.x) — assim celular e outras máquinas na wifi acessam o dev sem precisar
// reconfigurar CORS_ORIGINS a cada troca de IP. Produção segue só na allowlist.
const PRIVATE_LAN_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|10(\.\d{1,3}){3}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|192\.168(\.\d{1,3}){2})(:\d+)?$/i
const allowLanOrigins = process.env.NODE_ENV !== 'production'

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || (allowLanOrigins && PRIVATE_LAN_ORIGIN.test(origin))) {
      callback(null, true)
    } else {
      callback(new Error('CORS: origem não permitida'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})

// Limite estrito SÓ no login, e contando apenas tentativas que falham
// (skipSuccessfulRequests). Logins bem-sucedidos e o /auth/refresh automático
// não consomem o balde — evita falso positivo de "Muitas tentativas" em uso
// legítimo, sem enfraquecer a proteção contra força bruta.
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
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
