import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    participante: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './participantes.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

const INCLUDE = { inspetoria: true, delegacia: true, municipio: true }

describe('participantes.service', () => {
  it('listar inclui inspetoria, delegacia e município', async () => {
    mockPrisma.participante.findMany.mockResolvedValue([])
    await service.listar()
    expect(mockPrisma.participante.findMany).toHaveBeenCalledWith({
      orderBy: { nome: 'asc' },
      include: INCLUDE,
    })
  })

  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.participante.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('criar chama prisma.create com todos os campos e include', async () => {
    const data = {
      nome: 'João',
      subtitulo: 'Vice-Presidente',
      inspetoria_id: 5,
      delegacia_id: 7,
      municipio_id: 42,
    }
    mockPrisma.participante.create.mockResolvedValue({ id: 1, ...data })
    await service.criar(data)
    expect(mockPrisma.participante.create).toHaveBeenCalledWith({ data, include: INCLUDE })
  })

  it('criar aceita opcionais ausentes', async () => {
    const data = { nome: 'Ana', municipio_id: 42 }
    mockPrisma.participante.create.mockResolvedValue({ id: 1, ...data })
    await service.criar(data)
    expect(mockPrisma.participante.create).toHaveBeenCalledWith({ data, include: INCLUDE })
  })

  it('editar chama prisma.update com include', async () => {
    mockPrisma.participante.update.mockResolvedValue({ id: 1 })
    await service.editar(1, { nome: 'Maria' })
    expect(mockPrisma.participante.update).toHaveBeenCalledWith({
      where: { id: 1 }, data: { nome: 'Maria' }, include: INCLUDE,
    })
  })

  it('editar aceita null para inspetoria_id e delegacia_id', async () => {
    mockPrisma.participante.update.mockResolvedValue({ id: 1 })
    await service.editar(1, { inspetoria_id: null, delegacia_id: null })
    expect(mockPrisma.participante.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { inspetoria_id: null, delegacia_id: null },
      include: INCLUDE,
    })
  })

  it('remover deleta direto', async () => {
    mockPrisma.participante.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.participante.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
