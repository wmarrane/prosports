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
    inscricao: { groupBy: vi.fn(), findMany: vi.fn() },
    sorteio: { findMany: vi.fn() },
    eventoModalidadeExcluida: { findMany: vi.fn() },
    eventoComissao: { createMany: vi.fn(), deleteMany: vi.fn() },
    user: { findMany: vi.fn() },
    $transaction: vi.fn(async (ops: any) => Promise.all(ops)),
  },
}))

import prisma from '../../lib/prisma'
import * as service from './eventos.service'

const mockPrisma = prisma as any
beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.inscricao.findMany.mockResolvedValue([])
})

const INCLUDE = {
  competicao: true,
  municipio: true,
  anfitriao: { include: { municipio: true, inspetoria: true, delegacia: true } },
  comissao: { select: { usuario: { select: { id: true, nome: true } } } },
}
const LIST_INCLUDE = {
  competicao: {
    include: {
      modalidades: {
        where: { ativa: true },
        select: {
          id: true,
          nome: true,
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
      where: {},
      orderBy: { data_hora: 'desc' },
      include: LIST_INCLUDE,
    })
  })

  it('listar filtra por comissão quando role COMISSAO_TECNICA', async () => {
    mockPrisma.evento.findMany.mockResolvedValue([])
    await service.listar(undefined, { sub: 7, role: 'COMISSAO_TECNICA' })
    expect(mockPrisma.evento.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { comissao: { some: { usuario_id: 7 } } },
    }))
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

  it('editar chama prisma.update e retorna via findUnique com include', async () => {
    mockPrisma.evento.update.mockResolvedValue({ id: 1 })
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1 })
    await service.editar(1, { nome: 'Renomeado' })
    expect(mockPrisma.evento.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { nome: 'Renomeado' },
    })
    expect(mockPrisma.evento.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
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
          { id: 10, nome: 'Atletismo Feminino', tipo_modalidade: { tipo: 'grupos' }, mensagens_inscritos: [] },
          { id: 11, nome: 'Basquete Masculino', tipo_modalidade: { tipo: 'especifico' }, mensagens_inscritos: [] },
          { id: 12, nome: 'Volei Feminino', tipo_modalidade: { tipo: 'chaves' }, mensagens_inscritos: [{ min: 2, max: 2, mensagem: 'x', pular_sorteio: true }] },
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

  it('criar sincroniza comissão (createMany) e valida ids como COMISSAO_TECNICA', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 10, role: 'COMISSAO_TECNICA' }, { id: 11, role: 'COMISSAO_TECNICA' }])
    mockPrisma.evento.create.mockResolvedValue({ id: 99 })
    mockPrisma.eventoComissao.createMany.mockResolvedValue({ count: 2 })
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 99 })
    await service.criar({ nome: 'E', data_hora: new Date(), local: 'L', competicao_id: 1, municipio_id: 1, comissao_ids: [10, 11, 10] } as any)
    // dedupe: 10 e 11 (sem o 10 repetido)
    expect(mockPrisma.eventoComissao.createMany).toHaveBeenCalledWith({ data: [
      { evento_id: 99, usuario_id: 10 },
      { evento_id: 99, usuario_id: 11 },
    ] })
  })

  it('criar rejeita (400) comissao_ids que não são COMISSAO_TECNICA', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 10, role: 'ADMIN' }])
    await expect(service.criar({ nome: 'E', data_hora: new Date(), local: 'L', competicao_id: 1, municipio_id: 1, comissao_ids: [10] } as any))
      .rejects.toMatchObject({ status: 400 })
    expect(mockPrisma.evento.create).not.toHaveBeenCalled()
  })

  it('editar substitui a comissão (deleteMany + createMany)', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 20, role: 'COMISSAO_TECNICA' }])
    mockPrisma.evento.update.mockResolvedValue({ id: 5 })
    mockPrisma.eventoComissao.deleteMany.mockResolvedValue({ count: 1 })
    mockPrisma.eventoComissao.createMany.mockResolvedValue({ count: 1 })
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 5 })
    await service.editar(5, { comissao_ids: [20] } as any)
    expect(mockPrisma.eventoComissao.deleteMany).toHaveBeenCalledWith({ where: { evento_id: 5 } })
    expect(mockPrisma.eventoComissao.createMany).toHaveBeenCalledWith({ data: [{ evento_id: 5, usuario_id: 20 }] })
  })

  it('listar exclui modalidades excluidas do contador e calcula pendentes', async () => {
    mockPrisma.evento.findMany.mockResolvedValue([
      { id: 1, competicao: { modalidades: [
        { id: 10, nome: 'Atletismo Feminino', mensagens_inscritos: [], tipo_modalidade: { tipo: 'grupos' } },
        { id: 11, nome: 'Basquete Masculino', mensagens_inscritos: [], tipo_modalidade: { tipo: 'grupos' } },
        { id: 12, nome: 'Volei Feminino', mensagens_inscritos: [], tipo_modalidade: { tipo: 'grupos' } },
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

  it('listar conta modalidades_distintas por esporte (1a palavra), ignorando excluidas', async () => {
    mockPrisma.evento.findMany.mockResolvedValue([
      { id: 1, competicao: { modalidades: [
        { id: 10, nome: 'Atletismo Feminino Cat. A', mensagens_inscritos: [], tipo_modalidade: { tipo: 'grupos' } },
        { id: 11, nome: 'Atletismo Masculino Cat. B', mensagens_inscritos: [], tipo_modalidade: { tipo: 'grupos' } },
        { id: 12, nome: 'Basquete 3x3 Feminino Cat. A', mensagens_inscritos: [], tipo_modalidade: { tipo: 'grupos' } },
        { id: 13, nome: 'Bocha Rafa Masculino ou Misto', mensagens_inscritos: [], tipo_modalidade: { tipo: 'grupos' } },
      ] } },
    ])
    mockPrisma.inscricao.groupBy.mockResolvedValue([])
    mockPrisma.sorteio.findMany.mockResolvedValue([])
    mockPrisma.eventoModalidadeExcluida.findMany.mockResolvedValue([
      { evento_id: 1, modalidade_id: 13 },
    ])
    const [e] = await service.listar() as any[]
    expect(e.modalidades_distintas).toBe(2)
  })

  it('listar conta participantes distintos em total_participantes', async () => {
    mockPrisma.evento.findMany.mockResolvedValue([
      { id: 1, competicao: { modalidades: [] }, _count: { inscricoes: 0, sorteios: 0 } },
    ])
    mockPrisma.inscricao.groupBy.mockResolvedValue([]) // counts por modalidade
    mockPrisma.inscricao.findMany.mockResolvedValue([
      { evento_id: 1 }, { evento_id: 1 }, { evento_id: 1 },
    ]) // 3 pares (evento, participante) distintos
    mockPrisma.sorteio.findMany.mockResolvedValue([])
    mockPrisma.eventoModalidadeExcluida.findMany.mockResolvedValue([])

    const [e] = await service.listar() as any[]
    expect(e.total_participantes).toBe(3)
  })
})
