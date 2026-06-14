import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../modules/auth/auth.service', () => ({
  verifyAccess: vi.fn(),
  isAccessRevoked: vi.fn(),
}))
import { verifyAccess, isAccessRevoked } from '../modules/auth/auth.service'
import { requireAuth } from './auth'

const mkRes = () => ({ statusCode: 0, body: null as any, status(c: number){this.statusCode=c;return this}, json(b:any){this.body=b;return this} })
beforeEach(() => vi.clearAllMocks())

describe('requireAuth', () => {
  it('401 sem Bearer', async () => {
    const res: any = mkRes(); const next = vi.fn()
    await requireAuth({ headers: {} } as any, res, next)
    expect(res.statusCode).toBe(401); expect(next).not.toHaveBeenCalled()
  })
  it('401 se token revogado', async () => {
    ;(verifyAccess as any).mockReturnValue({ sub: 1, role: 'ADMIN', jti: 'j', iat: 1 })
    ;(isAccessRevoked as any).mockResolvedValue(true)
    const res: any = mkRes(); const next = vi.fn()
    await requireAuth({ headers: { authorization: 'Bearer x' } } as any, res, next)
    expect(res.statusCode).toBe(401); expect(next).not.toHaveBeenCalled()
  })
  it('next quando válido e não revogado', async () => {
    ;(verifyAccess as any).mockReturnValue({ sub: 1, role: 'ADMIN', jti: 'j', iat: 1 })
    ;(isAccessRevoked as any).mockResolvedValue(false)
    const req: any = { headers: { authorization: 'Bearer x' } }
    const res: any = mkRes(); const next = vi.fn()
    await requireAuth(req, res, next)
    expect(next).toHaveBeenCalled(); expect(req.user.sub).toBe(1)
  })
  it('401 para token type event-key', async () => {
    ;(verifyAccess as any).mockReturnValue({ type: 'event-key', sub: 1 })
    const res: any = mkRes(); const next = vi.fn()
    await requireAuth({ headers: { authorization: 'Bearer x' } } as any, res, next)
    expect(res.statusCode).toBe(401)
  })
})
