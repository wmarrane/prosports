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
    inscricao: { groupBy: vi.fn() },
    sorteio: { findMany: vi.fn() },
    eventoModalidadeExcluida: { findMany: vi.fn() },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './eventos.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

const INCLUDE = {
  competicao: true,
  municipio: true,
  anfitriao: { include: { municipio: true, inspetoria: true, delegacia: true } },
}
const LIST_INCLUDE = {
  competicao: {
    include: {
      modalidades: {
        where: { ativa: true },
        select: {
          id: true,
          mensagens_inscritos: true,
          tipo_modalidade: { select: { tipo: true } },
        },
      },
    },
  },
  municipio: true,
  _count: { select: { inscricoes: true, sorteios: true } },
}

describe('eventos.service', () => {
  it('listar sem filtro inclui competicao+modalidades+counts ordenado por data_hora desc', async () => {
    mockPrisma.evento.findMany.mockResolvedValue([])
    await service.listar()
    expect(mockPrisma.evento.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { data_hora: 'desc' },
      include: LIST_INCLUDE,
    })
  })

  it('listar filtra por competicao_id quando passado', async () => {
    mockPrisma.evento.findMany.mockResolvedValue([])
    await service.listar(7)
    expect(mockPrisma.evento.findMany).toHaveBeenCalledWith({
      where: { competicao_id: 7 },
      orderBy: { data_hora: 'desc' },
      include: LIST_INCLUDE,
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

  it('listar computa modalidades_sorteaveis por evento (ignora especifico/sem-inscritos/pular; inclui sorteadas)', async () => {
    mockPrisma.evento.findMany.mockResolvedValue([
      {
        id: 1,
        competicao: { modalidades: [
          { id: 10, tipo_modalidade: { tipo: 'grupos' }, mensagens_inscritos: [] },
          { id: 11, tipo_modalidade: { tipo: 'especifico' }, mensagens_inscritos: [] },
          { id: 12, tipo_modalidade: { tipo: 'chaves' }, mensagens_inscritos: [{ min: 2, max: 2, mensagem: 'x', pular_sorteio: true }] },
        ] },
        _count: { inscricoes: 0, sorteios: 1 },
      },
    ])
    mockPrisma.inscricao.groupBy.mockResolvedValue([
      { evento_id: 1, modalidade_id: 10, _count: { _all: 8 } },
      { evento_id: 1, modalidade_id: 11, _count: { _all: 5 } },
      { evento_id: 1, modalidade_id: 12, _count: { _all: 2 } },
    ])
    mockPrisma.sorteio.findMany.mockResolvedValue([{ evento_id: 1, modalidade_id: 10 }])
    mockPrisma.eventoModalidadeExcluida.findMany.mockResolvedValue([])

    const out = await service.listar()
    expect((out[0] as any).modalidades_sorteaveis).toBe(1)
  })

  it('listar exclui modalidades excluidas do contador e calcula pendentes', async () => {
    mockPrisma.evento.findMany.mockResolvedValue([
      { id: 1, competicao: { modalidades: [
        { id: 10, mensagens_inscritos: [], tipo_modalidade: { tipo: 'grupos' } },
        { id: 11, mensagens_inscritos: [], tipo_modalidade: { tipo: 'grupos' } },
        { id: 12, mensagens_inscritos: [], tipo_modalidade: { tipo: 'grupos' } },
      ] } },
    ])
    mockPrisma.inscricao.groupBy.mockResolvedValue([
      { evento_id: 1, modalidade_id: 10, _count: { _all: 4 } },
      { evento_id: 1, modalidade_id: 11, _count: { _all: 4 } },
      { evento_id: 1, modalidade_id: 12, _count: { _all: 4 } },
    ])
    mockPrisma.sorteio.findMany.mockResolvedValue([
      { evento_id: 1, modalidade_id: 10 },
    ])
    mockPrisma.eventoModalidadeExcluida.findMany.mockResolvedValue([
      { evento_id: 1, modalidade_id: 12 },
    ])
    const [e] = await service.listar() as any[]
    expect(e.modalidades_sorteaveis).toBe(2)
    expect(e.modalidades_pendentes).toBe(1)
  })
})
