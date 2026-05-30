import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    sorteio: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
    evento: {
      findUnique: vi.fn(),
    },
    modalidade: {
      findUnique: vi.fn(),
    },
    inscricao: {
      findMany: vi.fn(),
    },
    sistemaDisputasGrupos: {
      findFirst: vi.fn(),
    },
    sistemaDisputasChaves: {
      findFirst: vi.fn(),
    },
    campeaoAnterior: {
      findMany: vi.fn(),
    },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './sorteios.service'

const mockPrisma = prisma as any
beforeEach(() => {
  vi.clearAllMocks()
  // Default: no campeões cadastrados (tests that need campeões override this)
  mockPrisma.campeaoAnterior.findMany.mockResolvedValue([])
})

describe('sorteios.service', () => {
  it('listar com filtros passa where corretamente', async () => {
    mockPrisma.sorteio.findMany.mockResolvedValue([])
    await service.listar({ evento_id: 5, modalidade_id: 2 })
    expect(mockPrisma.sorteio.findMany).toHaveBeenCalledWith({
      where: { evento_id: 5, modalidade_id: 2 },
      orderBy: { gerado_em: 'desc' },
    })
  })

  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.sorteio.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('remover deleta direto', async () => {
    mockPrisma.sorteio.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.sorteio.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })

  it('executar lança 404 se evento não existe', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue(null)
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 1, competicao_id: 1, tipo_modalidade: { tipo: 'chaves' } })
    await expect(service.executar({ evento_id: 1, modalidade_id: 1 }))
      .rejects.toMatchObject({ status: 404, message: expect.stringContaining('Evento') })
  })

  it('executar lança 404 se modalidade não existe', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue(null)
    await expect(service.executar({ evento_id: 1, modalidade_id: 1 }))
      .rejects.toMatchObject({ status: 404, message: expect.stringContaining('Modalidade') })
  })

  it('executar lança 400 se competições não batem', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 1, competicao_id: 2, tipo_modalidade: { tipo: 'chaves' } })
    await expect(service.executar({ evento_id: 1, modalidade_id: 1 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('competição') })
  })

  it('executar lança 400 se tipo === especifico', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 1, competicao_id: 1, tipo_modalidade: { tipo: 'especifico' } })
    await expect(service.executar({ evento_id: 1, modalidade_id: 1 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('específico') })
  })

  it('executar lança 400 se 0 inscritos', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 1, competicao_id: 1, tipo_modalidade: { tipo: 'chaves' } })
    mockPrisma.inscricao.findMany.mockResolvedValue([])
    await expect(service.executar({ evento_id: 1, modalidade_id: 1 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('inscrito') })
  })

  it('executar (grupos) lança 400 amigável se sem regra na tabela', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 1, competicao_id: 1, tipo_modalidade: { tipo: 'grupos' } })
    mockPrisma.inscricao.findMany.mockResolvedValue([
      { participante_id: 1 }, { participante_id: 2 }, { participante_id: 3 },
    ])
    mockPrisma.sistemaDisputasGrupos.findFirst.mockResolvedValue(null)
    await expect(service.executar({ evento_id: 1, modalidade_id: 1 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('3 equipes') })
  })

  it('executar (grupos) faz upsert com resultado quando regra existe', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 1, tipo_modalidade: { tipo: 'grupos' } })
    mockPrisma.inscricao.findMany.mockResolvedValue([
      { participante_id: 11 }, { participante_id: 12 }, { participante_id: 13 },
      { participante_id: 14 }, { participante_id: 15 }, { participante_id: 16 },
    ])
    mockPrisma.sistemaDisputasGrupos.findFirst.mockResolvedValue({
      id: 100, quantidade_grupos: 2, grupos_3_componentes: 2, grupos_4_componentes: 0, numero_classificados: 2,
    })
    mockPrisma.sorteio.upsert.mockImplementation(async (args: any) => ({ id: 1, ...args.create }))
    const result = await service.executar({ evento_id: 1, modalidade_id: 2 })
    expect(mockPrisma.sorteio.upsert).toHaveBeenCalledTimes(1)
    const call = mockPrisma.sorteio.upsert.mock.calls[0][0]
    expect(call.where).toEqual({ evento_id_modalidade_id: { evento_id: 1, modalidade_id: 2 } })
    expect(call.create.tipo).toBe('grupos')
    expect(call.create.evento_id).toBe(1)
    expect(call.create.modalidade_id).toBe(2)
    expect(typeof call.create.seed).toBe('string')
    expect(call.create.seed.length).toBeGreaterThan(0)
    expect(call.create.resultado.regra_id).toBe(100)
    expect(call.create.resultado.grupos).toHaveLength(2)
    expect(result.tipo).toBe('grupos')
  })

  it('executar (chaves) faz upsert com bracket usando regra', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 1, tipo_modalidade: { tipo: 'chaves' } })
    mockPrisma.inscricao.findMany.mockResolvedValue([
      { participante_id: 1 }, { participante_id: 2 }, { participante_id: 3 }, { participante_id: 4 }, { participante_id: 5 },
    ])
    mockPrisma.sistemaDisputasChaves.findFirst.mockResolvedValue({
      id: 4, numero_inscrito: 5, posicao_primeiro_cabeca: 1, posicao_segundo_cabeca: 5, posicao_terceiro_cabeca: 4, posicao_quarto_cabeca: 3,
    })
    mockPrisma.campeaoAnterior.findMany.mockResolvedValue([])
    mockPrisma.sorteio.upsert.mockImplementation(async (args: any) => ({ id: 1, ...args.create }))
    await service.executar({ evento_id: 1, modalidade_id: 2 })
    const call = mockPrisma.sorteio.upsert.mock.calls[0][0]
    expect(call.create.tipo).toBe('chaves')
    expect(call.create.resultado.size).toBe(5)
    expect(call.create.resultado.slots).toHaveLength(5)
  })

  it('executar (ordem_entrada) faz upsert com ordem', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 1, tipo_modalidade: { tipo: 'ordem_entrada' } })
    mockPrisma.inscricao.findMany.mockResolvedValue([
      { participante_id: 1 }, { participante_id: 2 }, { participante_id: 3 },
    ])
    mockPrisma.sorteio.upsert.mockImplementation(async (args: any) => ({ id: 1, ...args.create }))
    await service.executar({ evento_id: 1, modalidade_id: 2 })
    const call = mockPrisma.sorteio.upsert.mock.calls[0][0]
    expect(call.create.tipo).toBe('ordem_entrada')
    expect(call.create.resultado.ordem).toHaveLength(3)
    expect(call.create.resultado.ordem.sort()).toEqual([1,2,3])
  })

  it('executar (chaves) lança 400 amigável se sem regra na tabela sistema_disputas_chaves', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 1, tipo_modalidade: { tipo: 'chaves' } })
    mockPrisma.inscricao.findMany.mockResolvedValue([
      { participante_id: 1 }, { participante_id: 2 },
    ])
    mockPrisma.sistemaDisputasChaves.findFirst.mockResolvedValue(null)
    mockPrisma.campeaoAnterior.findMany.mockResolvedValue([])
    await expect(service.executar({ evento_id: 1, modalidade_id: 2 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('chaveamento') })
  })

  it('executar (grupos) com campeoes inscritos passa pids ordenados ao engine', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 1, tipo_modalidade: { tipo: 'grupos' } })
    mockPrisma.inscricao.findMany.mockResolvedValue([
      { participante_id: 11 }, { participante_id: 12 }, { participante_id: 13 },
      { participante_id: 14 }, { participante_id: 15 }, { participante_id: 16 },
    ])
    mockPrisma.sistemaDisputasGrupos.findFirst.mockResolvedValue({
      id: 100, quantidade_grupos: 2, grupos_3_componentes: 2, grupos_4_componentes: 0, numero_classificados: 2,
    })
    mockPrisma.campeaoAnterior.findMany.mockResolvedValue([
      { participante_id: 11, posicao: 1 },
      { participante_id: 99, posicao: 2 },
      { participante_id: 13, posicao: 3 },
    ])
    mockPrisma.sorteio.upsert.mockImplementation(async (args: any) => ({ id: 1, ...args.create }))
    await service.executar({ evento_id: 1, modalidade_id: 2 })
    const call = mockPrisma.sorteio.upsert.mock.calls[0][0]
    expect(call.create.resultado.grupos[0].participantes[0]).toBe(11)
    expect(call.create.resultado.grupos[1].participantes[0]).toBe(13)
  })

  it('executar (chaves) com campeoes inscritos passa pids ao engine.drawBracket', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 1, tipo_modalidade: { tipo: 'chaves' } })
    mockPrisma.inscricao.findMany.mockResolvedValue([
      { participante_id: 1 }, { participante_id: 2 }, { participante_id: 3 }, { participante_id: 4 }, { participante_id: 5 },
    ])
    mockPrisma.sistemaDisputasChaves.findFirst.mockResolvedValue({
      id: 4, numero_inscrito: 5, posicao_primeiro_cabeca: 1, posicao_segundo_cabeca: 5, posicao_terceiro_cabeca: 4, posicao_quarto_cabeca: 3,
    })
    mockPrisma.campeaoAnterior.findMany.mockResolvedValue([
      { participante_id: 1, posicao: 1 },
      { participante_id: 2, posicao: 2 },
    ])
    mockPrisma.sorteio.upsert.mockImplementation(async (args: any) => ({ id: 1, ...args.create }))
    await service.executar({ evento_id: 1, modalidade_id: 2 })
    const call = mockPrisma.sorteio.upsert.mock.calls[0][0]
    expect(call.create.resultado.slots[0]).toBe(1)
    expect(call.create.resultado.slots[4]).toBe(2)
  })
})
