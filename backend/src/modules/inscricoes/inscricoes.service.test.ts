import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    inscricao: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
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
import * as service from './inscricoes.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

const INCLUDE = { participante: true }

describe('inscricoes.service', () => {
  it('listar com filtros passa where corretamente', async () => {
    mockPrisma.inscricao.findMany.mockResolvedValue([])
    await service.listar({ evento_id: 7, modalidade_id: 3 })
    expect(mockPrisma.inscricao.findMany).toHaveBeenCalledWith({
      where: { evento_id: 7, modalidade_id: 3 },
      orderBy: { criado_em: 'asc' },
      include: INCLUDE,
    })
  })

  it('listar sem filtros chama findMany com where vazio', async () => {
    mockPrisma.inscricao.findMany.mockResolvedValue([])
    await service.listar({})
    expect(mockPrisma.inscricao.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { criado_em: 'asc' },
      include: INCLUDE,
    })
  })

  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.inscricao.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('criar lança 404 se evento não existe', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue(null)
    mockPrisma.modalidade.findUnique.mockResolvedValue({ competicao_id: 1 })
    await expect(service.criar({ evento_id: 1, modalidade_id: 1, participante_id: 1 }))
      .rejects.toMatchObject({ status: 404, message: expect.stringContaining('Evento') })
    expect(mockPrisma.inscricao.create).not.toHaveBeenCalled()
  })

  it('criar lança 404 se modalidade não existe', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue(null)
    await expect(service.criar({ evento_id: 1, modalidade_id: 1, participante_id: 1 }))
      .rejects.toMatchObject({ status: 404, message: expect.stringContaining('Modalidade') })
    expect(mockPrisma.inscricao.create).not.toHaveBeenCalled()
  })

  it('criar lança 400 se competições não batem', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ competicao_id: 2 })
    await expect(service.criar({ evento_id: 1, modalidade_id: 1, participante_id: 1 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('competição') })
    expect(mockPrisma.inscricao.create).not.toHaveBeenCalled()
  })

  it('criar chama prisma.create com include quando competições batem', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.inscricao.create.mockResolvedValue({ id: 1 })
    const data = { evento_id: 1, modalidade_id: 1, participante_id: 1 }
    await service.criar(data)
    expect(mockPrisma.inscricao.create).toHaveBeenCalledWith({ data, include: INCLUDE })
  })

  it('criar mapeia P2002 para 409', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.inscricao.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))
    await expect(service.criar({ evento_id: 1, modalidade_id: 1, participante_id: 1 }))
      .rejects.toMatchObject({ status: 409, message: expect.stringContaining('inscrito') })
  })

  it('remover deleta direto', async () => {
    mockPrisma.inscricao.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.inscricao.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
