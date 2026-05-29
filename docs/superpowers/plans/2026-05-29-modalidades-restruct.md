# Modalidades restruct + TipoModalidade + drop Categoria — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover a entidade `Categoria` (e o enum `Genero`), criar a nova entidade `TipoModalidade` (CRUD admin), e reescrever `Modalidade` para ter FKs obrigatórias para `Competicao` e `TipoModalidade`, novo campo `sigla`, e uniqueness composto. Bump para `1.4.0`.

**Architecture:** Migração destrutiva atômica (drop Categoria/Genero, drop Modalidade.descricao+nome unique, drop dados de Modalidade, create TipoModalidade, alter Modalidade com 3 FKs + sigla + 2 uniques compostos). Backend reescreve `modalidades.service` para usar `include: { competicao, tipo_modalidade }` e `mapPrismaError` para 409; novo módulo `tipos_modalidade` padrão; `competicoes.service.remover` ganha check 409. Frontend troca `pages/categorias` por `pages/tipos-modalidade`, reescreve `ModalidadeForm`/`ModalidadesList` para 2 combos + sigla + nome, consolida tipos em `types/modalidade.ts` (apaga `fundacao.ts`), reorganiza sidebar e rotas.

**Tech Stack:** Prisma (Postgres), Express + Zod + Vitest. React 18 + Vite + React Query + Tailwind + React Router.

**Spec:** `docs/superpowers/specs/2026-05-29-modalidades-restruct-design.md`

---

## File Structure

**Backend — Create:**
- `backend/src/modules/tipos_modalidade/{tipos_modalidade.service,tipos_modalidade.service.test,tipos_modalidade.controller,tipos_modalidade.routes}.ts`
- `backend/prisma/migrations/<timestamp>_drop_categoria_restruct_modalidade/migration.sql` (auto-generated)

**Backend — Modify:**
- `backend/prisma/schema.prisma` — drop `Categoria`, drop enum `Genero`, modify `Modalidade`, add `TipoModalidade`, add back-refs.
- `backend/src/modules/modalidades/modalidades.service.ts` — reescrever (novos campos, includes, mapPrismaError, sem `_count.categorias`).
- `backend/src/modules/modalidades/modalidades.service.test.ts` — reescrever.
- `backend/src/modules/modalidades/modalidades.controller.ts` — reescrever Zod schema (campos novos, parse query `competicao_id?`).
- `backend/src/modules/competicoes/competicoes.service.ts` — `remover` ganha check 409 de modalidade.
- `backend/src/modules/competicoes/competicoes.service.test.ts` — 2 novos testes.
- `backend/src/index.ts` — remover `categoriasRoutes` import/use; adicionar `tiposModalidadeRoutes` antes de `modalidades`.

**Backend — Delete:**
- `backend/src/modules/categorias/` (4 arquivos).

**Frontend — Create:**
- `frontend/src/types/modalidade.ts` (TipoModalidade + Modalidade consolidados).
- `frontend/src/services/tipos-modalidade.ts`.
- `frontend/src/services/modalidades.ts` (reescrito — substitui existente).
- `frontend/src/pages/tipos-modalidade/{TiposModalidadeList,TipoModalidadeForm}.tsx`.

**Frontend — Modify:**
- `frontend/src/pages/modalidades/ModalidadesList.tsx` — reescrito (4 cols).
- `frontend/src/pages/modalidades/ModalidadeForm.tsx` — reescrito (2 combos + sigla + nome).
- `frontend/src/App.tsx` — drop `/categorias/*`, add `/tipos-modalidade/*`.
- `frontend/src/components/Layout.tsx` — sidebar items (remover Categorias, inserir Tipos de Modalidade).

**Frontend — Delete:**
- `frontend/src/pages/categorias/` (2 arquivos).
- `frontend/src/services/categorias.ts`.
- `frontend/src/types/fundacao.ts` (todos os tipos migraram).

**Release:**
- `package.json` (root): `1.3.0` → `1.4.0`.
- `CHANGELOG.md`: novo bloco `## [1.4.0]` no topo.

---

## Task 1: Atomic schema migration + delete categorias module + rewrite modalidades.service + competicoes.service 409 check

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\prisma\schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_drop_categoria_restruct_modalidade/migration.sql` (auto)
- Delete: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\categorias\` (4 arquivos)
- Modify: `backend/src/modules/modalidades/modalidades.service.ts`
- Modify: `backend/src/modules/modalidades/modalidades.service.test.ts`
- Modify: `backend/src/modules/competicoes/competicoes.service.ts`
- Modify: `backend/src/modules/competicoes/competicoes.service.test.ts`
- Modify: `backend/src/index.ts`

Esta task é **atômica** porque após `prisma migrate dev`, o client regenerado não tem mais `prisma.categoria`/`Genero`, nem o shape antigo de `prisma.modalidade`. Todos os 8 itens precisam casar no mesmo commit.

- [ ] **Step 1: Editar `schema.prisma`**

Aplique exatamente estas mudanças no arquivo:

**(a)** Remover por completo o bloco `enum Genero { ... }` e o bloco `model Categoria { ... }`.

**(b)** Substituir o `model Modalidade` inteiro pelo novo shape (mais abaixo).

**(c)** Substituir o `model Competicao` inteiro pelo novo shape (adiciona `modalidades` back-ref).

**(d)** Adicionar `model TipoModalidade { ... }` ao final do arquivo.

Final do arquivo deve ficar com estes blocos novos/modificados (os demais — `User`, `Municipio`, `Inspetoria`, `Delegacia`, `Participante` — intocados):

```prisma
model Modalidade {
  id                  Int             @id @default(autoincrement())
  nome                String
  sigla               String
  competicao          Competicao      @relation(fields: [competicao_id], references: [id])
  competicao_id       Int
  tipo_modalidade     TipoModalidade  @relation(fields: [tipo_modalidade_id], references: [id])
  tipo_modalidade_id  Int
  criado_em           DateTime        @default(now())
  atualizado_em       DateTime        @updatedAt

  @@unique([competicao_id, nome])
  @@unique([competicao_id, sigla])
}

model Competicao {
  id                  Int          @id @default(autoincrement())
  nome                String       @unique
  estados             String[]
  adicionar_subtitulo Boolean      @default(false)
  modalidades         Modalidade[]
  criado_em           DateTime     @default(now())
  atualizado_em       DateTime     @updatedAt
}

model TipoModalidade {
  id            Int          @id @default(autoincrement())
  nome          String       @unique
  modalidades   Modalidade[]
  criado_em     DateTime     @default(now())
  atualizado_em DateTime     @updatedAt
}
```

- [ ] **Step 2: Apagar o módulo `categorias`**

Remover os 4 arquivos:
- `backend/src/modules/categorias/categorias.controller.ts`
- `backend/src/modules/categorias/categorias.routes.ts`
- `backend/src/modules/categorias/categorias.service.ts`
- `backend/src/modules/categorias/categorias.service.test.ts`

E o diretório vazio.

- [ ] **Step 3: Reescrever `modalidades.service.ts`**

Substituir o arquivo `backend/src/modules/modalidades/modalidades.service.ts` por:

```ts
import prisma from '../../lib/prisma'

const INCLUDE = { competicao: true, tipo_modalidade: true } as const

async function mapPrismaError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw Object.assign(
        new Error('Já existe uma modalidade com este nome ou sigla nesta competição.'),
        { status: 409 }
      )
    }
    throw err
  }
}

export async function listar(competicao_id?: number) {
  return prisma.modalidade.findMany({
    where: competicao_id ? { competicao_id } : undefined,
    orderBy: [{ competicao: { nome: 'asc' } }, { nome: 'asc' }],
    include: INCLUDE,
  })
}

export async function buscarPorId(id: number) {
  const item = await prisma.modalidade.findUnique({
    where: { id },
    include: INCLUDE,
  })
  if (!item) throw Object.assign(new Error('Modalidade não encontrada'), { status: 404 })
  return item
}

export async function criar(data: {
  nome: string
  sigla: string
  competicao_id: number
  tipo_modalidade_id: number
}) {
  return mapPrismaError(() => prisma.modalidade.create({ data, include: INCLUDE }))
}

export async function editar(
  id: number,
  data: Partial<{ nome: string; sigla: string; competicao_id: number; tipo_modalidade_id: number }>
) {
  return mapPrismaError(() => prisma.modalidade.update({ where: { id }, data, include: INCLUDE }))
}

export async function remover(id: number) {
  return prisma.modalidade.delete({ where: { id } })
}
```

- [ ] **Step 4: Reescrever `modalidades.service.test.ts`**

Substituir o arquivo `backend/src/modules/modalidades/modalidades.service.test.ts` por:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    modalidade: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './modalidades.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

const INCLUDE = { competicao: true, tipo_modalidade: true }

describe('modalidades.service', () => {
  it('listar sem filtro inclui competicao e tipo_modalidade', async () => {
    mockPrisma.modalidade.findMany.mockResolvedValue([])
    await service.listar()
    expect(mockPrisma.modalidade.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: [{ competicao: { nome: 'asc' } }, { nome: 'asc' }],
      include: INCLUDE,
    })
  })

  it('listar filtra por competicao_id quando passado', async () => {
    mockPrisma.modalidade.findMany.mockResolvedValue([])
    await service.listar(7)
    expect(mockPrisma.modalidade.findMany).toHaveBeenCalledWith({
      where: { competicao_id: 7 },
      orderBy: [{ competicao: { nome: 'asc' } }, { nome: 'asc' }],
      include: INCLUDE,
    })
  })

  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.modalidade.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('criar chama prisma.create com todos os campos e include', async () => {
    const data = { nome: 'Futebol', sigla: 'FUT', competicao_id: 1, tipo_modalidade_id: 2 }
    mockPrisma.modalidade.create.mockResolvedValue({ id: 1, ...data })
    await service.criar(data)
    expect(mockPrisma.modalidade.create).toHaveBeenCalledWith({ data, include: INCLUDE })
  })

  it('criar mapeia P2002 para 409', async () => {
    mockPrisma.modalidade.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))
    await expect(
      service.criar({ nome: 'X', sigla: 'X', competicao_id: 1, tipo_modalidade_id: 1 })
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining('Já existe') })
  })

  it('editar chama prisma.update com include', async () => {
    mockPrisma.modalidade.update.mockResolvedValue({ id: 1 })
    await service.editar(1, { nome: 'Renomeada' })
    expect(mockPrisma.modalidade.update).toHaveBeenCalledWith({
      where: { id: 1 }, data: { nome: 'Renomeada' }, include: INCLUDE,
    })
  })

  it('editar também mapeia P2002 para 409', async () => {
    mockPrisma.modalidade.update.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))
    await expect(
      service.editar(1, { sigla: 'DUP' })
    ).rejects.toMatchObject({ status: 409 })
  })

  it('remover deleta direto', async () => {
    mockPrisma.modalidade.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.modalidade.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
```

- [ ] **Step 5: Atualizar `competicoes.service.ts`**

Localizar a função `remover` no arquivo (atualmente é `return prisma.competicao.delete(...)` sem check). Substituir por:

```ts
export async function remover(id: number) {
  const vinculadas = await prisma.modalidade.count({ where: { competicao_id: id } })
  if (vinculadas > 0) {
    throw Object.assign(
      new Error('Remova as modalidades vinculadas antes de excluir esta competição.'),
      { status: 409 }
    )
  }
  return prisma.competicao.delete({ where: { id } })
}
```

Restante do arquivo intocado.

- [ ] **Step 6: Atualizar `competicoes.service.test.ts`**

Atualizar o `vi.mock` no topo para incluir o mock de `modalidade.count`. Localizar o bloco:

```ts
vi.mock('../../lib/prisma', () => ({
  default: {
    competicao: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))
```

Substituir por:

```ts
vi.mock('../../lib/prisma', () => ({
  default: {
    competicao: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    modalidade: {
      count: vi.fn(),
    },
  },
}))
```

E substituir o teste existente:

```ts
  it('remover deleta direto', async () => {
    mockPrisma.competicao.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.competicao.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
```

Por estes 2 novos:

```ts
  it('remover lança 409 se há modalidade vinculada', async () => {
    mockPrisma.modalidade.count.mockResolvedValue(2)
    await expect(service.remover(1)).rejects.toMatchObject({ status: 409 })
    expect(mockPrisma.competicao.delete).not.toHaveBeenCalled()
  })

  it('remover deleta quando não há modalidade vinculada', async () => {
    mockPrisma.modalidade.count.mockResolvedValue(0)
    mockPrisma.competicao.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.competicao.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
```

- [ ] **Step 7: Atualizar `backend/src/index.ts`**

Remover a linha de import:
```ts
import categoriasRoutes from './modules/categorias/categorias.routes'
```

E a linha de uso:
```ts
app.use('/categorias', categoriasRoutes)
```

Não adicionar nada novo aqui — `tipos_modalidade` será wired em Task 3.

- [ ] **Step 8: Gerar migration**

De `backend/`:
```
npx prisma migrate dev --name drop_categoria_restruct_modalidade
```

Esperado: Prisma alerta sobre data loss (drop Categoria + drop dados de Modalidade por causa das novas FKs obrigatórias). Responder yes.

Se `migrate dev` bloquear (non-TTY, falha de conexão), usar fallback:
```
DATABASE_URL=<from .env> npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
# salvar saída em backend/prisma/migrations/<timestamp>_drop_categoria_restruct_modalidade/migration.sql
DATABASE_URL=<from .env> npx prisma migrate deploy
```

Após qualquer um, rodar `npx prisma generate`.

- [ ] **Step 9: Verificar migration.sql**

Abrir o `migration.sql` gerado e confirmar:
- `ALTER TABLE "Modalidade" DROP CONSTRAINT "Modalidade_..._fkey"` (Categoria FK)
- `DROP TABLE "Categoria"`
- `DROP TYPE "Genero"`
- `ALTER TABLE "Modalidade" DROP COLUMN "descricao"`
- `DROP INDEX "Modalidade_nome_key"` (era unique global)
- `ALTER TABLE "Modalidade" ADD COLUMN "sigla" TEXT NOT NULL`, `ADD COLUMN "competicao_id" INTEGER NOT NULL`, `ADD COLUMN "tipo_modalidade_id" INTEGER NOT NULL`
- 2 `ALTER TABLE` para as FKs novas (Modalidade → Competicao, Modalidade → TipoModalidade)
- `CREATE UNIQUE INDEX "Modalidade_competicao_id_nome_key"`, `"Modalidade_competicao_id_sigla_key"`
- `CREATE TABLE "TipoModalidade"` + unique `nome`

Incluir o trecho relevante no relatório.

- [ ] **Step 10: tsc + suite atual**

```
npx tsc --noEmit
npx vitest run
```
Esperado: tsc clean (não há mais referências a `prisma.categoria`, `Genero`, `descricao`, `_count.categorias`, `categorias` em Modalidade, etc.); todos os testes existentes + os 2 novos de competicoes + os ~8 de modalidades reescritos passam.

Se algum arquivo ainda referencia `Categoria`/`categoria`/`Genero`/`descricao`/`_count`, rodar `grep -rn "Categoria\|categoria\|Genero\|descricao\|_count" backend/src` para localizar.

- [ ] **Step 11: Commit**

```
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/modules/modalidades backend/src/modules/competicoes backend/src/index.ts
git rm -r backend/src/modules/categorias
git commit -m "refactor(db): drop Categoria + restruct Modalidade with FKs to Competicao/TipoModalidade"
```

---

## Task 2: Módulo `tipos_modalidade` — service + tests + controller + routes

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\tipos_modalidade\tipos_modalidade.service.ts`
- Create: `backend/src/modules/tipos_modalidade/tipos_modalidade.service.test.ts`
- Create: `backend/src/modules/tipos_modalidade/tipos_modalidade.controller.ts`
- Create: `backend/src/modules/tipos_modalidade/tipos_modalidade.routes.ts`

TDD: testes → falham → implementação → passam.

- [ ] **Step 1: Criar o test (conteúdo exato)**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    tipoModalidade: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    modalidade: {
      count: vi.fn(),
    },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './tipos_modalidade.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('tipos_modalidade.service', () => {
  it('listar retorna lista ordenada por nome', async () => {
    mockPrisma.tipoModalidade.findMany.mockResolvedValue([{ id: 1, nome: 'Coletivo' }])
    const result = await service.listar()
    expect(result).toEqual([{ id: 1, nome: 'Coletivo' }])
    expect(mockPrisma.tipoModalidade.findMany).toHaveBeenCalledWith({ orderBy: { nome: 'asc' } })
  })

  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.tipoModalidade.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('criar chama prisma.create com nome', async () => {
    mockPrisma.tipoModalidade.create.mockResolvedValue({ id: 1, nome: 'Coletivo' })
    await service.criar({ nome: 'Coletivo' })
    expect(mockPrisma.tipoModalidade.create).toHaveBeenCalledWith({ data: { nome: 'Coletivo' } })
  })

  it('editar chama prisma.update', async () => {
    mockPrisma.tipoModalidade.update.mockResolvedValue({ id: 1, nome: 'Individual' })
    await service.editar(1, { nome: 'Individual' })
    expect(mockPrisma.tipoModalidade.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { nome: 'Individual' } })
  })

  it('remover lança 409 quando há modalidade vinculada', async () => {
    mockPrisma.modalidade.count.mockResolvedValue(3)
    await expect(service.remover(1)).rejects.toMatchObject({ status: 409 })
    expect(mockPrisma.tipoModalidade.delete).not.toHaveBeenCalled()
  })

  it('remover deleta quando não há vínculo', async () => {
    mockPrisma.modalidade.count.mockResolvedValue(0)
    mockPrisma.tipoModalidade.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.tipoModalidade.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
```

- [ ] **Step 2: Rodar test — deve falhar (module not found)**

```
cd backend && npx vitest run src/modules/tipos_modalidade/tipos_modalidade.service.test.ts
```

- [ ] **Step 3: Implementar `tipos_modalidade.service.ts`**

```ts
import prisma from '../../lib/prisma'

export async function listar() {
  return prisma.tipoModalidade.findMany({ orderBy: { nome: 'asc' } })
}

export async function buscarPorId(id: number) {
  const item = await prisma.tipoModalidade.findUnique({ where: { id } })
  if (!item) throw Object.assign(new Error('Tipo de modalidade não encontrado'), { status: 404 })
  return item
}

export async function criar(data: { nome: string }) {
  return prisma.tipoModalidade.create({ data })
}

export async function editar(id: number, data: { nome?: string }) {
  return prisma.tipoModalidade.update({ where: { id }, data })
}

export async function remover(id: number) {
  const vinculadas = await prisma.modalidade.count({ where: { tipo_modalidade_id: id } })
  if (vinculadas > 0) {
    throw Object.assign(
      new Error('Remova as modalidades vinculadas antes de excluir este tipo.'),
      { status: 409 }
    )
  }
  return prisma.tipoModalidade.delete({ where: { id } })
}
```

- [ ] **Step 4: Rodar test — 6 passam**

```
npx vitest run src/modules/tipos_modalidade/tipos_modalidade.service.test.ts
```

- [ ] **Step 5: Criar `tipos_modalidade.controller.ts`**

```ts
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './tipos_modalidade.service'

const createSchema = z.object({ nome: z.string().min(1) })
const updateSchema = createSchema.partial()

export async function listar(_req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.listar()) } catch (err) { next(err) }
}

export async function buscarPorId(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.buscarPorId(Number(req.params.id))) } catch (err) { next(err) }
}

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchema.parse(req.body)
    res.status(201).json(await service.criar(body))
  } catch (err) { next(err) }
}

export async function editar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = updateSchema.parse(req.body)
    res.json(await service.editar(Number(req.params.id), body))
  } catch (err) { next(err) }
}

export async function remover(req: Request, res: Response, next: NextFunction) {
  try {
    await service.remover(Number(req.params.id))
    res.status(204).send()
  } catch (err) { next(err) }
}
```

- [ ] **Step 6: Criar `tipos_modalidade.routes.ts`**

```ts
import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as ctrl from './tipos_modalidade.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]

router.get('/', requireAuth, ctrl.listar)
router.get('/:id', requireAuth, ctrl.buscarPorId)
router.post('/', ...admin, ctrl.criar)
router.put('/:id', ...admin, ctrl.editar)
router.delete('/:id', ...admin, ctrl.remover)

export default router
```

- [ ] **Step 7: tsc**

```
cd backend && npx tsc --noEmit
```
Esperado: clean (rotas serão wired em Task 3).

- [ ] **Step 8: Commit**

```
git add backend/src/modules/tipos_modalidade
git commit -m "feat(tipos-modalidade): add CRUD service, controller and routes"
```

---

## Task 3: Backend — atualizar `modalidades.controller.ts` (Zod novo + parse query) + registrar `tipos_modalidade` route

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\modalidades\modalidades.controller.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Reescrever `modalidades.controller.ts`**

Substituir o arquivo `backend/src/modules/modalidades/modalidades.controller.ts` por:

```ts
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './modalidades.service'

const createSchema = z.object({
  nome: z.string().min(1),
  sigla: z.string().min(2).max(6),
  competicao_id: z.coerce.number().int().positive(),
  tipo_modalidade_id: z.coerce.number().int().positive(),
})
const updateSchema = createSchema.partial()

const listQuerySchema = z.object({
  competicao_id: z.coerce.number().int().positive().optional(),
})

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const { competicao_id } = listQuerySchema.parse(req.query)
    res.json(await service.listar(competicao_id))
  } catch (err) { next(err) }
}

export async function buscarPorId(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.buscarPorId(Number(req.params.id))) } catch (err) { next(err) }
}

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchema.parse(req.body)
    res.status(201).json(await service.criar(body))
  } catch (err) { next(err) }
}

export async function editar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = updateSchema.parse(req.body)
    res.json(await service.editar(Number(req.params.id), body))
  } catch (err) { next(err) }
}

export async function remover(req: Request, res: Response, next: NextFunction) {
  try {
    await service.remover(Number(req.params.id))
    res.status(204).send()
  } catch (err) { next(err) }
}
```

- [ ] **Step 2: Registrar `tipos_modalidade` em `backend/src/index.ts`**

Localizar o bloco de imports. Após o último (provavelmente `competicoesRoutes`), adicionar:

```ts
import tiposModalidadeRoutes from './modules/tipos_modalidade/tipos_modalidade.routes'
```

No bloco de `app.use`, adicionar `app.use('/tipos-modalidade', tiposModalidadeRoutes)` **antes** de `app.use('/modalidades', modalidadesRoutes)` (ordem cosmética; funcional não muda).

- [ ] **Step 3: tsc + full suite**

```
cd backend && npx tsc --noEmit && npx vitest run
```
Esperado: tsc clean; suíte completa passa (deve ser 50 prévios menos 4 de categorias (drop) + 8 modalidades reescritos + 2 novos competicoes + 6 tipos_modalidade ≈ ~60 testes).

- [ ] **Step 4: Commit**

```
git add backend/src/modules/modalidades/modalidades.controller.ts backend/src/index.ts
git commit -m "feat(modalidades): new Zod schema with FKs + sigla; wire tipos-modalidade route"
```

---

## Task 4: Frontend — types/modalidade.ts + apagar fundacao.ts

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\types\modalidade.ts`
- Delete: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\types\fundacao.ts`

- [ ] **Step 1: Criar `types/modalidade.ts`**

```ts
import type { Competicao } from './competicao'

export type TipoModalidade = {
  id: number
  nome: string
  criado_em: string
  atualizado_em: string
}

export type Modalidade = {
  id: number
  nome: string
  sigla: string
  competicao_id: number
  competicao: Competicao
  tipo_modalidade_id: number
  tipo_modalidade: TipoModalidade
  criado_em: string
  atualizado_em: string
}
```

- [ ] **Step 2: Apagar `frontend/src/types/fundacao.ts`**

O arquivo atual exporta `Modalidade`, `Genero`, `Categoria`. Todos os 3 saem (Modalidade migra para `types/modalidade.ts`; Genero/Categoria são removidos com a feature).

- [ ] **Step 3: tsc**

```
cd frontend && npx tsc --noEmit
```
Esperado: a partir daqui, vários arquivos vão acusar import quebrado de `fundacao`. Como o tsconfig do frontend não é strict, pode passar mesmo assim. Se aparecerem erros em arquivos que NÃO são `pages/categorias/*` ou `pages/modalidades/*` (que serão reescritos nas próximas tasks), fixar antes de seguir. Os imports quebrados em `categorias`/`modalidades` são esperados — serão resolvidos quando esses arquivos forem deletados/reescritos.

- [ ] **Step 4: Commit**

```
git add frontend/src/types/modalidade.ts
git rm frontend/src/types/fundacao.ts
git commit -m "refactor(frontend): consolidate Modalidade types in types/modalidade.ts; delete fundacao.ts"
```

---

## Task 5: Frontend — services (drop categorias, add tipos-modalidade, rewrite modalidades)

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\services\tipos-modalidade.ts`
- Modify (rewrite): `frontend/src/services/modalidades.ts`
- Delete: `frontend/src/services/categorias.ts`

- [ ] **Step 1: Criar `services/tipos-modalidade.ts`**

```ts
import api from './api'
import type { TipoModalidade } from '../types/modalidade'

const BASE = '/tipos-modalidade'

export const tiposModalidadeService = {
  listar: () => api.get<TipoModalidade[]>(BASE).then(r => r.data),
  buscar: (id: number) => api.get<TipoModalidade>(`${BASE}/${id}`).then(r => r.data),
  criar: (data: { nome: string }) => api.post<TipoModalidade>(BASE, data).then(r => r.data),
  editar: (id: number, data: { nome?: string }) => api.put<TipoModalidade>(`${BASE}/${id}`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
```

- [ ] **Step 2: Reescrever `services/modalidades.ts`**

Substituir o arquivo `frontend/src/services/modalidades.ts` por:

```ts
import api from './api'
import type { Modalidade } from '../types/modalidade'

const BASE = '/modalidades'

type ModalidadePayload = {
  nome: string
  sigla: string
  competicao_id: number
  tipo_modalidade_id: number
}

export const modalidadesService = {
  listar: (params?: { competicao_id?: number }) =>
    api.get<Modalidade[]>(BASE, { params }).then(r => r.data),
  buscar: (id: number) => api.get<Modalidade>(`${BASE}/${id}`).then(r => r.data),
  criar: (data: ModalidadePayload) => api.post<Modalidade>(BASE, data).then(r => r.data),
  editar: (id: number, data: Partial<ModalidadePayload>) =>
    api.put<Modalidade>(`${BASE}/${id}`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
```

- [ ] **Step 3: Apagar `services/categorias.ts`**

Remover o arquivo `frontend/src/services/categorias.ts`.

- [ ] **Step 4: tsc**

```
cd frontend && npx tsc --noEmit
```
Esperado: errors residuais apenas em `pages/categorias/*` (apagados na Task 8) e em `pages/modalidades/*` (reescritos na Task 7). Outros caminhos limpos.

- [ ] **Step 5: Commit**

```
git add frontend/src/services/tipos-modalidade.ts frontend/src/services/modalidades.ts
git rm frontend/src/services/categorias.ts
git commit -m "feat(frontend): add tipos-modalidade service; rewrite modalidades service; drop categorias"
```

---

## Task 6: Frontend — pages de Tipos de Modalidade (List + Form)

**Files:**
- Create: `frontend/src/pages/tipos-modalidade/TiposModalidadeList.tsx`
- Create: `frontend/src/pages/tipos-modalidade/TipoModalidadeForm.tsx`

- [ ] **Step 1: Criar `TiposModalidadeList.tsx`**

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import { tiposModalidadeService } from '../../services/tipos-modalidade'
import type { TipoModalidade } from '../../types/modalidade'

export default function TiposModalidadeList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['tipos-modalidade'],
    queryFn: tiposModalidadeService.listar,
  })

  const { mutate: remover } = useMutation({
    mutationFn: tiposModalidadeService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tipos-modalidade'] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const columns = [
    { header: 'Nome', accessor: (row: TipoModalidade) => row.nome },
    {
      header: 'Ações',
      accessor: (row: TipoModalidade) => (
        <div className="flex gap-2">
          <button onClick={() => navigate(`/tipos-modalidade/${row.id}/editar`)} className="text-indigo-400 hover:text-indigo-300 text-xs">Editar</button>
          <button onClick={() => { if (confirm(`Remover "${row.nome}"?`)) remover(row.id) }} className="text-red-400 hover:text-red-300 text-xs">Remover</button>
        </div>
      ),
      className: 'w-28',
    },
  ]

  return (
    <div className="text-white">
      <PageHeader title="Tipos de Modalidade" actionLabel="+ Novo Tipo" actionTo="/tipos-modalidade/novo" />
      <div className="p-6">
        {isLoading ? <p className="text-gray-400 text-sm">Carregando...</p>
          : <DataTable columns={columns} data={data} keyExtractor={r => r.id} emptyMessage="Nenhum tipo cadastrado." />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar `TipoModalidadeForm.tsx`**

```tsx
import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { tiposModalidadeService } from '../../services/tipos-modalidade'

export default function TipoModalidadeForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['tipos-modalidade', Number(id)],
    queryFn: () => tiposModalidadeService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => { if (existing) setNome(existing.nome) }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => isEdit
      ? tiposModalidadeService.editar(Number(id), { nome })
      : tiposModalidadeService.criar({ nome }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tipos-modalidade'] }); navigate('/tipos-modalidade') },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  return (
    <div className="text-white">
      <PageHeader title={isEdit ? 'Editar Tipo' : 'Novo Tipo de Modalidade'} backTo="/tipos-modalidade" />
      <div className="p-6 max-w-lg">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); setErro(''); salvar() }} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} required
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {erro && <p className="text-sm text-red-400">{erro}</p>}
          <button type="submit" disabled={isPending}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: tsc**

```
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```
git add frontend/src/pages/tipos-modalidade
git commit -m "feat(frontend): add TiposModalidade list and form pages"
```

---

## Task 7: Frontend — rewrite ModalidadesList + ModalidadeForm

**Files:**
- Modify (rewrite): `frontend/src/pages/modalidades/ModalidadesList.tsx`
- Modify (rewrite): `frontend/src/pages/modalidades/ModalidadeForm.tsx`

- [ ] **Step 1: Reescrever `ModalidadesList.tsx`**

Substituir o arquivo `frontend/src/pages/modalidades/ModalidadesList.tsx` por:

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import { modalidadesService } from '../../services/modalidades'
import type { Modalidade } from '../../types/modalidade'

export default function ModalidadesList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['modalidades'],
    queryFn: () => modalidadesService.listar(),
  })

  const { mutate: remover } = useMutation({
    mutationFn: modalidadesService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['modalidades'] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const columns = [
    { header: 'Competição', accessor: (row: Modalidade) => row.competicao.nome },
    { header: 'Tipo', accessor: (row: Modalidade) => row.tipo_modalidade.nome },
    { header: 'Nome', accessor: (row: Modalidade) => row.nome },
    { header: 'Sigla', accessor: (row: Modalidade) => row.sigla, className: 'w-20 font-mono' },
    {
      header: 'Ações',
      accessor: (row: Modalidade) => (
        <div className="flex gap-2">
          <button onClick={() => navigate(`/modalidades/${row.id}/editar`)} className="text-indigo-400 hover:text-indigo-300 text-xs">Editar</button>
          <button onClick={() => { if (confirm(`Remover "${row.nome}"?`)) remover(row.id) }} className="text-red-400 hover:text-red-300 text-xs">Remover</button>
        </div>
      ),
      className: 'w-28',
    },
  ]

  return (
    <div className="text-white">
      <PageHeader title="Modalidades" actionLabel="+ Nova Modalidade" actionTo="/modalidades/nova" />
      <div className="p-6">
        {isLoading ? <p className="text-gray-400 text-sm">Carregando...</p>
          : <DataTable columns={columns} data={data} keyExtractor={r => r.id} emptyMessage="Nenhuma modalidade cadastrada." />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Reescrever `ModalidadeForm.tsx`**

Substituir o arquivo `frontend/src/pages/modalidades/ModalidadeForm.tsx` por:

```tsx
import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { modalidadesService } from '../../services/modalidades'
import { competicoesService } from '../../services/competicoes'
import { tiposModalidadeService } from '../../services/tipos-modalidade'

export default function ModalidadeForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [competicaoId, setCompeticaoId] = useState<number | ''>('')
  const [tipoModalidadeId, setTipoModalidadeId] = useState<number | ''>('')
  const [nome, setNome] = useState('')
  const [sigla, setSigla] = useState('')
  const [erro, setErro] = useState('')

  const { data: competicoes = [] } = useQuery({
    queryKey: ['competicoes'],
    queryFn: competicoesService.listar,
  })

  const { data: tipos = [] } = useQuery({
    queryKey: ['tipos-modalidade'],
    queryFn: tiposModalidadeService.listar,
  })

  const { data: existing } = useQuery({
    queryKey: ['modalidades', Number(id)],
    queryFn: () => modalidadesService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setCompeticaoId(existing.competicao_id)
      setTipoModalidadeId(existing.tipo_modalidade_id)
      setNome(existing.nome)
      setSigla(existing.sigla)
    }
  }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      const payload = {
        nome,
        sigla: sigla.trim().toUpperCase(),
        competicao_id: Number(competicaoId),
        tipo_modalidade_id: Number(tipoModalidadeId),
      }
      return isEdit
        ? modalidadesService.editar(Number(id), payload)
        : modalidadesService.criar(payload)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['modalidades'] }); navigate('/modalidades') },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!competicaoId) return setErro('Selecione uma competição.')
    if (!tipoModalidadeId) return setErro('Selecione um tipo de modalidade.')
    if (!nome.trim()) return setErro('Informe o nome.')
    if (sigla.trim().length < 2) return setErro('Sigla deve ter ao menos 2 caracteres.')
    salvar()
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="text-white">
      <PageHeader title={isEdit ? 'Editar Modalidade' : 'Nova Modalidade'} backTo="/modalidades" />
      <div className="p-6 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Competição</label>
            <select value={competicaoId} onChange={e => setCompeticaoId(e.target.value === '' ? '' : Number(e.target.value))} required className={inputClass}>
              <option value="">— Selecione —</option>
              {competicoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Tipo de Modalidade</label>
            <select value={tipoModalidadeId} onChange={e => setTipoModalidadeId(e.target.value === '' ? '' : Number(e.target.value))} required className={inputClass}>
              <option value="">— Selecione —</option>
              {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} required className={inputClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Sigla (2 a 6 caracteres)</label>
            <input value={sigla} onChange={e => setSigla(e.target.value)} required maxLength={6}
              className={`${inputClass} font-mono uppercase`} placeholder="Ex.: FUT" />
          </div>

          {erro && <p className="text-sm text-red-400">{erro}</p>}
          <button type="submit" disabled={isPending}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: tsc**

```
cd frontend && npx tsc --noEmit
```
Esperado: errors residuais apenas em `pages/categorias/*` (drop na Task 8).

- [ ] **Step 4: Commit**

```
git add frontend/src/pages/modalidades
git commit -m "feat(frontend): rewrite Modalidades pages (List + Form with FK combos + sigla)"
```

---

## Task 8: Frontend — drop categorias pages + App.tsx routes + Layout.tsx sidebar

**Files:**
- Delete: `frontend/src/pages/categorias/` (2 arquivos: List + Form)
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Apagar pages/categorias**

Remover os 2 arquivos:
- `frontend/src/pages/categorias/CategoriasList.tsx`
- `frontend/src/pages/categorias/CategoriaForm.tsx`

E o diretório.

- [ ] **Step 2: Atualizar `App.tsx`**

Read o arquivo. Remover os imports:
```tsx
import CategoriasList from './pages/categorias/CategoriasList'
import CategoriaForm from './pages/categorias/CategoriaForm'
```

Adicionar os novos (depois dos imports de `ParticipanteForm`):
```tsx
import TiposModalidadeList from './pages/tipos-modalidade/TiposModalidadeList'
import TipoModalidadeForm from './pages/tipos-modalidade/TipoModalidadeForm'
```

Remover as 3 rotas de `/categorias/*` dentro do `<Route element={<Layout />}>`:
```tsx
<Route path="/categorias" element={<CategoriasList />} />
<Route path="/categorias/nova" element={<CategoriaForm />} />
<Route path="/categorias/:id/editar" element={<CategoriaForm />} />
```

Adicionar (na posição antes de `/modalidades/*`, depois de `/participantes/:id/editar`):
```tsx
            <Route path="/tipos-modalidade"            element={<TiposModalidadeList />} />
            <Route path="/tipos-modalidade/novo"       element={<TipoModalidadeForm />} />
            <Route path="/tipos-modalidade/:id/editar" element={<TipoModalidadeForm />} />
```

(Indentação 12 espaços, consistente.)

- [ ] **Step 3: Atualizar `Layout.tsx` (sidebar)**

Localizar o array `items` do grupo Cadastros. Está atualmente com 7 itens (incluindo Categorias). Substituir o array `items` inteiro por:

```tsx
items: [
  { label: 'Municípios',          to: '/municipios' },
  { label: 'Inspetorias',         to: '/inspetorias' },
  { label: 'Delegacias',          to: '/delegacias' },
  { label: 'Participantes',       to: '/participantes' },
  { label: 'Tipos de Modalidade', to: '/tipos-modalidade' },
  { label: 'Modalidades',         to: '/modalidades' },
  { label: 'Competições',         to: '/competicoes' },
],
```

"Categorias" removido. "Tipos de Modalidade" inserido entre Participantes e Modalidades.

- [ ] **Step 4: Sanity grep**

Do root do repo:
```
grep -rni "Categoria\|categorias\|Genero" frontend/src 2>/dev/null
```
Esperado: zero hits. Se houver, fixar.

- [ ] **Step 5: tsc + build**

```
cd frontend && npx tsc --noEmit && npm run build
```
Esperado: tsc clean; vite build OK.

- [ ] **Step 6: Commit**

```
git add frontend/src/App.tsx frontend/src/components/Layout.tsx
git rm -r frontend/src/pages/categorias
git commit -m "feat(frontend): drop Categorias pages; wire tipos-modalidade routes and sidebar"
```

---

## Task 9: Bump versão + CHANGELOG

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\package.json`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\CHANGELOG.md`

- [ ] **Step 1: Bump version**

Editar `package.json` root. Atual `"version": "1.3.0"`. Mudar apenas para `"version": "1.4.0"`.

- [ ] **Step 2: Adicionar bloco no `CHANGELOG.md`**

Inserir o novo bloco logo após o cabeçalho (linhas iniciais com `# Changelog` e descrição), antes do bloco `## [1.3.0]`:

```md
## [1.4.0] - 2026-05-29

### Added
- Entidade TipoModalidade com CRUD admin.
- Modalidade ganha FKs obrigatórias para Competição e TipoModalidade, e novo campo Sigla.

### Changed
- Modalidade reescrita: agora pertence a uma Competição, tem Tipo (FK) e Sigla; nome e sigla únicos por competição (uniqueness composto).
- Sidebar: "Tipos de Modalidade" entra entre Participantes e Modalidades; "Categorias" removido.

### Removed
- Entidade Categoria (e enum Genero — só era usado por Categoria).
- Campo `descricao` de Modalidade.
- Item "Categorias" do sidebar e rotas correspondentes.
```

Blocos `[1.3.0]`, `[1.2.0]`, `[1.1.0]`, `[1.0.0]` permanecem inalterados abaixo.

- [ ] **Step 3: Commit**

```
git add package.json CHANGELOG.md
git commit -m "chore(release): v1.4.0 — Modalidades restruct + TipoModalidade + drop Categoria"
```

---

## Task 10: End-to-end smoke test (manual, pós-deploy)

**Files:** (sem edição — verificação manual)

- [ ] **Step 1: Push e aguardar CI**

```
git push origin develop
```
CI roda `prisma migrate deploy` (aplica migração destrutiva: drop Categoria/Genero, drop dados de Modalidade, alter Modalidade, create TipoModalidade) e reconstrói os 2 containers (~5 min).

- [ ] **Step 2: Verificar rotas no backend**

```bash
curl -s -o /dev/null -w "/tipos-modalidade: %{http_code} (want 401)\n" http://192.168.56.113:3000/tipos-modalidade
curl -s -o /dev/null -w "/modalidades: %{http_code} (want 401)\n"        http://192.168.56.113:3000/modalidades
curl -s -o /dev/null -w "/categorias: %{http_code} (want 404)\n"         http://192.168.56.113:3000/categorias
```
Esperado: 401, 401, 404.

- [ ] **Step 3: Smoke test no browser (anônimo)**

Abrir http://192.168.56.113:8080. Login `admin@prosports.com` / `admin123`.

1. Sidebar tem 7 itens em Cadastros nessa ordem: Municípios · Inspetorias · Delegacias · Participantes · **Tipos de Modalidade** · Modalidades · Competições. Sem "Categorias".
2. **Tipos de Modalidade** → "+ Novo Tipo" → "Coletivo" → Salvar. Repetir com "Individual".
3. **Modalidades** → "+ Nova Modalidade": Competição = "Copa Brasil 2026", Tipo = "Coletivo", Nome = "Futebol", Sigla = "FUT" → Salvar. Lista mostra `Copa Brasil 2026 · Coletivo · Futebol · FUT`.
4. Criar **outra Modalidade na mesma Competição com mesma sigla "FUT"** → 409 amigável.
5. Criar a mesma "Futebol" + "FUT" em **outra Competição** (cadastrar competição extra antes se necessário) → permitido.
6. Tentar excluir o TipoModalidade "Coletivo" → 409.
7. Tentar excluir a Competição "Copa Brasil 2026" → 409.
8. Remover a Modalidade → consegue. Tentar excluir o Tipo de novo → consegue (sem vínculo).
9. Rodapé do sidebar `v1.4.0 (<sha>)` com badge indigo → `/novidades` mostra entrada `1.4.0 — 2026-05-29` no topo com Added/Changed/Removed.

- [ ] **Step 4: Reportar**

Se passou tudo, fechar a sessão. Se algo falhar, capturar request/response (aba Network) e voltar para iteração.

---

## Self-review

Cobertura do spec:

| Spec | Coberto por |
|---|---|
| Drop Categoria + enum Genero | Task 1 |
| Drop dados Modalidade + alter shape | Task 1 (migration) |
| `Modalidade` novos campos + uniqueness composto | Task 1 |
| `TipoModalidade` model | Task 1 |
| Drop módulo backend `categorias` | Task 1 |
| `municipios.service` ainda válido | — sem mudança |
| `modalidades.service` reescrito | Task 1 + Task 3 (controller) |
| `competicoes.service.remover` 409 | Task 1 |
| Módulo `tipos_modalidade` | Task 2 |
| Wiring em `index.ts` (drop categorias, add tipos-modalidade) | Tasks 1 + 3 |
| Frontend tipos consolidados em `types/modalidade.ts` | Task 4 |
| Frontend services | Task 5 |
| Páginas Tipos | Task 6 |
| Páginas Modalidade reescritas | Task 7 |
| App.tsx + Sidebar | Task 8 |
| Bump + CHANGELOG | Task 9 |
| Smoke test | Task 10 |

Riscos do spec (migração destrutiva, P2002 sem diferenciar campo, fundacao.ts residual) endereçados nas Tasks 1 (atômica + grep), 1 Step 3 (mensagem genérica), 4 e 8 (grep antes do commit final).
