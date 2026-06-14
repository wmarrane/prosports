import { describe, it, expect, vi, beforeEach } from 'vitest'

// security.ts lê CORS_ORIGINS/NODE_ENV no carregamento do módulo. Como os `import`
// ESM são içados acima das atribuições top-level, usamos vi.hoisted para garantir
// que as envs estejam definidas ANTES de o módulo ser avaliado.
vi.hoisted(() => {
  process.env.CORS_ORIGINS = 'https://app.exemplo.com'
  process.env.NODE_ENV = 'production'
})

import { requireSameOrigin } from './security'

const mkRes = () => ({ statusCode: 0, body: null as any, status(c:number){this.statusCode=c;return this}, json(b:any){this.body=b;return this} })
beforeEach(() => vi.clearAllMocks())

describe('requireSameOrigin', () => {
  it('next quando Origin está na allowlist', () => {
    const res:any = mkRes(); const next = vi.fn()
    requireSameOrigin({ headers: { origin: 'https://app.exemplo.com' } } as any, res, next)
    expect(next).toHaveBeenCalled()
  })
  it('403 quando Origin fora da allowlist', () => {
    const res:any = mkRes(); const next = vi.fn()
    requireSameOrigin({ headers: { origin: 'https://evil.com' } } as any, res, next)
    expect(res.statusCode).toBe(403); expect(next).not.toHaveBeenCalled()
  })
  it('403 sem Origin nem Referer', () => {
    const res:any = mkRes(); const next = vi.fn()
    requireSameOrigin({ headers: {} } as any, res, next)
    expect(res.statusCode).toBe(403)
  })
})
