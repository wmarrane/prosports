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

  it('criar gera token único e grava email + criada_por quando nao existe', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue(null)
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

  it('criar rejeita 409 quando ja existe chave ATIVA pro mesmo email/evento', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({
      id: 1, evento_id: 5, email: 'a@b.com', revogado_em: null,
    })
    await expect(service.criar({ evento_id: 5, email: 'a@b.com', criada_por: 3 }))
      .rejects.toMatchObject({ status: 409 })
    expect(mockPrisma.eventoKey.create).not.toHaveBeenCalled()
    expect(mockPrisma.eventoKey.update).not.toHaveBeenCalled()
  })

  it('criar reativa chave revogada com token novo e zera device', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({
      id: 7, evento_id: 5, email: 'a@b.com',
      revogado_em: new Date('2026-01-01'),
      device_fp: 'antigo-fp', device_label: 'iPhone',
    })
    mockPrisma.eventoKey.update.mockResolvedValue({ id: 7, token: 'novo' })
    const r = await service.criar({ evento_id: 5, email: 'a@b.com', criada_por: 9 })
    const call = mockPrisma.eventoKey.update.mock.calls[0][0]
    expect(call.where).toEqual({ id: 7 })
    expect(call.data.revogado_em).toBeNull()
    expect(call.data.device_fp).toBeNull()
    expect(call.data.device_label).toBeNull()
    expect(call.data.first_used_at).toBeNull()
    expect(call.data.last_seen_at).toBeNull()
    expect(call.data.criada_por).toBe(9)
    expect(typeof call.data.token).toBe('string')
    expect(call.data.token.length).toBeGreaterThan(15)
    expect(mockPrisma.eventoKey.create).not.toHaveBeenCalled()
    expect(r.id).toBe(7)
  })

  it('criar mapeia P2002 (race condition) para 409 ao tentar criar', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue(null)
    mockPrisma.eventoKey.create.mockRejectedValue({ code: 'P2002' })
    await expect(service.criar({ evento_id: 5, email: 'a@b.com', criada_por: 3 }))
      .rejects.toMatchObject({ status: 409 })
  })

  it('revogar preenche revogado_em', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({ id: 1, evento_id: 5 })
    mockPrisma.eventoKey.update.mockResolvedValue({ id: 1 })
    await service.revogar(1, 5)
    expect(mockPrisma.eventoKey.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { revogado_em: expect.any(Date) },
    })
  })

  it('resetDevice zera device_fp/label/first_used_at/last_seen_at', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({ id: 1, evento_id: 5 })
    mockPrisma.eventoKey.update.mockResolvedValue({ id: 1 })
    await service.resetDevice(1, 5)
    expect(mockPrisma.eventoKey.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { device_fp: null, device_label: null, first_used_at: null, last_seen_at: null },
    })
  })

  it('apagar lança 409 se key já foi usada (device_fp != null)', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({ id: 1, evento_id: 5, device_fp: 'abc' })
    await expect(service.apagar(1, 5)).rejects.toMatchObject({ status: 409 })
    expect(mockPrisma.eventoKey.delete).not.toHaveBeenCalled()
  })

  it('apagar deleta quando nunca usada', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({ id: 1, evento_id: 5, device_fp: null })
    mockPrisma.eventoKey.delete.mockResolvedValue({ id: 1 })
    await service.apagar(1, 5)
    expect(mockPrisma.eventoKey.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })

  it('revogar lança 404 quando key não pertence ao evento', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({ id: 1, evento_id: 99 })
    await expect(service.revogar(1, 5)).rejects.toMatchObject({ status: 404 })
    expect(mockPrisma.eventoKey.update).not.toHaveBeenCalled()
  })

  it('resetDevice lança 404 quando key não pertence ao evento', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({ id: 1, evento_id: 99 })
    await expect(service.resetDevice(1, 5)).rejects.toMatchObject({ status: 404 })
    expect(mockPrisma.eventoKey.update).not.toHaveBeenCalled()
  })

  it('apagar lança 404 quando key não pertence ao evento', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({ id: 1, evento_id: 99, device_fp: null })
    await expect(service.apagar(1, 5)).rejects.toMatchObject({ status: 404 })
    expect(mockPrisma.eventoKey.delete).not.toHaveBeenCalled()
  })
})
