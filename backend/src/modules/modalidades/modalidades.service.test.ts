import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    modalidade: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './modalidades.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('modalidades.service', () => {
  it('listar inclui contagem de categorias', async () => {
    mockPrisma.modalidade.findMany.mockResolvedValue([])
    await service.listar()
    expect(mockPrisma.modalidade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: { _count: { select: { categorias: true } } } })
    )
  })

  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.modalidade.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('remover lança 409 se tiver categorias vinculadas', async () => {
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 1, _count: { categorias: 2 } })
    await expect(service.remover(1)).rejects.toMatchObject({ status: 409 })
  })

  it('remover deleta quando sem categorias', async () => {
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 1, _count: { categorias: 0 } })
    mockPrisma.modalidade.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.modalidade.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
