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
    bracketChavesByes: {
      findUnique: vi.fn(),
    },
    bracketChavesMatches: {
      findUnique: vi.fn(),
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
  // Default: valid bracket structure for N=5 (tests that need different N override this)
  mockPrisma.bracketChavesByes.findUnique.mockResolvedValue({ numero_inscrito: 5, posicoes_bye: [] })
  mockPrisma.bracketChavesMatches.findUnique.mockResolvedValue(null)
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

  it('executar chaves lança 400 amigável quando bracket_chaves_byes ausente para N', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 10 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({
      id: 1, competicao_id: 10,
      tipo_modalidade: { tipo: 'chaves' },
    })
    mockPrisma.inscricao.findMany.mockResolvedValue([
      { participante_id: 100 }, { participante_id: 200 },
    ])
    mockPrisma.sistemaDisputasChaves.findFirst.mockResolvedValue({
      numero_inscrito: 2, posicao_primeiro_cabeca: 1,
      posicao_segundo_cabeca: 2, posicao_terceiro_cabeca: 0, posicao_quarto_cabeca: 0,
    })
    mockPrisma.bracketChavesByes.findUnique.mockResolvedValue(null)

    await expect(service.executar({ evento_id: 1, modalidade_id: 1 })).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('estrutura de bracket'),
    })
  })

  it('executar chaves passa matchesGraph quando disponível', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 10 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({
      id: 1, competicao_id: 10,
      tipo_modalidade: { tipo: 'chaves' },
    })
    mockPrisma.inscricao.findMany.mockResolvedValue([
      { participante_id: 100 }, { participante_id: 200 },
    ])
    mockPrisma.sistemaDisputasChaves.findFirst.mockResolvedValue({
      numero_inscrito: 2, posicao_primeiro_cabeca: 1,
      posicao_segundo_cabeca: 2, posicao_terceiro_cabeca: 0, posicao_quarto_cabeca: 0,
    })
    mockPrisma.bracketChavesByes.findUnique.mockResolvedValue({ numero_inscrito: 2, posicoes_bye: [] })
    const fakeGraph = {
      matches: [{ id: 'J1', round: 1, top: 'P1', bottom: 'P2' }],
      final: 'J1', thirdPlace: null,
    }
    mockPrisma.bracketChavesMatches.findUnique.mockResolvedValue({
      numero_inscrito: 2, matches_graph: fakeGraph,
    })
    mockPrisma.sorteio.upsert.mockResolvedValue({ id: 99 })

    await service.executar({ evento_id: 1, modalidade_id: 1 })

    expect(mockPrisma.sorteio.upsert).toHaveBeenCalled()
    const callArg = mockPrisma.sorteio.upsert.mock.calls[0][0]
    expect(callArg.create.resultado.matchesGraph).toEqual(fakeGraph)
  })
})

describe('applyAnfitriaoRule', () => {
  const base = {
    consideraAnfitriao: true,
    anfitriaoInscrito: true,
    tipo: 'grupos' as const,
  }

  it('retorna lista intacta quando consideraAnfitriao=false', () => {
    const out = service.applyAnfitriaoRule({
      ...base, consideraAnfitriao: false,
      campeoesPidsInscritos: [10, 20, 30], anfitriaoPid: 99, quantidadeGrupos: 4,
    })
    expect(out).toEqual([10, 20, 30])
  })

  it('retorna lista intacta quando anfitriao nulo', () => {
    const out = service.applyAnfitriaoRule({
      ...base, campeoesPidsInscritos: [10, 20], anfitriaoPid: null, quantidadeGrupos: 4,
    })
    expect(out).toEqual([10, 20])
  })

  it('retorna lista intacta quando anfitriao nao esta inscrito', () => {
    const out = service.applyAnfitriaoRule({
      ...base, anfitriaoInscrito: false,
      campeoesPidsInscritos: [10, 20], anfitriaoPid: 99, quantidadeGrupos: 4,
    })
    expect(out).toEqual([10, 20])
  })

  it('grupos == 4: anfitriao ja na 1a posicao -> move pra 4a (anfitriao tem prioridade)', () => {
    const out = service.applyAnfitriaoRule({
      ...base, campeoesPidsInscritos: [99, 10, 20, 30], anfitriaoPid: 99, quantidadeGrupos: 4,
    })
    // 99 era cabeca 1; com a regra, vai pra pos 4 (grupo D) deslocando os demais
    expect(out).toEqual([10, 20, 30, 99])
  })

  it('grupos == 4: anfitriao ja na 4a posicao -> permanece na 4a', () => {
    const out = service.applyAnfitriaoRule({
      ...base, campeoesPidsInscritos: [10, 20, 30, 99], anfitriaoPid: 99, quantidadeGrupos: 4,
    })
    expect(out).toEqual([10, 20, 30, 99])
  })

  it('grupos == 3: anfitriao campeao na 1a -> move pra 3a (grupo C)', () => {
    // Cenario do bug: Basquete 3x3 Feminino Livre em Campinas. Anfitriao era
    // tambem um dos campeoes anteriores e estava sendo seedado em A em vez de C.
    const out = service.applyAnfitriaoRule({
      ...base, campeoesPidsInscritos: [99, 10, 20], anfitriaoPid: 99, quantidadeGrupos: 3,
    })
    expect(out).toEqual([10, 20, 99])
  })

  it('grupos == 3: anfitriao nao campeao -> entra na 3a (grupo C)', () => {
    // Cenario do bug do usuario: anfitriao inscrito mas nao era campeao.
    const out = service.applyAnfitriaoRule({
      ...base, campeoesPidsInscritos: [10, 20], anfitriaoPid: 99, quantidadeGrupos: 3,
    })
    expect(out).toEqual([10, 20, 99])
  })

  it('grupos com < 3 grupos: regra nao se aplica', () => {
    const out = service.applyAnfitriaoRule({
      ...base, campeoesPidsInscritos: [10, 20], anfitriaoPid: 99, quantidadeGrupos: 2,
    })
    expect(out).toEqual([10, 20])
  })

  it('grupos == 3 e anfitriao na pos 5 -> vira cabeca do grupo C (pos 3)', () => {
    const out = service.applyAnfitriaoRule({
      ...base, campeoesPidsInscritos: [10, 20, 30, 40, 99], anfitriaoPid: 99, quantidadeGrupos: 3,
    })
    expect(out).toEqual([10, 20, 99, 30, 40])
  })

  it('grupos == 3 e anfitriao sem posicao previa -> vira cabeca pos 3', () => {
    const out = service.applyAnfitriaoRule({
      ...base, campeoesPidsInscritos: [10, 20, 30], anfitriaoPid: 99, quantidadeGrupos: 3,
    })
    expect(out).toEqual([10, 20, 99, 30])
  })

  it('grupos == 4 e anfitriao sem posicao -> vira cabeca pos 4 (grupo D)', () => {
    const out = service.applyAnfitriaoRule({
      ...base, campeoesPidsInscritos: [10, 20, 30], anfitriaoPid: 99, quantidadeGrupos: 4,
    })
    expect(out).toEqual([10, 20, 30, 99])
  })

  it('grupos == 5 e anfitriao na pos 7 -> vira cabeca pos 4', () => {
    const out = service.applyAnfitriaoRule({
      ...base, campeoesPidsInscritos: [10, 20, 30, 40, 50, 60, 99], anfitriaoPid: 99, quantidadeGrupos: 5,
    })
    expect(out).toEqual([10, 20, 30, 99, 40, 50, 60])
  })

  it('chaves: anfitriao na pos 5 -> vira 4o cabeca (deslocando antigo 4o)', () => {
    const out = service.applyAnfitriaoRule({
      ...base, tipo: 'chaves',
      campeoesPidsInscritos: [10, 20, 30, 40, 99], anfitriaoPid: 99,
    })
    expect(out).toEqual([10, 20, 30, 99, 40])
  })

  it('chaves: anfitriao sem posicao -> vira 4o cabeca', () => {
    const out = service.applyAnfitriaoRule({
      ...base, tipo: 'chaves',
      campeoesPidsInscritos: [10, 20, 30], anfitriaoPid: 99,
    })
    expect(out).toEqual([10, 20, 30, 99])
  })

  it('chaves: anfitriao na 2a posicao -> move pra 4a cabeca (anfitriao tem prioridade)', () => {
    const out = service.applyAnfitriaoRule({
      ...base, tipo: 'chaves',
      campeoesPidsInscritos: [10, 99, 30, 40], anfitriaoPid: 99,
    })
    // 99 era 2a cabeca; com a regra vira 4a, deslocando 30 e 40 pra cima
    expect(out).toEqual([10, 30, 40, 99])
  })

  it('chaves: anfitriao ja na 4a posicao -> permanece na 4a', () => {
    const out = service.applyAnfitriaoRule({
      ...base, tipo: 'chaves',
      campeoesPidsInscritos: [10, 20, 30, 99], anfitriaoPid: 99,
    })
    expect(out).toEqual([10, 20, 30, 99])
  })
})
