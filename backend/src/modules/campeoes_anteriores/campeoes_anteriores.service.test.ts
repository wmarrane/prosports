import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    campeaoAnterior: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    evento: {
      findUnique: vi.fn(),
    },
    modalidade: {
      findUnique: vi.fn(),
    },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './campeoes_anteriores.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

const INCLUDE = { participante: true }

describe('campeoes_anteriores.service', () => {
  it('listar com filtros passa where correto', async () => {
    mockPrisma.campeaoAnterior.findMany.mockResolvedValue([])
    await service.listar({ evento_id: 5, modalidade_id: 2 })
    expect(mockPrisma.campeaoAnterior.findMany).toHaveBeenCalledWith({
      where: { evento_id: 5, modalidade_id: 2 },
      orderBy: [{ modalidade_id: 'asc' }, { posicao: 'asc' }],
      include: INCLUDE,
    })
  })

  it('listar sem filtros chama findMany com where vazio', async () => {
    mockPrisma.campeaoAnterior.findMany.mockResolvedValue([])
    await service.listar({})
    expect(mockPrisma.campeaoAnterior.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ modalidade_id: 'asc' }, { posicao: 'asc' }],
      include: INCLUDE,
    })
  })

  it('criar lança 404 se evento não existe', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue(null)
    mockPrisma.modalidade.findUnique.mockResolvedValue({ competicao_id: 1 })
    await expect(service.criar({ evento_id: 1, modalidade_id: 1, participante_id: 1, posicao: 1 }))
      .rejects.toMatchObject({ status: 404, message: expect.stringContaining('Evento') })
  })

  it('criar lança 404 se modalidade não existe', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue(null)
    await expect(service.criar({ evento_id: 1, modalidade_id: 1, participante_id: 1, posicao: 1 }))
      .rejects.toMatchObject({ status: 404, message: expect.stringContaining('Modalidade') })
  })

  it('criar lança 400 se competições não batem', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ competicao_id: 2 })
    await expect(service.criar({ evento_id: 1, modalidade_id: 1, participante_id: 1, posicao: 1 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('competição') })
  })

  it('criar chama prisma.create com data + include quando OK', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.campeaoAnterior.create.mockResolvedValue({ id: 1 })
    const data = { evento_id: 1, modalidade_id: 2, participante_id: 3, posicao: 1 as 1 | 2 | 3 }
    await service.criar(data)
    expect(mockPrisma.campeaoAnterior.create).toHaveBeenCalledWith({ data, include: INCLUDE })
  })

  it('criar mapeia P2002 para 409', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.campeaoAnterior.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))
    await expect(service.criar({ evento_id: 1, modalidade_id: 1, participante_id: 1, posicao: 1 }))
      .rejects.toMatchObject({ status: 409, message: expect.stringContaining('posição') })
  })

  it('remover deleta direto', async () => {
    mockPrisma.campeaoAnterior.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.campeaoAnterior.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
