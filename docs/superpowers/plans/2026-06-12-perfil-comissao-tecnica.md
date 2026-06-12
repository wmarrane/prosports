# Perfil Comissão Técnica + melhorias (sidebar nome, separar Sorteados) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Novo perfil `COMISSAO_TECNICA` que opera apenas os eventos atribuídos a ele (inscritos, campeões, sorteios/Modo Congresso, relatórios), sem Administração/Competições/Participantes; + 2 melhorias de UI (nome na sidebar, separar eventos "Sorteado").

**Architecture:** Role enum + tabela M2M `EventoComissao`. Middleware backend `requireAcessoEvento(resolver)` autoriza ADMIN ou CT-atribuído por evento, substituindo `requireRole('ADMIN')` nas ações operacionais. `GET /eventos` filtra por comissão para CT. Frontend: menu/rotas por role, campo comissão no form do evento, ações de admin ocultas para CT.

**Tech Stack:** Node/Express, Prisma/PostgreSQL, zod, Vitest (mock prisma); React 18 + TS + Vite, react-query.

Specs: `docs/superpowers/specs/2026-06-12-perfil-comissao-tecnica-design.md` e `docs/superpowers/specs/2026-06-12-melhorias-sidebar-nome-e-eventos-sorteados-design.md`.

---

## Task 1: Modelo — Role + EventoComissao + migrations

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260612010000_add_role_comissao_tecnica/migration.sql`
- Create: `backend/prisma/migrations/20260612010100_add_evento_comissao/migration.sql`

- [ ] **Step 1: Schema** — em `backend/prisma/schema.prisma`:
(a) no `enum Role`, adicionar `COMISSAO_TECNICA`:
```prisma
enum Role {
  ADMIN
  PARTICIPANTE
  VIEWER
  COMISSAO_TECNICA
}
```
(b) no model `User`, adicionar a back-relation (após `event_keys_criadas EventoKey[]`):
```prisma
  eventos_comissao  EventoComissao[]
```
(c) no model `Evento`, adicionar (após `modalidades_excluidas EventoModalidadeExcluida[]`):
```prisma
  comissao        EventoComissao[]
```
(d) ao final do arquivo, adicionar o model:
```prisma
model EventoComissao {
  id         Int    @id @default(autoincrement())
  evento     Evento @relation(fields: [evento_id], references: [id], onDelete: Cascade)
  evento_id  Int
  usuario    User   @relation(fields: [usuario_id], references: [id], onDelete: Cascade)
  usuario_id Int

  @@unique([evento_id, usuario_id])
  @@index([usuario_id])
  @@map("evento_comissao")
}
```

- [ ] **Step 2: Migration do enum** — criar `backend/prisma/migrations/20260612010000_add_role_comissao_tecnica/migration.sql`:
```sql
ALTER TYPE "Role" ADD VALUE 'COMISSAO_TECNICA';
```

- [ ] **Step 3: Migration da tabela** — criar `backend/prisma/migrations/20260612010100_add_evento_comissao/migration.sql`:
```sql
CREATE TABLE "evento_comissao" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    CONSTRAINT "evento_comissao_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "evento_comissao_evento_id_usuario_id_key" ON "evento_comissao"("evento_id", "usuario_id");
CREATE INDEX "evento_comissao_usuario_id_idx" ON "evento_comissao"("usuario_id");
ALTER TABLE "evento_comissao" ADD CONSTRAINT "evento_comissao_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evento_comissao" ADD CONSTRAINT "evento_comissao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Generate + validate + build** — `cd backend && npx prisma generate` → ok; `npx prisma validate` → valid; `npm run build` → tsc limpo. (NÃO `migrate dev`.)

- [ ] **Step 5: Commit**
```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260612010000_add_role_comissao_tecnica backend/prisma/migrations/20260612010100_add_evento_comissao
git commit -m "feat(db): role COMISSAO_TECNICA + tabela EventoComissao"
```

---

## Task 2: Middleware de acesso por evento

**Files:**
- Create: `backend/src/middleware/evento-acesso.ts`
- Test: `backend/src/middleware/evento-acesso.test.ts`

- [ ] **Step 1: Teste** — criar `backend/src/middleware/evento-acesso.test.ts`:
```ts
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
```
Run: `cd backend && npx vitest run src/middleware/evento-acesso.test.ts` → FAIL (módulo não existe).

- [ ] **Step 2: Implementar** — criar `backend/src/middleware/evento-acesso.ts`:
```ts
import { Request, Response, NextFunction } from 'express'
import prisma from '../lib/prisma'

type AuthUser = { sub: number; role: string; email?: string }

export async function usuarioTemAcessoAoEvento(user: AuthUser, evento_id: number): Promise<boolean> {
  if (!user) return false
  if (user.role === 'ADMIN') return true
  if (user.role === 'COMISSAO_TECNICA') {
    const row = await prisma.eventoComissao.findUnique({
      where: { evento_id_usuario_id: { evento_id, usuario_id: user.sub } },
      select: { id: true },
    })
    return row != null
  }
  return false
}

// Resolve o evento_id da requisição (params/body/lookup) e autoriza ADMIN ou
// COMISSAO_TECNICA atribuída ao evento. 400 se não resolver; 403 se negar.
export function requireAcessoEvento(resolver: (req: Request) => number | null | Promise<number | null>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user as AuthUser
      const evento_id = await resolver(req)
      if (evento_id == null || Number.isNaN(evento_id)) {
        res.status(400).json({ message: 'Evento não identificado na requisição.' })
        return
      }
      if (await usuarioTemAcessoAoEvento(user, evento_id)) { next(); return }
      res.status(403).json({ message: 'Acesso negado a este evento.' })
    } catch (err) { next(err) }
  }
}
```

- [ ] **Step 3: Rodar e ver passar** — `cd backend && npx vitest run src/middleware/evento-acesso.test.ts` → PASS.
- [ ] **Step 4: Build** — `cd backend && npm run build` → tsc limpo.
- [ ] **Step 5: Commit**
```bash
git add backend/src/middleware/evento-acesso.ts backend/src/middleware/evento-acesso.test.ts
git commit -m "feat(auth): middleware requireAcessoEvento (ADMIN ou comissão do evento)"
```

---

## Task 3: Aplicar requireAcessoEvento nas rotas operacionais

**Files:**
- Modify: `backend/src/modules/inscricoes/inscricoes.routes.ts`
- Modify: `backend/src/modules/campeoes_anteriores/campeoes_anteriores.routes.ts`
- Modify: `backend/src/modules/sorteios/sorteios.routes.ts`
- Modify: `backend/src/modules/relatorios/relatorios.routes.ts`

Padrão: importar `requireAcessoEvento` de `../../middleware/evento-acesso` e `requireAuth` de `../../middleware/auth`; trocar `...admin` pelas guardas `[requireAuth, requireAcessoEvento(<resolver>)]`. Para resolvers que precisam buscar o registro por `:id`, usar `prisma` (importar `prisma from '../../lib/prisma'`).

- [ ] **Step 1: inscricoes.routes.ts** — substituir o conteúdo por:
```ts
import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { requireAcessoEvento } from '../../middleware/evento-acesso'
import prisma from '../../lib/prisma'
import * as ctrl from './inscricoes.controller'

const router = Router()
const acessoBody = requireAcessoEvento(req => Number(req.body?.evento_id))
const acessoParamsEvento = requireAcessoEvento(req => Number(req.params.eventoId))
const acessoInscricaoId = requireAcessoEvento(async req => {
  const i = await prisma.inscricao.findUnique({ where: { id: Number(req.params.id) }, select: { evento_id: true } })
  return i?.evento_id ?? null
})

router.get('/counts', requireAuth, ctrl.counts)
router.get('/', requireAuth, ctrl.listar)
router.get('/:id', requireAuth, ctrl.buscarPorId)
router.post('/', requireAuth, acessoBody, ctrl.criar)
router.post('/bulk', requireAuth, acessoBody, ctrl.criarBulk)
router.post('/import', requireAuth, acessoBody, ctrl.importar)
router.delete('/evento/:eventoId/modalidade/:modalidadeId', requireAuth, acessoParamsEvento, ctrl.removerTodosDaModalidade)
router.delete('/:id', requireAuth, acessoInscricaoId, ctrl.remover)

export default router
```

- [ ] **Step 2: campeoes_anteriores.routes.ts** — substituir por:
```ts
import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { requireAcessoEvento } from '../../middleware/evento-acesso'
import prisma from '../../lib/prisma'
import * as ctrl from './campeoes_anteriores.controller'

const router = Router()
const acessoBody = requireAcessoEvento(req => Number(req.body?.evento_id))
const acessoCampeaoId = requireAcessoEvento(async req => {
  const c = await prisma.campeaoAnterior.findUnique({ where: { id: Number(req.params.id) }, select: { evento_id: true } })
  return c?.evento_id ?? null
})

router.get('/', requireAuth, ctrl.listar)
router.post('/', requireAuth, acessoBody, ctrl.criar)
router.post('/import', requireAuth, acessoBody, ctrl.importar)
router.delete('/:id', requireAuth, acessoCampeaoId, ctrl.remover)

export default router
```

- [ ] **Step 3: sorteios.routes.ts** — substituir por:
```ts
import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { requireAcessoEvento } from '../../middleware/evento-acesso'
import prisma from '../../lib/prisma'
import * as ctrl from './sorteios.controller'

const router = Router()
const acessoBody = requireAcessoEvento(req => Number(req.body?.evento_id))
const acessoParamsEvento = requireAcessoEvento(req => Number(req.params.evento_id))
const acessoSorteioId = requireAcessoEvento(async req => {
  const s = await prisma.sorteio.findUnique({ where: { id: Number(req.params.id) }, select: { evento_id: true } })
  return s?.evento_id ?? null
})

router.get('/', requireAuth, ctrl.listar)
router.get('/:id', requireAuth, ctrl.buscarPorId)
router.post('/executar', requireAuth, acessoBody, ctrl.executar)
router.delete('/evento/:evento_id', requireAuth, acessoParamsEvento, ctrl.removerTodosDoEvento)
router.delete('/:id', requireAuth, acessoSorteioId, ctrl.remover)

export default router
```

- [ ] **Step 4: relatorios.routes.ts** — substituir por:
```ts
import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { requireAcessoEvento } from '../../middleware/evento-acesso'
import * as ctrl from './relatorios.controller'

const router = Router()
const acessoParamsEvento = requireAcessoEvento(req => Number(req.params.eventoId))

router.get('/eventos/:eventoId/congresso', requireAuth, acessoParamsEvento, ctrl.congresso)

export default router
```

- [ ] **Step 5: Build + suíte** — `cd backend && npm run build` → tsc limpo. `cd backend && npx vitest run` → suíte verde (essas rotas não têm testes de integração; serviços inalterados).

- [ ] **Step 6: Commit**
```bash
git add backend/src/modules/inscricoes/inscricoes.routes.ts backend/src/modules/campeoes_anteriores/campeoes_anteriores.routes.ts backend/src/modules/sorteios/sorteios.routes.ts backend/src/modules/relatorios/relatorios.routes.ts
git commit -m "feat(auth): rotas operacionais aceitam ADMIN ou comissão do evento"
```

---

## Task 4: Eventos — filtrar por comissão (CT) + comissao_ids + include

**Files:**
- Modify: `backend/src/modules/eventos/eventos.service.ts`
- Modify: `backend/src/modules/eventos/eventos.controller.ts`
- Test: `backend/src/modules/eventos/eventos.service.test.ts`

READ os três arquivos antes de editar.

- [ ] **Step 1: `listar` aceita filtro de usuário** — em `eventos.service.ts`, alterar a assinatura de `listar` para aceitar um segundo parâmetro opcional `user` e aplicar o filtro de comissão quando role CT. Trocar a assinatura `export async function listar(competicao_id?: number)` por:
```ts
export async function listar(competicao_id?: number, user?: { sub: number; role: string }) {
```
E no `prisma.evento.findMany({ where: ..., ... })`, montar o `where` considerando comissão:
```ts
  const where: any = {}
  if (competicao_id) where.competicao_id = competicao_id
  if (user && user.role === 'COMISSAO_TECNICA') {
    where.comissao = { some: { usuario_id: user.sub } }
  }
  const eventos = await prisma.evento.findMany({
    where,
    orderBy: { data_hora: 'desc' },
    include: LIST_INCLUDE,
  })
```
(Substituir o `where: competicao_id ? { competicao_id } : undefined` atual por esse bloco; manter o resto de `listar` igual.)

- [ ] **Step 2: include `comissao` em INCLUDE** — em `eventos.service.ts`, no `INCLUDE` (usado por `buscarPorId`/`criar`/`editar`), adicionar a relação comissão com nome do usuário:
```ts
  comissao: { select: { usuario: { select: { id: true, nome: true } } } },
```

- [ ] **Step 3: `criar`/`editar` sincronizam `comissao_ids`** — em `eventos.service.ts`, ajustar `CreateInput` e as funções. Adicionar ao tipo `CreateInput` o campo opcional:
```ts
  comissao_ids?: number[]
```
E reescrever `criar` e `editar` para gravar/sincronizar a comissão (validando que os ids são usuários COMISSAO_TECNICA). Substituir as funções `criar` e `editar` por:
```ts
async function validarComissaoIds(ids: number[]) {
  if (ids.length === 0) return
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, role: true } })
  const validos = new Set(users.filter(u => u.role === 'COMISSAO_TECNICA').map(u => u.id))
  const invalidos = ids.filter(id => !validos.has(id))
  if (invalidos.length > 0) {
    throw Object.assign(new Error(`Usuário(s) inválido(s) para comissão técnica: ${invalidos.join(', ')}.`), { status: 400 })
  }
}

export async function criar(data: CreateInput) {
  const { comissao_ids, ...rest } = data
  if (comissao_ids) await validarComissaoIds(comissao_ids)
  return mapPrismaError(async () => {
    const evento = await prisma.evento.create({ data: rest, include: INCLUDE })
    if (comissao_ids && comissao_ids.length > 0) {
      await prisma.eventoComissao.createMany({ data: comissao_ids.map(usuario_id => ({ evento_id: evento.id, usuario_id })) })
      return prisma.evento.findUnique({ where: { id: evento.id }, include: INCLUDE })
    }
    return evento
  })
}

export async function editar(id: number, data: Partial<CreateInput>) {
  const { comissao_ids, ...rest } = data
  if (comissao_ids) await validarComissaoIds(comissao_ids)
  return mapPrismaError(async () => {
    await prisma.evento.update({ where: { id }, data: rest })
    if (comissao_ids) {
      await prisma.$transaction([
        prisma.eventoComissao.deleteMany({ where: { evento_id: id } }),
        ...(comissao_ids.length > 0
          ? [prisma.eventoComissao.createMany({ data: comissao_ids.map(usuario_id => ({ evento_id: id, usuario_id })) })]
          : []),
      ])
    }
    return prisma.evento.findUnique({ where: { id }, include: INCLUDE })
  })
}
```
(Manter `mapPrismaError`, `INCLUDE`, `LIST_INCLUDE` e o restante do arquivo.)

- [ ] **Step 4: Controller passa `user` e aceita `comissao_ids`** — em `eventos.controller.ts`:
(a) no `createSchema`, adicionar o campo:
```ts
  comissao_ids: z.array(z.coerce.number().int().positive()).optional(),
```
(b) no handler `listar`, passar o usuário: trocar a chamada `service.listar(...)` por `service.listar(filtros.competicao_id, (req as any).user)`.
(c) no handler `buscarPorId`, após obter o evento, barrar CT não atribuído. READ o handler; envolver com checagem usando o helper:
```ts
import { usuarioTemAcessoAoEvento } from '../../middleware/evento-acesso'
```
e no `buscarPorId`:
```ts
export async function buscarPorId(req: Request, res: Response, next: NextFunction) {
  try {
    const evento = await service.buscarPorId(Number(req.params.id))
    const user = (req as any).user
    if (user?.role === 'COMISSAO_TECNICA' && !(await usuarioTemAcessoAoEvento(user, evento.id))) {
      res.status(403).json({ message: 'Acesso negado a este evento.' })
      return
    }
    res.json(evento)
  } catch (err) { next(err) }
}
```
(Ajustar `criar`/`editar` handlers se necessário para repassar `comissao_ids` — eles já fazem `service.criar(body)` / `service.editar(id, body)`, então o campo flui automaticamente desde que esteja no schema.)

- [ ] **Step 5: Teste** — em `eventos.service.test.ts`, garantir que o mock de prisma tenha `eventoComissao: { createMany: vi.fn(), deleteMany: vi.fn() }`, `user: { findMany: vi.fn() }` e `$transaction`. Adicionar:
```ts
  it('listar filtra por comissão quando role COMISSAO_TECNICA', async () => {
    mockPrisma.evento.findMany.mockResolvedValue([])
    await service.listar(undefined, { sub: 7, role: 'COMISSAO_TECNICA' })
    expect(mockPrisma.evento.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { comissao: { some: { usuario_id: 7 } } },
    }))
  })
```
(Se algum teste existente de `listar` deep-assertar o `where: undefined`, atualizar para `where: {}` conforme a nova montagem.)
Run: `cd backend && npx vitest run src/modules/eventos/eventos.service.test.ts` → PASS (ajustar asserções de `where` que tenham mudado de `undefined` para `{}`).

- [ ] **Step 6: Build + suíte** — `cd backend && npm run build` → tsc limpo; `cd backend && npx vitest run` → verde.

- [ ] **Step 7: Commit**
```bash
git add backend/src/modules/eventos/eventos.service.ts backend/src/modules/eventos/eventos.controller.ts backend/src/modules/eventos/eventos.service.test.ts
git commit -m "feat(eventos): comissão do evento (filtro p/ CT, comissao_ids no create/edit, include)"
```

---

## Task 5: Frontend — tipos + role na tela de Usuários

**Files:**
- Modify: `frontend/src/types/auth.ts`
- Modify: `frontend/src/types/evento.ts`
- Modify: `frontend/src/pages/usuarios/UsuarioForm.tsx`
- Modify: `frontend/src/pages/usuarios/UsuariosList.tsx`

- [ ] **Step 1: Role no tipo** — em `frontend/src/types/auth.ts`, trocar:
```ts
export type Role = 'ADMIN' | 'PARTICIPANTE' | 'VIEWER'
```
por:
```ts
export type Role = 'ADMIN' | 'PARTICIPANTE' | 'VIEWER' | 'COMISSAO_TECNICA'
```

- [ ] **Step 2: Evento.comissao no tipo** — em `frontend/src/types/evento.ts`, dentro do tipo `Evento`, adicionar:
```ts
  comissao?: { usuario: { id: number; nome: string } }[]
```

- [ ] **Step 3: UsuarioForm — opção de role** — em `frontend/src/pages/usuarios/UsuarioForm.tsx`, no `ROLE_OPTIONS`, adicionar:
```ts
  { value: 'COMISSAO_TECNICA', label: 'Comissão Técnica — opera eventos atribuídos' },
```

- [ ] **Step 4: UsuariosList — pill** — em `frontend/src/pages/usuarios/UsuariosList.tsx`, no `ROLE_PILL`, adicionar:
```ts
  COMISSAO_TECNICA: { label: 'Comissão Técnica', bg: 'var(--warn-soft)', color: 'var(--warn-700)' },
```

- [ ] **Step 5: Build** — `cd frontend && npx tsc -b && npm run build` → sem erros (o `Record<Role,...>` exige a nova chave; se algum mapa exaustivo de Role acusar falta, completar).

- [ ] **Step 6: Commit**
```bash
git add frontend/src/types/auth.ts frontend/src/types/evento.ts frontend/src/pages/usuarios/UsuarioForm.tsx frontend/src/pages/usuarios/UsuariosList.tsx
git commit -m "feat(ui): role Comissão Técnica nos tipos e na tela de Usuários"
```

---

## Task 6: Frontend — menu por role + Modo Congresso + guardas de rota + nome na sidebar (melhoria 1)

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Sidebar — item Modo Congresso + filtro por role + nome** — em `frontend/src/components/Sidebar.tsx`:
(a) adicionar ao `NAV` (após o item `eventos`, antes de `participantes`) um item de Modo Congresso. Importar um ícone disponível (ex.: reutilizar `Evento` ou `Trophy` já importados — use `Trophy`):
```tsx
  { id: 'congresso', label: 'Modo Congresso', icon: Trophy, path: '/congresso' },
```
(b) filtrar o NAV por role. Logo após `const { user } = useAuthStore()`, derivar o NAV visível:
```tsx
  const isCT = user?.role === 'COMISSAO_TECNICA'
  const CT_VISIBLE = new Set(['eventos', 'congresso', 'relatorios'])
  const navItems = NAV.filter(item => {
    if (!isCT) return true
    if ('cat' in item) return false // sem categorias para CT (menu enxuto)
    return CT_VISIBLE.has((item as any).id)
  })
```
e trocar o `.map` de `NAV.map(...)` por `navItems.map(...)`. (Para CT, o grupo "Relatórios" continua aparecendo com seus dois filhos; Painel/Competições/Participantes/Administração somem.)
(c) melhoria 1 — nome no lugar do e-mail. Trocar:
```tsx
  const userInitials = (user?.email ?? 'U').slice(0, 2).toUpperCase()
```
por:
```tsx
  const userInitials = (user?.nome ?? user?.email ?? 'U').slice(0, 2).toUpperCase()
```
e na área `.who`, trocar `<b>{user?.email ?? '—'}</b>` por:
```tsx
                <b>{user?.nome ?? user?.email ?? '—'}</b>
```
e ampliar o rótulo de role para incluir Comissão Técnica: trocar a `<span>` de role por:
```tsx
                <span>{user?.role === 'ADMIN' ? 'Administrador' : user?.role === 'COMISSAO_TECNICA' ? 'Comissão Técnica' : user?.role === 'PARTICIPANTE' ? 'Participante' : 'Viewer'}</span>
```

- [ ] **Step 2: App.tsx — barrar CT em rotas de admin** — READ `frontend/src/App.tsx`. As rotas de `/painel`, `/competicoes`, `/participantes` e o bloco de Administração (`/usuarios`, `/municipios`, `/inspetorias`, `/delegacias`, `/tipos-modalidade`, `/modalidades`, `/sistemas-disputa`) devem ficar dentro de um `ProtectedRoute` que **exclui** `COMISSAO_TECNICA`. Para cada uma dessas rotas (ou o grupo que as contém), envolver/usar:
```tsx
<Route element={<ProtectedRoute roles={['ADMIN', 'PARTICIPANTE', 'VIEWER']} />}>
  ... rotas de painel/competicoes/participantes/administração ...
</Route>
```
Mantenha `/eventos`, `/eventos/:id/*`, `/congresso`, `/relatorio`, `/relatorios/*`, `/conta*` acessíveis ao CT (dentro do ProtectedRoute sem `roles` ou com `roles` incluindo `COMISSAO_TECNICA`). As rotas que já têm `roles={['ADMIN']}` (usuarios, sistemas-disputa) permanecem.
Aplicar com cuidado conforme a estrutura atual do arquivo; o objetivo é: CT autenticado que navegue para `/competicoes`, `/participantes`, `/painel` ou administração é redirecionado para `/sem-acesso` (comportamento atual do ProtectedRoute). Se preferir redirecionar para `/eventos`, ajustar o ProtectedRoute não é necessário — `/sem-acesso` já existe.

- [ ] **Step 3: Build** — `cd frontend && npx tsc -b && npm run build` → sem erros.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/components/Sidebar.tsx frontend/src/App.tsx
git commit -m "feat(ui): menu/rotas por role (Comissão Técnica) + nome na sidebar"
```

---

## Task 7: Frontend — comissão no form do evento + ocultar ações admin p/ CT

**Files:**
- Modify: `frontend/src/services/eventos.ts`
- Modify: `frontend/src/services/users.ts` (ou equivalente) — listar usuários CT
- Modify: `frontend/src/pages/eventos/EventoForm.tsx`
- Modify: `frontend/src/pages/eventos/EventoInscricoes.tsx`

READ cada arquivo antes de editar.

- [ ] **Step 1: Payload aceita comissao_ids** — em `frontend/src/services/eventos.ts`, no tipo `EventoPayload`, adicionar:
```ts
  comissao_ids?: number[]
```

- [ ] **Step 2: EventoForm — multi-seleção de comissão** — em `frontend/src/pages/eventos/EventoForm.tsx`:
(a) buscar usuários com role `COMISSAO_TECNICA` (via o service de usuários — confirmar o método; provavelmente `usersService.listar()` retornando todos, filtrar `u.role === 'COMISSAO_TECNICA'` no client). Adicionar um `useQuery` para a lista de usuários e derivar os CT.
(b) estado `comissaoIds: number[]`, inicializado de `existing?.comissao?.map(c => c.usuario.id) ?? []` ao carregar o evento.
(c) renderizar um grupo de checkboxes (ou multi-select) com os usuários CT, controlando `comissaoIds`. Colocar perto do campo de status/anfitrião.
(d) incluir `comissao_ids: comissaoIds` no payload de `criar`/`editar`.
Use o padrão de formulário já existente no arquivo; mantenha simples (lista de checkboxes com nome do usuário). Se não houver usuários CT, mostrar um aviso "Nenhum usuário Comissão Técnica cadastrado".

- [ ] **Step 3: EventoInscricoes — ocultar ações de admin para CT** — em `frontend/src/pages/eventos/EventoInscricoes.tsx`:
(a) obter o role do usuário: `import { useAuthStore } from '../../store/authStore'` e `const role = useAuthStore(s => s.user?.role)`; `const isAdmin = role === 'ADMIN'`.
(b) Ocultar, quando `!isAdmin`: o botão **"Editar evento"**, o botão **"Modalidades do evento"**, e qualquer ação de **publicar/despublicar site** que exista nesta tela. Envolver cada um com `{isAdmin && ( ... )}`. As ações operacionais (Inscrever, Importar, Remover, Sortear/Re-sortear, Apagar sorteios, campeões) **permanecem** visíveis (o backend autoriza por evento).

- [ ] **Step 4: Build** — `cd frontend && npx tsc -b && npm run build` → sem erros.

- [ ] **Step 5: Verificação manual**
- Admin: no form do evento, atribui usuários da Comissão Técnica; salva.
- Login como CT: vê só os eventos atribuídos; menu enxuto (Eventos, Modo Congresso, Relatórios); abre um evento e opera inscritos/campeões/sorteio/relatório; não vê "Editar evento"/"Modalidades do evento"; é redirecionado ao tentar `/competicoes`, `/participantes`, `/painel`, administração.
- CT em evento não atribuído (via URL): backend retorna 403.

- [ ] **Step 6: Commit**
```bash
git add frontend/src/services/eventos.ts frontend/src/pages/eventos/EventoForm.tsx frontend/src/pages/eventos/EventoInscricoes.tsx
git commit -m "feat(ui): atribuir comissão no evento + ocultar ações de admin para CT"
```

---

## Task 8: Melhoria 2 — separar eventos "Sorteado" na lista

**Files:**
- Modify: `frontend/src/pages/eventos/EventosList.tsx`

READ o arquivo. Hoje renderiza `grupos = agruparEventosPorCompeticao(lista)`.

- [ ] **Step 1: Dividir por status** — após obter `lista` (a lista filtrada que alimenta `agruparEventosPorCompeticao`), dividir em dois conjuntos e agrupar cada um:
```tsx
  const sorteados = useMemo(() => lista.filter(e => e.status === 'sorteado'), [lista])
  const demais = useMemo(() => lista.filter(e => e.status !== 'sorteado'), [lista])
  const gruposDemais = useMemo(() => agruparEventosPorCompeticao(demais), [demais])
  const gruposSorteados = useMemo(() => agruparEventosPorCompeticao(sorteados), [sorteados])
```
(Remover/ajustar o `grupos` antigo conforme necessário.)

- [ ] **Step 2: Renderizar duas seções** — substituir a renderização do `grupos` único por duas seções: primeiro `gruposDemais` (sem cabeçalho ou com "Em andamento"), depois, **se** `gruposSorteados` tiver itens, uma seção com um título claro "Sorteados" e a mesma renderização de grupos. Não renderizar a seção "Sorteados" se vazia; idem para a primeira (se `demais` vazio). Reutilizar exatamente o mesmo JSX de card/grupo já existente (extrair para uma função local `renderGrupos(grupos)` se ajudar a DRY).

- [ ] **Step 3: Build** — `cd frontend && npx tsc -b && npm run build` → sem erros.

- [ ] **Step 4: Verificação manual** — lista mostra os eventos "Sorteado" numa seção separada abaixo dos demais; seções vazias não aparecem.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/pages/eventos/EventosList.tsx
git commit -m "feat(ui): separar eventos Sorteado dos demais na lista"
```

---

## Self-review (cobertura das specs)

**Comissão Técnica:**
- Role `COMISSAO_TECNICA` + tabela `EventoComissao` + migrations → Task 1 ✓
- Middleware `requireAcessoEvento`/`usuarioTemAcessoAoEvento` + testes → Task 2 ✓
- Ações operacionais (inscritos/campeões/sorteios/relatório) liberadas p/ ADMIN ou CT-atribuído, com resolvers (body/params/lookup) → Task 3 ✓
- `GET /eventos` filtrado por comissão p/ CT; `buscarPorId` barra CT não atribuído; `comissao_ids` no create/edit + include → Task 4 ✓
- Tipos (Role, Evento.comissao) + role na tela de Usuários → Task 5 ✓
- Menu por role (CT: Eventos/Modo Congresso/Relatórios) + guardas de rota + Modo Congresso no menu → Task 6 ✓
- Comissão no form do evento + ocultar Editar/Modalidades/Publicar p/ CT em EventoInscricoes → Task 7 ✓
- CT mantém leitura de participantes (GET requireAuth, inalterado) ✓

**Melhorias:**
- Nome no lugar do e-mail na sidebar → Task 6 (Step 1c) ✓
- Separar eventos "Sorteado" → Task 8 ✓

- Migrations (enum Role + tabela evento_comissao) exigem Cloud SQL prod ligado no deploy-main. Validação por testes (mock prisma) + `npm run build` + manual.
