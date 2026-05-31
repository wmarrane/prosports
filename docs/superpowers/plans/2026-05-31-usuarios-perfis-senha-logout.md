# Usuários, perfis, alterar senha e logout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar CRUD de usuários (admin-only), endpoint+UI para o usuário trocar a própria senha, reset de senha pelo admin, botão de logout funcional e popover de menu de usuário na sidebar.

**Architecture:** Backend ganha novo módulo `users/` seguindo o padrão de `municipios/` (service + controller + schemas + routes registrados em `index.ts`), além de um endpoint `POST /auth/alterar-senha`. Frontend ganha 5 páginas novas (`/usuarios`, `/usuarios/novo`, `/usuarios/:id/editar`, `/conta`, `/conta/senha`), um popover de menu de usuário, e modificações em `Sidebar.tsx`, `App.tsx`, `authStore.ts`. Sem migration de schema — o model `User` já tem todos os campos necessários.

**Tech Stack:** Express + Prisma + Zod + Vitest (backend), React 18 + React Router 6 + Zustand + Tanstack Query + Axios (frontend), bcryptjs + JWT + Redis (auth — já existentes).

**Spec:** `docs/superpowers/specs/2026-05-31-usuarios-perfis-senha-logout-design.md`

**Padrões importantes do projeto:**
- Backend mounta rotas sem prefixo `/api`: `app.use('/auth', ...)`, `app.use('/users', ...)`. O frontend usa axios com `baseURL = '/api'` e Vite proxy rewrite — então `api.post('/users')` ↔ `POST /users` no backend.
- Erros lançados nos services usam `Object.assign(new Error('msg'), { status: 400 })` — o `errorHandler` global converte para resposta JSON.
- Tests com Vitest, mock do Prisma via `vi.mock('../../lib/prisma', ...)`. Test files ao lado do código: `users.service.test.ts`.
- Frontend services não tratam erro — bubbla para o componente, que lê `err?.response?.data?.message`.
- DataTable em card + busca client-side é o padrão para listas (ver `ParticipantesList.tsx`).
- Form em cards seccionados com ícone gradient, eyebrow, asterisco vermelho em obrigatórios, action bar Cancelar+Salvar (ver `ParticipanteForm.tsx`).
- ProtectedRoute (`frontend/src/components/ProtectedRoute.tsx`) já aceita prop `roles?: Role[]` — usar para proteger rotas admin.

---

## Backend

### Task 1: Users service — `listar` e `buscarPorId`

**Files:**
- Create: `backend/src/modules/users/users.service.ts`
- Create: `backend/src/modules/users/users.service.test.ts`

- [ ] **Step 1: Escrever os testes falhantes**

`backend/src/modules/users/users.service.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}))

vi.mock('../auth/auth.service', () => ({
  hashSenha: vi.fn(async (s: string) => `hashed:${s}`),
  revogarTodosRefreshTokens: vi.fn(async () => {}),
}))

import prisma from '../../lib/prisma'
import * as service from './users.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('users.service', () => {
  describe('listar', () => {
    it('retorna usuários ordenados por nome (sem senha_hash)', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 1, nome: 'Alice', email: 'a@x.com', role: 'ADMIN', ativo: true, ultimo_login: null, criado_em: new Date(), atualizado_em: new Date() },
      ])
      const result = await service.listar()
      expect(result).toHaveLength(1)
      expect(result[0]).not.toHaveProperty('senha_hash')
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        orderBy: { nome: 'asc' },
        select: expect.objectContaining({ senha_hash: false }),
      })
    })
  })

  describe('buscarPorId', () => {
    it('retorna usuário sem senha_hash', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1, nome: 'Alice', email: 'a@x.com', role: 'ADMIN', ativo: true,
      })
      const result = await service.buscarPorId(1)
      expect(result).not.toHaveProperty('senha_hash')
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: expect.objectContaining({ senha_hash: false }),
      })
    })

    it('lança 404 quando não encontrado', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
    })
  })
})
```

- [ ] **Step 2: Rodar testes para confirmar que falham**

```
cd backend && npx vitest run src/modules/users/users.service.test.ts --reporter=verbose
```

Esperado: FAIL com "Cannot find module './users.service'".

- [ ] **Step 3: Implementar listar + buscarPorId**

`backend/src/modules/users/users.service.ts`:
```typescript
import prisma from '../../lib/prisma'

const USER_SELECT = {
  id: true,
  nome: true,
  email: true,
  role: true,
  ativo: true,
  ultimo_login: true,
  criado_em: true,
  atualizado_em: true,
  senha_hash: false,
  tentativas_login: false,
  bloqueado_ate: false,
} as const

export async function listar() {
  return prisma.user.findMany({
    orderBy: { nome: 'asc' },
    select: USER_SELECT,
  })
}

export async function buscarPorId(id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: USER_SELECT,
  })
  if (!user) throw Object.assign(new Error('Usuário não encontrado'), { status: 404 })
  return user
}
```

- [ ] **Step 4: Rodar testes para confirmar que passam**

```
cd backend && npx vitest run src/modules/users/users.service.test.ts --reporter=verbose
```

Esperado: PASS para os 3 testes.

- [ ] **Step 5: Commit**

```
git add backend/src/modules/users/
git commit -m "feat(users): listar e buscarPorId no service"
```

---

### Task 2: Users service — `criar`

**Files:**
- Modify: `backend/src/modules/users/users.service.ts`
- Modify: `backend/src/modules/users/users.service.test.ts`

- [ ] **Step 1: Adicionar testes falhantes para `criar`**

Adicione dentro do `describe('users.service', ...)` em `users.service.test.ts`:
```typescript
  describe('criar', () => {
    it('cria usuário com senha hash', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null)
      mockPrisma.user.create.mockResolvedValue({
        id: 1, nome: 'Bob', email: 'b@x.com', role: 'VIEWER', ativo: true,
      })
      const result = await service.criar({
        nome: 'Bob', email: 'b@x.com', role: 'VIEWER', senha: 'segredo123',
      })
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          nome: 'Bob',
          email: 'b@x.com',
          role: 'VIEWER',
          senha_hash: 'hashed:segredo123',
        },
        select: expect.any(Object),
      })
      expect(result).not.toHaveProperty('senha_hash')
    })

    it('falha com 400 se email já existe', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 9 })
      await expect(
        service.criar({ nome: 'X', email: 'dup@x.com', role: 'VIEWER', senha: 'segredo123' })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('Email') })
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })
  })
```

- [ ] **Step 2: Rodar testes — confirmar falha**

```
cd backend && npx vitest run src/modules/users/users.service.test.ts -t criar --reporter=verbose
```

Esperado: FAIL com "service.criar is not a function".

- [ ] **Step 3: Implementar `criar`**

Adicione no topo de `users.service.ts`:
```typescript
import { hashSenha } from '../auth/auth.service'
import type { Role } from '@prisma/client'

export type CriarPayload = {
  nome: string
  email: string
  role: Role
  senha: string
}
```

E ao final do arquivo:
```typescript
export async function criar(payload: CriarPayload) {
  const exists = await prisma.user.findFirst({ where: { email: payload.email } })
  if (exists) {
    throw Object.assign(new Error('Email já cadastrado'), { status: 400 })
  }
  const senha_hash = await hashSenha(payload.senha)
  return prisma.user.create({
    data: {
      nome: payload.nome,
      email: payload.email,
      role: payload.role,
      senha_hash,
    },
    select: USER_SELECT,
  })
}
```

- [ ] **Step 4: Rodar testes — confirmar passam**

```
cd backend && npx vitest run src/modules/users/users.service.test.ts --reporter=verbose
```

Esperado: PASS para os 5 testes.

- [ ] **Step 5: Commit**

```
git add backend/src/modules/users/
git commit -m "feat(users): criar usuario com validacao de email duplicado"
```

---

### Task 3: Users service — `editar`

**Files:**
- Modify: `backend/src/modules/users/users.service.ts`
- Modify: `backend/src/modules/users/users.service.test.ts`

- [ ] **Step 1: Adicionar testes falhantes para `editar`**

Adicione dentro do `describe('users.service', ...)`:
```typescript
  describe('editar', () => {
    it('edita campos permitidos sem mexer em senha_hash', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1, role: 'PARTICIPANTE', ativo: true,
      })
      mockPrisma.user.update.mockResolvedValue({ id: 1, nome: 'Novo', email: 'n@x.com' })
      await service.editar(1, { nome: 'Novo', email: 'n@x.com' }, { sub: 9, role: 'ADMIN' })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { nome: 'Novo', email: 'n@x.com' },
        select: expect.any(Object),
      })
    })

    it('falha 400 ao tentar desativar a si mesmo', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, role: 'ADMIN', ativo: true })
      await expect(
        service.editar(1, { ativo: false }, { sub: 1, role: 'ADMIN' })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('desativar a si') })
    })

    it('falha 400 ao tentar rebaixar o próprio role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, role: 'ADMIN', ativo: true })
      await expect(
        service.editar(1, { role: 'VIEWER' }, { sub: 1, role: 'ADMIN' })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('rebaixar') })
    })

    it('falha 400 ao deixar sistema sem ADMIN ativo (desativando único admin)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 5, role: 'ADMIN', ativo: true })
      mockPrisma.user.count.mockResolvedValue(1)
      await expect(
        service.editar(5, { ativo: false }, { sub: 9, role: 'ADMIN' })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('último') })
    })

    it('falha 400 ao deixar sistema sem ADMIN ativo (rebaixando único admin)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 5, role: 'ADMIN', ativo: true })
      mockPrisma.user.count.mockResolvedValue(1)
      await expect(
        service.editar(5, { role: 'VIEWER' }, { sub: 9, role: 'ADMIN' })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('último') })
    })

    it('falha 400 quando email novo conflita com outro usuário', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, email: 'old@x.com', role: 'VIEWER', ativo: true })
      mockPrisma.user.findFirst.mockResolvedValue({ id: 2 })
      await expect(
        service.editar(1, { email: 'novo@x.com' }, { sub: 9, role: 'ADMIN' })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('Email') })
    })

    it('lança 404 se usuário-alvo não existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      await expect(
        service.editar(99, { nome: 'X' }, { sub: 9, role: 'ADMIN' })
      ).rejects.toMatchObject({ status: 404 })
    })
  })
```

- [ ] **Step 2: Rodar testes — confirmar falha**

```
cd backend && npx vitest run src/modules/users/users.service.test.ts -t editar --reporter=verbose
```

Esperado: FAIL com "service.editar is not a function".

- [ ] **Step 3: Implementar `editar`**

Adicione `EditarPayload` e `CallerCtx` ao type block:
```typescript
export type EditarPayload = {
  nome?: string
  email?: string
  role?: Role
  ativo?: boolean
}

export type CallerCtx = {
  sub: number   // id do usuário autenticado
  role: string
}
```

E ao final do arquivo:
```typescript
async function ensureNotLastActiveAdmin(targetId: number) {
  const adminsAtivos = await prisma.user.count({
    where: { role: 'ADMIN', ativo: true, NOT: { id: targetId } },
  })
  if (adminsAtivos === 0) {
    throw Object.assign(
      new Error('Operação negada: este é o último ADMIN ativo do sistema.'),
      { status: 400 }
    )
  }
}

export async function editar(id: number, payload: EditarPayload, caller: CallerCtx) {
  const alvo = await prisma.user.findUnique({ where: { id } })
  if (!alvo) throw Object.assign(new Error('Usuário não encontrado'), { status: 404 })

  // Auto-proteções
  if (caller.sub === id) {
    if (payload.ativo === false) {
      throw Object.assign(new Error('Você não pode desativar a si mesmo.'), { status: 400 })
    }
    if (payload.role && payload.role !== alvo.role && alvo.role === 'ADMIN') {
      throw Object.assign(new Error('Você não pode rebaixar a si mesmo.'), { status: 400 })
    }
  }

  // Último admin ativo
  const desativando = payload.ativo === false
  const rebaixando = payload.role && payload.role !== 'ADMIN'
  if (alvo.role === 'ADMIN' && alvo.ativo && (desativando || rebaixando)) {
    await ensureNotLastActiveAdmin(id)
  }

  // Email único
  if (payload.email && payload.email !== alvo.email) {
    const conflict = await prisma.user.findFirst({
      where: { email: payload.email, NOT: { id } },
    })
    if (conflict) {
      throw Object.assign(new Error('Email já cadastrado'), { status: 400 })
    }
  }

  return prisma.user.update({
    where: { id },
    data: payload,
    select: USER_SELECT,
  })
}
```

- [ ] **Step 4: Rodar testes — confirmar passam**

```
cd backend && npx vitest run src/modules/users/users.service.test.ts --reporter=verbose
```

Esperado: PASS para os 12 testes.

- [ ] **Step 5: Commit**

```
git add backend/src/modules/users/
git commit -m "feat(users): editar com auto-protecao e ultimo admin"
```

---

### Task 4: Users service — `remover`

**Files:**
- Modify: `backend/src/modules/users/users.service.ts`
- Modify: `backend/src/modules/users/users.service.test.ts`

- [ ] **Step 1: Adicionar testes falhantes para `remover`**

Adicione dentro do `describe('users.service', ...)`:
```typescript
  describe('remover', () => {
    it('remove usuário', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 2, role: 'VIEWER', ativo: true })
      mockPrisma.user.delete.mockResolvedValue({ id: 2 })
      await service.remover(2, { sub: 1, role: 'ADMIN' })
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 2 } })
    })

    it('falha 400 ao tentar remover a si mesmo', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1, role: 'ADMIN', ativo: true })
      await expect(
        service.remover(1, { sub: 1, role: 'ADMIN' })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('remover a si') })
    })

    it('falha 400 ao remover último admin ativo', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 5, role: 'ADMIN', ativo: true })
      mockPrisma.user.count.mockResolvedValue(0)
      await expect(
        service.remover(5, { sub: 9, role: 'ADMIN' })
      ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('último') })
    })

    it('lança 404 se usuário não existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      await expect(
        service.remover(99, { sub: 1, role: 'ADMIN' })
      ).rejects.toMatchObject({ status: 404 })
    })
  })
```

- [ ] **Step 2: Rodar testes — confirmar falha**

```
cd backend && npx vitest run src/modules/users/users.service.test.ts -t remover --reporter=verbose
```

Esperado: FAIL com "service.remover is not a function".

- [ ] **Step 3: Implementar `remover`**

Adicione ao final de `users.service.ts`:
```typescript
export async function remover(id: number, caller: CallerCtx) {
  if (caller.sub === id) {
    throw Object.assign(new Error('Você não pode remover a si mesmo.'), { status: 400 })
  }
  const alvo = await prisma.user.findUnique({ where: { id } })
  if (!alvo) throw Object.assign(new Error('Usuário não encontrado'), { status: 404 })

  if (alvo.role === 'ADMIN' && alvo.ativo) {
    await ensureNotLastActiveAdmin(id)
  }

  return prisma.user.delete({ where: { id } })
}
```

- [ ] **Step 4: Rodar testes — confirmar passam**

```
cd backend && npx vitest run src/modules/users/users.service.test.ts --reporter=verbose
```

Esperado: PASS para os 16 testes.

- [ ] **Step 5: Commit**

```
git add backend/src/modules/users/
git commit -m "feat(users): remover com auto-protecao e ultimo admin"
```

---

### Task 5: Auth service — helper `revogarTodosRefreshTokens`

**Files:**
- Modify: `backend/src/modules/auth/auth.service.ts`

Razão: tanto o `resetarSenha` (admin reseta outro) quanto o futuro `alterarSenha` (usuário troca a própria) precisam invalidar TODAS as sessões ativas do usuário-alvo (não só a current). Adicionamos um helper que usa Redis SCAN para listar e remover todas as chaves `refresh:${userId}:*`.

- [ ] **Step 1: Verificar a API do Redis client em uso**

Inspecionar `backend/src/lib/redis.ts` para saber se é `node-redis` (v4+, usa `scanIterator`) ou `ioredis`.

```
cd backend && grep -E "redis|Redis" src/lib/redis.ts | head -20
```

Esperado: identificar o client. Se for `node-redis` v4, usar `redis.scanIterator({ MATCH: ..., COUNT: 100 })`.

- [ ] **Step 2: Adicionar a função `revogarTodosRefreshTokens` em `auth.service.ts`**

Adicione ao final do arquivo `backend/src/modules/auth/auth.service.ts`:

```typescript
/**
 * Revoga TODAS as sessões ativas (refresh tokens) de um usuário.
 * Usado quando: usuário troca senha, admin reseta senha de outro.
 */
export async function revogarTodosRefreshTokens(userId: number) {
  const pattern = `refresh:${userId}:*`
  // node-redis v4 oferece scanIterator
  const iter = (redis as any).scanIterator({ MATCH: pattern, COUNT: 100 })
  const keys: string[] = []
  for await (const k of iter) {
    keys.push(k)
  }
  if (keys.length > 0) {
    await redis.del(keys)
  }
}
```

Se o helper `scanIterator` não existir no client em uso (ioredis ou redis v3), implemente a equivalente: `SCAN 0 MATCH ... COUNT 100` em loop, acumulando keys e chamando `redis.del(keys)` no final.

- [ ] **Step 3: Sem teste unitário aqui (Redis externo) — smoke test manual depois**

Será exercitado pelos testes das tasks 6 e 8, que mockam essa função.

- [ ] **Step 4: Commit**

```
git add backend/src/modules/auth/auth.service.ts
git commit -m "feat(auth): helper para revogar todos os refresh tokens de um usuario"
```

---

### Task 6: Users service — `resetarSenha`

**Files:**
- Modify: `backend/src/modules/users/users.service.ts`
- Modify: `backend/src/modules/users/users.service.test.ts`

- [ ] **Step 1: Adicionar testes falhantes para `resetarSenha`**

Adicione dentro do `describe('users.service', ...)`:
```typescript
  describe('resetarSenha', () => {
    it('grava novo hash, reseta tentativas e revoga refresh tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 7, email: 'x@x.com' })
      mockPrisma.user.update.mockResolvedValue({ id: 7 })
      const auth = await import('../auth/auth.service')

      await service.resetarSenha(7, 'novasenha123')

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 7 },
        data: {
          senha_hash: 'hashed:novasenha123',
          tentativas_login: 0,
          bloqueado_ate: null,
        },
      })
      expect(auth.revogarTodosRefreshTokens).toHaveBeenCalledWith(7)
    })

    it('lança 404 se usuário não existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      await expect(service.resetarSenha(99, 'novasenha123')).rejects.toMatchObject({ status: 404 })
    })
  })
```

- [ ] **Step 2: Rodar testes — confirmar falha**

```
cd backend && npx vitest run src/modules/users/users.service.test.ts -t resetarSenha --reporter=verbose
```

Esperado: FAIL.

- [ ] **Step 3: Implementar `resetarSenha`**

Atualize o import no topo de `users.service.ts`:
```typescript
import { hashSenha, revogarTodosRefreshTokens } from '../auth/auth.service'
```

Adicione ao final do arquivo:
```typescript
export async function resetarSenha(id: number, novaSenha: string) {
  const alvo = await prisma.user.findUnique({ where: { id } })
  if (!alvo) throw Object.assign(new Error('Usuário não encontrado'), { status: 404 })

  const senha_hash = await hashSenha(novaSenha)
  await prisma.user.update({
    where: { id },
    data: { senha_hash, tentativas_login: 0, bloqueado_ate: null },
  })
  await revogarTodosRefreshTokens(id)
  return { ok: true }
}
```

- [ ] **Step 4: Rodar testes — confirmar passam**

```
cd backend && npx vitest run src/modules/users/users.service.test.ts --reporter=verbose
```

Esperado: PASS para os 18 testes.

- [ ] **Step 5: Commit**

```
git add backend/src/modules/users/
git commit -m "feat(users): resetarSenha pelo admin"
```

---

### Task 7: Users — schemas, controller, routes

**Files:**
- Create: `backend/src/modules/users/users.schemas.ts`
- Create: `backend/src/modules/users/users.controller.ts`
- Create: `backend/src/modules/users/users.routes.ts`

Sem TDD aqui — é plumbing (delegação para o service já testado).

- [ ] **Step 1: Criar `users.schemas.ts` (Zod)**

`backend/src/modules/users/users.schemas.ts`:
```typescript
import { z } from 'zod'

const roleEnum = z.enum(['ADMIN', 'PARTICIPANTE', 'VIEWER'])

export const createSchema = z.object({
  nome: z.string().min(2).max(80),
  email: z.string().email(),
  role: roleEnum,
  senha: z.string().min(8).max(72),
})

export const updateSchema = z.object({
  nome: z.string().min(2).max(80).optional(),
  email: z.string().email().optional(),
  role: roleEnum.optional(),
  ativo: z.boolean().optional(),
})

export const resetarSenhaSchema = z.object({
  nova_senha: z.string().min(8).max(72),
})
```

- [ ] **Step 2: Criar `users.controller.ts`**

`backend/src/modules/users/users.controller.ts`:
```typescript
import { Request, Response, NextFunction } from 'express'
import * as service from './users.service'
import { createSchema, updateSchema, resetarSenhaSchema } from './users.schemas'

function caller(req: Request) {
  const u = (req as any).user as { sub: number; role: string } | undefined
  if (!u) throw Object.assign(new Error('Não autenticado'), { status: 401 })
  return u
}

export async function listar(_req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.listar()) } catch (e) { next(e) }
}

export async function buscarPorId(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.buscarPorId(Number(req.params.id))) } catch (e) { next(e) }
}

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchema.parse(req.body)
    res.status(201).json(await service.criar(body))
  } catch (e) { next(e) }
}

export async function editar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = updateSchema.parse(req.body)
    res.json(await service.editar(Number(req.params.id), body, caller(req)))
  } catch (e) { next(e) }
}

export async function remover(req: Request, res: Response, next: NextFunction) {
  try {
    await service.remover(Number(req.params.id), caller(req))
    res.status(204).send()
  } catch (e) { next(e) }
}

export async function resetarSenha(req: Request, res: Response, next: NextFunction) {
  try {
    const body = resetarSenhaSchema.parse(req.body)
    res.json(await service.resetarSenha(Number(req.params.id), body.nova_senha))
  } catch (e) { next(e) }
}
```

- [ ] **Step 3: Criar `users.routes.ts`**

`backend/src/modules/users/users.routes.ts`:
```typescript
import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as ctrl from './users.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]

router.get('/', ...admin, ctrl.listar)
router.get('/:id', ...admin, ctrl.buscarPorId)
router.post('/', ...admin, ctrl.criar)
router.patch('/:id', ...admin, ctrl.editar)
router.delete('/:id', ...admin, ctrl.remover)
router.post('/:id/resetar-senha', ...admin, ctrl.resetarSenha)

export default router
```

- [ ] **Step 4: Verificar typecheck**

```
cd backend && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```
git add backend/src/modules/users/users.schemas.ts backend/src/modules/users/users.controller.ts backend/src/modules/users/users.routes.ts
git commit -m "feat(users): schemas, controller e routes"
```

---

### Task 8: Registrar `/users` no `index.ts`

**Files:**
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Adicionar import**

Adicione na lista de imports de routes em `backend/src/index.ts` (após o de `tiposModalidadeRoutes`):
```typescript
import usersRoutes from './modules/users/users.routes'
```

- [ ] **Step 2: Adicionar `app.use('/users', usersRoutes)`**

Após `app.use('/auth', authRateLimit, authRoutes)`, adicione:
```typescript
app.use('/users', usersRoutes)
```

- [ ] **Step 3: Verificar typecheck + smoke probe**

```
cd backend && npx tsc --noEmit
```

Esperado: sem erros.

Smoke (após backend rodar): `curl -s http://localhost:3000/users` → deve retornar `401 Token não fornecido` (rota existe, exige auth).

- [ ] **Step 4: Commit**

```
git add backend/src/index.ts
git commit -m "feat(users): registra rota /users no index"
```

---

### Task 9: Auth service — `alterarSenha` (próprio)

**Files:**
- Modify: `backend/src/modules/auth/auth.service.ts`
- Create: `backend/src/modules/auth/auth.service.test.ts`

- [ ] **Step 1: Escrever os testes falhantes**

`backend/src/modules/auth/auth.service.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('../../lib/redis', () => ({
  default: {
    setEx: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    scanIterator: vi.fn(() => (async function* () { /* empty */ })()),
  },
  connectRedis: vi.fn(),
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async (s: string) => `bcrypt:${s}`),
    compare: vi.fn(async (raw: string, hash: string) => hash === `bcrypt:${raw}`),
  },
}))

process.env.JWT_SECRET = 'test-secret'

import prisma from '../../lib/prisma'
import * as authService from './auth.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('auth.service.alterarSenha', () => {
  it('atualiza senha quando senha atual confere', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, senha_hash: 'bcrypt:antiga' })
    mockPrisma.user.update.mockResolvedValue({ id: 1 })

    await authService.alterarSenha(1, 'antiga', 'novasenha123')

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { senha_hash: 'bcrypt:novasenha123' },
    })
  })

  it('falha 401 quando senha atual está errada', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 1, senha_hash: 'bcrypt:antiga' })
    await expect(
      authService.alterarSenha(1, 'errada', 'novasenha123')
    ).rejects.toMatchObject({ status: 401, message: expect.stringContaining('atual') })
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('falha 404 quando usuário não existe', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    await expect(
      authService.alterarSenha(99, 'qualquer', 'novasenha123')
    ).rejects.toMatchObject({ status: 404 })
  })
})
```

- [ ] **Step 2: Rodar testes — confirmar falha**

```
cd backend && npx vitest run src/modules/auth/auth.service.test.ts --reporter=verbose
```

Esperado: FAIL com "authService.alterarSenha is not a function".

- [ ] **Step 3: Implementar `alterarSenha`**

Adicione ao final de `backend/src/modules/auth/auth.service.ts`:
```typescript
export async function alterarSenha(userId: number, senhaAtual: string, novaSenha: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw Object.assign(new Error('Usuário não encontrado'), { status: 404 })

  const ok = await bcrypt.compare(senhaAtual, user.senha_hash)
  if (!ok) {
    throw Object.assign(new Error('Senha atual incorreta.'), { status: 401 })
  }

  const senha_hash = await bcrypt.hash(novaSenha, 12)
  await prisma.user.update({
    where: { id: userId },
    data: { senha_hash },
  })
  // Revoga todas as sessões — o usuário será deslogado e precisará logar novamente.
  await revogarTodosRefreshTokens(userId)
  return { ok: true }
}
```

- [ ] **Step 4: Rodar testes — confirmar passam**

```
cd backend && npx vitest run src/modules/auth/auth.service.test.ts --reporter=verbose
```

Esperado: PASS para os 3 testes.

- [ ] **Step 5: Commit**

```
git add backend/src/modules/auth/
git commit -m "feat(auth): alterarSenha valida senha atual e revoga sessoes"
```

---

### Task 10: Auth controller + route — `POST /auth/alterar-senha`

**Files:**
- Modify: `backend/src/modules/auth/auth.controller.ts`
- Modify: `backend/src/modules/auth/auth.routes.ts`

- [ ] **Step 1: Adicionar schema + handler em `auth.controller.ts`**

No topo do arquivo, adicione ao bloco de imports/schemas:
```typescript
const alterarSenhaSchema = z.object({
  senha_atual: z.string().min(1),
  nova_senha: z.string().min(8).max(72),
})
```

E adicione o handler ao final do arquivo (antes do `meHandler` se preferir agrupar):
```typescript
export async function alterarSenhaHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = alterarSenhaSchema.parse(req.body)
    const user = (req as any).user as { sub: number }
    await authService.alterarSenha(user.sub, body.senha_atual, body.nova_senha)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}
```

- [ ] **Step 2: Registrar rota em `auth.routes.ts`**

Em `backend/src/modules/auth/auth.routes.ts`, atualize o import e adicione a rota:
```typescript
import { loginHandler, refreshHandler, logoutHandler, meHandler, alterarSenhaHandler } from './auth.controller'
```
E após `router.post('/logout', requireAuth, logoutHandler)`:
```typescript
router.post('/alterar-senha', requireAuth, alterarSenhaHandler)
```

- [ ] **Step 3: Typecheck + smoke**

```
cd backend && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```
git add backend/src/modules/auth/auth.controller.ts backend/src/modules/auth/auth.routes.ts
git commit -m "feat(auth): endpoint POST /auth/alterar-senha"
```

---

## Frontend

### Task 11: Frontend types + service de users

**Files:**
- Create: `frontend/src/types/user.ts`
- Create: `frontend/src/services/users.ts`
- Modify: `frontend/src/services/auth.ts` (se existir — senão criar) OU adicionar ao authStore na Task 17

- [ ] **Step 1: Criar `types/user.ts`**

`frontend/src/types/user.ts`:
```typescript
import type { Role } from './auth'

export type User = {
  id: number
  nome: string
  email: string
  role: Role
  ativo: boolean
  ultimo_login: string | null
  criado_em: string
  atualizado_em: string
}

export type UserCreatePayload = {
  nome: string
  email: string
  role: Role
  senha: string
}

export type UserUpdatePayload = Partial<{
  nome: string
  email: string
  role: Role
  ativo: boolean
}>
```

- [ ] **Step 2: Criar `services/users.ts`**

`frontend/src/services/users.ts`:
```typescript
import api from './api'
import type { User, UserCreatePayload, UserUpdatePayload } from '../types/user'

const BASE = '/users'

export const usersService = {
  listar: () => api.get<User[]>(BASE).then((r) => r.data),
  buscar: (id: number) => api.get<User>(`${BASE}/${id}`).then((r) => r.data),
  criar: (data: UserCreatePayload) => api.post<User>(BASE, data).then((r) => r.data),
  editar: (id: number, data: UserUpdatePayload) =>
    api.patch<User>(`${BASE}/${id}`, data).then((r) => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
  resetarSenha: (id: number, nova_senha: string) =>
    api.post<{ ok: true }>(`${BASE}/${id}/resetar-senha`, { nova_senha }).then((r) => r.data),
  alterarSenha: (senha_atual: string, nova_senha: string) =>
    api.post<{ ok: true }>('/auth/alterar-senha', { senha_atual, nova_senha }).then((r) => r.data),
}
```

- [ ] **Step 3: Verificar typecheck**

```
cd frontend && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```
git add frontend/src/types/user.ts frontend/src/services/users.ts
git commit -m "feat(users): types e service no frontend"
```

---

### Task 12: Adicionar ícones que faltam

**Files:**
- Modify: `frontend/src/lib/icons.ts`

- [ ] **Step 1: Adicionar exports**

Em `frontend/src/lib/icons.ts`, adicione na lista de exports:
```typescript
  Key,
  LogOut,
  UserCog,
  ShieldCheck,
```

(`ShieldCheck` já está aliasado como `Admin` mas vamos exportar com o nome real também — usado em forms de usuário. Se conflito de export duplicado, use `ShieldCheck as ShieldCheckIcon` ou apenas use `Admin` no resto.)

Versão final do arquivo deve ter, na lista alfabética se possível:
```typescript
export {
  LayoutDashboard as Panel,
  Trophy,
  Users as Cadastro,
  Users,
  Brackets as Bracket,
  Group as Groups,
  ListOrdered as Order,
  Calendar as Evento,
  FileText as Report,
  Settings,
  ShieldCheck as Admin,
  ShieldCheck,
  ChevronRight as ChevR,
  ChevronDown,
  PanelLeftClose as Collapse,
  Search,
  Bell,
  Sun,
  Moon,
  Lock,
  Check,
  ArrowRight,
  Maximize,
  Minimize,
  Save,
  Pin,
  Construction,
  Plus,
  X,
  Dices as Dice,
  Shuffle,
  Crown,
  Download,
  Key,
  LogOut,
  UserCog,
} from 'lucide-react'
```

> Nota: `ShieldCheck` aparece duas vezes (aliasado e direto). TypeScript permite, pois são exports separados. Se o build falhar com "Duplicate export", remova o segundo `ShieldCheck` e use `Admin` nas referências.

- [ ] **Step 2: Verificar typecheck**

```
cd frontend && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```
git add frontend/src/lib/icons.ts
git commit -m "feat(icons): adiciona Key, LogOut, UserCog, ShieldCheck"
```

---

### Task 13: Página `UsuariosList`

**Files:**
- Create: `frontend/src/pages/usuarios/UsuariosList.tsx`

Segue o padrão de `ParticipantesList.tsx`: header + card com busca client-side + DataTable em card + ações por linha.

- [ ] **Step 1: Criar a página**

`frontend/src/pages/usuarios/UsuariosList.tsx`:
```tsx
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import { usersService } from '../../services/users'
import type { User } from '../../types/user'
import { Plus, Key, UserCog } from '../../lib/icons'
import { Users, Search } from 'lucide-react'
import ResetSenhaModal from './ResetSenhaModal'

const ROLE_PILL: Record<string, { label: string; bg: string; color: string }> = {
  ADMIN: { label: 'Admin', bg: 'var(--brand-deep)', color: '#fff' },
  PARTICIPANTE: { label: 'Participante', bg: 'var(--success-soft)', color: 'var(--success-700)' },
  VIEWER: { label: 'Viewer', bg: 'var(--brand-50)', color: 'var(--brand-700)' },
}

export default function UsuariosList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [resetTarget, setResetTarget] = useState<User | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersService.listar,
  })

  const { mutate: remover } = useMutation({
    mutationFn: usersService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const base = [...data].sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
    )
    if (!term) return base
    return base.filter((u) =>
      u.nome.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
    )
  }, [data, q])

  const columns = [
    {
      header: 'Nome',
      accessor: (row: User) => (
        <div>
          <div className="font-semibold text-[var(--t1)]">{row.nome}</div>
          <div className="text-xs text-[var(--t3)]">{row.email}</div>
        </div>
      ),
    },
    {
      header: 'Perfil',
      accessor: (row: User) => {
        const p = ROLE_PILL[row.role] ?? { label: row.role, bg: 'var(--card-bg-2)', color: 'var(--t2)' }
        return (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 9px',
              borderRadius: 'var(--radius-pill)',
              background: p.bg,
              color: p.color,
              display: 'inline-block',
            }}
          >
            {p.label}
          </span>
        )
      },
    },
    {
      header: 'Ativo',
      accessor: (row: User) => (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 'var(--radius-pill)',
            background: row.ativo ? 'var(--success-soft)' : 'var(--danger-soft)',
            color: row.ativo ? 'var(--success-700)' : 'var(--danger)',
          }}
        >
          {row.ativo ? 'Sim' : 'Não'}
        </span>
      ),
    },
    {
      header: 'Último login',
      accessor: (row: User) =>
        row.ultimo_login ? (
          <span className="font-mono text-xs text-[var(--t2)]">
            {new Date(row.ultimo_login).toLocaleString('pt-BR')}
          </span>
        ) : (
          <span className="text-xs text-[var(--t4)]">Nunca</span>
        ),
    },
    {
      header: 'Ações',
      accessor: (row: User) => (
        <div className="flex gap-2">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate(`/usuarios/${row.id}/editar`)}
            title="Editar"
          >Editar</button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setResetTarget(row)}
            title="Resetar senha"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <Key size={12} /> Senha
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              if (confirm(`Remover usuário ${row.nome}?`)) remover(row.id)
            }}
            style={{ color: 'var(--danger)' }}
          >Remover</button>
        </div>
      ),
    },
  ]

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Administração"
        title="Usuários"
        sub="Gerencie quem tem acesso ao sistema e qual o papel de cada um."
        actions={
          <button
            onClick={() => navigate('/usuarios/novo')}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} /> Novo Usuário
          </button>
        }
      />

      <div className="p-6">
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-xl)',
            padding: 16,
            marginBottom: 14,
            boxShadow: 'var(--shadow-card)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }}
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome ou email..."
              style={{
                width: '100%',
                paddingLeft: 36,
                paddingRight: 12,
                paddingTop: 10,
                paddingBottom: 10,
                background: 'var(--card-bg-2)',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--t1)',
                fontSize: 14,
              }}
            />
          </div>
          <div
            className="text-sm text-[var(--t2)] flex items-center gap-2"
            style={{ paddingLeft: 12, borderLeft: '1px solid var(--card-border)' }}
          >
            <Users size={14} />
            <b className="text-[var(--t1)]">{filtered.length}</b>
            {q && <span className="text-xs text-[var(--t3)]">de {data.length}</span>}
            <span>usuários</span>
          </div>
        </div>

        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-card)',
            overflow: 'hidden',
          }}
        >
          <DataTable
            rows={filtered}
            columns={columns}
            loading={isLoading}
            emptyText={q ? 'Nenhum usuário corresponde à busca.' : 'Nenhum usuário cadastrado.'}
          />
        </div>
      </div>

      {resetTarget && (
        <ResetSenhaModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  )
}
```

> Nota: as props exatas de `PageHeader` (eyebrow/title/sub/actions/backTo) e `DataTable` (rows/columns/loading/emptyText) devem corresponder ao que outras páginas do projeto usam. Se o `PageHeader` deste projeto não aceitar `actions`, posicione o botão "Novo Usuário" como na `ParticipantesList`. Se `DataTable` exigir outras props, adapte mantendo o mesmo conjunto de colunas. **Use uma página existente como referência ao invés de inferir.**

- [ ] **Step 2: Typecheck**

```
cd frontend && npx tsc --noEmit
```

Esperado: sem erros (a Task 14 cria `ResetSenhaModal`; até lá pode dar erro de import — neste caso, comente a linha do import e a renderização do modal, e descomente depois da Task 14).

- [ ] **Step 3: Commit**

```
git add frontend/src/pages/usuarios/UsuariosList.tsx
git commit -m "feat(usuarios): pagina de listagem"
```

---

### Task 14: `ResetSenhaModal`

**Files:**
- Create: `frontend/src/pages/usuarios/ResetSenhaModal.tsx`

- [ ] **Step 1: Criar o componente**

`frontend/src/pages/usuarios/ResetSenhaModal.tsx`:
```tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { usersService } from '../../services/users'
import type { User } from '../../types/user'
import { X, Check, Key } from '../../lib/icons'

type Props = {
  user: User
  onClose: () => void
}

export default function ResetSenhaModal({ user, onClose }: Props) {
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: () => usersService.resetarSenha(user.id, nova),
    onSuccess: () => {
      alert(`Senha de ${user.nome} redefinida. O usuário foi deslogado.`)
      onClose()
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao redefinir.'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (nova.length < 8) return setErro('A nova senha deve ter no mínimo 8 caracteres.')
    if (nova !== confirma) return setErro('As senhas não conferem.')
    mutate()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 24,
          maxWidth: 460,
          width: '92%',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
              color: '#fff', display: 'grid', placeItems: 'center',
            }}
          >
            <Key size={18} />
          </div>
          <div>
            <div className="eyebrow">Resetar senha</div>
            <h3 className="sec-title" style={{ fontSize: 17 }}>
              {user.nome}
            </h3>
          </div>
        </div>

        <p className="text-sm text-[var(--t2)] mb-4">
          Defina uma nova senha para este usuário. Ao salvar, as sessões ativas serão encerradas e ele precisará entrar novamente.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                Nova senha <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="password"
                value={nova}
                onChange={(e) => setNova(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                Confirmar nova senha <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="password"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
              />
            </div>
          </div>

          {erro && (
            <div
              style={{
                background: 'var(--danger-soft)',
                color: 'var(--danger)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-lg)',
                padding: '10px 14px',
                fontSize: 13,
                marginTop: 12,
              }}
            >
              {erro}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-5">
            <button type="button" onClick={onClose} className="btn btn-ghost"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <X size={16} /> Cancelar
            </button>
            <button type="submit" disabled={isPending} className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: isPending ? 0.5 : 1 }}>
              <Check size={16} /> {isPending ? 'Salvando...' : 'Redefinir senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```
cd frontend && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```
git add frontend/src/pages/usuarios/ResetSenhaModal.tsx
git commit -m "feat(usuarios): modal de resetar senha"
```

---

### Task 15: `UsuarioForm` (criar e editar)

**Files:**
- Create: `frontend/src/pages/usuarios/UsuarioForm.tsx`

Segue o padrão de `ParticipanteForm.tsx`: 2 cards seccionados, asterisco em obrigatórios, action bar.

- [ ] **Step 1: Criar a página**

`frontend/src/pages/usuarios/UsuarioForm.tsx`:
```tsx
import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { usersService } from '../../services/users'
import type { Role } from '../../types/auth'
import { Check, X, Key } from '../../lib/icons'
import { Users, ShieldCheck } from 'lucide-react'
import ResetSenhaModal from './ResetSenhaModal'

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'ADMIN', label: 'Admin — acesso total' },
  { value: 'PARTICIPANTE', label: 'Participante — uso operacional' },
  { value: 'VIEWER', label: 'Viewer — apenas leitura' },
]

export default function UsuarioForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('VIEWER')
  const [senha, setSenha] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [erro, setErro] = useState('')
  const [resetOpen, setResetOpen] = useState(false)

  const { data: existing } = useQuery({
    queryKey: ['users', Number(id)],
    queryFn: () => usersService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setNome(existing.nome)
      setEmail(existing.email)
      setRole(existing.role)
      setAtivo(existing.ativo)
    }
  }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      if (isEdit) {
        return usersService.editar(Number(id), { nome: nome.trim(), email: email.trim(), role, ativo })
      }
      return usersService.criar({ nome: nome.trim(), email: email.trim(), role, senha })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      navigate('/usuarios')
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!nome.trim()) return setErro('Informe o nome.')
    if (!email.trim()) return setErro('Informe o email.')
    if (!isEdit && senha.length < 8) return setErro('A senha inicial deve ter no mínimo 8 caracteres.')
    salvar()
  }

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]'
  const cardStyle = {
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-xl)',
    padding: 24,
    marginBottom: 16,
    boxShadow: 'var(--shadow-card)',
  } as const

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Administração"
        title={isEdit ? 'Editar Usuário' : 'Novo Usuário'}
        sub={isEdit ? 'Atualize identificação, perfil e ativação.' : 'Cadastre um novo usuário com perfil e senha inicial.'}
        backTo="/usuarios"
      />

      <div className="p-6" style={{ maxWidth: 720 }}>
        <form onSubmit={handleSubmit}>
          <section style={cardStyle}>
            <div className="flex items-center gap-3 mb-5">
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--grad-brand-deep)', color: '#fff',
                  display: 'grid', placeItems: 'center',
                }}
              >
                <Users size={18} />
              </div>
              <div>
                <div className="eyebrow">Identificação</div>
                <h3 className="sec-title" style={{ fontSize: 17 }}>Nome e email</h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Nome <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="Ex.: João da Silva"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Email <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="usuario@empresa.com"
                />
              </div>
            </div>
          </section>

          <section style={cardStyle}>
            <div className="flex items-center gap-3 mb-5">
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: '#fff', display: 'grid', placeItems: 'center',
                }}
              >
                <ShieldCheck size={18} />
              </div>
              <div>
                <div className="eyebrow">Acesso</div>
                <h3 className="sec-title" style={{ fontSize: 17 }}>Perfil e {isEdit ? 'ativação' : 'senha inicial'}</h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Perfil <span className="text-[var(--danger)]">*</span>
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className={inputClass}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {!isEdit ? (
                <div>
                  <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                    Senha inicial <span className="text-[var(--danger)]">*</span>
                    <span className="text-[var(--t4)] font-normal text-xs ml-2">(mín. 8 caracteres)</span>
                  </label>
                  <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    minLength={8}
                    className={inputClass}
                    placeholder="••••••••"
                  />
                </div>
              ) : (
                <>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ativo}
                      onChange={(e) => setAtivo(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: 'var(--brand-500)' }}
                    />
                    <span className="text-sm text-[var(--t1)]">
                      Usuário ativo
                      <span className="text-xs text-[var(--t3)] ml-2">
                        (desmarcado, não consegue fazer login)
                      </span>
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setResetOpen(true)}
                    className="btn btn-ghost"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
                  >
                    <Key size={14} /> Resetar senha do usuário
                  </button>
                </>
              )}
            </div>
          </section>

          {erro && (
            <div
              style={{
                background: 'var(--danger-soft)', color: 'var(--danger)',
                border: '1px solid var(--danger)', borderRadius: 'var(--radius-lg)',
                padding: '10px 14px', fontSize: 13, marginBottom: 12,
              }}
            >
              {erro}
            </div>
          )}

          <div
            style={{
              display: 'flex', justifyContent: 'flex-end', gap: 10,
              paddingTop: 16, borderTop: '1px solid var(--card-border)',
            }}
          >
            <button type="button" onClick={() => navigate('/usuarios')} className="btn btn-ghost"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <X size={16} /> Cancelar
            </button>
            <button type="submit" disabled={isPending} className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: isPending ? 0.5 : 1 }}>
              <Check size={16} /> {isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar usuário'}
            </button>
          </div>
        </form>
      </div>

      {isEdit && existing && resetOpen && (
        <ResetSenhaModal user={existing} onClose={() => setResetOpen(false)} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```
cd frontend && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```
git add frontend/src/pages/usuarios/UsuarioForm.tsx
git commit -m "feat(usuarios): form de criar e editar"
```

---

### Task 16: Páginas `MinhaConta` e `TrocarSenha`

**Files:**
- Create: `frontend/src/pages/conta/MinhaConta.tsx`
- Create: `frontend/src/pages/conta/TrocarSenha.tsx`

- [ ] **Step 1: Criar `MinhaConta.tsx`**

`frontend/src/pages/conta/MinhaConta.tsx`:
```tsx
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { useAuthStore } from '../../store/authStore'
import { usersService } from '../../services/users'
import { Key, UserCog } from '../../lib/icons'

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  PARTICIPANTE: 'Participante',
  VIEWER: 'Viewer',
}

export default function MinhaConta() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const { data: detalhe } = useQuery({
    queryKey: ['users', user?.id, 'me'],
    queryFn: () => usersService.buscar(user!.id),
    enabled: Boolean(user?.id),
  })

  const ultimo = detalhe?.ultimo_login
    ? new Date(detalhe.ultimo_login).toLocaleString('pt-BR')
    : 'Nunca'

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Conta"
        title="Minha conta"
        sub="Informações do seu acesso ao sistema."
      />
      <div className="p-6" style={{ maxWidth: 640 }}>
        <section
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-xl)',
            padding: 28,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-center gap-4 mb-6">
            <div
              style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--grad-brand-deep)', color: '#fff',
                display: 'grid', placeItems: 'center',
                fontSize: 22, fontWeight: 800,
              }}
            >
              {(user?.email ?? 'U').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-xl font-bold text-[var(--t1)]">{user?.nome}</div>
              <div className="text-sm text-[var(--t3)]">{user?.email}</div>
            </div>
          </div>

          <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <dt className="text-xs text-[var(--t3)] uppercase tracking-wider mb-1">Perfil</dt>
              <dd className="text-sm text-[var(--t1)] font-semibold">
                {ROLE_LABEL[user?.role ?? ''] ?? user?.role}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--t3)] uppercase tracking-wider mb-1">Último login</dt>
              <dd className="text-sm text-[var(--t1)] font-mono">{ultimo}</dd>
            </div>
          </dl>

          <div className="flex gap-2 mt-6">
            <button
              onClick={() => navigate('/conta/senha')}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Key size={14} /> Trocar senha
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar `TrocarSenha.tsx`**

`frontend/src/pages/conta/TrocarSenha.tsx`:
```tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { useAuthStore } from '../../store/authStore'
import { usersService } from '../../services/users'
import { Check, X, Key } from '../../lib/icons'

export default function TrocarSenha() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: () => usersService.alterarSenha(atual, nova),
    onSuccess: async () => {
      alert('Senha alterada. Por segurança, faça login novamente.')
      await logout()
      navigate('/login', { replace: true })
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao alterar.'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (nova.length < 8) return setErro('A nova senha deve ter no mínimo 8 caracteres.')
    if (nova !== confirma) return setErro('As novas senhas não conferem.')
    if (nova === atual) return setErro('A nova senha deve ser diferente da atual.')
    mutate()
  }

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]'

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Conta"
        title="Trocar senha"
        sub="Após salvar, suas sessões ativas serão encerradas e você precisará entrar novamente."
        backTo="/conta"
      />
      <div className="p-6" style={{ maxWidth: 560 }}>
        <form onSubmit={handleSubmit}>
          <section
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-xl)',
              padding: 24,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                  color: '#fff', display: 'grid', placeItems: 'center',
                }}
              >
                <Key size={18} />
              </div>
              <div>
                <div className="eyebrow">Segurança</div>
                <h3 className="sec-title" style={{ fontSize: 17 }}>Nova senha</h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Senha atual <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="password"
                  value={atual}
                  onChange={(e) => setAtual(e.target.value)}
                  required
                  className={inputClass}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Nova senha <span className="text-[var(--danger)]">*</span>
                  <span className="text-[var(--t4)] font-normal text-xs ml-2">(mín. 8 caracteres)</span>
                </label>
                <input
                  type="password"
                  value={nova}
                  onChange={(e) => setNova(e.target.value)}
                  required
                  minLength={8}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Confirmar nova senha <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="password"
                  value={confirma}
                  onChange={(e) => setConfirma(e.target.value)}
                  required
                  minLength={8}
                  className={inputClass}
                />
              </div>
            </div>

            {erro && (
              <div
                style={{
                  background: 'var(--danger-soft)', color: 'var(--danger)',
                  border: '1px solid var(--danger)', borderRadius: 'var(--radius-lg)',
                  padding: '10px 14px', fontSize: 13, marginTop: 14,
                }}
              >
                {erro}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => navigate('/conta')} className="btn btn-ghost"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <X size={16} /> Cancelar
              </button>
              <button type="submit" disabled={isPending} className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: isPending ? 0.5 : 1 }}>
                <Check size={16} /> {isPending ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </div>
          </section>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

```
cd frontend && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 4: Commit**

```
git add frontend/src/pages/conta/
git commit -m "feat(conta): paginas Minha conta e Trocar senha"
```

---

### Task 17: Componente `UserMenuPopover`

**Files:**
- Create: `frontend/src/components/UserMenuPopover.tsx`

- [ ] **Step 1: Criar o componente**

`frontend/src/components/UserMenuPopover.tsx`:
```tsx
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { UserCog, Key, LogOut } from '../lib/icons'

type Props = {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement>
}

export default function UserMenuPopover({ open, onClose, anchorRef }: Props) {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (ref.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null

  async function handleLogout() {
    onClose()
    await logout()
    navigate('/login', { replace: true })
  }

  function go(path: string) {
    onClose()
    navigate(path)
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 6px)',
        left: 8,
        right: 8,
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
        padding: 6,
        zIndex: 40,
      }}
    >
      <MenuItem icon={<UserCog size={15} />} label="Minha conta" onClick={() => go('/conta')} />
      <MenuItem icon={<Key size={15} />} label="Trocar senha" onClick={() => go('/conta/senha')} />
      <div style={{ height: 1, background: 'var(--card-border)', margin: '4px 6px' }} />
      <MenuItem icon={<LogOut size={15} />} label="Sair" onClick={handleLogout} danger />
    </div>
  )
}

function MenuItem({
  icon, label, onClick, danger,
}: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', textAlign: 'left',
        padding: '8px 10px',
        borderRadius: 'var(--radius-md)',
        background: 'transparent',
        color: danger ? 'var(--danger)' : 'var(--t1)',
        fontSize: 13,
        fontWeight: 500,
        border: 'none',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--card-bg-2)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      {label}
    </button>
  )
}
```

- [ ] **Step 2: Typecheck**

```
cd frontend && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```
git add frontend/src/components/UserMenuPopover.tsx
git commit -m "feat(menu): popover de usuario com Minha conta, Trocar senha, Sair"
```

---

### Task 18: Integrar popover na `Sidebar` + adicionar item "Usuários"

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Adicionar item "Usuários" na lista `NAV`**

Em `frontend/src/components/Sidebar.tsx`, dentro do array `NAV`, ache o item de `Administração` e adicione `Usuários` como **primeiro** filho:

```typescript
{
  id: 'admin', label: 'Administração', icon: Admin, expandable: true,
  children: [
    { id: 'usuarios', label: 'Usuários', path: '/usuarios' },
    { id: 'municipios', label: 'Municípios', path: '/municipios' },
    { id: 'inspetorias', label: 'Inspetorias', path: '/inspetorias' },
    { id: 'delegacias', label: 'Delegacias', path: '/delegacias' },
    { id: 'tipos-modalidade', label: 'Tipos de Modalidade', path: '/tipos-modalidade' },
    { id: 'modalidades', label: 'Modalidades', path: '/modalidades' },
  ],
},
```

- [ ] **Step 2: Adicionar imports do popover e useRef/useState**

No topo de `Sidebar.tsx`, atualize/adicione:
```typescript
import { useRef, useState } from 'react'
import UserMenuPopover from './UserMenuPopover'
```

(o `useState` já está importado — manter o existente)

- [ ] **Step 3: Adicionar estado e ref no componente, e envolver `sb-user`**

Dentro de `export default function Sidebar(...)`, após o `useState(initialExpanded)`, adicione:
```typescript
  const [menuOpen, setMenuOpen] = useState(false)
  const userBtnRef = useRef<HTMLButtonElement>(null)
```

E substitua o bloco `<div className="sb-user">...</div>` no JSX por:
```typescript
        <div style={{ position: 'relative' }}>
          <button
            ref={userBtnRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="sb-user"
            style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            <div className="av">{userInitials}</div>
            {!collapsed && (
              <div className="who">
                <b>{user?.email ?? '—'}</b>
                <span>{user?.role === 'ADMIN' ? 'Administrador' : user?.role === 'PARTICIPANTE' ? 'Participante' : 'Viewer'}</span>
              </div>
            )}
          </button>
          <UserMenuPopover
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            anchorRef={userBtnRef}
          />
        </div>
```

- [ ] **Step 4: Typecheck**

```
cd frontend && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```
git add frontend/src/components/Sidebar.tsx
git commit -m "feat(sidebar): item Usuarios + popover de menu de usuario"
```

---

### Task 19: Registrar rotas no `App.tsx`

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Adicionar imports das novas páginas**

Em `frontend/src/App.tsx`, adicione na seção de imports:
```typescript
import UsuariosList from './pages/usuarios/UsuariosList'
import UsuarioForm from './pages/usuarios/UsuarioForm'
import MinhaConta from './pages/conta/MinhaConta'
import TrocarSenha from './pages/conta/TrocarSenha'
```

- [ ] **Step 2: Registrar as rotas**

Dentro do `<Route element={<Layout />}>` (qualquer ordem entre as outras rotas), adicione:

```tsx
            <Route element={<ProtectedRoute roles={['ADMIN']} />}>
              <Route path="/usuarios" element={<UsuariosList />} />
              <Route path="/usuarios/novo" element={<UsuarioForm />} />
              <Route path="/usuarios/:id/editar" element={<UsuarioForm />} />
            </Route>

            <Route path="/conta" element={<MinhaConta />} />
            <Route path="/conta/senha" element={<TrocarSenha />} />
```

> Nota: o `<Route element={<ProtectedRoute roles={['ADMIN']} />}>` aninha as rotas admin sob uma camada extra que checa role. As demais `/conta*` herdam apenas o `<ProtectedRoute />` externo (logged in suficiente).

- [ ] **Step 3: Verificar página `/sem-acesso`**

A `ProtectedRoute` redireciona para `/sem-acesso` quando role insuficiente. Verifique se essa rota existe em `App.tsx`. Se NÃO existe, adicione uma rota simples:

```tsx
            <Route path="/sem-acesso" element={
              <div className="p-10 text-[var(--t1)]">
                <h1 className="text-2xl font-bold mb-2">Acesso negado</h1>
                <p className="text-[var(--t3)]">Você não tem permissão para acessar essa área.</p>
              </div>
            } />
```

Se já existir, pular este passo.

- [ ] **Step 4: Typecheck + build**

```
cd frontend && npm run build
```

Esperado: build OK, sem erros TS.

- [ ] **Step 5: Commit**

```
git add frontend/src/App.tsx
git commit -m "feat(rotas): registra rotas de usuarios e conta"
```

---

### Task 20: Bump de versão, CHANGELOG e smoke test manual

**Files:**
- Modify: `package.json` (raiz)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Bumpar versão para `1.32.0`**

Em `package.json` (raiz):
```json
  "version": "1.32.0",
```

- [ ] **Step 2: Adicionar entrada no CHANGELOG.md**

No topo das entradas (após o cabeçalho), adicione:
```markdown
## [1.32.0] - 2026-05-31

### Added (Usuários, perfis, alterar senha, logout)
- **Backend**: módulo `users` (`GET/POST/PATCH/DELETE /users`, `POST /users/:id/resetar-senha`) com proteções de auto-edição e último ADMIN ativo. Endpoint `POST /auth/alterar-senha` para o usuário trocar a própria senha.
- **Frontend**: páginas `/usuarios` (lista), `/usuarios/novo` e `/usuarios/:id/editar` (form em 2 cards), `/conta` (minha conta), `/conta/senha` (trocar senha). Modal de reset de senha (admin).
- **Sidebar**: item "Usuários" em Administração + popover no card de usuário do rodapé com **Minha conta**, **Trocar senha** e **Sair**.
- **Segurança**: ao trocar/resetar senha, todas as sessões ativas do usuário são revogadas (Redis SCAN + DEL em `refresh:${id}:*`).
```

- [ ] **Step 3: Build final**

```
cd frontend && npm run build
cd ../backend && npx tsc --noEmit && npx vitest run --reporter=verbose
```

Esperado: tudo verde.

- [ ] **Step 4: Smoke test manual via Playwright ou navegador**

1. Login como `admin@prosports.com` / `admin123`.
2. Verificar item "Usuários" sob Administração na sidebar.
3. Criar um novo usuário (Participante, senha `teste1234`).
4. Logout → login com o novo usuário.
5. Trocar senha → confirmar que desloga e exige novo login.
6. Login com nova senha.
7. Voltar como admin → resetar senha do novo usuário → confirmar mensagem.

- [ ] **Step 5: Commit + push**

```
git add package.json CHANGELOG.md
git commit -m "chore: v1.32.0 — usuarios, perfis, alterar senha, logout"
git push origin develop
```

Esperado: push aciona o CI/CD; em ~3-5 min o deploy estará no ar em `http://192.168.56.113:8080`.

---

## Self-review

**Spec coverage:**

| Spec item | Tarefa |
|---|---|
| Backend: CRUD `/users` (ADMIN) | Tasks 1–4, 7, 8 |
| Backend: `POST /users/:id/resetar-senha` | Task 6 |
| Backend: `POST /auth/alterar-senha` | Tasks 9, 10 |
| Backend: auto-proteção (não remover/desativar self) | Tasks 3, 4 |
| Backend: último ADMIN ativo | Tasks 3, 4 |
| Backend: revogar sessões em troca/reset de senha | Tasks 5, 6, 9 |
| Backend: senha 8–72 chars, email único | Task 7 (schemas) + Task 2 (service) |
| Frontend: rota `/usuarios` + lista | Tasks 11, 13 |
| Frontend: rota `/usuarios/novo` e `/:id/editar` | Task 15 |
| Frontend: rota `/conta` (Minha conta) | Task 16 |
| Frontend: rota `/conta/senha` (Trocar senha) | Task 16 |
| Frontend: modal de reset (admin) | Task 14 |
| Frontend: popover de menu de usuário com Minha conta/Trocar senha/Sair | Tasks 17, 18 |
| Frontend: item "Usuários" em Administração | Task 18 |
| Frontend: rotas protegidas por role ADMIN | Task 19 |
| Frontend: logout funcional via popover | Tasks 17, 18 (usa `authStore.logout` que já existe) |
| Padrão visual (cards seccionados, eyebrow, asterisco) | Tasks 13, 15, 16 |
| CHANGELOG + bump de versão | Task 20 |

**Placeholders:** revisado — nenhum "TBD"/"TODO"/"handle errors appropriately". Todas as funções referenciadas estão definidas em alguma task; todos os tipos e assinaturas batem.

**Type consistency:** `User`, `UserCreatePayload`, `UserUpdatePayload` definidos em Task 11 e referenciados consistentemente em 13–16. `CallerCtx` definido em Task 3 e reusado em Task 4. `usersService` API é consistente entre service (Task 11) e consumers (13–16).

**Riscos conhecidos:**

1. **`PageHeader.actions`**: assumi que o componente aceita prop `actions`. Se não aceitar, posicionar o botão fora do header, como faz `MunicipiosList.tsx`. Inspecionar `frontend/src/components/PageHeader.tsx` antes da Task 13.
2. **`DataTable` API**: assumi `rows`, `columns`, `loading`, `emptyText`. Verificar contra `ParticipantesList.tsx` ou outra lista que use `DataTable` no projeto.
3. **`scanIterator` no Redis client** (Task 5): se o client não for `node-redis` v4+, adaptar a iteração. Inspecionar `backend/src/lib/redis.ts` antes.
4. **Variáveis CSS** (`--success-soft`, `--success-700`, `--danger-soft`, `--brand-deep`, `--grad-brand-deep`): já são usadas em outras páginas do projeto. Se alguma faltar, adicionar em `frontend/src/index.css` espelhando o estilo das outras pages.
