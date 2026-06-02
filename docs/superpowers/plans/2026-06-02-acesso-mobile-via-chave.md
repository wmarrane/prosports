# Acesso Mobile via Chave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que convidados externos acessem um evento via link único + QR code no celular em modo somente leitura (inscritos, campeões anteriores, sorteios) com first-use device lock e revogação pelo admin.

**Architecture:** Backend adiciona model `EventoKey`, 2 módulos novos (`evento_keys` admin + `key_access` público) e middleware `requireEventoKey`. Frontend ganha card no `EventoForm`, instância axios separada (`apiKey`), e 4 telas mobile-first sob rota `/e/:token` (login) e `/m/*` (conteúdo). JWT do convidado usa mesmo `JWT_SECRET` com payload `{type:'event-key'}` para distinguir. Polling React Query 15s para atualização ao vivo.

**Tech Stack:** Prisma · Express · Vitest · React 19 · React Router · React Query · qrcode.react

**Spec:** `docs/superpowers/specs/2026-06-02-acesso-mobile-via-chave-design.md`

---

## File map

**Backend (criar):**
- `backend/prisma/migrations/20260602000000_evento_keys/migration.sql`
- `backend/src/lib/key-jwt.ts`
- `backend/src/middleware/requireEventoKey.ts`
- `backend/src/modules/evento_keys/evento_keys.service.ts` (+ `.test.ts`)
- `backend/src/modules/evento_keys/evento_keys.controller.ts`
- `backend/src/modules/evento_keys/evento_keys.routes.ts`
- `backend/src/modules/key_access/key_access.service.ts` (+ `.test.ts`)
- `backend/src/modules/key_access/key_access.controller.ts`
- `backend/src/modules/key_access/key_access.routes.ts`

**Backend (modificar):**
- `backend/prisma/schema.prisma` — add `EventoKey` model + relations em `Evento` e `User`
- `backend/src/index.ts` — mount `/key-access` e `/eventos/:id/keys`
- `backend/src/modules/eventos/eventos.routes.ts` — mount sub-router de keys

**Frontend (criar):**
- `frontend/src/types/evento-key.ts`
- `frontend/src/lib/device.ts`
- `frontend/src/lib/api-key.ts`
- `frontend/src/services/evento-keys.ts`
- `frontend/src/services/key-access.ts`
- `frontend/src/pages/eventos/AcessoMobileCard.tsx`
- `frontend/src/pages/mobile/MobileShell.tsx`
- `frontend/src/pages/mobile/MobileLogin.tsx`
- `frontend/src/pages/mobile/MobileModalidades.tsx`
- `frontend/src/pages/mobile/MobileModalidade.tsx`

**Frontend (modificar):**
- `frontend/package.json` — add `qrcode.react`
- `frontend/src/pages/eventos/EventoForm.tsx` — incluir `<AcessoMobileCard />`
- `frontend/src/App.tsx` — adicionar rotas `/e/:token`, `/m`, `/m/:id`
- `frontend/src/types/evento.ts` — adicionar relação `event_keys?` (opcional, só pra typing)

**Docs:**
- `CHANGELOG.md` — entrada `[1.46.0]`
- `package.json` — bump 1.45.1 → 1.46.0

---

## Task 1: Schema + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260602000000_evento_keys/migration.sql`

- [ ] **Step 1: Adicionar model `EventoKey` em `schema.prisma`**

Adicionar este bloco no final do arquivo (após o último model):

```prisma
model EventoKey {
  id              Int       @id @default(autoincrement())
  token           String    @unique
  email           String
  evento          Evento    @relation(fields: [evento_id], references: [id], onDelete: Cascade)
  evento_id       Int
  device_fp       String?
  device_label    String?
  first_used_at   DateTime?
  last_seen_at    DateTime?
  revogado_em     DateTime?
  criado_em       DateTime  @default(now())
  criada_por      Int
  criador         User      @relation(fields: [criada_por], references: [id])

  @@unique([evento_id, email])
  @@index([evento_id])
  @@index([token])
}
```

- [ ] **Step 2: Adicionar relations em `Evento` e `User`**

No model `Evento`, adicionar dentro do bloco antes de `criado_em`:

```prisma
  event_keys      EventoKey[]
```

No model `User`, adicionar dentro do bloco antes de `criado_em`:

```prisma
  event_keys_criadas EventoKey[]
```

- [ ] **Step 3: Criar migration SQL**

Criar `backend/prisma/migrations/20260602000000_evento_keys/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "EventoKey" (
  "id" SERIAL NOT NULL,
  "token" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "evento_id" INTEGER NOT NULL,
  "device_fp" TEXT,
  "device_label" TEXT,
  "first_used_at" TIMESTAMP(3),
  "last_seen_at" TIMESTAMP(3),
  "revogado_em" TIMESTAMP(3),
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criada_por" INTEGER NOT NULL,
  CONSTRAINT "EventoKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventoKey_token_key" ON "EventoKey"("token");
CREATE UNIQUE INDEX "EventoKey_evento_id_email_key" ON "EventoKey"("evento_id", "email");
CREATE INDEX "EventoKey_evento_id_idx" ON "EventoKey"("evento_id");
CREATE INDEX "EventoKey_token_idx" ON "EventoKey"("token");

ALTER TABLE "EventoKey" ADD CONSTRAINT "EventoKey_evento_id_fkey"
  FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventoKey" ADD CONSTRAINT "EventoKey_criada_por_fkey"
  FOREIGN KEY ("criada_por") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 4: Gerar prisma client**

Run: `cd backend && npx prisma generate`
Expected: `✔ Generated Prisma Client (v5.22.0)` sem erros.

- [ ] **Step 5: Verificar tipos compilam**

Run: `cd backend && npx tsc --noEmit`
Expected: sem output (sucesso).

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260602000000_evento_keys
git commit -m "feat(schema): adicionar EventoKey para acesso mobile via chave"
```

---

## Task 2: Key JWT helper (TDD)

**Files:**
- Create: `backend/src/lib/key-jwt.ts`
- Create: `backend/src/lib/key-jwt.test.ts`

- [ ] **Step 1: Escrever teste**

Criar `backend/src/lib/key-jwt.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
process.env.JWT_SECRET = 'test-secret-for-key-jwt'
import { signKeyToken, verifyKeyToken } from './key-jwt'

describe('key-jwt', () => {
  it('sign + verify roundtrip OK', () => {
    const token = signKeyToken({ keyId: 1, eventoId: 10, deviceFp: 'abc' })
    const payload = verifyKeyToken(token)
    expect(payload.keyId).toBe(1)
    expect(payload.eventoId).toBe(10)
    expect(payload.deviceFp).toBe('abc')
    expect(payload.type).toBe('event-key')
  })

  it('verifyKeyToken rejeita token de tipo errado (admin access)', () => {
    const jwt = require('jsonwebtoken')
    const adminToken = jwt.sign({ sub: 1, email: 'a@b', role: 'ADMIN' }, 'test-secret-for-key-jwt')
    expect(() => verifyKeyToken(adminToken)).toThrow(/tipo/)
  })

  it('verifyKeyToken rejeita lixo', () => {
    expect(() => verifyKeyToken('lixo')).toThrow()
  })
})
```

- [ ] **Step 2: Rodar teste e ver falhar**

Run: `cd backend && npx vitest run src/lib/key-jwt.test.ts`
Expected: FAIL — "Cannot find module './key-jwt'"

- [ ] **Step 3: Implementar `key-jwt.ts`**

Criar `backend/src/lib/key-jwt.ts`:

```ts
import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET!
const EXPIRES = '365d'

export type KeyTokenPayload = {
  type: 'event-key'
  keyId: number
  eventoId: number
  deviceFp: string
}

export function signKeyToken(data: Omit<KeyTokenPayload, 'type'>): string {
  const payload: KeyTokenPayload = { type: 'event-key', ...data }
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES })
}

export function verifyKeyToken(token: string): KeyTokenPayload {
  const decoded = jwt.verify(token, SECRET) as any
  if (decoded?.type !== 'event-key') {
    throw new Error('Token de tipo inválido')
  }
  return decoded as KeyTokenPayload
}
```

- [ ] **Step 4: Rodar testes e ver passar**

Run: `cd backend && npx vitest run src/lib/key-jwt.test.ts`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/key-jwt.ts backend/src/lib/key-jwt.test.ts
git commit -m "feat(key-jwt): sign/verify para token de convidado mobile"
```

---

## Task 3: Middleware `requireEventoKey` (TDD)

**Files:**
- Create: `backend/src/middleware/requireEventoKey.ts`
- Create: `backend/src/middleware/requireEventoKey.test.ts`

- [ ] **Step 1: Escrever teste**

Criar `backend/src/middleware/requireEventoKey.test.ts`:

```ts
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
    const key = { id: 1, evento_id: 5, revogado_em: null, evento: { id: 5, nome: 'X' } }
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
})
```

- [ ] **Step 2: Rodar teste e ver falhar**

Run: `cd backend && npx vitest run src/middleware/requireEventoKey.test.ts`
Expected: FAIL — "Cannot find module './requireEventoKey'"

- [ ] **Step 3: Implementar middleware**

Criar `backend/src/middleware/requireEventoKey.ts`:

```ts
import { Request, Response, NextFunction } from 'express'
import prisma from '../lib/prisma'
import { verifyKeyToken } from '../lib/key-jwt'

export async function requireEventoKey(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Token não fornecido' })
    return
  }

  let payload
  try {
    payload = verifyKeyToken(header.slice(7))
  } catch {
    res.status(401).json({ message: 'Token inválido ou expirado' })
    return
  }

  const key = await prisma.eventoKey.findUnique({
    where: { id: payload.keyId },
    include: { evento: { include: { competicao: true } } },
  })

  if (!key || key.revogado_em !== null) {
    res.status(401).json({ message: 'Chave revogada ou inexistente' })
    return
  }

  // Touch last_seen_at sem bloquear muito a resposta
  await prisma.eventoKey.update({
    where: { id: key.id },
    data: { last_seen_at: new Date() },
  })

  ;(req as any).eventoKey = key
  next()
}
```

- [ ] **Step 4: Rodar testes e ver passar**

Run: `cd backend && npx vitest run src/middleware/requireEventoKey.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/requireEventoKey.ts backend/src/middleware/requireEventoKey.test.ts
git commit -m "feat(middleware): requireEventoKey valida JWT + revogação + touch last_seen_at"
```

---

## Task 4: EventoKey service admin (TDD)

**Files:**
- Create: `backend/src/modules/evento_keys/evento_keys.service.ts`
- Create: `backend/src/modules/evento_keys/evento_keys.service.test.ts`

- [ ] **Step 1: Escrever testes**

Criar `backend/src/modules/evento_keys/evento_keys.service.test.ts`:

```ts
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
```

- [ ] **Step 2: Rodar testes e ver falhar**

Run: `cd backend && npx vitest run src/modules/evento_keys/evento_keys.service.test.ts`
Expected: FAIL — "Cannot find module './evento_keys.service'"

- [ ] **Step 3: Implementar service**

Criar `backend/src/modules/evento_keys/evento_keys.service.ts`:

```ts
import prisma from '../../lib/prisma'
import { randomBytes } from 'crypto'

function novoToken(): string {
  // 16 bytes = 32 hex chars; suficiente para ser "unguessable" mas curto na URL
  return randomBytes(16).toString('hex')
}

async function mapPrismaError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw Object.assign(
        new Error('Já existe chave para este email neste evento.'),
        { status: 409 }
      )
    }
    throw err
  }
}

export async function listarPorEvento(evento_id: number) {
  return prisma.eventoKey.findMany({
    where: { evento_id },
    orderBy: { criado_em: 'desc' },
  })
}

export async function criar(input: { evento_id: number; email: string; criada_por: number }) {
  return mapPrismaError(() =>
    prisma.eventoKey.create({
      data: {
        evento_id: input.evento_id,
        email: input.email,
        criada_por: input.criada_por,
        token: novoToken(),
      },
    })
  )
}

export async function revogar(id: number) {
  return prisma.eventoKey.update({
    where: { id },
    data: { revogado_em: new Date() },
  })
}

export async function resetDevice(id: number) {
  return prisma.eventoKey.update({
    where: { id },
    data: { device_fp: null, device_label: null, first_used_at: null },
  })
}

export async function apagar(id: number) {
  const key = await prisma.eventoKey.findUnique({ where: { id } })
  if (!key) throw Object.assign(new Error('Chave não encontrada'), { status: 404 })
  if (key.device_fp !== null) {
    throw Object.assign(
      new Error('Esta chave já foi usada. Use Revogar ao invés de Apagar.'),
      { status: 409 }
    )
  }
  return prisma.eventoKey.delete({ where: { id } })
}
```

- [ ] **Step 4: Rodar testes e ver passar**

Run: `cd backend && npx vitest run src/modules/evento_keys/evento_keys.service.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/evento_keys
git commit -m "feat(evento-keys): service admin (listar/criar/revogar/reset/apagar)"
```

---

## Task 5: EventoKey controller + routes admin

**Files:**
- Create: `backend/src/modules/evento_keys/evento_keys.controller.ts`
- Create: `backend/src/modules/evento_keys/evento_keys.routes.ts`
- Modify: `backend/src/modules/eventos/eventos.routes.ts`

- [ ] **Step 1: Criar controller**

Criar `backend/src/modules/evento_keys/evento_keys.controller.ts`:

```ts
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './evento_keys.service'

const createSchema = z.object({
  email: z.string().email({ message: 'Email inválido' }),
})

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const evento_id = Number(req.params.evento_id)
    res.json(await service.listarPorEvento(evento_id))
  } catch (err) { next(err) }
}

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = createSchema.parse(req.body)
    const evento_id = Number(req.params.evento_id)
    const criada_por = (req as any).user.sub
    res.status(201).json(await service.criar({ evento_id, email, criada_por }))
  } catch (err) { next(err) }
}

export async function revogar(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.revogar(Number(req.params.keyId)))
  } catch (err) { next(err) }
}

export async function resetDevice(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.resetDevice(Number(req.params.keyId)))
  } catch (err) { next(err) }
}

export async function apagar(req: Request, res: Response, next: NextFunction) {
  try {
    await service.apagar(Number(req.params.keyId))
    res.status(204).send()
  } catch (err) { next(err) }
}
```

- [ ] **Step 2: Criar routes**

Criar `backend/src/modules/evento_keys/evento_keys.routes.ts`:

```ts
import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as ctrl from './evento_keys.controller'

// Mounted at /eventos/:evento_id/keys (sub-router)
const router = Router({ mergeParams: true })
const admin = [requireAuth, requireRole('ADMIN')]

router.get('/', ...admin, ctrl.listar)
router.post('/', ...admin, ctrl.criar)
router.post('/:keyId/revoke', ...admin, ctrl.revogar)
router.post('/:keyId/reset-device', ...admin, ctrl.resetDevice)
router.delete('/:keyId', ...admin, ctrl.apagar)

export default router
```

- [ ] **Step 3: Mount sub-router em `eventos.routes.ts`**

Modificar `backend/src/modules/eventos/eventos.routes.ts`, adicionar import no topo:

```ts
import eventoKeysRoutes from '../evento_keys/evento_keys.routes'
```

E adicionar antes do `export default router`:

```ts
router.use('/:evento_id/keys', eventoKeysRoutes)
```

- [ ] **Step 4: Type-check + tests existentes não quebraram**

Run: `cd backend && npx tsc --noEmit && npx vitest run`
Expected: tsc sem output, vitest 199 tests passing (192 existentes + 7 novos do service).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/evento_keys backend/src/modules/eventos/eventos.routes.ts
git commit -m "feat(evento-keys): controller + rotas /eventos/:id/keys"
```

---

## Task 6: KeyAccess service público (TDD)

**Files:**
- Create: `backend/src/modules/key_access/key_access.service.ts`
- Create: `backend/src/modules/key_access/key_access.service.test.ts`

- [ ] **Step 1: Escrever testes**

Criar `backend/src/modules/key_access/key_access.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
process.env.JWT_SECRET = 'test-secret'

vi.mock('../../lib/prisma', () => ({
  default: {
    eventoKey: { findUnique: vi.fn(), update: vi.fn() },
    modalidade: { findMany: vi.fn(), findUnique: vi.fn() },
    inscricao: { findMany: vi.fn() },
    campeaoAnterior: { findMany: vi.fn() },
    sorteio: { findUnique: vi.fn() },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './key_access.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('key_access.service', () => {
  it('login 401 quando token não existe', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue(null)
    await expect(service.login({ token: 'x', device_fp: 'fp', device_label: 'iPhone' }))
      .rejects.toMatchObject({ status: 401 })
  })

  it('login 401 quando revogado_em != null', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({
      id: 1, evento_id: 5, device_fp: null, revogado_em: new Date(),
    })
    await expect(service.login({ token: 'x', device_fp: 'fp', device_label: 'iPhone' }))
      .rejects.toMatchObject({ status: 401 })
  })

  it('login first-use grava device_fp, label, first_used_at + retorna keyToken', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({
      id: 1, evento_id: 5, device_fp: null, revogado_em: null,
      evento: { id: 5, nome: 'E', data_hora: new Date(), local: 'L', logo_url: null,
                competicao: { subtitulo_campos: [] } },
    })
    mockPrisma.eventoKey.update.mockResolvedValue({})
    const r = await service.login({ token: 'x', device_fp: 'fp1', device_label: 'iPhone' })
    expect(r.keyToken).toBeTruthy()
    expect(r.evento.id).toBe(5)
    expect(mockPrisma.eventoKey.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        device_fp: 'fp1', device_label: 'iPhone',
        first_used_at: expect.any(Date), last_seen_at: expect.any(Date),
      },
    })
  })

  it('login re-acesso com mesmo device_fp sucesso, atualiza só last_seen_at', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({
      id: 1, evento_id: 5, device_fp: 'fp1', revogado_em: null,
      evento: { id: 5, nome: 'E', data_hora: new Date(), local: 'L', logo_url: null,
                competicao: { subtitulo_campos: [] } },
    })
    mockPrisma.eventoKey.update.mockResolvedValue({})
    const r = await service.login({ token: 'x', device_fp: 'fp1', device_label: 'iPhone' })
    expect(r.keyToken).toBeTruthy()
    const call = mockPrisma.eventoKey.update.mock.calls[0][0]
    expect(call.data.device_fp).toBeUndefined()
    expect(call.data.last_seen_at).toBeInstanceOf(Date)
  })

  it('login com device_fp diferente lança 403', async () => {
    mockPrisma.eventoKey.findUnique.mockResolvedValue({
      id: 1, evento_id: 5, device_fp: 'fp1', revogado_em: null,
      evento: { id: 5 },
    })
    await expect(service.login({ token: 'x', device_fp: 'fpOUTRO', device_label: 'X' }))
      .rejects.toMatchObject({ status: 403 })
  })

  it('getModalidades lista do evento, ordenadas', async () => {
    const evento = { id: 5, competicao_id: 10 } as any
    mockPrisma.modalidade.findMany.mockResolvedValue([{ id: 1, nome: 'A' }])
    await service.getModalidades(evento)
    expect(mockPrisma.modalidade.findMany).toHaveBeenCalledWith({
      where: { competicao_id: 10 },
      orderBy: { nome: 'asc' },
      include: { tipo_modalidade: { select: { tipo: true } } },
    })
  })

  it('getModalidadeDetail 404 quando modalidade não é da competição do evento', async () => {
    const evento = { id: 5, competicao_id: 10 } as any
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 1, competicao_id: 99 })
    await expect(service.getModalidadeDetail(evento, 1)).rejects.toMatchObject({ status: 404 })
  })

  it('getModalidadeDetail retorna inscritos com nested + sorteio opcional', async () => {
    const evento = { id: 5, competicao_id: 10 } as any
    mockPrisma.modalidade.findUnique.mockResolvedValue({
      id: 1, competicao_id: 10, nome: 'M', tipo_modalidade: { tipo: 'grupos' },
    })
    mockPrisma.inscricao.findMany.mockResolvedValue([{ id: 1, participante: { id: 1 } }])
    mockPrisma.campeaoAnterior.findMany.mockResolvedValue([])
    mockPrisma.sorteio.findUnique.mockResolvedValue({ id: 5, resultado: {} })
    const r = await service.getModalidadeDetail(evento, 1)
    expect(r.modalidade.id).toBe(1)
    expect(r.inscritos).toHaveLength(1)
    expect(r.sorteio).toBeTruthy()
    expect(mockPrisma.inscricao.findMany.mock.calls[0][0].include).toEqual({
      participante: { include: { municipio: true, inspetoria: true, delegacia: true } },
    })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/modules/key_access/key_access.service.test.ts`
Expected: FAIL — "Cannot find module './key_access.service'"

- [ ] **Step 3: Implementar service**

Criar `backend/src/modules/key_access/key_access.service.ts`:

```ts
import prisma from '../../lib/prisma'
import { signKeyToken } from '../../lib/key-jwt'

type Evento = { id: number; competicao_id: number; [k: string]: any }

export async function login(input: { token: string; device_fp: string; device_label: string }) {
  const key = await prisma.eventoKey.findUnique({
    where: { token: input.token },
    include: { evento: { include: { competicao: true } } },
  })
  if (!key || key.revogado_em !== null) {
    throw Object.assign(new Error('Chave inválida ou revogada.'), { status: 401, code: 'invalid_or_revoked' })
  }

  const now = new Date()
  const firstUse = key.device_fp === null

  if (!firstUse && key.device_fp !== input.device_fp) {
    throw Object.assign(
      new Error('Esta chave já está em uso em outro aparelho. Solicite ao organizador o reset.'),
      { status: 403, code: 'device_mismatch' }
    )
  }

  await prisma.eventoKey.update({
    where: { id: key.id },
    data: firstUse
      ? { device_fp: input.device_fp, device_label: input.device_label, first_used_at: now, last_seen_at: now }
      : { last_seen_at: now },
  })

  const keyToken = signKeyToken({ keyId: key.id, eventoId: key.evento_id, deviceFp: input.device_fp })
  return { keyToken, evento: key.evento }
}

export async function getModalidades(evento: Evento) {
  return prisma.modalidade.findMany({
    where: { competicao_id: evento.competicao_id },
    orderBy: { nome: 'asc' },
    include: { tipo_modalidade: { select: { tipo: true } } },
  })
}

export async function getModalidadeDetail(evento: Evento, modalidade_id: number) {
  const modalidade = await prisma.modalidade.findUnique({
    where: { id: modalidade_id },
    include: { tipo_modalidade: { select: { tipo: true } } },
  })
  if (!modalidade || modalidade.competicao_id !== evento.competicao_id) {
    throw Object.assign(new Error('Modalidade não encontrada neste evento'), { status: 404 })
  }

  const [inscritos, campeoes, sorteio] = await Promise.all([
    prisma.inscricao.findMany({
      where: { evento_id: evento.id, modalidade_id },
      include: {
        participante: { include: { municipio: true, inspetoria: true, delegacia: true } },
      },
    }),
    prisma.campeaoAnterior.findMany({
      where: { evento_id: evento.id, modalidade_id },
      include: {
        participante: { include: { municipio: true, inspetoria: true, delegacia: true } },
      },
      orderBy: { posicao: 'asc' },
    }),
    prisma.sorteio.findUnique({
      where: { evento_id_modalidade_id: { evento_id: evento.id, modalidade_id } },
    }),
  ])

  return { modalidade, inscritos, campeoes, sorteio }
}
```

- [ ] **Step 4: Rodar testes e ver passar**

Run: `cd backend && npx vitest run src/modules/key_access/key_access.service.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/key_access
git commit -m "feat(key-access): service login + getModalidades + getModalidadeDetail"
```

---

## Task 7: KeyAccess controller + routes + mount

**Files:**
- Create: `backend/src/modules/key_access/key_access.controller.ts`
- Create: `backend/src/modules/key_access/key_access.routes.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Criar controller**

Criar `backend/src/modules/key_access/key_access.controller.ts`:

```ts
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './key_access.service'

const loginSchema = z.object({
  token: z.string().min(1),
  device_fp: z.string().min(1).max(200),
  device_label: z.string().min(1).max(200),
})

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const body = loginSchema.parse(req.body)
    res.json(await service.login(body))
  } catch (err) { next(err) }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const key = (req as any).eventoKey
    res.json({ evento: key.evento, valido: true })
  } catch (err) { next(err) }
}

export async function modalidades(req: Request, res: Response, next: NextFunction) {
  try {
    const key = (req as any).eventoKey
    res.json(await service.getModalidades(key.evento))
  } catch (err) { next(err) }
}

export async function modalidadeDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const key = (req as any).eventoKey
    res.json(await service.getModalidadeDetail(key.evento, Number(req.params.id)))
  } catch (err) { next(err) }
}
```

- [ ] **Step 2: Criar routes**

Criar `backend/src/modules/key_access/key_access.routes.ts`:

```ts
import { Router } from 'express'
import { requireEventoKey } from '../../middleware/requireEventoKey'
import * as ctrl from './key_access.controller'

const router = Router()

// Public: login com token + device
router.post('/login', ctrl.login)

// Protegido por keyToken
router.get('/me', requireEventoKey, ctrl.me)
router.get('/modalidades', requireEventoKey, ctrl.modalidades)
router.get('/modalidade/:id', requireEventoKey, ctrl.modalidadeDetail)

export default router
```

- [ ] **Step 3: Mount em `index.ts`**

Modificar `backend/src/index.ts`, adicionar import junto dos outros:

```ts
import keyAccessRoutes from './modules/key_access/key_access.routes'
```

E adicionar antes de `app.get('/health', ...)`:

```ts
app.use('/key-access', keyAccessRoutes)
```

- [ ] **Step 4: Type-check + suite completa**

Run: `cd backend && npx tsc --noEmit && npx vitest run`
Expected: tsc sem output, vitest 207 tests passing (192 + 7 evento_keys + 8 key_access).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/key_access/key_access.controller.ts backend/src/modules/key_access/key_access.routes.ts backend/src/index.ts
git commit -m "feat(key-access): controller + rotas /key-access/*"
```

---

## Task 8: Frontend — deps + utils + types

**Files:**
- Modify: `frontend/package.json` (via npm install)
- Create: `frontend/src/types/evento-key.ts`
- Create: `frontend/src/lib/device.ts`
- Create: `frontend/src/lib/api-key.ts`

- [ ] **Step 1: Instalar qrcode.react**

Run: `cd frontend && npm install qrcode.react`
Expected: `added 1 package`. Verificar que `package.json` ganhou `"qrcode.react": "^x.y.z"` em `dependencies`.

- [ ] **Step 2: Criar types**

Criar `frontend/src/types/evento-key.ts`:

```ts
export type EventoKey = {
  id: number
  token: string
  email: string
  evento_id: number
  device_fp: string | null
  device_label: string | null
  first_used_at: string | null
  last_seen_at: string | null
  revogado_em: string | null
  criado_em: string
  criada_por: number
}
```

- [ ] **Step 3: Criar `device.ts`**

Criar `frontend/src/lib/device.ts`:

```ts
const FP_KEY = 'prosports.device_fp'

export function getDeviceFingerprint(): string {
  let fp = localStorage.getItem(FP_KEY)
  if (!fp) {
    fp = (crypto.randomUUID?.() ?? `fp-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    localStorage.setItem(FP_KEY, fp)
  }
  return fp
}

export function getDeviceLabel(): string {
  const ua = navigator.userAgent
  // Detecção simples: SO + browser
  const os =
    /iPhone|iPad/.test(ua) ? 'iPhone'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'Desconhecido'
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser'
  return `${os} ${browser}`
}
```

- [ ] **Step 4: Criar `api-key.ts`**

Criar `frontend/src/lib/api-key.ts`:

```ts
import axios from 'axios'

const KEY_TOKEN_LS = 'prosports.key_token'

export function getKeyToken(): string | null {
  return localStorage.getItem(KEY_TOKEN_LS)
}
export function setKeyToken(token: string): void {
  localStorage.setItem(KEY_TOKEN_LS, token)
}
export function clearKeyToken(): void {
  localStorage.removeItem(KEY_TOKEN_LS)
}

const apiKey = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
})

apiKey.interceptors.request.use((config) => {
  const t = getKeyToken()
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

apiKey.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      clearKeyToken()
      // Mantém rota atual; MobileShell vai detectar ausência de token e mostrar tela de erro
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/e/')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default apiKey
```

- [ ] **Step 5: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: sem output.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/types/evento-key.ts frontend/src/lib/device.ts frontend/src/lib/api-key.ts
git commit -m "feat(mobile): qrcode.react + device fingerprint + apiKey axios"
```

---

## Task 9: Frontend — services

**Files:**
- Create: `frontend/src/services/evento-keys.ts`
- Create: `frontend/src/services/key-access.ts`

- [ ] **Step 1: Criar `services/evento-keys.ts`**

Criar `frontend/src/services/evento-keys.ts`:

```ts
import api from './api'
import type { EventoKey } from '../types/evento-key'

const base = (eventoId: number) => `/eventos/${eventoId}/keys`

export const eventoKeysService = {
  listar: (eventoId: number) =>
    api.get<EventoKey[]>(base(eventoId)).then(r => r.data),
  criar: (eventoId: number, email: string) =>
    api.post<EventoKey>(base(eventoId), { email }).then(r => r.data),
  revogar: (eventoId: number, keyId: number) =>
    api.post<EventoKey>(`${base(eventoId)}/${keyId}/revoke`).then(r => r.data),
  resetDevice: (eventoId: number, keyId: number) =>
    api.post<EventoKey>(`${base(eventoId)}/${keyId}/reset-device`).then(r => r.data),
  apagar: (eventoId: number, keyId: number) =>
    api.delete(`${base(eventoId)}/${keyId}`),
}
```

- [ ] **Step 2: Criar `services/key-access.ts`**

Criar `frontend/src/services/key-access.ts`:

```ts
import apiKey from '../lib/api-key'
import type { Evento } from '../types/evento'
import type { Modalidade, TipoDisputa } from '../types/modalidade'
import type { Inscricao } from '../types/inscricao'
import type { CampeaoAnterior } from '../types/campeao-anterior'
import type { Sorteio } from '../types/sorteio'

const BASE = '/key-access'

type LoginPayload = { token: string; device_fp: string; device_label: string }
type LoginResponse = { keyToken: string; evento: Evento }

export type ModalidadeDetail = {
  modalidade: Modalidade & { tipo_modalidade: { tipo: TipoDisputa } }
  inscritos: Inscricao[]
  campeoes: CampeaoAnterior[]
  sorteio: Sorteio | null
}

export const keyAccessService = {
  login: (data: LoginPayload) =>
    apiKey.post<LoginResponse>(`${BASE}/login`, data).then(r => r.data),
  me: () =>
    apiKey.get<{ evento: Evento; valido: boolean }>(`${BASE}/me`).then(r => r.data),
  modalidades: () =>
    apiKey.get<Modalidade[]>(`${BASE}/modalidades`).then(r => r.data),
  modalidade: (id: number) =>
    apiKey.get<ModalidadeDetail>(`${BASE}/modalidade/${id}`).then(r => r.data),
}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: sem output. Se reclamar de imports faltando, verificar tipos `Inscricao`, `CampeaoAnterior`, `Sorteio` em `frontend/src/types/`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/evento-keys.ts frontend/src/services/key-access.ts
git commit -m "feat(mobile): services evento-keys (admin) + key-access (público)"
```

---

## Task 10: Admin card — AcessoMobileCard + integração no EventoForm

**Files:**
- Create: `frontend/src/pages/eventos/AcessoMobileCard.tsx`
- Modify: `frontend/src/pages/eventos/EventoForm.tsx`

- [ ] **Step 1: Criar `AcessoMobileCard.tsx`**

Criar `frontend/src/pages/eventos/AcessoMobileCard.tsx`:

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { eventoKeysService } from '../../services/evento-keys'
import type { EventoKey } from '../../types/evento-key'
import { Plus, X, Check } from '../../lib/icons'
import { Key, Smartphone, Copy, QrCode, RotateCcw, Ban, Trash2 } from 'lucide-react'

type Props = { eventoId: number }

function formatRelativo(iso: string | null): string {
  if (!iso) return 'nunca'
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min atrás`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  return `${d}d atrás`
}

export default function AcessoMobileCard({ eventoId }: Props) {
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [qrAlvo, setQrAlvo] = useState<EventoKey | null>(null)
  const [confirmAlvo, setConfirmAlvo] = useState<{ acao: 'revogar' | 'reset' | 'apagar'; key: EventoKey } | null>(null)

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['evento-keys', eventoId],
    queryFn: () => eventoKeysService.listar(eventoId),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['evento-keys', eventoId] })

  const { mutate: criar, isPending: criando } = useMutation({
    mutationFn: () => eventoKeysService.criar(eventoId, email.trim()),
    onSuccess: (nova) => { invalidate(); setEmail(''); setErro(''); setQrAlvo(nova) },
    onError: (e: any) => setErro(e?.response?.data?.message ?? 'Erro ao criar chave.'),
  })

  const { mutate: revogar } = useMutation({
    mutationFn: (id: number) => eventoKeysService.revogar(eventoId, id),
    onSuccess: invalidate,
  })
  const { mutate: resetDevice } = useMutation({
    mutationFn: (id: number) => eventoKeysService.resetDevice(eventoId, id),
    onSuccess: invalidate,
  })
  const { mutate: apagar } = useMutation({
    mutationFn: (id: number) => eventoKeysService.apagar(eventoId, id),
    onSuccess: invalidate,
    onError: (e: any) => alert(e?.response?.data?.message ?? 'Erro ao apagar.'),
  })

  function linkDe(key: EventoKey): string {
    return `${window.location.origin}/e/${key.token}`
  }
  function copiarLink(key: EventoKey) {
    navigator.clipboard.writeText(linkDe(key))
  }

  return (
    <section style={{
      background: 'var(--card-bg)', border: '1px solid var(--card-border)',
      borderRadius: 'var(--radius-xl)', padding: 24, marginBottom: 16,
      boxShadow: 'var(--shadow-card)',
    }}>
      <div className="flex items-center gap-3 mb-5">
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
          color: '#fff', display: 'grid', placeItems: 'center',
        }}>
          <Key size={18} />
        </div>
        <div>
          <div className="eyebrow">Acesso mobile</div>
          <h3 className="sec-title" style={{ fontSize: 17 }}>Chaves de visualização</h3>
        </div>
      </div>

      <p className="text-sm text-[var(--t3)] mb-4">
        Convidados podem visualizar inscritos, campeões e sorteios em tempo real através de um link/QR vinculado a este evento.
      </p>

      {/* Nova chave */}
      <div style={{
        background: 'var(--card-bg-2)', border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-lg)', padding: 14, marginBottom: 16,
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email do convidado"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--t1)] text-sm"
        />
        <button
          type="button"
          onClick={() => criar()}
          disabled={!email.trim() || criando}
          className="btn btn-primary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: !email.trim() || criando ? 0.5 : 1 }}
        >
          <Plus size={14} /> {criando ? 'Gerando...' : 'Gerar chave'}
        </button>
      </div>
      {erro && (
        <div style={{
          background: 'var(--danger-soft)', color: 'var(--danger)',
          border: '1px solid var(--danger)', borderRadius: 'var(--radius-lg)',
          padding: '8px 12px', fontSize: 13, marginBottom: 12,
        }}>{erro}</div>
      )}

      {/* Lista */}
      <div className="eyebrow mb-2">Emitidas ({keys.length})</div>
      {isLoading ? (
        <p className="text-sm text-[var(--t3)]">Carregando...</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-[var(--t4)] italic">Nenhuma chave gerada ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {keys.map(k => {
            const revogada = !!k.revogado_em
            const ativada = !!k.device_fp
            const cor = revogada ? 'var(--t4)' : ativada ? 'var(--success)' : 'var(--brand-500)'
            return (
              <div
                key={k.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px',
                  background: 'var(--card-bg-2)',
                  border: `1px solid ${revogada ? 'var(--card-border)' : cor}`,
                  borderRadius: 'var(--radius-lg)',
                  opacity: revogada ? 0.6 : 1,
                }}
              >
                <Smartphone size={18} style={{ color: cor, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-sm font-semibold text-[var(--t1)] truncate"
                       style={{ textDecoration: revogada ? 'line-through' : 'none' }}>
                    {k.email}
                  </div>
                  <div className="text-xs text-[var(--t3)] mt-0.5">
                    {revogada
                      ? `Revogada ${formatRelativo(k.revogado_em)}`
                      : ativada
                      ? `${k.device_label} · ${formatRelativo(k.last_seen_at)}`
                      : 'Nunca acessada'}
                  </div>
                </div>
                {!revogada && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => copiarLink(k)} title="Copiar link" className="p-1.5 rounded hover:bg-[var(--card-bg)] text-[var(--t3)]">
                      <Copy size={14} />
                    </button>
                    <button onClick={() => setQrAlvo(k)} title="QR code" className="p-1.5 rounded hover:bg-[var(--card-bg)] text-[var(--t3)]">
                      <QrCode size={14} />
                    </button>
                    {ativada && (
                      <button onClick={() => setConfirmAlvo({ acao: 'reset', key: k })} title="Reset device" className="p-1.5 rounded hover:bg-[var(--card-bg)] text-[var(--brand-500)]">
                        <RotateCcw size={14} />
                      </button>
                    )}
                    {ativada ? (
                      <button onClick={() => setConfirmAlvo({ acao: 'revogar', key: k })} title="Revogar" className="p-1.5 rounded hover:bg-[var(--card-bg)] text-[var(--danger)]">
                        <Ban size={14} />
                      </button>
                    ) : (
                      <button onClick={() => setConfirmAlvo({ acao: 'apagar', key: k })} title="Apagar" className="p-1.5 rounded hover:bg-[var(--card-bg)] text-[var(--danger)]">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal QR */}
      {qrAlvo && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 310 }}
          onClick={() => setQrAlvo(null)}
        >
          <div
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-2xl)', padding: 32, maxWidth: 420, width: '100%', margin: '0 16px', textAlign: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2 text-[var(--t1)]">Acesso de {qrAlvo.email}</h3>
            <p className="text-xs text-[var(--t3)] mb-4">Escaneie o QR ou envie o link.</p>
            <div style={{ display: 'inline-block', background: '#fff', padding: 12, borderRadius: 12 }}>
              <QRCodeSVG value={linkDe(qrAlvo)} size={240} />
            </div>
            <div style={{
              marginTop: 16, padding: '8px 12px', background: 'var(--card-bg-2)',
              border: '1px solid var(--card-border)', borderRadius: 'var(--radius-md)',
              fontSize: 12, fontFamily: 'var(--font-mono)', wordBreak: 'break-all',
            }}>{linkDe(qrAlvo)}</div>
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => copiarLink(qrAlvo)} className="btn btn-ghost btn-sm">
                <Copy size={14} /> Copiar link
              </button>
              <button onClick={() => setQrAlvo(null)} className="btn btn-primary btn-sm">
                <Check size={14} /> Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmação ações destrutivas */}
      {confirmAlvo && (() => {
        const { acao, key } = confirmAlvo
        const titulos = {
          revogar: { t: 'Revogar chave?', d: `O convidado ${key.email} será deslogado na próxima request. Histórico preservado.`, btn: 'Revogar', danger: true, ico: Ban },
          reset: { t: 'Resetar device?', d: `A chave de ${key.email} poderá ser usada em um novo aparelho.`, btn: 'Resetar', danger: false, ico: RotateCcw },
          apagar: { t: 'Apagar chave?', d: `A chave de ${key.email} será removida permanentemente.`, btn: 'Apagar', danger: true, ico: Trash2 },
        }
        const cfg = titulos[acao]
        const Ico = cfg.ico
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 310 }}
            onClick={() => setConfirmAlvo(null)}
          >
            <div
              style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-2xl)', padding: 32, maxWidth: 480, width: '100%', margin: '0 16px', textAlign: 'center' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{
                width: 72, height: 72, margin: '0 auto 16px', borderRadius: '50%',
                background: cfg.danger ? 'var(--danger-soft)' : 'var(--brand-50)',
                color: cfg.danger ? 'var(--danger)' : 'var(--brand-500)',
                display: 'grid', placeItems: 'center',
              }}><Ico size={36} /></div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>{cfg.t}</h3>
              <p style={{ fontSize: 15, color: 'var(--t3)', marginBottom: 24 }}>{cfg.d}</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => setConfirmAlvo(null)} className="btn btn-ghost">
                  <X size={16} /> Cancelar
                </button>
                <button
                  onClick={() => {
                    if (acao === 'revogar') revogar(key.id)
                    else if (acao === 'reset') resetDevice(key.id)
                    else apagar(key.id)
                    setConfirmAlvo(null)
                  }}
                  style={{
                    background: cfg.danger ? 'var(--danger)' : 'var(--brand-500)',
                    color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)',
                    padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Ico size={16} /> {cfg.btn}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </section>
  )
}
```

- [ ] **Step 2: Incluir `<AcessoMobileCard />` em `EventoForm.tsx`**

Localizar onde está o card de logo (na branch `isEdit`):

Run: `grep -n "Logotipo do evento" frontend/src/pages/eventos/EventoForm.tsx`

Adicionar import no topo:

```tsx
import AcessoMobileCard from './AcessoMobileCard'
```

E logo após o `</section>` do card de logo (dentro do `{isEdit && (...)}` se aplicável), adicionar:

```tsx
{isEdit && <AcessoMobileCard eventoId={Number(id)} />}
```

(Se já houver outro `{isEdit && ...}`, fica adjacente.)

- [ ] **Step 3: Build frontend**

Run: `cd frontend && npm run build`
Expected: `✓ built` sem erros TS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/eventos/AcessoMobileCard.tsx frontend/src/pages/eventos/EventoForm.tsx
git commit -m "feat(eventos): card 'Acesso mobile' com QR, lista e gestão de chaves"
```

---

## Task 11: Mobile — Shell + Login

**Files:**
- Create: `frontend/src/pages/mobile/MobileShell.tsx`
- Create: `frontend/src/pages/mobile/MobileLogin.tsx`

- [ ] **Step 1: Criar `MobileShell.tsx`**

Criar `frontend/src/pages/mobile/MobileShell.tsx`:

```tsx
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Evento } from '../../types/evento'
import { clearKeyToken } from '../../lib/api-key'
import LogoMontana from '../../components/LogoMontana'
import { LogOut, ArrowLeft, RefreshCw } from 'lucide-react'

type Props = {
  evento: Evento | null
  showBack?: boolean
  onBack?: () => void
  onRefresh?: () => void
  children: ReactNode
}

export default function MobileShell({ evento, showBack, onBack, onRefresh, children }: Props) {
  const navigate = useNavigate()

  function sair() {
    clearKeyToken()
    navigate('/login', { replace: true })
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--card-bg-2)',
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--grad-brand-deep)', color: '#fff',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}>
        {showBack ? (
          <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}>
            <ArrowLeft size={22} />
          </button>
        ) : evento?.logo_url ? (
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.95)', padding: 4, display: 'grid', placeItems: 'center' }}>
            <img src={evento.logo_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.95)', padding: 4, display: 'grid', placeItems: 'center' }}>
            <LogoMontana variant="simbolo" height={28} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {evento?.nome ?? '—'}
          </div>
          {evento && (
            <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>
              {evento.competicao?.nome ?? ''}
            </div>
          )}
        </div>
        {onRefresh && (
          <button onClick={onRefresh} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }} title="Atualizar">
            <RefreshCw size={20} />
          </button>
        )}
        <button onClick={sair} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }} title="Sair">
          <LogOut size={20} />
        </button>
      </header>

      <main style={{ flex: 1, padding: 12, maxWidth: 720, margin: '0 auto', width: '100%' }}>
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Criar `MobileLogin.tsx`**

Criar `frontend/src/pages/mobile/MobileLogin.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { keyAccessService } from '../../services/key-access'
import { getDeviceFingerprint, getDeviceLabel } from '../../lib/device'
import { setKeyToken } from '../../lib/api-key'
import LogoMontana from '../../components/LogoMontana'

export default function MobileLogin() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { setErro('Link inválido.'); setLoading(false); return }
    keyAccessService.login({
      token,
      device_fp: getDeviceFingerprint(),
      device_label: getDeviceLabel(),
    })
      .then(r => {
        setKeyToken(r.keyToken)
        navigate('/m', { replace: true })
      })
      .catch((e: any) => {
        const code = e?.response?.data?.code
        const msg = e?.response?.data?.message
        if (code === 'device_mismatch') {
          setErro(msg ?? 'Esta chave já está em uso em outro aparelho. Solicite ao organizador o reset.')
        } else {
          setErro(msg ?? 'Chave inválida ou revogada.')
        }
        setLoading(false)
      })
  }, [token, navigate])

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--grad-brand-deep)', color: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 20, gap: 24,
    }}>
      <div style={{ background: 'rgba(255,255,255,0.96)', borderRadius: 18, padding: 16, boxShadow: '0 12px 28px rgba(0,0,0,0.3)' }}>
        <LogoMontana variant="simbolo" height={64} />
      </div>
      {loading && <p style={{ fontSize: 16, opacity: 0.85 }}>Validando acesso...</p>}
      {erro && (
        <div style={{
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)',
          padding: '14px 18px', borderRadius: 12, maxWidth: 420, textAlign: 'center', fontSize: 14,
        }}>
          {erro}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: sem output.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/mobile/MobileShell.tsx frontend/src/pages/mobile/MobileLogin.tsx
git commit -m "feat(mobile): Shell layout sticky + Login com first-use lock"
```

---

## Task 12: Mobile — Modalidades (lista) + Modalidade (detalhe)

**Files:**
- Create: `frontend/src/pages/mobile/MobileModalidades.tsx`
- Create: `frontend/src/pages/mobile/MobileModalidade.tsx`

- [ ] **Step 1: Criar `MobileModalidades.tsx`**

Criar `frontend/src/pages/mobile/MobileModalidades.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { keyAccessService } from '../../services/key-access'
import MobileShell from './MobileShell'
import { Brackets, Group, ListOrdered, FileText, Check } from 'lucide-react'

const TIPO_ICON: Record<string, any> = {
  chaves: Brackets, grupos: Group, ordem_entrada: ListOrdered, especifico: FileText,
}
const TIPO_GRAD: Record<string, string> = {
  chaves: 'linear-gradient(135deg,#1061d8,#4f8ef7)',
  grupos: 'linear-gradient(135deg,#0d9488,#14b88a)',
  ordem_entrada: 'linear-gradient(135deg,#d97706,#f59e0b)',
  especifico: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
}

export default function MobileModalidades() {
  const navigate = useNavigate()
  const { data: evento } = useQuery({
    queryKey: ['key-access', 'me'],
    queryFn: keyAccessService.me,
    refetchInterval: 60_000,
    select: r => r.evento,
  })
  const { data: modalidades = [], isLoading, refetch } = useQuery({
    queryKey: ['key-access', 'modalidades'],
    queryFn: keyAccessService.modalidades,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })

  return (
    <MobileShell evento={evento ?? null} onRefresh={() => refetch()}>
      <div style={{ marginBottom: 12 }}>
        <div className="eyebrow" style={{ color: 'var(--t3)' }}>Modalidades</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: '4px 0 0' }}>
          {modalidades.length} {modalidades.length === 1 ? 'modalidade' : 'modalidades'}
        </h2>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--t3)]">Carregando...</p>
      ) : modalidades.length === 0 ? (
        <p className="text-sm text-[var(--t4)] italic">Nenhuma modalidade.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {modalidades.map((m: any) => {
            const tipo = m.tipo_modalidade?.tipo ?? 'especifico'
            const Icon = TIPO_ICON[tipo] ?? FileText
            const grad = TIPO_GRAD[tipo]
            return (
              <button
                key={m.id}
                onClick={() => navigate(`/m/${m.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px',
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 'var(--radius-xl)',
                  textAlign: 'left', cursor: 'pointer', width: '100%',
                }}
              >
                <span style={{
                  width: 40, height: 40, borderRadius: 10, background: grad,
                  color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0,
                }}>
                  <Icon size={20} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{m.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
                    {m.sigla} · {tipo === 'especifico' ? 'Específico' : tipo === 'ordem_entrada' ? 'Ordem' : tipo[0].toUpperCase() + tipo.slice(1)}
                  </div>
                </div>
                <Check size={16} style={{ color: 'var(--t4)' }} />
              </button>
            )
          })}
        </div>
      )}
    </MobileShell>
  )
}
```

- [ ] **Step 2: Criar `MobileModalidade.tsx`**

Criar `frontend/src/pages/mobile/MobileModalidade.tsx`:

```tsx
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { keyAccessService } from '../../services/key-access'
import MobileShell from './MobileShell'
import SorteioGrupos from '../../components/sorteio-result/SorteioGrupos'
import SorteioChaves from '../../components/sorteio-result/SorteioChaves'
import SorteioOrdem from '../../components/sorteio-result/SorteioOrdem'
import CampeaoBadge from '../../components/CampeaoBadge'
import { composeSubtituloLine } from '../../lib/compose-subtitulo'
import type { Participante } from '../../types/participante'

type Tab = 'inscritos' | 'campeoes' | 'sorteio'

export default function MobileModalidade() {
  const { id } = useParams()
  const navigate = useNavigate()
  const modalidadeId = Number(id)
  const [tab, setTab] = useState<Tab>('inscritos')

  const { data: evento } = useQuery({
    queryKey: ['key-access', 'me'],
    queryFn: keyAccessService.me,
    select: r => r.evento,
  })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['key-access', 'modalidade', modalidadeId],
    queryFn: () => keyAccessService.modalidade(modalidadeId),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })

  const campos = evento?.competicao?.subtitulo_campos ?? []
  const subtituloLine = (p: any) => composeSubtituloLine(p, campos)

  const participantesById = useMemo(() => {
    const m = new Map<number, Participante>()
    for (const i of data?.inscritos ?? []) m.set(i.participante_id, i.participante as any)
    return m
  }, [data])

  const campeoesByParticipanteId = useMemo(() => {
    const m = new Map<number, number>()
    for (const c of data?.campeoes ?? []) m.set(c.participante_id, c.posicao)
    return m
  }, [data])

  const tipo = data?.modalidade.tipo_modalidade?.tipo
  const sorteioDisponivel = !!data?.sorteio && tipo !== 'especifico'

  return (
    <MobileShell evento={evento ?? null} showBack onBack={() => navigate('/m')} onRefresh={() => refetch()}>
      {isLoading || !data ? (
        <p className="text-sm text-[var(--t3)]">Carregando...</p>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>
              {data.modalidade.nome}
            </h2>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>
              {data.modalidade.sigla}
            </div>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 4, padding: 4,
            background: 'var(--card-bg)', border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-lg)', marginBottom: 12,
          }}>
            {(['inscritos', 'campeoes', 'sorteio'] as Tab[]).map(t => {
              const label = t === 'inscritos' ? 'Inscritos' : t === 'campeoes' ? 'Campeões' : 'Sorteio'
              const ativo = tab === t
              const disabled = t === 'sorteio' && !sorteioDisponivel
              return (
                <button
                  key={t}
                  onClick={() => !disabled && setTab(t)}
                  disabled={disabled}
                  style={{
                    flex: 1, padding: '8px 6px', borderRadius: 'var(--radius-md)',
                    background: ativo ? 'var(--brand-500)' : 'transparent',
                    color: ativo ? '#fff' : disabled ? 'var(--t4)' : 'var(--t2)',
                    border: 'none', fontSize: 12, fontWeight: 600,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Conteúdo */}
          {tab === 'inscritos' && (
            <div style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-lg)', padding: 12,
            }}>
              {data.inscritos.length === 0 ? (
                <p className="text-sm text-[var(--t4)] italic">Nenhum inscrito.</p>
              ) : (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.inscritos.map((i, idx) => {
                    const pos = campeoesByParticipanteId.get(i.participante_id)
                    const linha = subtituloLine(i.participante)
                    return (
                      <li key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--t4)', fontSize: 11, minWidth: 22 }}>
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--t1)' }}>{i.participante.nome}</div>
                          {linha && <div style={{ fontSize: 11, color: 'var(--t3)' }}>{linha}</div>}
                        </div>
                        {pos && <CampeaoBadge posicao={pos} />}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {tab === 'campeoes' && (
            <div style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-lg)', padding: 12,
            }}>
              {data.campeoes.length === 0 ? (
                <p className="text-sm text-[var(--t4)] italic">Nenhum campeão anterior cadastrado.</p>
              ) : (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.campeoes.map(c => {
                    const linha = subtituloLine(c.participante)
                    return (
                      <li key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <CampeaoBadge posicao={c.posicao} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--t1)' }}>{c.participante.nome}</div>
                          {linha && <div style={{ fontSize: 11, color: 'var(--t3)' }}>{linha}</div>}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {tab === 'sorteio' && data.sorteio && (
            <div style={{ overflowX: 'auto' }}>
              {data.sorteio.tipo === 'grupos' && (
                <SorteioGrupos
                  resultado={data.sorteio.resultado as any}
                  participantesById={participantesById}
                  campeoesByParticipanteId={campeoesByParticipanteId}
                  anfitriaoPid={evento?.anfitriao_id ?? null}
                  subtituloLine={subtituloLine}
                />
              )}
              {data.sorteio.tipo === 'chaves' && (
                <SorteioChaves
                  resultado={data.sorteio.resultado as any}
                  participantesById={participantesById}
                  campeoesByParticipanteId={campeoesByParticipanteId}
                  anfitriaoPid={evento?.anfitriao_id ?? null}
                  subtituloLine={subtituloLine}
                />
              )}
              {data.sorteio.tipo === 'ordem_entrada' && (
                <SorteioOrdem
                  resultado={data.sorteio.resultado as any}
                  participantesById={participantesById}
                  anfitriaoPid={evento?.anfitriao_id ?? null}
                  subtituloLine={subtituloLine}
                />
              )}
            </div>
          )}
          {tab === 'sorteio' && !data.sorteio && (
            <div style={{
              background: 'var(--card-bg-2)', border: '1px dashed var(--card-border)',
              borderRadius: 'var(--radius-lg)', padding: 24, textAlign: 'center',
              fontSize: 13, color: 'var(--t3)',
            }}>
              {tipo === 'especifico'
                ? 'Modalidade sem sorteio automático.'
                : 'Sorteio ainda não realizado.'}
            </div>
          )}
        </>
      )}
    </MobileShell>
  )
}
```

- [ ] **Step 3: Adicionar rotas em `App.tsx`**

Modificar `frontend/src/App.tsx`, adicionar imports junto dos outros:

```tsx
import MobileLogin from './pages/mobile/MobileLogin'
import MobileModalidades from './pages/mobile/MobileModalidades'
import MobileModalidade from './pages/mobile/MobileModalidade'
```

E adicionar as rotas FORA do `<Layout>` (junto da rota `/login`):

```tsx
<Route path="/e/:token" element={<MobileLogin />} />
<Route path="/m" element={<MobileModalidades />} />
<Route path="/m/:id" element={<MobileModalidade />} />
```

- [ ] **Step 4: Build**

Run: `cd frontend && npm run build`
Expected: `✓ built` sem erros TS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/mobile/MobileModalidades.tsx frontend/src/pages/mobile/MobileModalidade.tsx frontend/src/App.tsx
git commit -m "feat(mobile): lista de modalidades + detalhe com 3 tabs + polling 15s"
```

---

## Task 13: Release v1.46.0

**Files:**
- Modify: `package.json`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Bump version**

Modificar `package.json`: trocar `"version": "1.45.1"` por `"version": "1.46.0"`.

- [ ] **Step 2: Adicionar entrada no CHANGELOG**

No topo do `CHANGELOG.md`, adicionar antes da `## [1.45.1]`:

```markdown
## [1.46.0] - 2026-06-02

### Added (Acesso mobile via chave)
- **Schema**: novo model `EventoKey` com unique `(evento_id, email)`. Migration `20260602000000_evento_keys`.
- **Backend**:
  - 5 rotas admin em `/eventos/:id/keys` (listar/criar/revogar/reset-device/apagar)
  - 4 rotas públicas em `/key-access/*` (login + me + modalidades + modalidade/:id)
  - `key-jwt.ts` (sign/verify com `type: 'event-key'`), `requireEventoKey` middleware
  - First-use device lock: primeiro acesso grava `device_fp`; tentativas em outro device → 403
  - 19 novos testes (192 → 211 passing)
- **Admin UI**: novo card "Acesso mobile" no `EventoForm` com geração de chaves, QR code, lista com auditoria (device_label + last_seen relativo), modais de Revogar/Reset/Apagar
- **Mobile UI** (rotas `/e/:token` + `/m` + `/m/:id`):
  - `MobileLogin` valida chave, gera device fingerprint (localStorage UUID + UA parse), salva keyToken
  - `MobileModalidades` lista modalidades do evento, polling 15s
  - `MobileModalidade` 3 tabs (Inscritos / Campeões / Sorteio), reusa componentes `SorteioGrupos/Chaves/Ordem`, polling 15s
  - `MobileShell` header sticky com logo do evento (fallback Montana), botões refresh + sair
- **Lib nova**: `qrcode.react` para renderizar QR no admin
- Polling 15s read-only via React Query (`refetchInterval` + `refetchIntervalInBackground: false`)
```

- [ ] **Step 3: Build final + tests**

Run: `cd backend && npx vitest run`
Expected: 211 tests passing.

Run: `cd frontend && npm run build`
Expected: `✓ built`.

- [ ] **Step 4: Commit + push**

```bash
git add package.json CHANGELOG.md
git commit -m "release(v1.46.0): acesso mobile via chave"
git push origin develop
```

CI deploy ~3-5min.

- [ ] **Step 5: Smoke test em prod (manual)**

1. Abrir `/eventos/:id/editar` na web → card "Acesso mobile" aparece
2. Gerar chave com seu email → modal QR aparece automaticamente
3. Copiar link, abrir em outro browser/celular → tela validando → lista de modalidades
4. Selecionar modalidade → 3 tabs aparecem; Sorteio mostra/aguarda conforme tipo
5. Voltar pro admin → lista mostra device_label + "agora"
6. Clicar Revogar → próxima request no celular deve dar 401 e redirect
