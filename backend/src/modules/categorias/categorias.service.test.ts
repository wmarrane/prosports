import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    categoria: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './categorias.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('categorias.service', () => {
  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.categoria.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('criar lança 400 se idade_min >= idade_max', async () => {
    await expect(service.criar({
      modalidade_id: 1, nome: 'Sub-17', genero: 'MASCULINO', idade_min: 17, idade_max: 15
    })).rejects.toMatchObject({ status: 400 })
  })

  it('criar aceita sem faixa etária', async () => {
    mockPrisma.categoria.create.mockResolvedValue({ id: 1 })
    await service.criar({ modalidade_id: 1, nome: 'Adulto', genero: 'LIVRE' })
    expect(mockPrisma.categoria.create).toHaveBeenCalled()
  })

  it('listar filtra por modalidade_id quando fornecido', async () => {
    mockPrisma.categoria.findMany.mockResolvedValue([])
    await service.listar(2)
    expect(mockPrisma.categoria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { modalidade_id: 2 } })
    )
  })
})
