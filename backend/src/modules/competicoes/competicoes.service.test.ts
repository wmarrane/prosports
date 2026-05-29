import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    competicao: {
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
import * as service from './competicoes.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('competicoes.service', () => {
  it('listar retorna lista ordenada por nome', async () => {
    mockPrisma.competicao.findMany.mockResolvedValue([{ id: 1, nome: 'Copa A' }])
    const result = await service.listar()
    expect(result).toEqual([{ id: 1, nome: 'Copa A' }])
    expect(mockPrisma.competicao.findMany).toHaveBeenCalledWith({ orderBy: { nome: 'asc' } })
  })

  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.competicao.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('criar aceita UFs válidas e default false em adicionar_subtitulo', async () => {
    mockPrisma.competicao.create.mockResolvedValue({ id: 1 })
    await service.criar({ nome: 'Copa Brasil', estados: ['SP', 'RJ'] })
    expect(mockPrisma.competicao.create).toHaveBeenCalledWith({
      data: { nome: 'Copa Brasil', estados: ['SP', 'RJ'], adicionar_subtitulo: false },
    })
  })

  it('criar respeita adicionar_subtitulo=true quando passado', async () => {
    mockPrisma.competicao.create.mockResolvedValue({ id: 1 })
    await service.criar({ nome: 'Copa', estados: ['MG'], adicionar_subtitulo: true })
    expect(mockPrisma.competicao.create).toHaveBeenCalledWith({
      data: { nome: 'Copa', estados: ['MG'], adicionar_subtitulo: true },
    })
  })

  it('criar rejeita UF inválida com 400', async () => {
    await expect(
      service.criar({ nome: 'Copa', estados: ['SP', 'XX'] })
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('XX') })
    expect(mockPrisma.competicao.create).not.toHaveBeenCalled()
  })

  it('criar mapeia P2002 (unique nome) para 409', async () => {
    mockPrisma.competicao.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }))
    await expect(
      service.criar({ nome: 'Copa', estados: ['SP'] })
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining('Já existe') })
  })

  it('editar valida estados quando presente', async () => {
    await expect(
      service.editar(1, { estados: ['ZZ'] })
    ).rejects.toMatchObject({ status: 400 })
    expect(mockPrisma.competicao.update).not.toHaveBeenCalled()
  })

  it('editar passa pela validação se estados ausente', async () => {
    mockPrisma.competicao.update.mockResolvedValue({ id: 1 })
    await service.editar(1, { nome: 'Renomeada' })
    expect(mockPrisma.competicao.update).toHaveBeenCalledWith({
      where: { id: 1 }, data: { nome: 'Renomeada' },
    })
  })

  it('remover lança 409 se há modalidade vinculada', async () => {
    mockPrisma.modalidade.count.mockResolvedValue(2)
    await expect(service.remover(1)).rejects.toMatchObject({ status: 409 })
    expect(mockPrisma.competicao.delete).not.toHaveBeenCalled()
  })

  it('remover deleta quando não há modalidade vinculada', async () => {
    mockPrisma.modalidade.count.mockResolvedValue(0)
    mockPrisma.competicao.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.competicao.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
