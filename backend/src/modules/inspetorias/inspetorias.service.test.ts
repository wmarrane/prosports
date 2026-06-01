import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    inspetoria: {
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
import * as service from './inspetorias.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('inspetorias.service', () => {
  it('listar sem filtro inclui delegacia e ordena por nome', async () => {
    mockPrisma.inspetoria.findMany.mockResolvedValue([{ id: 1, nome: 'Alfa' }])
    const result = await service.listar()
    expect(result).toEqual([{ id: 1, nome: 'Alfa' }])
    expect(mockPrisma.inspetoria.findMany).toHaveBeenCalledWith({
      where: undefined, include: { delegacia: true }, orderBy: { nome: 'asc' },
    })
  })

  it('listar com delegacia_id filtra', async () => {
    mockPrisma.inspetoria.findMany.mockResolvedValue([])
    await service.listar({ delegacia_id: 7 })
    expect(mockPrisma.inspetoria.findMany).toHaveBeenCalledWith({
      where: { delegacia_id: 7 }, include: { delegacia: true }, orderBy: { nome: 'asc' },
    })
  })

  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.inspetoria.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('criar chama prisma.create com nome + delegacia_id', async () => {
    mockPrisma.inspetoria.create.mockResolvedValue({ id: 1, nome: 'Alfa' })
    await service.criar({ nome: 'Alfa', delegacia_id: 2 })
    expect(mockPrisma.inspetoria.create).toHaveBeenCalledWith({
      data: { nome: 'Alfa', delegacia_id: 2 }, include: { delegacia: true },
    })
  })

  it('editar chama prisma.update', async () => {
    mockPrisma.inspetoria.update.mockResolvedValue({ id: 1, nome: 'Beta' })
    await service.editar(1, { nome: 'Beta' })
    expect(mockPrisma.inspetoria.update).toHaveBeenCalledWith({
      where: { id: 1 }, data: { nome: 'Beta' }, include: { delegacia: true },
    })
  })

  it('remover lança 409 quando há participante vinculado', async () => {
    mockPrisma.participante.count.mockResolvedValue(3)
    await expect(service.remover(1)).rejects.toMatchObject({ status: 409 })
    expect(mockPrisma.inspetoria.delete).not.toHaveBeenCalled()
  })

  it('remover deleta quando não há vínculo', async () => {
    mockPrisma.participante.count.mockResolvedValue(0)
    mockPrisma.inspetoria.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.inspetoria.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
