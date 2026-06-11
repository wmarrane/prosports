import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    evento: { findUnique: vi.fn() },
    modalidade: { findMany: vi.fn() },
    inscricao: { findMany: vi.fn() },
    sorteio: { findMany: vi.fn() },
    eventoModalidadeExcluida: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
  },
}))

import prisma from '../../lib/prisma'
import * as service from './modalidades-excluidas.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('getExcluidas', () => {
  it('retorna array de modalidade_id excluidos', async () => {
    mockPrisma.eventoModalidadeExcluida.findMany.mockResolvedValue([{ modalidade_id: 3 }, { modalidade_id: 4 }])
    expect(await service.getExcluidas(1)).toEqual([3, 4])
  })
})

describe('setExcluidas', () => {
  beforeEach(() => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 7 })
    mockPrisma.modalidade.findMany.mockResolvedValue([{ id: 2 }, { id: 3 }, { id: 4 }])
    mockPrisma.inscricao.findMany.mockResolvedValue([])
    mockPrisma.sorteio.findMany.mockResolvedValue([])
  })

  it('substitui o conjunto quando nao ha dados', async () => {
    await service.setExcluidas(1, [2, 3])
    expect(mockPrisma.eventoModalidadeExcluida.deleteMany).toHaveBeenCalledWith({ where: { evento_id: 1 } })
    expect(mockPrisma.eventoModalidadeExcluida.createMany).toHaveBeenCalledWith({
      data: [
        { evento_id: 1, modalidade_id: 2 },
        { evento_id: 1, modalidade_id: 3 },
      ],
    })
  })

  it('conjunto vazio limpa todas as exclusoes', async () => {
    await service.setExcluidas(1, [])
    expect(mockPrisma.eventoModalidadeExcluida.deleteMany).toHaveBeenCalledWith({ where: { evento_id: 1 } })
    expect(mockPrisma.eventoModalidadeExcluida.createMany).not.toHaveBeenCalled()
  })

  it('400 quando id nao pertence a competicao', async () => {
    await expect(service.setExcluidas(1, [999])).rejects.toMatchObject({ status: 400 })
    expect(mockPrisma.eventoModalidadeExcluida.deleteMany).not.toHaveBeenCalled()
  })

  it('400 quando modalidade a excluir tem inscritos', async () => {
    mockPrisma.inscricao.findMany.mockResolvedValue([{ modalidade_id: 2 }])
    await expect(service.setExcluidas(1, [2])).rejects.toMatchObject({ status: 400 })
    expect(mockPrisma.eventoModalidadeExcluida.deleteMany).not.toHaveBeenCalled()
  })

  it('400 quando modalidade a excluir tem sorteio', async () => {
    mockPrisma.sorteio.findMany.mockResolvedValue([{ modalidade_id: 3 }])
    await expect(service.setExcluidas(1, [3])).rejects.toMatchObject({ status: 400 })
  })

  it('404 quando evento nao existe', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue(null)
    await expect(service.setExcluidas(1, [2])).rejects.toMatchObject({ status: 404 })
  })
})
