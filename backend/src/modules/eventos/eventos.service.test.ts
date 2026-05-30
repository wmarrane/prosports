import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    evento: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './eventos.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

const INCLUDE = { competicao: true, municipio: true }

describe('eventos.service', () => {
  it('listar sem filtro inclui competicao e municipio ordenado por data_hora desc', async () => {
    mockPrisma.evento.findMany.mockResolvedValue([])
    await service.listar()
    expect(mockPrisma.evento.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { data_hora: 'desc' },
      include: INCLUDE,
    })
  })

  it('listar filtra por competicao_id quando passado', async () => {
    mockPrisma.evento.findMany.mockResolvedValue([])
    await service.listar(7)
    expect(mockPrisma.evento.findMany).toHaveBeenCalledWith({
      where: { competicao_id: 7 },
      orderBy: { data_hora: 'desc' },
      include: INCLUDE,
    })
  })

  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('criar chama prisma.create com todos os campos e include', async () => {
    const data = {
      nome: 'Etapa SP',
      data_hora: new Date('2026-07-01T09:00:00Z'),
      local: 'Ginásio',
      organizador: 'SEJEL',
      status: 'rascunho' as const,
      competicao_id: 1,
      municipio_id: 2,
    }
    mockPrisma.evento.create.mockResolvedValue({ id: 1, ...data })
    await service.criar(data)
    expect(mockPrisma.evento.create).toHaveBeenCalledWith({ data, include: INCLUDE })
  })

  it('criar aceita opcionais ausentes (organizador, status)', async () => {
    const data = {
      nome: 'Etapa minimal',
      data_hora: new Date('2026-07-01T09:00:00Z'),
      local: 'Ginásio',
      competicao_id: 1,
      municipio_id: 2,
    }
    mockPrisma.evento.create.mockResolvedValue({ id: 1, ...data })
    await service.criar(data)
    expect(mockPrisma.evento.create).toHaveBeenCalledWith({ data, include: INCLUDE })
  })

  it('criar mapeia P2002 para 409', async () => {
    mockPrisma.evento.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))
    await expect(
      service.criar({
        nome: 'X',
        data_hora: new Date(),
        local: 'L',
        competicao_id: 1,
        municipio_id: 1,
      })
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining('Já existe') })
  })

  it('editar chama prisma.update com include', async () => {
    mockPrisma.evento.update.mockResolvedValue({ id: 1 })
    await service.editar(1, { nome: 'Renomeado' })
    expect(mockPrisma.evento.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { nome: 'Renomeado' },
      include: INCLUDE,
    })
  })

  it('editar também mapeia P2002 para 409', async () => {
    mockPrisma.evento.update.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))
    await expect(service.editar(1, { nome: 'DUP' })).rejects.toMatchObject({ status: 409 })
  })

  it('remover deleta direto', async () => {
    mockPrisma.evento.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.evento.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
