import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    delegacao: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('../../lib/upload', () => ({ deleteFile: vi.fn() }))

import prisma from '../../lib/prisma'
import { deleteFile } from '../../lib/upload'
import * as service from './delegacoes.service'

const mockPrisma = prisma as any

beforeEach(() => vi.clearAllMocks())

describe('delegacoes.service', () => {
  it('listar retorna lista ordenada', async () => {
    mockPrisma.delegacao.findMany.mockResolvedValue([{ id: 1, nome: 'SP' }])
    const result = await service.listar()
    expect(result).toEqual([{ id: 1, nome: 'SP' }])
    expect(mockPrisma.delegacao.findMany).toHaveBeenCalledWith({ orderBy: { nome: 'asc' } })
  })

  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.delegacao.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('criar chama prisma.create com dados corretos', async () => {
    const data = { nome: 'SP', municipio: 'São Paulo', estado: 'SP' }
    mockPrisma.delegacao.create.mockResolvedValue({ id: 1, ...data })
    await service.criar(data)
    expect(mockPrisma.delegacao.create).toHaveBeenCalledWith({ data })
  })

  it('remover deleta arquivo de logo se existir', async () => {
    mockPrisma.delegacao.findUnique.mockResolvedValue({ id: 1, nome: 'SP', logo_path: 'abc.jpg' })
    mockPrisma.delegacao.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(deleteFile).toHaveBeenCalledWith('delegacoes', 'abc.jpg')
  })
})
