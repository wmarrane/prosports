import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/prisma', () => ({
  default: { eventoComissao: { findUnique: vi.fn() } },
}))

import prisma from '../lib/prisma'
import { usuarioTemAcessoAoEvento, requireAcessoEvento } from './evento-acesso'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('usuarioTemAcessoAoEvento', () => {
  it('ADMIN sempre tem acesso', async () => {
    expect(await usuarioTemAcessoAoEvento({ sub: 1, role: 'ADMIN' } as any, 9)).toBe(true)
    expect(mockPrisma.eventoComissao.findUnique).not.toHaveBeenCalled()
  })
  it('CT atribuído tem acesso', async () => {
    mockPrisma.eventoComissao.findUnique.mockResolvedValue({ id: 1 })
    expect(await usuarioTemAcessoAoEvento({ sub: 2, role: 'COMISSAO_TECNICA' } as any, 9)).toBe(true)
    expect(mockPrisma.eventoComissao.findUnique).toHaveBeenCalledWith({
      where: { evento_id_usuario_id: { evento_id: 9, usuario_id: 2 } },
      select: { id: true },
    })
  })
  it('CT não atribuído não tem acesso', async () => {
    mockPrisma.eventoComissao.findUnique.mockResolvedValue(null)
    expect(await usuarioTemAcessoAoEvento({ sub: 2, role: 'COMISSAO_TECNICA' } as any, 9)).toBe(false)
  })
  it('outro role não tem acesso', async () => {
    expect(await usuarioTemAcessoAoEvento({ sub: 3, role: 'VIEWER' } as any, 9)).toBe(false)
  })
})

describe('requireAcessoEvento', () => {
  function mkRes() {
    return { statusCode: 0, body: null as any, status(c: number) { this.statusCode = c; return this }, json(b: any) { this.body = b; return this } }
  }
  it('403 quando não tem acesso', async () => {
    mockPrisma.eventoComissao.findUnique.mockResolvedValue(null)
    const req: any = { user: { sub: 2, role: 'COMISSAO_TECNICA' } }
    const res: any = mkRes()
    const next = vi.fn()
    await requireAcessoEvento(() => 9)(req, res, next)
    expect(res.statusCode).toBe(403)
    expect(next).not.toHaveBeenCalled()
  })
  it('chama next quando ADMIN', async () => {
    const req: any = { user: { sub: 1, role: 'ADMIN' } }
    const res: any = mkRes()
    const next = vi.fn()
    await requireAcessoEvento(() => 9)(req, res, next)
    expect(next).toHaveBeenCalled()
  })
  it('400 quando evento_id não resolve', async () => {
    const req: any = { user: { sub: 1, role: 'ADMIN' } }
    const res: any = mkRes()
    const next = vi.fn()
    await requireAcessoEvento(() => null)(req, res, next)
    expect(res.statusCode).toBe(400)
    expect(next).not.toHaveBeenCalled()
  })
})
