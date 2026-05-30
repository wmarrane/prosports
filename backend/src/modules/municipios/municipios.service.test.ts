import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    municipio: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    participante: {
      count: vi.fn(),
    },
    evento: {
      count: vi.fn(),
    },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './municipios.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('municipios.service', () => {
  it('listar sem filtros aplica paginação padrão', async () => {
    mockPrisma.municipio.findMany.mockResolvedValue([{ id: 1, nome: 'Aracaju' }])
    mockPrisma.municipio.count.mockResolvedValue(1)
    const result = await service.listar({})
    expect(result).toEqual({ data: [{ id: 1, nome: 'Aracaju' }], total: 1, page: 1, limit: 50 })
    expect(mockPrisma.municipio.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ uf: 'asc' }, { nome: 'asc' }],
      skip: 0,
      take: 50,
    })
  })

  it('listar filtra por uf e q (case-insensitive)', async () => {
    mockPrisma.municipio.findMany.mockResolvedValue([])
    mockPrisma.municipio.count.mockResolvedValue(0)
    await service.listar({ uf: 'sp', q: 'são pa', page: 2, limit: 10 })
    expect(mockPrisma.municipio.findMany).toHaveBeenCalledWith({
      where: { uf: 'SP', nome: { contains: 'são pa', mode: 'insensitive' } },
      orderBy: [{ uf: 'asc' }, { nome: 'asc' }],
      skip: 10,
      take: 10,
    })
  })

  it('listar limita o tamanho da página em 200', async () => {
    mockPrisma.municipio.findMany.mockResolvedValue([])
    mockPrisma.municipio.count.mockResolvedValue(0)
    await service.listar({ limit: 9999 })
    expect(mockPrisma.municipio.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }))
  })

  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.municipio.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('criar normaliza uf para maiúsculas', async () => {
    mockPrisma.municipio.create.mockResolvedValue({ id: 1 })
    await service.criar({ codigo_ibge: '3550308', nome: 'São Paulo', uf: 'sp' })
    expect(mockPrisma.municipio.create).toHaveBeenCalledWith({
      data: { codigo_ibge: '3550308', nome: 'São Paulo', uf: 'SP' },
    })
  })

  it('editar normaliza uf para maiúsculas', async () => {
    mockPrisma.municipio.update.mockResolvedValue({ id: 1 })
    await service.editar(1, { uf: 'rj' })
    expect(mockPrisma.municipio.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { uf: 'RJ' } })
  })

  it('remover falha com 409 quando há participante vinculado', async () => {
    mockPrisma.participante.count.mockResolvedValue(2)
    mockPrisma.evento.count.mockResolvedValue(0)
    await expect(service.remover(1)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('participantes') })
    expect(mockPrisma.municipio.delete).not.toHaveBeenCalled()
  })

  it('remover falha com 409 quando há evento vinculado', async () => {
    mockPrisma.participante.count.mockResolvedValue(0)
    mockPrisma.evento.count.mockResolvedValue(2)
    await expect(service.remover(1)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('eventos') })
    expect(mockPrisma.municipio.delete).not.toHaveBeenCalled()
  })

  it('remover falha com 409 composto quando há ambos', async () => {
    mockPrisma.participante.count.mockResolvedValue(2)
    mockPrisma.evento.count.mockResolvedValue(1)
    await expect(service.remover(1)).rejects.toMatchObject({ status: 409, message: expect.stringContaining('participantes e eventos') })
  })

  it('remover deleta quando não há vínculos', async () => {
    mockPrisma.participante.count.mockResolvedValue(0)
    mockPrisma.evento.count.mockResolvedValue(0)
    mockPrisma.municipio.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.municipio.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
