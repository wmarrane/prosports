import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    eventoModalidadeExcluida: { findMany: vi.fn() },
    evento: { findUnique: vi.fn() },
    modalidade: { findMany: vi.fn() },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './evento-modalidades.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('getModalidadeIdsExcluidas', () => {
  it('retorna Set dos modalidade_id excluidos do evento', async () => {
    mockPrisma.eventoModalidadeExcluida.findMany.mockResolvedValue([
      { modalidade_id: 2 }, { modalidade_id: 5 },
    ])
    const set = await service.getModalidadeIdsExcluidas(10)
    expect(mockPrisma.eventoModalidadeExcluida.findMany).toHaveBeenCalledWith({
      where: { evento_id: 10 },
      select: { modalidade_id: true },
    })
    expect([...set].sort()).toEqual([2, 5])
  })
})

describe('modalidadesDoEvento', () => {
  it('retorna modalidades da competicao menos as excluidas', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 10, competicao_id: 7 })
    mockPrisma.modalidade.findMany.mockResolvedValue([
      { id: 1, nome: 'A' }, { id: 2, nome: 'B' }, { id: 3, nome: 'C' },
    ])
    mockPrisma.eventoModalidadeExcluida.findMany.mockResolvedValue([{ modalidade_id: 2 }])
    const mods = await service.modalidadesDoEvento(10)
    expect(mods.map((m: any) => m.id)).toEqual([1, 3])
  })

  it('404 quando evento nao existe', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue(null)
    await expect(service.modalidadesDoEvento(99)).rejects.toMatchObject({ status: 404 })
  })
})
