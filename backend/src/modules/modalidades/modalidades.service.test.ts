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
    tipoModalidade: {
      findUnique: vi.fn(),
    },
    sorteio: {
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    inscricao: {
      count: vi.fn(),
    },
    campeaoAnterior: {
      count: vi.fn(),
    },
    $transaction: vi.fn(),
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

  it('criar repassa chave_versao para prisma.create', async () => {
    const data = { nome: 'Judo', sigla: 'JUD', competicao_id: 1, tipo_modalidade_id: 2, chave_versao: 'V2' }
    mockPrisma.modalidade.create.mockResolvedValue({ id: 1, ...data })
    await service.criar(data)
    expect(mockPrisma.modalidade.create).toHaveBeenCalledWith({ data, include: INCLUDE })
  })

  it('criar repassa mensagens_inscritos para prisma.create', async () => {
    const regras = [{ min: 2, max: 2, mensagem: 'Final direta', pular_sorteio: true }]
    const data = { nome: 'Judo', sigla: 'JUD', competicao_id: 1, tipo_modalidade_id: 2, mensagens_inscritos: regras }
    mockPrisma.modalidade.create.mockResolvedValue({ id: 1, ...data })
    await service.criar(data)
    expect(mockPrisma.modalidade.create).toHaveBeenCalledWith({ data, include: INCLUDE })
  })

  it('editar repassa mensagens_inscritos para prisma.update', async () => {
    const regras = [{ min: 1, max: null, mensagem: 'Sem disputa', pular_sorteio: true }]
    mockPrisma.modalidade.update.mockResolvedValue({ id: 1 })
    await service.editar(1, { mensagens_inscritos: regras })
    expect(mockPrisma.modalidade.update).toHaveBeenCalledWith({
      where: { id: 1 }, data: { mensagens_inscritos: regras }, include: INCLUDE,
    })
  })

  it('editar repassa chave_versao para prisma.update', async () => {
    mockPrisma.modalidade.update.mockResolvedValue({ id: 1 })
    await service.editar(1, { chave_versao: 'V1' })
    expect(mockPrisma.modalidade.update).toHaveBeenCalledWith({
      where: { id: 1 }, data: { chave_versao: 'V1' }, include: INCLUDE,
    })
  })

  it('criar mapeia P2002 para 409', async () => {
    mockPrisma.modalidade.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))
    await expect(
      service.criar({ nome: 'X', sigla: 'X', competicao_id: 1, tipo_modalidade_id: 1 })
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining('Já existe') })
  })

  it('editar sem mudar tipo_modalidade_id apenas atualiza', async () => {
    mockPrisma.modalidade.update.mockResolvedValue({ id: 1 })
    await service.editar(1, { nome: 'Renomeada' })
    expect(mockPrisma.modalidade.update).toHaveBeenCalledWith({
      where: { id: 1 }, data: { nome: 'Renomeada' }, include: INCLUDE,
    })
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(mockPrisma.sorteio.deleteMany).not.toHaveBeenCalled()
  })

  it('editar com tipo_modalidade_id que mantém o mesmo tipo NÃO apaga sorteios', async () => {
    mockPrisma.modalidade.findUnique.mockResolvedValue({ tipo_modalidade: { tipo: 'grupos' } })
    mockPrisma.tipoModalidade.findUnique.mockResolvedValue({ tipo: 'grupos' })
    mockPrisma.modalidade.update.mockResolvedValue({ id: 1 })

    await service.editar(1, { tipo_modalidade_id: 99 })

    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(mockPrisma.sorteio.deleteMany).not.toHaveBeenCalled()
    expect(mockPrisma.modalidade.update).toHaveBeenCalledWith({
      where: { id: 1 }, data: { tipo_modalidade_id: 99 }, include: INCLUDE,
    })
  })

  it('editar com tipo_modalidade_id que MUDA o tipo apaga sorteios na transação', async () => {
    mockPrisma.modalidade.findUnique.mockResolvedValue({ tipo_modalidade: { tipo: 'grupos' } })
    mockPrisma.tipoModalidade.findUnique.mockResolvedValue({ tipo: 'chaves' })
    const txMock = {
      sorteio: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
      modalidade: { update: vi.fn().mockResolvedValue({ id: 1 }) },
    }
    mockPrisma.$transaction.mockImplementation((fn: any) => fn(txMock))

    await service.editar(1, { tipo_modalidade_id: 42 })

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    expect(txMock.sorteio.deleteMany).toHaveBeenCalledWith({ where: { modalidade_id: 1 } })
    expect(txMock.modalidade.update).toHaveBeenCalledWith({
      where: { id: 1 }, data: { tipo_modalidade_id: 42 }, include: INCLUDE,
    })
  })

  it('editar com tipo_modalidade_id inexistente lança 400', async () => {
    mockPrisma.modalidade.findUnique.mockResolvedValue({ tipo_modalidade: { tipo: 'grupos' } })
    mockPrisma.tipoModalidade.findUnique.mockResolvedValue(null)
    await expect(service.editar(1, { tipo_modalidade_id: 999 })).rejects.toMatchObject({ status: 400 })
  })

  it('editar com id de modalidade inexistente lança 404 (quando muda tipo_modalidade_id)', async () => {
    mockPrisma.modalidade.findUnique.mockResolvedValue(null)
    await expect(service.editar(999, { tipo_modalidade_id: 1 })).rejects.toMatchObject({ status: 404 })
  })

  it('editar também mapeia P2002 para 409', async () => {
    mockPrisma.modalidade.update.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))
    await expect(
      service.editar(1, { sigla: 'DUP' })
    ).rejects.toMatchObject({ status: 409 })
  })

  it('remover deleta quando nao ha dependentes', async () => {
    mockPrisma.inscricao.count.mockResolvedValue(0)
    mockPrisma.sorteio.count.mockResolvedValue(0)
    mockPrisma.campeaoAnterior.count.mockResolvedValue(0)
    mockPrisma.modalidade.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.modalidade.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })

  it('remover lanca 409 com mensagem detalhada quando ha inscricoes', async () => {
    mockPrisma.inscricao.count.mockResolvedValue(3)
    mockPrisma.sorteio.count.mockResolvedValue(0)
    mockPrisma.campeaoAnterior.count.mockResolvedValue(0)
    await expect(service.remover(1)).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining('3 inscrições'),
    })
    expect(mockPrisma.modalidade.delete).not.toHaveBeenCalled()
  })

  it('remover lanca 409 listando inscricoes + sorteios + campeoes', async () => {
    mockPrisma.inscricao.count.mockResolvedValue(1)
    mockPrisma.sorteio.count.mockResolvedValue(1)
    mockPrisma.campeaoAnterior.count.mockResolvedValue(2)
    await expect(service.remover(1)).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/1 inscrição.*1 sorteio.*2 campeões anteriores/),
    })
  })

  it('replicarMensagens aplica só nos destinos de mesmo tipo e retorna contagem', async () => {
    mockPrisma.modalidade.findUnique.mockResolvedValue({ tipo_modalidade: { tipo: 'grupos' } })
    mockPrisma.modalidade.findMany.mockResolvedValue([
      { id: 2, tipo_modalidade: { tipo: 'grupos' } },
      { id: 3, tipo_modalidade: { tipo: 'chaves' } },
      { id: 1, tipo_modalidade: { tipo: 'grupos' } },
    ])
    mockPrisma.modalidade.update.mockReturnValue('upd' as any)
    mockPrisma.$transaction.mockResolvedValue([])
    const msgs = [{ min: 2, max: 2, mensagem: 'x', pular_sorteio: true }]
    const r = await service.replicarMensagens(1, [2, 3, 1], msgs)
    expect(r).toEqual({ replicadas: 1 })
    expect(mockPrisma.modalidade.update).toHaveBeenCalledTimes(1)
    expect(mockPrisma.modalidade.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { mensagens_inscritos: msgs } })
  })

  it('replicarMensagens lança 404 se origem não existe', async () => {
    mockPrisma.modalidade.findUnique.mockResolvedValue(null)
    await expect(service.replicarMensagens(99, [2], [])).rejects.toMatchObject({ status: 404 })
  })
})
