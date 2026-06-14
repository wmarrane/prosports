# Security Grupo 2 — Autenticação / Sessão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Endurecer a autenticação: pin de algoritmo HS256, segredos JWT obrigatórios/validados, correção do bug latente do refresh + rotação com detecção de reuse, revogação de access token (logout / sair-de-todos), CSRF em refresh/logout e token da chave mobile mais curto.

**Architecture:** Tokens HS256 com `jti`. Refresh rotaciona a cada uso (Redis `refresh:{userId}:{jti}`), reuse → revoga tudo. Access revogável via Redis (`denyAccess:{jti}` por logout; `authEpoch:{userId}` por sair-de-todos/troca de senha) checado num `requireAuth` agora **async**. CSRF por allowlist de Origin em `/auth/refresh` e `/auth/logout`.

**Tech Stack:** Node/Express, jsonwebtoken, redis (node-redis v4), Prisma, Vitest (mock prisma+redis).

**Validação obrigatória:** backend `npm run build` + `npm run test`.

**⚠️ Pré-requisito operacional (dev e prod):** após este grupo, o backend **exige** `JWT_SECRET` e `JWT_REFRESH_SECRET` (distintos) na env; ausência → boot falha. Configurar no `.env` de dev e na VM de prod **antes** de subir.

**Spec:** `docs/superpowers/specs/2026-06-14-security-hardening-design.md` (Grupo 2)

**Git:** identidade NÃO configurada — commitar inline (`git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit ...`). Não pular hooks. Caminhos absolutos.

---

## File Structure
- **Modify** `backend/src/lib/key-jwt.ts` — alg pin + 7d.
- **Modify** `backend/src/modules/auth/auth.service.ts` — alg pin, jti, rotação, revogação helpers.
- **Create** `backend/src/modules/auth/auth.service.test.ts` — rotação/reuse/revogação.
- **Modify** `backend/src/middleware/auth.ts` (+ `auth.test.ts` novo) — requireAuth async + checagem de revogação.
- **Modify** `backend/src/modules/auth/auth.controller.ts` — logout denylista access; refresh re-seta cookie rotacionado.
- **Modify** `backend/src/middleware/security.ts` (+ test) — `originPermitida` + `requireSameOrigin`.
- **Modify** `backend/src/modules/auth/auth.routes.ts` — CSRF em refresh/logout.
- **Modify** `backend/src/index.ts` — validação de segredos no boot.
- **Modify** `backend/.env.example` — documentar `JWT_SECRET`/`JWT_REFRESH_SECRET`.

---

## Task 1: Pin HS256 + encurtar token da chave (key-jwt)

**Files:** Modify `backend/src/lib/key-jwt.ts`

- [ ] **Step 1:** Trocar o conteúdo relevante. De:
```ts
const EXPIRES = '365d'
...
export function signKeyToken(data: Omit<KeyTokenPayload, 'type'>): string {
  const payload: KeyTokenPayload = { type: 'event-key', ...data }
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: EXPIRES })
}

export function verifyKeyToken(token: string): KeyTokenPayload {
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
```
Para:
```ts
const EXPIRES = '7d'
...
export function signKeyToken(data: Omit<KeyTokenPayload, 'type'>): string {
  const payload: KeyTokenPayload = { type: 'event-key', ...data }
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: EXPIRES, algorithm: 'HS256' })
}

export function verifyKeyToken(token: string): KeyTokenPayload {
  const decoded = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] }) as any
```
- [ ] **Step 2:** `cd backend && npm run test -- key_access` → PASS (round-trip de assinatura/verificação inalterado). `npm run build` → PASS.
- [ ] **Step 3:** Commit:
```bash
git add backend/src/lib/key-jwt.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "fix(security): pin HS256 e reduzir token da chave para 7d"
```

---

## Task 2: auth.service — alg pin, jti, rotação de refresh, helpers de revogação

**Files:** Modify `backend/src/modules/auth/auth.service.ts`; Create `backend/src/modules/auth/auth.service.test.ts`

- [ ] **Step 1: Escrever o teste (mock prisma + redis)**

Create `backend/src/modules/auth/auth.service.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
process.env.JWT_SECRET = 'test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaa'
process.env.JWT_REFRESH_SECRET = 'test-refresh-bbbbbbbbbbbbbbbbbbbbbbbbbbbb'

vi.mock('../../lib/prisma', () => ({
  default: { user: { findUnique: vi.fn(), update: vi.fn() } },
}))
vi.mock('../../lib/redis', () => ({
  default: { setEx: vi.fn(), get: vi.fn(), del: vi.fn(), set: vi.fn(), scanIterator: vi.fn(() => (async function*(){})()) },
}))

import prisma from '../../lib/prisma'
import redis from '../../lib/redis'
import * as svc from './auth.service'

const mp = prisma as any
const mr = redis as any
beforeEach(() => vi.clearAllMocks())

describe('refresh (rotação + reuse)', () => {
  it('rotaciona: valida jti no redis, apaga a chave antiga e grava a nova', async () => {
    const userId = 7
    // login p/ obter um refresh válido com jti
    mp.user.findUnique.mockResolvedValue({ id: userId, email: 'a@a.com', role: 'ADMIN', senha_hash: 'x', ativo: true })
    // simula refresh existente: capturamos o token assinando via login
    mp.user.update.mockResolvedValue({})
    const loginRes = await svc.login('a@a.com', 'irrelevante').catch(() => null)
    // login chama bcrypt.compare; para evitar, testamos refresh diretamente:
    // gera um refresh token válido manualmente
    const jwt = (await import('jsonwebtoken')).default
    const jti = 'jti-1'
    const token = jwt.sign({ sub: userId, email: 'a@a.com', role: 'ADMIN' }, process.env.JWT_REFRESH_SECRET!, { algorithm: 'HS256', jwtid: jti, expiresIn: '7d' })
    mr.get.mockResolvedValue(token) // redis tem a chave válida
    mp.user.findUnique.mockResolvedValue({ id: userId, email: 'a@a.com', role: 'ADMIN', ativo: true })
    const out = await svc.refresh(token)
    expect(out.accessToken).toBeTruthy()
    expect(out.refreshToken).toBeTruthy()
    expect(out.refreshToken).not.toBe(token) // rotacionou
    expect(mr.del).toHaveBeenCalledWith(`refresh:${userId}:${jti}`)
    expect(mr.setEx).toHaveBeenCalled() // grava o novo
    void loginRes
  })

  it('reuse: jti não está no redis → revoga tudo (set authEpoch) e 401', async () => {
    const userId = 8
    const jwt = (await import('jsonwebtoken')).default
    const token = jwt.sign({ sub: userId, email: 'b@b.com', role: 'ADMIN' }, process.env.JWT_REFRESH_SECRET!, { algorithm: 'HS256', jwtid: 'old', expiresIn: '7d' })
    mr.get.mockResolvedValue(null) // não existe → reuse/revogado
    await expect(svc.refresh(token)).rejects.toMatchObject({ status: 401 })
    expect(mr.set).toHaveBeenCalledWith(expect.stringContaining(`authEpoch:${userId}`), expect.any(String))
  })
})

describe('isAccessRevoked', () => {
  it('true quando denyAccess do jti existe', async () => {
    mr.get.mockImplementation((k: string) => Promise.resolve(k.startsWith('denyAccess:') ? '1' : null))
    expect(await svc.isAccessRevoked({ sub: 1, jti: 'j', iat: 1000 })).toBe(true)
  })
  it('true quando iat < authEpoch', async () => {
    mr.get.mockImplementation((k: string) => Promise.resolve(k.startsWith('authEpoch:') ? '2000' : null))
    expect(await svc.isAccessRevoked({ sub: 1, jti: 'j', iat: 1000 })).toBe(true)
  })
  it('false quando nada revogado', async () => {
    mr.get.mockResolvedValue(null)
    expect(await svc.isAccessRevoked({ sub: 1, jti: 'j', iat: 9999 })).toBe(false)
  })
})
```

- [ ] **Step 2:** `cd backend && npm run test -- auth.service` → FAIL (funções/rotação ainda não existem).

- [ ] **Step 3: Implementar** — Em `backend/src/modules/auth/auth.service.ts`:

(3a) Segredos (remover fallback):
```ts
const ACCESS_SECRET = process.env.JWT_SECRET!
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!
```

(3b) Assinaturas com HS256 + jti:
```ts
function signAccess(payload: TokenPayload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES, algorithm: 'HS256', jwtid: randomUUID() })
}

function signRefresh(payload: TokenPayload, jti: string) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: `${REFRESH_EXPIRES_SEC}s`, algorithm: 'HS256', jwtid: jti })
}
```

(3c) `login` — assinar refresh com o jti gerado:
```ts
  const payload: TokenPayload = { sub: user.id, email: user.email, role: user.role }
  const refreshJti = randomUUID()
  const accessToken = signAccess(payload)
  const refreshToken = signRefresh(payload, refreshJti)
  await redis.setEx(`refresh:${user.id}:${refreshJti}`, REFRESH_EXPIRES_SEC, refreshToken)
  return {
    accessToken, refreshToken, refreshJti,
    user: { id: user.id, nome: user.nome, email: user.email, role: user.role },
  }
```

(3d) `refresh` — verificar com alg pin, validar jti, rotacionar, detectar reuse:
```ts
export async function refresh(refreshToken: string) {
  let payload: TokenPayload & { jti?: string }
  try {
    payload = jwt.verify(refreshToken, REFRESH_SECRET, { algorithms: ['HS256'] }) as unknown as TokenPayload & { jti?: string }
  } catch {
    throw Object.assign(new Error('Refresh token inválido'), { status: 401 })
  }

  const jti = payload.jti
  const key = jti ? `refresh:${payload.sub}:${jti}` : null
  const stored = key ? await redis.get(key) : null
  if (!key || !stored || stored !== refreshToken) {
    // Reuse/revogado: revoga todas as sessões e marca epoch (invalida todos os access).
    await revogarTodosRefreshTokens(payload.sub)
    throw Object.assign(new Error('Refresh token revogado'), { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } })
  if (!user || !user.ativo) {
    throw Object.assign(new Error('Usuário inativo'), { status: 401 })
  }

  // Rotaciona
  await redis.del(key)
  const newPayload: TokenPayload = { sub: user.id, email: user.email, role: user.role }
  const newJti = randomUUID()
  const accessToken = signAccess(newPayload)
  const newRefresh = signRefresh(newPayload, newJti)
  await redis.setEx(`refresh:${user.id}:${newJti}`, REFRESH_EXPIRES_SEC, newRefresh)
  return { accessToken, refreshToken: newRefresh, refreshJti: newJti }
}
```

(3e) `logout` — denylista o access (além do refresh):
```ts
export async function logout(userId: number, refreshJti: string, accessJti?: string, accessTtlSec?: number) {
  await redis.del(`refresh:${userId}:${refreshJti}`)
  if (accessJti && accessTtlSec && accessTtlSec > 0) {
    await redis.setEx(`denyAccess:${accessJti}`, accessTtlSec, '1')
  }
}
```

(3f) `revogarTodosRefreshTokens` — também setar authEpoch:
```ts
export async function revogarTodosRefreshTokens(userId: number) {
  const pattern = `refresh:${userId}:*`
  const iter = (redis as any).scanIterator({ MATCH: pattern, COUNT: 100 })
  const keys: string[] = []
  for await (const k of iter) { keys.push(k) }
  if (keys.length > 0) { await redis.del(keys) }
  await redis.set(`authEpoch:${userId}`, String(Math.floor(Date.now() / 1000)))
}
```

(3g) `verifyAccess` com alg pin + novo helper `isAccessRevoked`:
```ts
export function verifyAccess(token: string): TokenPayload & { jti?: string; iat?: number } {
  return jwt.verify(token, ACCESS_SECRET, { algorithms: ['HS256'] }) as unknown as TokenPayload & { jti?: string; iat?: number }
}

export async function isAccessRevoked(payload: { sub: number; jti?: string; iat?: number }): Promise<boolean> {
  if (payload.jti && (await redis.get(`denyAccess:${payload.jti}`))) return true
  const epoch = await redis.get(`authEpoch:${payload.sub}`)
  if (epoch && payload.iat != null && payload.iat < Number(epoch)) return true
  return false
}
```

- [ ] **Step 4:** `cd backend && npm run test -- auth.service` → PASS. `npm run build` → PASS.
- [ ] **Step 5:** Commit:
```bash
git add backend/src/modules/auth/auth.service.ts backend/src/modules/auth/auth.service.test.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(security): HS256 + jti, rotacao de refresh com deteccao de reuse, revogacao de access"
```

---

## Task 3: requireAuth async + checagem de revogação

**Files:** Modify `backend/src/middleware/auth.ts`; Create `backend/src/middleware/auth.test.ts`

- [ ] **Step 1: Teste**

Create `backend/src/middleware/auth.test.ts`:
```ts
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
```

- [ ] **Step 2:** `cd backend && npm run test -- middleware/auth` → FAIL.

- [ ] **Step 3: Implementar** — substituir `requireAuth` em `backend/src/middleware/auth.ts`:
```ts
import { Request, Response, NextFunction } from 'express'
import { verifyAccess, isAccessRevoked } from '../modules/auth/auth.service'

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Token não fornecido' })
    return
  }
  try {
    const token = header.slice(7)
    const payload = verifyAccess(token) as any
    if (payload.type === 'event-key') {
      res.status(401).json({ message: 'Token inválido' })
      return
    }
    if (await isAccessRevoked(payload)) {
      res.status(401).json({ message: 'Sessão encerrada. Faça login novamente.' })
      return
    }
    ;(req as any).user = payload
    next()
  } catch {
    res.status(401).json({ message: 'Token inválido ou expirado' })
  }
}
```
(`requireRole` permanece igual, abaixo.)

- [ ] **Step 4:** `cd backend && npm run test -- middleware/auth` → PASS. `npm run test` (suíte) → PASS. `npm run build` → PASS.
- [ ] **Step 5:** Commit:
```bash
git add backend/src/middleware/auth.ts backend/src/middleware/auth.test.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(security): requireAuth async checa revogacao de access (denyAccess/authEpoch)"
```

---

## Task 4: Controller — logout denylista access; refresh re-seta cookie rotacionado

**Files:** Modify `backend/src/modules/auth/auth.controller.ts`

- [ ] **Step 1: refreshHandler re-seta o cookie rotacionado**

Trocar:
```ts
    const [, refreshToken] = raw.split('::')
    const result = await authService.refresh(refreshToken)
    res.json({ accessToken: result.accessToken })
```
Por:
```ts
    const [, refreshToken] = raw.split('::')
    const result = await authService.refresh(refreshToken)
    res.cookie(REFRESH_COOKIE, `${result.refreshJti}::${result.refreshToken}`, COOKIE_OPTS)
    res.json({ accessToken: result.accessToken })
```

- [ ] **Step 2: logoutHandler denylista o access**

Trocar:
```ts
    if (raw) {
      const [jti] = raw.split('::')
      const user = (req as any).user
      if (user?.sub && jti) {
        await authService.logout(user.sub, jti)
      }
    }
```
Por:
```ts
    if (raw) {
      const [jti] = raw.split('::')
      const user = (req as any).user as { sub?: number; jti?: string; exp?: number } | undefined
      if (user?.sub && jti) {
        const ttl = user.exp ? user.exp - Math.floor(Date.now() / 1000) : undefined
        await authService.logout(user.sub, jti, user.jti, ttl)
      }
    }
```
(`req.user` agora carrega `jti` e `exp` do access — `verifyAccess` retorna o token decodificado completo.)

- [ ] **Step 3:** `cd backend && npm run build` → PASS. `npm run test` → PASS.
- [ ] **Step 4:** Commit:
```bash
git add backend/src/modules/auth/auth.controller.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(security): refresh rotaciona cookie; logout revoga o access token"
```

---

## Task 5: CSRF (origin allowlist) em refresh/logout

**Files:** Modify `backend/src/middleware/security.ts` (+ test `backend/src/middleware/security.test.ts`); `backend/src/modules/auth/auth.routes.ts`

- [ ] **Step 1: Teste do middleware**

Create `backend/src/middleware/security.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
process.env.CORS_ORIGINS = 'https://app.exemplo.com'
process.env.NODE_ENV = 'production'

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
```
(Nota: como `security.ts` lê `CORS_ORIGINS`/`NODE_ENV` no carregamento do módulo, o teste seta essas envs ANTES do import — manter essa ordem.)

- [ ] **Step 2:** `cd backend && npm run test -- middleware/security` → FAIL.

- [ ] **Step 3: Implementar** — em `backend/src/middleware/security.ts`, após o bloco do `corsMiddleware`, adicionar:
```ts
export function originPermitida(origin?: string): boolean {
  if (!origin) return false
  if (allowedOrigins.includes(origin)) return true
  if (allowLanOrigins && PRIVATE_LAN_ORIGIN.test(origin)) return true
  return false
}

// CSRF: em prod o cookie é SameSite=None, então exigimos Origin/Referer na allowlist.
export function requireSameOrigin(req: Request, res: Response, next: NextFunction) {
  const ref = req.headers.referer
  let origin = req.headers.origin as string | undefined
  if (!origin && ref) { try { origin = new URL(ref).origin } catch { origin = undefined } }
  if (originPermitida(origin)) { next(); return }
  res.status(403).json({ message: 'Origem não permitida.' })
}
```

- [ ] **Step 4: Aplicar nas rotas** — em `backend/src/modules/auth/auth.routes.ts`, importar e aplicar:
```ts
import { loginRateLimit, requireSameOrigin } from '../../middleware/security'
...
router.post('/refresh', requireSameOrigin, refreshHandler)
router.post('/logout', requireSameOrigin, requireAuth, logoutHandler)
```

- [ ] **Step 5:** `cd backend && npm run test` → PASS. `npm run build` → PASS.
- [ ] **Step 6:** Commit:
```bash
git add backend/src/middleware/security.ts backend/src/middleware/security.test.ts backend/src/modules/auth/auth.routes.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(security): CSRF (origin allowlist) em /auth/refresh e /auth/logout"
```

---

## Task 6: Validação de segredos no boot + .env.example

**Files:** Modify `backend/src/index.ts`, `backend/.env.example`

- [ ] **Step 1: Validação no boot**

Em `backend/src/index.ts`, adicionar a função e chamá-la no início de `start()` (antes de `connectRedis()`):
```ts
function validarSegredos() {
  const s = process.env.JWT_SECRET
  const r = process.env.JWT_REFRESH_SECRET
  const probs: string[] = []
  if (!s) probs.push('JWT_SECRET ausente')
  if (!r) probs.push('JWT_REFRESH_SECRET ausente')
  if (s && r && s === r) probs.push('JWT_SECRET e JWT_REFRESH_SECRET devem ser diferentes')
  if (process.env.NODE_ENV === 'production') {
    if (s && s.length < 32) probs.push('JWT_SECRET deve ter >= 32 chars em produção')
    if (r && r.length < 32) probs.push('JWT_REFRESH_SECRET deve ter >= 32 chars em produção')
  }
  if (probs.length > 0) {
    logger.error({ probs }, 'Configuração de segredos JWT inválida')
    process.exit(1)
  }
}
```
E no `start()`:
```ts
async function start() {
  validarSegredos()
  await connectRedis()
  app.listen(PORT, () => logger.info(`Server running on port ${PORT}`))
}
```
(Presença é exigida em dev e prod; tamanho ≥32 e distinção é hard-fail só em prod — em dev, distinção ainda é exigida mas tamanho não, para não travar o dev. Ajuste: a distinção `s===r` vale em ambos.)

- [ ] **Step 2: .env.example**

Em `backend/.env.example`, adicionar (no topo) as variáveis de auth:
```
# Autenticação (obrigatório). Use segredos aleatórios distintos, >= 32 chars em produção.
JWT_SECRET=
JWT_REFRESH_SECRET=
# Origens permitidas (CORS) — allowlist separada por vírgula
CORS_ORIGINS=http://localhost:8080
# Seed do admin (obrigatório em produção)
ADMIN_SEED_PASSWORD=
```

- [ ] **Step 3:** `cd backend && npm run build` → PASS. `npm run test` → PASS (os testes setam as envs onde necessário; `validarSegredos` só roda em `start()`, não nos testes).
- [ ] **Step 4:** Commit:
```bash
git add backend/src/index.ts backend/.env.example
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(security): validar segredos JWT no boot + documentar .env.example"
```

---

## Manual Test Checklist (dev) — OBRIGATÓRIO antes de promover
Configurar no `backend/.env` de dev: `JWT_SECRET` e `JWT_REFRESH_SECRET` distintos (qualquer string no dev). Subir o backend.
- **Login** funciona; navegar no app autenticado funciona.
- **Refresh** (esperar o access expirar OU forçar): a sessão renova sem cair no login (valida a correção do bug latente + rotação). Conferir que o cookie muda (rotação).
- **Logout**: após logout, usar o access antigo numa chamada → 401 (denylist). Login de novo funciona.
- **Trocar senha**: sessões anteriores caem (authEpoch).
- **CSRF**: `POST /auth/refresh` de origem não-allowlist → 403 (testar via curl com `Origin: https://evil.com`).
- **Chave mobile**: login com email continua funcionando; token válido por 7d.
- Reuse: capturar um refresh, deixá-lo rotacionar (1 refresh), depois reusar o antigo → 401 e todas as sessões revogadas.

---

## Self-Review
**Spec coverage:** 2.1 pin (T1,T2) ✓; 2.2 segredos+boot (T2,T6) ✓; 2.3 jti+rotação+reuse (T2) ✓; 2.4 revogação access (T2,T3,T4) ✓; 2.5 CSRF (T5) ✓; 2.6 token 7d (T1) ✓.
**Placeholders:** nenhum; código completo.
**Type consistency:** `signRefresh(payload, jti)`, `logout(userId, refreshJti, accessJti?, accessTtlSec?)`, `isAccessRevoked({sub,jti?,iat?})`, `verifyAccess` retorna `{...,jti?,iat?}`, `requireSameOrigin`/`originPermitida` em security.ts. `req.user` carrega `jti`/`iat`/`exp` (decoded do access).
