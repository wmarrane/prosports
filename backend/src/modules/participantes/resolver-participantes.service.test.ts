import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    municipio: { findMany: vi.fn() },
    participante: { findMany: vi.fn() },
  },
}))

import prisma from '../../lib/prisma'
import { resolverParticipantes } from './resolver-participantes.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('resolverParticipantes', () => {
  it('resolve municipio e participante existentes (case-insensitive)', async () => {
    mockPrisma.municipio.findMany.mockResolvedValue([{ id: 7, nome: 'São Paulo', uf: 'SP' }])
    mockPrisma.participante.findMany.mockResolvedValue([{ id: 99, nome: 'João Silva', municipio_id: 7 }])
    const out = await resolverParticipantes([
      { nome: 'joão silva', municipio_uf: 'sp', municipio_nome: 'são paulo' },
    ])
    expect(out).toEqual([{ municipio_id: 7, participante_id: 99 }])
  })

  it('municipio inexistente → municipio_id null', async () => {
    mockPrisma.municipio.findMany.mockResolvedValue([])
    mockPrisma.participante.findMany.mockResolvedValue([])
    const out = await resolverParticipantes([
      { nome: 'Maria', municipio_uf: 'RJ', municipio_nome: 'Niterói' },
    ])
    expect(out).toEqual([{ municipio_id: null, participante_id: null }])
  })

  it('municipio existe mas participante não → participante_id null', async () => {
    mockPrisma.municipio.findMany.mockResolvedValue([{ id: 7, nome: 'São Paulo', uf: 'SP' }])
    mockPrisma.participante.findMany.mockResolvedValue([])
    const out = await resolverParticipantes([
      { nome: 'Novato', municipio_uf: 'SP', municipio_nome: 'São Paulo' },
    ])
    expect(out).toEqual([{ municipio_id: 7, participante_id: null }])
  })
})
