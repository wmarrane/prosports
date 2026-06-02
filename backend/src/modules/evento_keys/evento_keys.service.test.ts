import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    eventoKey: {
      findMany: vi.fn(), findUnique: vi.fn(),
      create: vi.fn(), update: vi.fn(), delete: vi.fn(),
    },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './evento_keys.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('evento_keys.service', () => {
  it('listar retorna keys do evento ordenadas por criado_em desc', async () => {
    mockPrisma.eventoKey.findMany.mockResolvedValue([{ id: 1 }])
    const r = await service.listarPorEvento(5)
    expect(mockPrisma.eventoKey.findMany).toHaveBeenCalledWith({
      where: { evento_id: 5 },
      orderBy: { criado_em: 'desc' },
    })
    expect(r).toEqual([{ id: 1 }])
  })

  it('criar gera token único e grava email + criada_por', async () => {
    mockPrisma.eventoKey.create.mockResolvedValue({ id: 99, token: 'xyz' })
    const r = await service.criar({ evento_id: 5, email: 'a@b.com', criada_por: 3 })
    const call = mockPrisma.eventoKey.create.mock.calls[0][0]
    expect(call.data.evento_id).toBe(5)
    expect(call.data.email).toBe('a@b.com')
    expect(call.data.criada_por).toBe(3)
    expect(typeof call.data.token).toBe('string')
    expect(call.data.token.length).toBeGreaterThan(15)
    expect(r.id).toBe(99)
  })

  it('criar mapeia P2002 (email duplicado) para 409', async () => {
    mockPrisma.eventoKey.create.mockRejectedValue({ code: 'P2002' })
    await expect(service.criar({ evento_id: 5, email: 'a@b.com', criada_por: 3 }))
      .rejects.toMatchObject({ status: 409 })
  })

  it('revogar preenche revogado_em', async () => {
    mockPrisma.eventoKey.update.mockResolvedValue({ id: 1 })
    await service.revogar(1)
    expect(mockPrisma.eventoKey.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { revogado_em: expect.any(Date) },
    })
  })

  it('resetDevice zera device_fp/label/first_used_at', async () => {
    mockPrisma.eventoKey.update.mockResolvedValue({ id: 1 })
    await service.resetDevice(1)
    expect(mockPrisma.eventoKey.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { device_fp: null, device_label: null, first_used_at: null },
    })
  })

  it('apagar lança 409 se key já foi usada (device_fp != null)', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({ id: 1, device_fp: 'abc' })
    await expect(service.apagar(1)).rejects.toMatchObject({ status: 409 })
    expect(mockPrisma.eventoKey.delete).not.toHaveBeenCalled()
  })

  it('apagar deleta quando nunca usada', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({ id: 1, device_fp: null })
    mockPrisma.eventoKey.delete.mockResolvedValue({ id: 1 })
    await service.apagar(1)
    expect(mockPrisma.eventoKey.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
