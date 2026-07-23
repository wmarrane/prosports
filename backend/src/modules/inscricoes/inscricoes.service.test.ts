import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    inscricao: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    sorteio: {
      findFirst: vi.fn(),
    },
    evento: {
      findUnique: vi.fn(),
    },
    modalidade: {
      findUnique: vi.fn(),
    },
    competicao: {
      findUnique: vi.fn(),
    },
    municipio: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
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

const INCLUDE = { participante: { include: { municipio: true, inspetoria: true, delegacia: true } }, municipio: true }

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

  it('criar com subtitulo e municipio_id válidos persiste overrides e retorna municipio', async () => {
    const municipio = { id: 42, nome: 'Campinas', uf: 'SP' }
    mockPrisma.evento.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.municipio.findUnique.mockResolvedValue(municipio)
    const created = { id: 10, evento_id: 1, modalidade_id: 1, participante_id: 1, subtitulo: 'Sub A', municipio_id: 42, municipio }
    mockPrisma.inscricao.create.mockResolvedValue(created)
    mockPrisma.inscricao.findUnique.mockResolvedValue(created)
    mockPrisma.inscricao.findMany.mockResolvedValue([created])

    const data = { evento_id: 1, modalidade_id: 1, participante_id: 1, subtitulo: 'Sub A', municipio_id: 42 }
    const result = await service.criar(data)
    expect(mockPrisma.municipio.findUnique).toHaveBeenCalledWith({ where: { id: 42 } })
    expect(mockPrisma.inscricao.create).toHaveBeenCalledWith({
      data: { evento_id: 1, modalidade_id: 1, participante_id: 1, subtitulo: 'Sub A', municipio_id: 42 },
      include: INCLUDE,
    })
    expect(result.subtitulo).toBe('Sub A')
    expect(result.municipio).toEqual(municipio)

    const byId = await service.buscarPorId(10)
    expect(byId.subtitulo).toBe('Sub A')
    expect(byId.municipio).toEqual(municipio)

    const list = await service.listar({ evento_id: 1 })
    expect(list[0].subtitulo).toBe('Sub A')
    expect(list[0].municipio).toEqual(municipio)
  })

  it('criar com municipio_id inválido lança 400', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.municipio.findUnique.mockResolvedValue(null)
    await expect(service.criar({ evento_id: 1, modalidade_id: 1, participante_id: 1, municipio_id: 999 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('Município') })
    expect(mockPrisma.inscricao.create).not.toHaveBeenCalled()
  })

  describe('editar', () => {
    it('editar atualiza subtitulo e municipio_id e retorna overrides com municipio incluído', async () => {
      const municipio = { id: 42, nome: 'Campinas', uf: 'SP' }
      mockPrisma.municipio.findUnique.mockResolvedValue(municipio)
      const updated = { id: 5, subtitulo: 'Sub B', municipio_id: 42, municipio }
      mockPrisma.inscricao.update.mockResolvedValue(updated)

      const result = await service.editar(5, { subtitulo: 'Sub B', municipio_id: 42 })
      expect(mockPrisma.municipio.findUnique).toHaveBeenCalledWith({ where: { id: 42 }, select: { id: true } })
      expect(mockPrisma.inscricao.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { subtitulo: 'Sub B', municipio_id: 42 },
        include: INCLUDE,
      })
      expect(result.subtitulo).toBe('Sub B')
      expect(result.municipio).toEqual(municipio)
    })

    it('editar com municipio_id inválido lança 400', async () => {
      mockPrisma.municipio.findUnique.mockResolvedValue(null)
      await expect(service.editar(5, { municipio_id: 999 }))
        .rejects.toMatchObject({ status: 400, message: expect.stringContaining('Município') })
      expect(mockPrisma.inscricao.update).not.toHaveBeenCalled()
    })

    it('editar com apenas subtitulo só inclui subtitulo no patch', async () => {
      const updated = { id: 5, subtitulo: 'Só Título', municipio_id: null, municipio: null }
      mockPrisma.inscricao.update.mockResolvedValue(updated)

      await service.editar(5, { subtitulo: 'Só Título' })
      expect(mockPrisma.municipio.findUnique).not.toHaveBeenCalled()
      expect(mockPrisma.inscricao.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { subtitulo: 'Só Título' },
        include: INCLUDE,
      })
    })

    it('editar com municipio_id null (limpar) inclui campo sem validar', async () => {
      const updated = { id: 5, subtitulo: null, municipio_id: null, municipio: null }
      mockPrisma.inscricao.update.mockResolvedValue(updated)

      await service.editar(5, { municipio_id: null })
      expect(mockPrisma.municipio.findUnique).not.toHaveBeenCalled()
      expect(mockPrisma.inscricao.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { municipio_id: null },
        include: INCLUDE,
      })
    })
  })

  it('remover deleta direto', async () => {
    mockPrisma.inscricao.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.inscricao.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })

  it('removerTodosDaModalidade bloqueia quando há sorteio', async () => {
    mockPrisma.sorteio.findFirst.mockResolvedValue({ id: 1 })
    await expect(service.removerTodosDaModalidade(5, 2)).rejects.toMatchObject({ status: 400 })
    expect(mockPrisma.inscricao.deleteMany).not.toHaveBeenCalled()
  })

  it('removerTodosDaModalidade deleta quando não há sorteio', async () => {
    mockPrisma.sorteio.findFirst.mockResolvedValue(null)
    mockPrisma.inscricao.deleteMany.mockResolvedValue({ count: 4 })
    const r = await service.removerTodosDaModalidade(5, 2)
    expect(r).toEqual({ count: 4 })
    expect(mockPrisma.inscricao.deleteMany).toHaveBeenCalledWith({ where: { evento_id: 5, modalidade_id: 2 } })
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
      expect(result.contadores).toEqual({ criadas: 0, duplicadas: 0, erros: 1, nao_cadastrados: 0 })
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
      expect(result.contadores).toEqual({ criadas: 0, duplicadas: 1, erros: 0, nao_cadastrados: 0 })
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
      expect(result.rows[0]).toMatchObject({ status: 'criada' })
      expect(mockPrisma.inscricao.create).toHaveBeenCalledWith({
        data: { evento_id: 1, modalidade_id: 2, participante_id: 500 },
      })
      expect(mockPrisma.participante.create).not.toHaveBeenCalled()
    })

    it('importar NÃO cria participante; não cadastrado vira erro e conta nao_cadastrados', async () => {
      mockPrisma.evento.findUnique.mockResolvedValue({ id: 5, competicao_id: 1 })
      mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 1 })
      mockPrisma.municipio.findMany.mockResolvedValue([{ id: 7, nome: 'São Paulo', uf: 'SP' }])
      mockPrisma.participante.findMany.mockResolvedValue([{ id: 99, nome: 'João', municipio_id: 7 }])
      mockPrisma.inscricao.findMany.mockResolvedValue([])
      mockPrisma.inscricao.create.mockResolvedValue({})

      const res = await service.importar({
        evento_id: 5, modalidade_id: 2, dry_run: false,
        rows: [
          { nome: 'João', municipio_uf: 'SP', municipio_nome: 'São Paulo' },
          { nome: 'Maria', municipio_uf: 'SP', municipio_nome: 'São Paulo' },
        ],
      })
      expect(res.contadores.criadas).toBe(1)
      expect(res.contadores.nao_cadastrados).toBe(1)
      expect(res.contadores.erros).toBe(1)
      expect(mockPrisma.inscricao.create).toHaveBeenCalledTimes(1)
    })

    it('dry_run não chama nenhum create', async () => {
      setupOk()
      mockPrisma.participante.findMany.mockResolvedValue([
        { id: 500, nome: 'Maria', municipio_id: 101 },
        { id: 501, nome: 'João Silva', municipio_id: 100 },
      ])
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
      expect(result.contadores.nao_cadastrados).toBe(0)
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
      expect(result.rows[0]).toMatchObject({ status: 'criada' })
    })

    describe('toggle subtitulo_municipio_por_modalidade (escolar)', () => {
      function setupEscolarOn(extraParticipantes: any[] = []) {
        mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 10 })
        mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 10 })
        mockPrisma.competicao.findUnique.mockResolvedValue({
          id: 10,
          subtitulo_municipio_por_modalidade: true,
          estados: ['SP'],
        })
        mockPrisma.municipio.findMany.mockResolvedValue([
          { id: 100, nome: 'São Paulo', uf: 'SP' },
          { id: 200, nome: 'Campinas', uf: 'SP' },
        ])
        mockPrisma.participante.findMany.mockResolvedValue(extraParticipantes)
        mockPrisma.inscricao.findMany.mockResolvedValue([])
        mockPrisma.inscricao.create.mockResolvedValue({ id: 999 })
        mockPrisma.participante.create.mockResolvedValue({ id: 888, nome: 'SREL Novo', municipio_id: 200 })
      }

      it('escolar: participante NOVO → cria participante e inscrição com overrides', async () => {
        setupEscolarOn([]) // nenhum participante existente
        const result = await service.importar({
          evento_id: 1,
          modalidade_id: 2,
          dry_run: false,
          rows: [
            {
              nome: 'SREL Novo',
              municipio_nome: 'Campinas',
              subtitulo: 'Escola A',
            },
          ],
        })
        expect(result.rows[0]).toMatchObject({ status: 'criada' })
        expect(mockPrisma.participante.create).toHaveBeenCalledWith({
          data: { nome: 'SREL Novo', municipio_id: 200 },
        })
        expect(mockPrisma.inscricao.create).toHaveBeenCalledWith({
          data: {
            evento_id: 1,
            modalidade_id: 2,
            participante_id: 888,
            subtitulo: 'Escola A',
            municipio_id: 200,
          },
        })
      })

      it('escolar: participante EXISTENTE → não cria participante; cria inscrição com overrides', async () => {
        setupEscolarOn([{ id: 500, nome: 'SREL Existente' }])
        const result = await service.importar({
          evento_id: 1,
          modalidade_id: 2,
          dry_run: false,
          rows: [
            {
              nome: 'SREL Existente',
              municipio_nome: 'São Paulo',
              subtitulo: 'Escola B',
            },
          ],
        })
        expect(result.rows[0]).toMatchObject({ status: 'criada' })
        expect(mockPrisma.participante.create).not.toHaveBeenCalled()
        expect(mockPrisma.inscricao.create).toHaveBeenCalledWith({
          data: {
            evento_id: 1,
            modalidade_id: 2,
            participante_id: 500,
            subtitulo: 'Escola B',
            municipio_id: 100,
          },
        })
      })

      it('escolar: município não encontrado nos estados → erro, sem criar', async () => {
        setupEscolarOn([{ id: 500, nome: 'SREL Existente' }])
        const result = await service.importar({
          evento_id: 1,
          modalidade_id: 2,
          dry_run: false,
          rows: [
            {
              nome: 'SREL Existente',
              municipio_nome: 'Cidade Inexistente',
            },
          ],
        })
        expect(result.rows[0]).toMatchObject({
          status: 'erro',
          erro: expect.stringContaining('Município'),
        })
        expect(mockPrisma.participante.create).not.toHaveBeenCalled()
        expect(mockPrisma.inscricao.create).not.toHaveBeenCalled()
      })

      it('toggle OFF: caminho atual inalterado (usa municipio_uf/nome, não cria participante)', async () => {
        mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 10 })
        mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 10 })
        mockPrisma.competicao.findUnique.mockResolvedValue({
          id: 10,
          subtitulo_municipio_por_modalidade: false,
          estados: ['SP'],
        })
        mockPrisma.municipio.findMany.mockResolvedValue([
          { id: 100, nome: 'São Paulo', uf: 'SP' },
        ])
        mockPrisma.participante.findMany.mockResolvedValue([
          { id: 500, nome: 'João Silva', municipio_id: 100 },
        ])
        mockPrisma.inscricao.findMany.mockResolvedValue([])
        mockPrisma.inscricao.create.mockResolvedValue({ id: 999 })

        const result = await service.importar({
          evento_id: 1,
          modalidade_id: 2,
          dry_run: false,
          rows: [
            {
              nome: 'João Silva',
              municipio_uf: 'SP',
              municipio_nome: 'São Paulo',
              subtitulo: 'Equipe A',
            },
          ],
        })
        expect(result.rows[0]).toMatchObject({ status: 'criada' })
        expect(mockPrisma.participante.create).not.toHaveBeenCalled()
        expect(mockPrisma.inscricao.create).toHaveBeenCalledWith({
          data: { evento_id: 1, modalidade_id: 2, participante_id: 500 },
        })
      })
    })
  })
})
