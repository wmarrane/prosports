import { describe, it, expect, vi, beforeEach } from 'vitest'

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

process.env.JWT_SECRET = 'test-secret'

import prisma from '../../lib/prisma'
import * as authService from './auth.service'

const mockPrisma = prisma as any
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
