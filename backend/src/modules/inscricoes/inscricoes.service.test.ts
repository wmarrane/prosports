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
    municipio: {
      findMany: vi.fn(),
    },
    participante: {
      findMany: vi.fn(),
      create: vi.fn(),
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

  describe('importar', () => {
    const baseInput = (overrides: any = {}) => ({
      evento_id: 1,
      modalidade_id: 2,
      dry_run: false,
      rows: [],
      ...overrides,
    })

    function setupOk() {
      mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 10 })
      mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 10 })
      mockPrisma.municipio.findMany.mockResolvedValue([
        { id: 100, nome: 'São Paulo', uf: 'SP' },
        { id: 101, nome: 'Rio de Janeiro', uf: 'RJ' },
      ])
      mockPrisma.participante.findMany.mockResolvedValue([])
      mockPrisma.inscricao.findMany.mockResolvedValue([])
    }

    it('lança 404 se evento não existe', async () => {
      mockPrisma.evento.findUnique.mockResolvedValue(null)
      mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 10 })
      await expect(service.importar(baseInput({ rows: [{ nome: 'X', municipio_uf: 'SP', municipio_nome: 'São Paulo' }] })))
        .rejects.toMatchObject({ status: 404, message: expect.stringContaining('Evento') })
    })

    it('lança 404 se modalidade não existe', async () => {
      mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 10 })
      mockPrisma.modalidade.findUnique.mockResolvedValue(null)
      await expect(service.importar(baseInput({ rows: [{ nome: 'X', municipio_uf: 'SP', municipio_nome: 'São Paulo' }] })))
        .rejects.toMatchObject({ status: 404, message: expect.stringContaining('Modalidade') })
    })

    it('lança 400 se competições não batem', async () => {
      mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 10 })
      mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 99 })
      await expect(service.importar(baseInput({ rows: [{ nome: 'X', municipio_uf: 'SP', municipio_nome: 'São Paulo' }] })))
        .rejects.toMatchObject({ status: 400, message: expect.stringContaining('competição') })
    })

    it('linha com município inexistente → erro', async () => {
      setupOk()
      const result = await service.importar(baseInput({
        rows: [{ nome: 'João', municipio_uf: 'SP', municipio_nome: 'Cidade Inexistente' }],
      }))
      expect(result.rows[0]).toMatchObject({ linha: 1, status: 'erro', erro: expect.stringContaining('Município') })
      expect(result.contadores).toEqual({ criadas: 0, duplicadas: 0, erros: 1, participantes_criados: 0 })
      expect(mockPrisma.inscricao.create).not.toHaveBeenCalled()
      expect(mockPrisma.participante.create).not.toHaveBeenCalled()
    })

    it('participante existente já inscrito → duplicada', async () => {
      setupOk()
      mockPrisma.participante.findMany.mockResolvedValue([
        { id: 500, nome: 'joão', municipio_id: 100 },
      ])
      mockPrisma.inscricao.findMany.mockResolvedValue([{ participante_id: 500 }])
      const result = await service.importar(baseInput({
        rows: [{ nome: 'João', municipio_uf: 'SP', municipio_nome: 'são paulo' }],
      }))
      expect(result.rows[0]).toMatchObject({ status: 'duplicada' })
      expect(result.contadores).toEqual({ criadas: 0, duplicadas: 1, erros: 0, participantes_criados: 0 })
      expect(mockPrisma.inscricao.create).not.toHaveBeenCalled()
      expect(mockPrisma.participante.create).not.toHaveBeenCalled()
    })

    it('participante existente NÃO inscrito → criada (sem criar participante)', async () => {
      setupOk()
      mockPrisma.participante.findMany.mockResolvedValue([
        { id: 500, nome: 'João Silva', municipio_id: 100 },
      ])
      mockPrisma.inscricao.findMany.mockResolvedValue([])
      mockPrisma.inscricao.create.mockResolvedValue({ id: 999 })
      const result = await service.importar(baseInput({
        rows: [{ nome: 'João Silva', municipio_uf: 'SP', municipio_nome: 'São Paulo' }],
      }))
      expect(result.rows[0]).toMatchObject({ status: 'criada', participante_criado: false })
      expect(mockPrisma.inscricao.create).toHaveBeenCalledWith({
        data: { evento_id: 1, modalidade_id: 2, participante_id: 500 },
      })
      expect(mockPrisma.participante.create).not.toHaveBeenCalled()
    })

    it('participante novo → criada (criando participante)', async () => {
      setupOk()
      mockPrisma.participante.create.mockResolvedValue({ id: 777 })
      mockPrisma.inscricao.create.mockResolvedValue({ id: 998 })
      const result = await service.importar(baseInput({
        rows: [{ nome: 'Maria', municipio_uf: 'RJ', municipio_nome: 'Rio de Janeiro', subtitulo: 'Atleta B' }],
      }))
      expect(result.rows[0]).toMatchObject({ status: 'criada', participante_criado: true })
      expect(mockPrisma.participante.create).toHaveBeenCalledWith({
        data: { nome: 'Maria', municipio_id: 101, subtitulo: 'Atleta B' },
      })
      expect(mockPrisma.inscricao.create).toHaveBeenCalledWith({
        data: { evento_id: 1, modalidade_id: 2, participante_id: 777 },
      })
      expect(result.contadores).toEqual({ criadas: 1, duplicadas: 0, erros: 0, participantes_criados: 1 })
    })

    it('2 linhas com mesmo participante novo → 1 criada + 1 duplicada (index em memória)', async () => {
      setupOk()
      mockPrisma.participante.create.mockResolvedValue({ id: 777 })
      mockPrisma.inscricao.create.mockResolvedValue({ id: 998 })
      const result = await service.importar(baseInput({
        rows: [
          { nome: 'Maria', municipio_uf: 'RJ', municipio_nome: 'Rio de Janeiro' },
          { nome: 'maria', municipio_uf: 'RJ', municipio_nome: 'Rio de Janeiro' },
        ],
      }))
      expect(result.rows[0]).toMatchObject({ status: 'criada', participante_criado: true })
      expect(result.rows[1]).toMatchObject({ status: 'duplicada' })
      expect(mockPrisma.participante.create).toHaveBeenCalledTimes(1)
      expect(mockPrisma.inscricao.create).toHaveBeenCalledTimes(1)
    })

    it('dry_run não chama nenhum create', async () => {
      setupOk()
      const result = await service.importar(baseInput({
        dry_run: true,
        rows: [
          { nome: 'Maria', municipio_uf: 'RJ', municipio_nome: 'Rio de Janeiro' },
          { nome: 'João Silva', municipio_uf: 'SP', municipio_nome: 'São Paulo' },
        ],
      }))
      expect(mockPrisma.participante.create).not.toHaveBeenCalled()
      expect(mockPrisma.inscricao.create).not.toHaveBeenCalled()
      expect(result.contadores.criadas).toBe(2)
      expect(result.contadores.participantes_criados).toBe(2)
    })

    it('match case-insensitive em participante.nome (evita duplicata por capitalização)', async () => {
      setupOk()
      mockPrisma.participante.findMany.mockResolvedValue([
        { id: 500, nome: 'João Silva', municipio_id: 100 },
      ])
      const result = await service.importar(baseInput({
        dry_run: true,
        rows: [{ nome: 'joão silva', municipio_uf: 'SP', municipio_nome: 'São Paulo' }],
      }))
      expect(result.rows[0]).toMatchObject({ status: 'criada', participante_criado: false })
    })
  })
})
