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
import { hashSenha } from '../auth/auth.service'

const mockPrisma = prisma as any
const mockHashSenha = hashSenha as ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.resetAllMocks()
  mockHashSenha.mockImplementation(async (s: string) => `hashed:${s}`)
})

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

  describe('editar', () => {
    it('edita campos permitidos sem mexer em senha_hash', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1, role: 'PARTICIPANTE', ativo: true,
      })
      mockPrisma.user.update.mockResolvedValue({ id: 1, nome: 'Novo', email: 'n@x.com' })
      await service.editar(1, { nome: 'Novo', email: 'n@x.com' }, { sub: 9, role: 'ADMIN' })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { nome: 'Novo', email: 'n@x.com' },
        select: expect.any(Object),
      })
    })

    it('falha 400 ao tentar desativar a si mesmo', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, role: 'ADMIN', ativo: true })
      await expect(
        service.editar(1, { ativo: false }, { sub: 1, role: 'ADMIN' })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('desativar a si') })
    })

    it('falha 400 ao tentar rebaixar o próprio role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, role: 'ADMIN', ativo: true })
      await expect(
        service.editar(1, { role: 'VIEWER' }, { sub: 1, role: 'ADMIN' })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('rebaixar') })
    })

    it('falha 400 ao deixar sistema sem ADMIN ativo (desativando único admin)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 5, role: 'ADMIN', ativo: true })
      mockPrisma.user.count.mockResolvedValue(0)
      await expect(
        service.editar(5, { ativo: false }, { sub: 9, role: 'ADMIN' })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('último') })
    })

    it('falha 400 ao deixar sistema sem ADMIN ativo (rebaixando único admin)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 5, role: 'ADMIN', ativo: true })
      mockPrisma.user.count.mockResolvedValue(0)
      await expect(
        service.editar(5, { role: 'VIEWER' }, { sub: 9, role: 'ADMIN' })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('último') })
    })

    it('falha 400 quando email novo conflita com outro usuário', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, email: 'old@x.com', role: 'VIEWER', ativo: true })
      mockPrisma.user.findFirst.mockResolvedValue({ id: 2 })
      await expect(
        service.editar(1, { email: 'novo@x.com' }, { sub: 9, role: 'ADMIN' })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('Email') })
    })

    it('lança 404 se usuário-alvo não existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      await expect(
        service.editar(99, { nome: 'X' }, { sub: 9, role: 'ADMIN' })
      ).rejects.toMatchObject({ status: 404 })
    })
  })
})
