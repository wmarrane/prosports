import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}))

vi.mock('../auth/auth.service', () => ({
  hashSenha: vi.fn(async (s: string) => `hashed:${s}`),
  revogarTodosRefreshTokens: vi.fn(async () => {}),
}))

import prisma from '../../lib/prisma'
import * as service from './users.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('users.service', () => {
  describe('listar', () => {
    it('retorna usuários ordenados por nome (sem senha_hash)', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 1, nome: 'Alice', email: 'a@x.com', role: 'ADMIN', ativo: true, ultimo_login: null, criado_em: new Date(), atualizado_em: new Date() },
      ])
      const result = await service.listar()
      expect(result).toHaveLength(1)
      expect(result[0]).not.toHaveProperty('senha_hash')
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        orderBy: { nome: 'asc' },
        select: expect.objectContaining({ senha_hash: false }),
      })
    })
  })

  describe('buscarPorId', () => {
    it('retorna usuário sem senha_hash', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1, nome: 'Alice', email: 'a@x.com', role: 'ADMIN', ativo: true,
      })
      const result = await service.buscarPorId(1)
      expect(result).not.toHaveProperty('senha_hash')
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: expect.objectContaining({ senha_hash: false }),
      })
    })

    it('lança 404 quando não encontrado', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
    })
  })

  describe('criar', () => {
    it('cria usuário com senha hash', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null)
      mockPrisma.user.create.mockResolvedValue({
        id: 1, nome: 'Bob', email: 'b@x.com', role: 'VIEWER', ativo: true,
      })
      const result = await service.criar({
        nome: 'Bob', email: 'b@x.com', role: 'VIEWER', senha: 'segredo123',
      })
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          nome: 'Bob',
          email: 'b@x.com',
          role: 'VIEWER',
          senha_hash: 'hashed:segredo123',
        },
        select: expect.any(Object),
      })
      expect(result).not.toHaveProperty('senha_hash')
    })

    it('falha com 400 se email já existe', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 9 })
      await expect(
        service.criar({ nome: 'X', email: 'dup@x.com', role: 'VIEWER', senha: 'segredo123' })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('Email') })
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })
  })
})
