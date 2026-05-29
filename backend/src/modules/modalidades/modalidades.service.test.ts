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

const INCLUDE = { competicao: true, tipo_modalidade: true }

describe('modalidades.service', () => {
  it('listar sem filtro inclui competicao e tipo_modalidade', async () => {
    mockPrisma.modalidade.findMany.mockResolvedValue([])
    await service.listar()
    expect(mockPrisma.modalidade.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: [{ competicao: { nome: 'asc' } }, { nome: 'asc' }],
      include: INCLUDE,
    })
  })

  it('listar filtra por competicao_id quando passado', async () => {
    mockPrisma.modalidade.findMany.mockResolvedValue([])
    await service.listar(7)
    expect(mockPrisma.modalidade.findMany).toHaveBeenCalledWith({
      where: { competicao_id: 7 },
      orderBy: [{ competicao: { nome: 'asc' } }, { nome: 'asc' }],
      include: INCLUDE,
    })
  })

  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.modalidade.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('criar chama prisma.create com todos os campos e include', async () => {
    const data = { nome: 'Futebol', sigla: 'FUT', competicao_id: 1, tipo_modalidade_id: 2 }
    mockPrisma.modalidade.create.mockResolvedValue({ id: 1, ...data })
    await service.criar(data)
    expect(mockPrisma.modalidade.create).toHaveBeenCalledWith({ data, include: INCLUDE })
  })

  it('criar mapeia P2002 para 409', async () => {
    mockPrisma.modalidade.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))
    await expect(
      service.criar({ nome: 'X', sigla: 'X', competicao_id: 1, tipo_modalidade_id: 1 })
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining('Já existe') })
  })

  it('editar chama prisma.update com include', async () => {
    mockPrisma.modalidade.update.mockResolvedValue({ id: 1 })
    await service.editar(1, { nome: 'Renomeada' })
    expect(mockPrisma.modalidade.update).toHaveBeenCalledWith({
      where: { id: 1 }, data: { nome: 'Renomeada' }, include: INCLUDE,
    })
  })

  it('editar também mapeia P2002 para 409', async () => {
    mockPrisma.modalidade.update.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))
    await expect(
      service.editar(1, { sigla: 'DUP' })
    ).rejects.toMatchObject({ status: 409 })
  })

  it('remover deleta direto', async () => {
    mockPrisma.modalidade.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.modalidade.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
