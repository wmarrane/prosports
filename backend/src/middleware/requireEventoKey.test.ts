import { describe, it, expect, vi, beforeEach } from 'vitest'
process.env.JWT_SECRET = 'test-secret'

vi.mock('../lib/prisma', () => ({
  default: { eventoKey: { findUnique: vi.fn(), update: vi.fn() } },
}))

import prisma from '../lib/prisma'
import { signKeyToken } from '../lib/key-jwt'
import { requireEventoKey } from './requireEventoKey'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

function mkReq(token?: string) {
  return { headers: token ? { authorization: `Bearer ${token}` } : {} } as any
}
function mkRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() } as any
}

describe('requireEventoKey', () => {
  it('401 sem header Authorization', async () => {
    const req = mkReq(), res = mkRes(), next = vi.fn()
    await requireEventoKey(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('401 com JWT inválido', async () => {
    const req = mkReq('lixo'), res = mkRes(), next = vi.fn()
    await requireEventoKey(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('401 quando chave foi revogada (mesmo com JWT válido)', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({
      id: 1, evento_id: 5, revogado_em: new Date(),
    })
    const token = signKeyToken({ keyId: 1, eventoId: 5, deviceFp: 'fp1' })
    const req = mkReq(token), res = mkRes(), next = vi.fn()
    await requireEventoKey(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('next() + req.eventoKey populado quando ativa, touch last_seen_at', async () => {
    const key = { id: 1, evento_id: 5, revogado_em: null, device_fp: 'fp1', evento: { id: 5, nome: 'X' } }
    mockPrisma.eventoKey.findUnique.mockResolvedValue(key)
    mockPrisma.eventoKey.update.mockResolvedValue({})
    const token = signKeyToken({ keyId: 1, eventoId: 5, deviceFp: 'fp1' })
    const req = mkReq(token), res = mkRes(), next = vi.fn()
    await requireEventoKey(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(req.eventoKey).toEqual(key)
    expect(mockPrisma.eventoKey.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { last_seen_at: expect.any(Date) },
    })
  })

  it('401 quando deviceFp do JWT não bate com device_fp do banco', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({
      id: 1, evento_id: 5, revogado_em: null, device_fp: 'fp-CORRETO',
      evento: { id: 5, nome: 'X' },
    })
    const token = signKeyToken({ keyId: 1, eventoId: 5, deviceFp: 'fp-OUTRO' })
    const req = mkReq(token), res = mkRes(), next = vi.fn()
    await requireEventoKey(req, res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
    expect(mockPrisma.eventoKey.update).not.toHaveBeenCalled()
  })

  it('OK quando device_fp ainda é null (nunca usado) — o login que faz first-use lock', async () => {
    const key = { id: 1, evento_id: 5, revogado_em: null, device_fp: null,
                  evento: { id: 5, nome: 'X' } }
    mockPrisma.eventoKey.findUnique.mockResolvedValue(key)
    mockPrisma.eventoKey.update.mockResolvedValue({})
    const token = signKeyToken({ keyId: 1, eventoId: 5, deviceFp: 'fp-qualquer' })
    const req = mkReq(token), res = mkRes(), next = vi.fn()
    await requireEventoKey(req, res, next)
    expect(next).toHaveBeenCalled()
  })
})
