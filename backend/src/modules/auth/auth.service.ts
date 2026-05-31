import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import prisma from '../../lib/prisma'
import redis from '../../lib/redis'

const ACCESS_SECRET = process.env.JWT_SECRET!
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? ACCESS_SECRET + '_refresh'
const ACCESS_EXPIRES = '1h'
const REFRESH_EXPIRES_SEC = 7 * 24 * 60 * 60 // 7 dias
const MAX_TENTATIVAS = 5
const BLOQUEIO_MINUTOS = 15

export type TokenPayload = {
  sub: number
  email: string
  role: string
}

function signAccess(payload: TokenPayload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES })
}

function signRefresh(payload: TokenPayload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: `${REFRESH_EXPIRES_SEC}s` })
}

export async function login(email: string, senha: string) {
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || !user.ativo) {
    throw Object.assign(new Error('Credenciais inválidas'), { status: 401 })
  }

  // Verifica bloqueio por tentativas
  if (user.bloqueado_ate && user.bloqueado_ate > new Date()) {
    const restante = Math.ceil((user.bloqueado_ate.getTime() - Date.now()) / 60000)
    throw Object.assign(
      new Error(`Conta bloqueada. Tente novamente em ${restante} minuto(s).`),
      { status: 429 }
    )
  }

  const senhaValida = await bcrypt.compare(senha, user.senha_hash)

  if (!senhaValida) {
    const novasTentativas = user.tentativas_login + 1
    const bloqueio =
      novasTentativas >= MAX_TENTATIVAS
        ? new Date(Date.now() + BLOQUEIO_MINUTOS * 60 * 1000)
        : null

    await prisma.user.update({
      where: { id: user.id },
      data: { tentativas_login: novasTentativas, bloqueado_ate: bloqueio },
    })

    throw Object.assign(new Error('Credenciais inválidas'), { status: 401 })
  }

  // Login bem-sucedido — reseta tentativas
  await prisma.user.update({
    where: { id: user.id },
    data: { tentativas_login: 0, bloqueado_ate: null, ultimo_login: new Date() },
  })

  const payload: TokenPayload = { sub: user.id, email: user.email, role: user.role }
  const accessToken = signAccess(payload)
  const refreshToken = signRefresh(payload)
  const refreshJti = randomUUID()

  // Armazena refresh token no Redis com TTL
  await redis.setEx(`refresh:${user.id}:${refreshJti}`, REFRESH_EXPIRES_SEC, refreshToken)

  return {
    accessToken,
    refreshToken,
    refreshJti,
    user: { id: user.id, nome: user.nome, email: user.email, role: user.role },
  }
}

export async function refresh(refreshToken: string) {
  let payload: TokenPayload & { jti?: string }

  try {
    payload = jwt.verify(refreshToken, REFRESH_SECRET) as unknown as TokenPayload & { jti?: string }
  } catch {
    throw Object.assign(new Error('Refresh token inválido'), { status: 401 })
  }

  const stored = await redis.get(`refresh:${payload.sub}:${payload.jti}`)
  if (!stored || stored !== refreshToken) {
    throw Object.assign(new Error('Refresh token revogado'), { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } })
  if (!user || !user.ativo) {
    throw Object.assign(new Error('Usuário inativo'), { status: 401 })
  }

  const newPayload: TokenPayload = { sub: user.id, email: user.email, role: user.role }
  return { accessToken: signAccess(newPayload) }
}

export async function logout(userId: number, jti: string) {
  await redis.del(`refresh:${userId}:${jti}`)
}

/**
 * Revoga TODAS as sessões ativas (refresh tokens) de um usuário.
 * Usado quando: usuário troca senha, admin reseta senha de outro.
 */
export async function revogarTodosRefreshTokens(userId: number) {
  const pattern = `refresh:${userId}:*`
  const iter = (redis as any).scanIterator({ MATCH: pattern, COUNT: 100 })
  const keys: string[] = []
  for await (const k of iter) {
    keys.push(k)
  }
  if (keys.length > 0) {
    await redis.del(keys)
  }
}

export async function hashSenha(senha: string) {
  return bcrypt.hash(senha, 12)
}

export function verifyAccess(token: string): TokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as unknown as TokenPayload
}
