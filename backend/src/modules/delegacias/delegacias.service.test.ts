import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    delegacia: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    participante: {
      count: vi.fn(),
    },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './delegacias.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('delegacias.service', () => {
  it('listar retorna lista ordenada por nome', async () => {
    mockPrisma.delegacia.findMany.mockResolvedValue([{ id: 1, nome: '1ª DP' }])
    const result = await service.listar()
    expect(result).toEqual([{ id: 1, nome: '1ª DP' }])
    expect(mockPrisma.delegacia.findMany).toHaveBeenCalledWith({ orderBy: { nome: 'asc' } })
  })

  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.delegacia.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('criar chama prisma.create com nome', async () => {
    mockPrisma.delegacia.create.mockResolvedValue({ id: 1, nome: '1ª DP' })
    await service.criar({ nome: '1ª DP' })
    expect(mockPrisma.delegacia.create).toHaveBeenCalledWith({ data: { nome: '1ª DP' } })
  })

  it('editar chama prisma.update', async () => {
    mockPrisma.delegacia.update.mockResolvedValue({ id: 1, nome: '2ª DP' })
    await service.editar(1, { nome: '2ª DP' })
    expect(mockPrisma.delegacia.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { nome: '2ª DP' } })
  })

  it('remover lança 409 quando há participante vinculado', async () => {
    mockPrisma.participante.count.mockResolvedValue(2)
    await expect(service.remover(1)).rejects.toMatchObject({ status: 409 })
    expect(mockPrisma.delegacia.delete).not.toHaveBeenCalled()
  })

  it('remover deleta quando não há vínculo', async () => {
    mockPrisma.participante.count.mockResolvedValue(0)
    mockPrisma.delegacia.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.delegacia.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
