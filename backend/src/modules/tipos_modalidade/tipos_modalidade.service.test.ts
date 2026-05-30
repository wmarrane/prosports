import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    tipoModalidade: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    modalidade: {
      count: vi.fn(),
    },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './tipos_modalidade.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('tipos_modalidade.service', () => {
  it('listar retorna lista ordenada por nome', async () => {
    mockPrisma.tipoModalidade.findMany.mockResolvedValue([{ id: 1, nome: 'Coletivo' }])
    const result = await service.listar()
    expect(result).toEqual([{ id: 1, nome: 'Coletivo' }])
    expect(mockPrisma.tipoModalidade.findMany).toHaveBeenCalledWith({ orderBy: { nome: 'asc' } })
  })

  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.tipoModalidade.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('criar chama prisma.create com nome', async () => {
    mockPrisma.tipoModalidade.create.mockResolvedValue({ id: 1, nome: 'Coletivo' })
    await service.criar({ nome: 'Coletivo' })
    expect(mockPrisma.tipoModalidade.create).toHaveBeenCalledWith({ data: { nome: 'Coletivo' } })
  })

  it('editar chama prisma.update', async () => {
    mockPrisma.tipoModalidade.update.mockResolvedValue({ id: 1, nome: 'Individual' })
    await service.editar(1, { nome: 'Individual' })
    expect(mockPrisma.tipoModalidade.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { nome: 'Individual' } })
  })

  it('criar com tipo passa o valor para prisma.create', async () => {
    mockPrisma.tipoModalidade.create.mockResolvedValue({ id: 1, nome: 'Atletismo', tipo: 'ordem_entrada' })
    await service.criar({ nome: 'Atletismo', tipo: 'ordem_entrada' })
    expect(mockPrisma.tipoModalidade.create).toHaveBeenCalledWith({ data: { nome: 'Atletismo', tipo: 'ordem_entrada' } })
  })

  it('criar sem tipo NÃO inclui a chave no data (deixa default do DB resolver)', async () => {
    mockPrisma.tipoModalidade.create.mockResolvedValue({ id: 1, nome: 'Vôlei' })
    await service.criar({ nome: 'Vôlei' })
    expect(mockPrisma.tipoModalidade.create).toHaveBeenCalledWith({ data: { nome: 'Vôlei' } })
  })

  it('editar com tipo atualiza o campo', async () => {
    mockPrisma.tipoModalidade.update.mockResolvedValue({ id: 1, nome: 'X', tipo: 'chaves' })
    await service.editar(1, { tipo: 'chaves' })
    expect(mockPrisma.tipoModalidade.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { tipo: 'chaves' } })
  })

  it('remover lança 409 quando há modalidade vinculada', async () => {
    mockPrisma.modalidade.count.mockResolvedValue(3)
    await expect(service.remover(1)).rejects.toMatchObject({ status: 409 })
    expect(mockPrisma.tipoModalidade.delete).not.toHaveBeenCalled()
  })

  it('remover deleta quando não há vínculo', async () => {
    mockPrisma.modalidade.count.mockResolvedValue(0)
    mockPrisma.tipoModalidade.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.tipoModalidade.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
