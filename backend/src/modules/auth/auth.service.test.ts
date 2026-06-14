import { describe, it, expect, vi, beforeEach } from 'vitest'

// Os `import` ESM são içados acima de atribuições normais, então auth.service
// (que captura os segredos no carregamento do módulo) leria env undefined.
// vi.hoisted roda ANTES dos imports, garantindo que os segredos existam.
vi.hoisted(() => {
  process.env.JWT_SECRET = 'test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  process.env.JWT_REFRESH_SECRET = 'test-refresh-bbbbbbbbbbbbbbbbbbbbbbbbbbbb'
})

vi.mock('../../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('../../lib/redis', () => ({
  default: {
    setEx: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    set: vi.fn(),
    scanIterator: vi.fn(() => (async function* () { /* empty */ })()),
  },
  connectRedis: vi.fn(),
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async (s: string) => `bcrypt:${s}`),
    compare: vi.fn(async (raw: string, hash: string) => hash === `bcrypt:${raw}`),
  },
}))

import jwt from 'jsonwebtoken'
import prisma from '../../lib/prisma'
import redis from '../../lib/redis'
import * as authService from './auth.service'
import * as svc from './auth.service'

const mockPrisma = prisma as any
const mp = prisma as any
const mr = redis as any
beforeEach(() => vi.clearAllMocks())

describe('auth.service.alterarSenha', () => {
  it('atualiza senha quando senha atual confere', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, senha_hash: 'bcrypt:antiga' })
    mockPrisma.user.update.mockResolvedValue({ id: 1 })

    await authService.alterarSenha(1, 'antiga', 'novasenha123')

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { senha_hash: 'bcrypt:novasenha123' },
    })
  })

  it('falha 401 quando senha atual está errada', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, senha_hash: 'bcrypt:antiga' })
    await expect(
      authService.alterarSenha(1, 'errada', 'novasenha123')
    ).rejects.toMatchObject({ status: 401, message: expect.stringContaining('atual') })
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('falha 404 quando usuário não existe', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    await expect(
      authService.alterarSenha(99, 'qualquer', 'novasenha123')
    ).rejects.toMatchObject({ status: 404 })
  })
})

describe('refresh (rotação + reuse)', () => {
  it('rotaciona: valida jti no redis, apaga a chave antiga e grava a nova', async () => {
    const userId = 7
    // gera um refresh token válido manualmente (com o MESMO segredo que o serviço usa)
    const jti = 'jti-1'
    const token = jwt.sign({ sub: userId, email: 'a@a.com', role: 'ADMIN' }, process.env.JWT_REFRESH_SECRET!, { algorithm: 'HS256', jwtid: jti, expiresIn: '7d' })
    mr.get.mockResolvedValue(token) // redis tem a chave válida
    mp.user.findUnique.mockResolvedValue({ id: userId, email: 'a@a.com', role: 'ADMIN', ativo: true })
    const out = await svc.refresh(token)
    expect(out.accessToken).toBeTruthy()
    expect(out.refreshToken).toBeTruthy()
    expect(out.refreshToken).not.toBe(token) // rotacionou
    expect(mr.del).toHaveBeenCalledWith(`refresh:${userId}:${jti}`)
    expect(mr.setEx).toHaveBeenCalled() // grava o novo
  }, 20000)

  it('reuse: jti não está no redis → revoga tudo (set authEpoch) e 401', async () => {
    const userId = 8
    const token = jwt.sign({ sub: userId, email: 'b@b.com', role: 'ADMIN' }, process.env.JWT_REFRESH_SECRET!, { algorithm: 'HS256', jwtid: 'old', expiresIn: '7d' })
    mr.get.mockResolvedValue(null) // não existe → reuse/revogado
    await expect(svc.refresh(token)).rejects.toMatchObject({ status: 401 })
    expect(mr.set).toHaveBeenCalledWith(expect.stringContaining(`authEpoch:${userId}`), expect.any(String))
  }, 20000)
})

describe('isAccessRevoked', () => {
  it('true quando denyAccess do jti existe', async () => {
    mr.get.mockImplementation((k: string) => Promise.resolve(k.startsWith('denyAccess:') ? '1' : null))
    expect(await svc.isAccessRevoked({ sub: 1, jti: 'j', iat: 1000 })).toBe(true)
  })
  it('true quando iat < authEpoch', async () => {
    mr.get.mockImplementation((k: string) => Promise.resolve(k.startsWith('authEpoch:') ? '2000' : null))
    expect(await svc.isAccessRevoked({ sub: 1, jti: 'j', iat: 1000 })).toBe(true)
  })
  it('false quando nada revogado', async () => {
    mr.get.mockResolvedValue(null)
    expect(await svc.isAccessRevoked({ sub: 1, jti: 'j', iat: 9999 })).toBe(false)
  })
})
