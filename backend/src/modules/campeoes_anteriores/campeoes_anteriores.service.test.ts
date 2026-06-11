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
    municipio: { findMany: vi.fn() },
    participante: { findMany: vi.fn() },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './campeoes_anteriores.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

const INCLUDE = { participante: { include: { municipio: true, inspetoria: true, delegacia: true } } }

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
    const data = { evento_id: 1, modalidade_id: 2, participante_id: 3, posicao: 1 }
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

describe('campeoes importar', () => {
  beforeEach(() => {
    mockPrisma.evento.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.municipio.findMany.mockResolvedValue([{ id: 7, nome: 'São Paulo', uf: 'SP' }])
    mockPrisma.participante.findMany.mockResolvedValue([{ id: 99, nome: 'João', municipio_id: 7 }])
    mockPrisma.campeaoAnterior.findMany.mockResolvedValue([])
    mockPrisma.campeaoAnterior.create.mockResolvedValue({})
  })

  it('cria campeão válido', async () => {
    const res = await service.importar({
      evento_id: 5, modalidade_id: 2, dry_run: false,
      rows: [{ posicao: 1, nome: 'João', municipio_uf: 'SP', municipio_nome: 'São Paulo' }],
    })
    expect(res.contadores.criadas).toBe(1)
    expect(mockPrisma.campeaoAnterior.create).toHaveBeenCalledTimes(1)
  })

  it('pula posição já ocupada (duplicada)', async () => {
    mockPrisma.campeaoAnterior.findMany.mockResolvedValue([{ posicao: 1 }])
    const res = await service.importar({
      evento_id: 5, modalidade_id: 2, dry_run: false,
      rows: [{ posicao: 1, nome: 'João', municipio_uf: 'SP', municipio_nome: 'São Paulo' }],
    })
    expect(res.contadores.duplicadas).toBe(1)
    expect(res.contadores.criadas).toBe(0)
    expect(mockPrisma.campeaoAnterior.create).not.toHaveBeenCalled()
  })

  it('participante não cadastrado vira erro', async () => {
    const res = await service.importar({
      evento_id: 5, modalidade_id: 2, dry_run: false,
      rows: [{ posicao: 2, nome: 'Maria', municipio_uf: 'SP', municipio_nome: 'São Paulo' }],
    })
    expect(res.contadores.erros).toBe(1)
    expect(res.rows[0].erro).toContain('não cadastrado')
  })
})
