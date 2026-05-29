# Participantes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir `Delegacao` por `Participante` (com FKs para Inspetoria, Delegacia, Municipio + campo Subtítulo), criar as entidades novas `Inspetoria` e `Delegacia` com CRUD admin, atualizar o frontend e bumpar para 1.2.0.

**Architecture:** Migração destrutiva: drop da tabela `Delegacao`, criação de 3 modelos novos (`Inspetoria`, `Delegacia`, `Participante`). Backend ganha 3 módulos novos (mesmo padrão de `municipios`/`modalidades`); módulo `delegacoes` é removido por completo. `municipios.service` é atualizado para usar `participante` no check de exclusão (409). Frontend cria páginas/services/types novos, remove os antigos de Delegações, atualiza sidebar e rotas. Vite reutiliza `MunicipioSelect` para o campo Município do Participante.

**Tech Stack:** Prisma (Postgres), Express + Zod + Multer (sem upload aqui), Vitest. React 18 + Vite + React Query + Tailwind + React Router + Axios.

**Spec:** `docs/superpowers/specs/2026-05-28-participantes-design.md`

---

## File Structure

**Backend — Create:**
- `backend/src/modules/inspetorias/{inspetorias.service,inspetorias.service.test,inspetorias.controller,inspetorias.routes}.ts`
- `backend/src/modules/delegacias/{delegacias.service,delegacias.service.test,delegacias.controller,delegacias.routes}.ts`
- `backend/src/modules/participantes/{participantes.service,participantes.service.test,participantes.controller,participantes.routes}.ts`
- `backend/prisma/migrations/<timestamp>_rename_delegacao_to_participante_with_refs/migration.sql` (auto-generated)

**Backend — Modify:**
- `backend/prisma/schema.prisma`: drop `Delegacao`, add 3 modelos, atualizar back-reference em `Municipio`.
- `backend/src/modules/municipios/municipios.service.ts`: troca `prisma.delegacao.count` por `prisma.participante.count` + mensagem do 409.
- `backend/src/modules/municipios/municipios.service.test.ts`: troca mock `delegacao` por `participante`.
- `backend/src/index.ts`: remove `delegacoesRoutes`, adiciona os 3 novos `app.use`.

**Backend — Delete:**
- `backend/src/modules/delegacoes/` (4 arquivos)

**Frontend — Create:**
- `frontend/src/types/participante.ts`
- `frontend/src/services/{inspetorias,delegacias,participantes}.ts`
- `frontend/src/pages/inspetorias/{InspetoriasList,InspetoriaForm}.tsx`
- `frontend/src/pages/delegacias/{DelegaciasList,DelegaciaForm}.tsx`
- `frontend/src/pages/participantes/{ParticipantesList,ParticipanteForm}.tsx`

**Frontend — Modify:**
- `frontend/src/types/fundacao.ts`: remove `Delegacao` (e o `import type { Municipio }`).
- `frontend/src/App.tsx`: rotas (remove `/delegacoes/*`, adiciona 9 novas, troca redirect raiz).
- `frontend/src/components/Layout.tsx`: sidebar (Cadastros) com a nova ordem.

**Frontend — Delete:**
- `frontend/src/pages/delegacoes/` (2 arquivos)
- `frontend/src/services/delegacoes.ts`

**Release:**
- `package.json` (root): version `1.1.0` → `1.2.0`.
- `CHANGELOG.md` (root): adiciona bloco `[1.2.0]` no topo.

---

## Task 1: Migração atômica — schema, cleanup de Delegacoes, ajuste do Municipios

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\prisma\schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_rename_delegacao_to_participante_with_refs/migration.sql` (auto)
- Delete: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\delegacoes\` (todos os 4 arquivos)
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\municipios\municipios.service.ts`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\municipios\municipios.service.test.ts`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\index.ts`

Esta task é **atômica** porque a regeneração do Prisma Client após o `migrate dev` quebra simultaneamente `delegacoes/*` (que usa `prisma.delegacao`) e `municipios.service.ts` (também usa `prisma.delegacao.count`). Os 6 itens acima precisam estar consistentes no mesmo commit.

- [ ] **Step 1: Editar `schema.prisma`**

Localizar o bloco atual do `Delegacao` (logo após o `Municipio`):
```prisma
model Delegacao {
  id            Int       @id @default(autoincrement())
  nome          String
  municipio     Municipio @relation(fields: [municipio_id], references: [id])
  municipio_id  Int
  logo_path     String?
  criado_em     DateTime  @default(now())
  atualizado_em DateTime  @updatedAt
}
```

Substituí-lo pelos 3 novos modelos abaixo. **Também atualizar** a back-reference no `Municipio` (linha `delegacoes Delegacao[]` vira `participantes Participante[]`).

```prisma
model Municipio {
  id            Int            @id @default(autoincrement())
  codigo_ibge   String         @unique @db.Char(7)
  nome          String
  uf            String         @db.Char(2)
  participantes Participante[]
  criado_em     DateTime       @default(now())
  atualizado_em DateTime       @updatedAt

  @@index([uf, nome])
  @@index([nome])
}

model Inspetoria {
  id            Int            @id @default(autoincrement())
  nome          String         @unique
  participantes Participante[]
  criado_em     DateTime       @default(now())
  atualizado_em DateTime       @updatedAt
}

model Delegacia {
  id            Int            @id @default(autoincrement())
  nome          String         @unique
  participantes Participante[]
  criado_em     DateTime       @default(now())
  atualizado_em DateTime       @updatedAt
}

model Participante {
  id            Int          @id @default(autoincrement())
  nome          String
  subtitulo     String?
  inspetoria    Inspetoria?  @relation(fields: [inspetoria_id], references: [id])
  inspetoria_id Int?
  delegacia     Delegacia?   @relation(fields: [delegacia_id], references: [id])
  delegacia_id  Int?
  municipio     Municipio    @relation(fields: [municipio_id], references: [id])
  municipio_id  Int
  criado_em     DateTime     @default(now())
  atualizado_em DateTime     @updatedAt
}
```

- [ ] **Step 2: Apagar o módulo `delegacoes` por completo**

Apagar os 4 arquivos:
- `backend/src/modules/delegacoes/delegacoes.controller.ts`
- `backend/src/modules/delegacoes/delegacoes.routes.ts`
- `backend/src/modules/delegacoes/delegacoes.service.ts`
- `backend/src/modules/delegacoes/delegacoes.service.test.ts`

Depois remover o diretório vazio `backend/src/modules/delegacoes/`.

- [ ] **Step 3: Atualizar `municipios.service.ts`**

Localizar a função `remover` (atualmente nas linhas 54-63) e substituir o bloco inteiro por:

```ts
export async function remover(id: number) {
  const vinculados = await prisma.participante.count({ where: { municipio_id: id } })
  if (vinculados > 0) {
    throw Object.assign(
      new Error('Remova os participantes vinculados antes de excluir este município.'),
      { status: 409 }
    )
  }
  return prisma.municipio.delete({ where: { id } })
}
```

- [ ] **Step 4: Atualizar `municipios.service.test.ts`**

Localizar o `vi.mock('../../lib/prisma', ...)` no topo e substituir o mock de `delegacao` por `participante` (mesmo shape):

Old:
```ts
    delegacao: {
      count: vi.fn(),
    },
```
New:
```ts
    participante: {
      count: vi.fn(),
    },
```

E nos dois testes que usam `mockPrisma.delegacao.count`, trocar para `mockPrisma.participante.count`:

Old (test "remover falha com 409 quando há delegação vinculada"):
```ts
  it('remover falha com 409 quando há delegação vinculada', async () => {
    mockPrisma.delegacao.count.mockResolvedValue(2)
    ...
```
New:
```ts
  it('remover falha com 409 quando há participante vinculado', async () => {
    mockPrisma.participante.count.mockResolvedValue(2)
    ...
```

Old (test "remover deleta quando não há delegação vinculada"):
```ts
  it('remover deleta quando não há delegação vinculada', async () => {
    mockPrisma.delegacao.count.mockResolvedValue(0)
    ...
```
New:
```ts
  it('remover deleta quando não há participante vinculado', async () => {
    mockPrisma.participante.count.mockResolvedValue(0)
    ...
```

- [ ] **Step 5: Atualizar `backend/src/index.ts`**

Remover a linha de import:
```ts
import delegacoesRoutes from './modules/delegacoes/delegacoes.routes'
```

E a linha de uso:
```ts
app.use('/delegacoes', delegacoesRoutes)
```

Não adicionar nada novo aqui — os 3 novos `app.use` virão na Task 5 (depois dos módulos novos existirem).

- [ ] **Step 6: Gerar migration**

Do `backend/`:
```bash
npx prisma migrate dev --name rename_delegacao_to_participante_with_refs
```

Esperado:
- Prisma detecta: drop column/table `Delegacao`, create tables `Inspetoria`, `Delegacia`, `Participante`.
- Avisa sobre data loss (dados em `Delegacao` serão perdidos). Responder **yes**.
- Migration aplicada; `@prisma/client` regenerado.

Se o Prisma reclamar de dependências da `Delegacao` ainda em código antes do drop: confirme que Step 2 foi executado (módulo removido) e Steps 3-5 também (referências em `municipios.service` e `index.ts`).

- [ ] **Step 7: Verificar migration.sql**

Abrir `backend/prisma/migrations/<timestamp>_rename_delegacao_to_participante_with_refs/migration.sql` e confirmar:
- `DROP TABLE "Delegacao"` (e seus índices/constraints associados)
- `CREATE TABLE "Inspetoria"` com `nome TEXT NOT NULL` e unique index em `nome`
- `CREATE TABLE "Delegacia"` com `nome TEXT NOT NULL` e unique index em `nome`
- `CREATE TABLE "Participante"` com `nome`, `subtitulo TEXT`, FKs `inspetoria_id`/`delegacia_id` opcionais e `municipio_id` obrigatória
- 3 constraints `..._fkey` referenciando as 3 tabelas

- [ ] **Step 8: tsc + testes existentes**

Do `backend/`:
```bash
npx tsc --noEmit
npx vitest run
```

Esperado: tsc clean (sem referências a Delegacao em qualquer arquivo); todos os 35 testes pré-existentes passam (modalidades, categorias, municipios atualizado).

Se houver erro em algum arquivo apontando para `prisma.delegacao` ou tipo `Delegacao` que não pega, rodar `grep -r "delegacao\|Delegacao" backend/src` e fixar antes de continuar.

- [ ] **Step 9: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/modules/municipios backend/src/index.ts
git rm -r backend/src/modules/delegacoes
git commit -m "refactor(db): drop Delegacao, add Inspetoria/Delegacia/Participante; update municipios.service"
```

---

## Task 2: Módulo `inspetorias` — service + tests + controller + routes

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\inspetorias\inspetorias.service.ts`
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\inspetorias\inspetorias.service.test.ts`
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\inspetorias\inspetorias.controller.ts`
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\inspetorias\inspetorias.routes.ts`

TDD: testes → falham → implementação → passam.

- [ ] **Step 1: Criar o teste com este conteúdo exato**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    inspetoria: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    participante: {
      count: vi.fn(),
    },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './inspetorias.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('inspetorias.service', () => {
  it('listar retorna lista ordenada por nome', async () => {
    mockPrisma.inspetoria.findMany.mockResolvedValue([{ id: 1, nome: 'Alfa' }])
    const result = await service.listar()
    expect(result).toEqual([{ id: 1, nome: 'Alfa' }])
    expect(mockPrisma.inspetoria.findMany).toHaveBeenCalledWith({ orderBy: { nome: 'asc' } })
  })

  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.inspetoria.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('criar chama prisma.create com nome', async () => {
    mockPrisma.inspetoria.create.mockResolvedValue({ id: 1, nome: 'Alfa' })
    await service.criar({ nome: 'Alfa' })
    expect(mockPrisma.inspetoria.create).toHaveBeenCalledWith({ data: { nome: 'Alfa' } })
  })

  it('editar chama prisma.update', async () => {
    mockPrisma.inspetoria.update.mockResolvedValue({ id: 1, nome: 'Beta' })
    await service.editar(1, { nome: 'Beta' })
    expect(mockPrisma.inspetoria.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { nome: 'Beta' } })
  })

  it('remover lança 409 quando há participante vinculado', async () => {
    mockPrisma.participante.count.mockResolvedValue(3)
    await expect(service.remover(1)).rejects.toMatchObject({ status: 409 })
    expect(mockPrisma.inspetoria.delete).not.toHaveBeenCalled()
  })

  it('remover deleta quando não há vínculo', async () => {
    mockPrisma.participante.count.mockResolvedValue(0)
    mockPrisma.inspetoria.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.inspetoria.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
```

- [ ] **Step 2: Rodar o teste — deve falhar com module-not-found**

```bash
cd backend && npx vitest run src/modules/inspetorias/inspetorias.service.test.ts
```
Esperado: FAIL — `Cannot find module './inspetorias.service'`.

- [ ] **Step 3: Implementar o service**

```ts
import prisma from '../../lib/prisma'

export async function listar() {
  return prisma.inspetoria.findMany({ orderBy: { nome: 'asc' } })
}

export async function buscarPorId(id: number) {
  const item = await prisma.inspetoria.findUnique({ where: { id } })
  if (!item) throw Object.assign(new Error('Inspetoria não encontrada'), { status: 404 })
  return item
}

export async function criar(data: { nome: string }) {
  return prisma.inspetoria.create({ data })
}

export async function editar(id: number, data: { nome?: string }) {
  return prisma.inspetoria.update({ where: { id }, data })
}

export async function remover(id: number) {
  const vinculados = await prisma.participante.count({ where: { inspetoria_id: id } })
  if (vinculados > 0) {
    throw Object.assign(
      new Error('Remova os participantes vinculados antes de excluir esta inspetoria.'),
      { status: 409 }
    )
  }
  return prisma.inspetoria.delete({ where: { id } })
}
```

- [ ] **Step 4: Rodar o teste — todos passam**

```bash
cd backend && npx vitest run src/modules/inspetorias/inspetorias.service.test.ts
```
Esperado: 6 testes verdes.

- [ ] **Step 5: Criar `inspetorias.controller.ts`**

```ts
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './inspetorias.service'

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

- [ ] **Step 6: Criar `inspetorias.routes.ts`**

```ts
import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as ctrl from './inspetorias.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]

router.get('/', requireAuth, ctrl.listar)
router.get('/:id', requireAuth, ctrl.buscarPorId)
router.post('/', ...admin, ctrl.criar)
router.put('/:id', ...admin, ctrl.editar)
router.delete('/:id', ...admin, ctrl.remover)

export default router
```

GET requer apenas autenticação (não ADMIN) — selectors do Participante usam.

- [ ] **Step 7: tsc**

```bash
cd backend && npx tsc --noEmit
```
Esperado: clean (o `index.ts` ainda não importa essas rotas — vai aparecer só na Task 5; não é erro).

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/inspetorias
git commit -m "feat(inspetorias): add CRUD service, controller and routes"
```

---

## Task 3: Módulo `delegacias` — service + tests + controller + routes

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\delegacias\delegacias.service.ts`
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\delegacias\delegacias.service.test.ts`
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\delegacias\delegacias.controller.ts`
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\delegacias\delegacias.routes.ts`

Mesmo padrão da Task 2 (cópia adaptada), TDD.

- [ ] **Step 1: Criar o teste com este conteúdo exato**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    delegacia: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    participante: {
      count: vi.fn(),
    },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './delegacias.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('delegacias.service', () => {
  it('listar retorna lista ordenada por nome', async () => {
    mockPrisma.delegacia.findMany.mockResolvedValue([{ id: 1, nome: '1ª DP' }])
    const result = await service.listar()
    expect(result).toEqual([{ id: 1, nome: '1ª DP' }])
    expect(mockPrisma.delegacia.findMany).toHaveBeenCalledWith({ orderBy: { nome: 'asc' } })
  })

  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.delegacia.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('criar chama prisma.create com nome', async () => {
    mockPrisma.delegacia.create.mockResolvedValue({ id: 1, nome: '1ª DP' })
    await service.criar({ nome: '1ª DP' })
    expect(mockPrisma.delegacia.create).toHaveBeenCalledWith({ data: { nome: '1ª DP' } })
  })

  it('editar chama prisma.update', async () => {
    mockPrisma.delegacia.update.mockResolvedValue({ id: 1, nome: '2ª DP' })
    await service.editar(1, { nome: '2ª DP' })
    expect(mockPrisma.delegacia.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { nome: '2ª DP' } })
  })

  it('remover lança 409 quando há participante vinculado', async () => {
    mockPrisma.participante.count.mockResolvedValue(2)
    await expect(service.remover(1)).rejects.toMatchObject({ status: 409 })
    expect(mockPrisma.delegacia.delete).not.toHaveBeenCalled()
  })

  it('remover deleta quando não há vínculo', async () => {
    mockPrisma.participante.count.mockResolvedValue(0)
    mockPrisma.delegacia.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.delegacia.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
```

- [ ] **Step 2: Rodar o teste — deve falhar**

```bash
cd backend && npx vitest run src/modules/delegacias/delegacias.service.test.ts
```
Esperado: FAIL — `Cannot find module './delegacias.service'`.

- [ ] **Step 3: Implementar o service**

```ts
import prisma from '../../lib/prisma'

export async function listar() {
  return prisma.delegacia.findMany({ orderBy: { nome: 'asc' } })
}

export async function buscarPorId(id: number) {
  const item = await prisma.delegacia.findUnique({ where: { id } })
  if (!item) throw Object.assign(new Error('Delegacia não encontrada'), { status: 404 })
  return item
}

export async function criar(data: { nome: string }) {
  return prisma.delegacia.create({ data })
}

export async function editar(id: number, data: { nome?: string }) {
  return prisma.delegacia.update({ where: { id }, data })
}

export async function remover(id: number) {
  const vinculados = await prisma.participante.count({ where: { delegacia_id: id } })
  if (vinculados > 0) {
    throw Object.assign(
      new Error('Remova os participantes vinculados antes de excluir esta delegacia.'),
      { status: 409 }
    )
  }
  return prisma.delegacia.delete({ where: { id } })
}
```

- [ ] **Step 4: Rodar o teste — todos passam**

```bash
cd backend && npx vitest run src/modules/delegacias/delegacias.service.test.ts
```
Esperado: 6 testes verdes.

- [ ] **Step 5: Criar `delegacias.controller.ts`**

```ts
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './delegacias.service'

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

- [ ] **Step 6: Criar `delegacias.routes.ts`**

```ts
import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as ctrl from './delegacias.controller'

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

```bash
cd backend && npx tsc --noEmit
```
Esperado: clean.

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/delegacias
git commit -m "feat(delegacias): add CRUD service, controller and routes"
```

---

## Task 4: Módulo `participantes` — service + tests + controller + routes

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\participantes\participantes.service.ts`
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\participantes\participantes.service.test.ts`
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\participantes\participantes.controller.ts`
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\participantes\participantes.routes.ts`

TDD.

- [ ] **Step 1: Criar o teste com este conteúdo exato**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    participante: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './participantes.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

const INCLUDE = { inspetoria: true, delegacia: true, municipio: true }

describe('participantes.service', () => {
  it('listar inclui inspetoria, delegacia e município', async () => {
    mockPrisma.participante.findMany.mockResolvedValue([])
    await service.listar()
    expect(mockPrisma.participante.findMany).toHaveBeenCalledWith({
      orderBy: { nome: 'asc' },
      include: INCLUDE,
    })
  })

  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.participante.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('criar chama prisma.create com todos os campos e include', async () => {
    const data = {
      nome: 'João',
      subtitulo: 'Vice-Presidente',
      inspetoria_id: 5,
      delegacia_id: 7,
      municipio_id: 42,
    }
    mockPrisma.participante.create.mockResolvedValue({ id: 1, ...data })
    await service.criar(data)
    expect(mockPrisma.participante.create).toHaveBeenCalledWith({ data, include: INCLUDE })
  })

  it('criar aceita opcionais ausentes', async () => {
    const data = { nome: 'Ana', municipio_id: 42 }
    mockPrisma.participante.create.mockResolvedValue({ id: 1, ...data })
    await service.criar(data)
    expect(mockPrisma.participante.create).toHaveBeenCalledWith({ data, include: INCLUDE })
  })

  it('editar chama prisma.update com include', async () => {
    mockPrisma.participante.update.mockResolvedValue({ id: 1 })
    await service.editar(1, { nome: 'Maria' })
    expect(mockPrisma.participante.update).toHaveBeenCalledWith({
      where: { id: 1 }, data: { nome: 'Maria' }, include: INCLUDE,
    })
  })

  it('remover deleta direto', async () => {
    mockPrisma.participante.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.participante.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
```

- [ ] **Step 2: Rodar o teste — deve falhar**

```bash
cd backend && npx vitest run src/modules/participantes/participantes.service.test.ts
```
Esperado: FAIL — `Cannot find module './participantes.service'`.

- [ ] **Step 3: Implementar o service**

```ts
import prisma from '../../lib/prisma'

const INCLUDE = { inspetoria: true, delegacia: true, municipio: true } as const

export async function listar() {
  return prisma.participante.findMany({
    orderBy: { nome: 'asc' },
    include: INCLUDE,
  })
}

export async function buscarPorId(id: number) {
  const item = await prisma.participante.findUnique({
    where: { id },
    include: INCLUDE,
  })
  if (!item) throw Object.assign(new Error('Participante não encontrado'), { status: 404 })
  return item
}

export async function criar(data: {
  nome: string
  subtitulo?: string
  inspetoria_id?: number
  delegacia_id?: number
  municipio_id: number
}) {
  return prisma.participante.create({ data, include: INCLUDE })
}

export async function editar(
  id: number,
  data: Partial<{
    nome: string
    subtitulo: string | null
    inspetoria_id: number | null
    delegacia_id: number | null
    municipio_id: number
  }>
) {
  return prisma.participante.update({ where: { id }, data, include: INCLUDE })
}

export async function remover(id: number) {
  return prisma.participante.delete({ where: { id } })
}
```

- [ ] **Step 4: Rodar o teste — todos passam**

```bash
cd backend && npx vitest run src/modules/participantes/participantes.service.test.ts
```
Esperado: 6 testes verdes.

- [ ] **Step 5: Criar `participantes.controller.ts`**

```ts
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './participantes.service'

const createSchema = z.object({
  nome: z.string().min(1),
  subtitulo: z.string().optional(),
  inspetoria_id: z.coerce.number().int().positive().optional(),
  delegacia_id: z.coerce.number().int().positive().optional(),
  municipio_id: z.coerce.number().int().positive(),
})

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

- [ ] **Step 6: Criar `participantes.routes.ts`**

```ts
import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as ctrl from './participantes.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]

router.get('/', requireAuth, ctrl.listar)
router.get('/:id', requireAuth, ctrl.buscarPorId)
router.post('/', ...admin, ctrl.criar)
router.put('/:id', ...admin, ctrl.editar)
router.delete('/:id', ...admin, ctrl.remover)

export default router
```

- [ ] **Step 7: tsc + suite completa**

```bash
cd backend && npx tsc --noEmit && npx vitest run
```
Esperado: tsc clean, todos os testes verdes (35 antigos + 6 inspetorias + 6 delegacias + 6 participantes = 53 testes em 8 arquivos).

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/participantes
git commit -m "feat(participantes): add CRUD service with FKs to inspetoria/delegacia/municipio"
```

---

## Task 5: Registrar rotas em `index.ts`

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\index.ts`

- [ ] **Step 1: Editar `index.ts`**

Localizar o bloco de imports dos módulos. Atualmente termina assim (após Task 1 já ter removido o de delegacoes):
```ts
import categoriasRoutes from './modules/categorias/categorias.routes'
import municipiosRoutes from './modules/municipios/municipios.routes'
```

Adicionar logo abaixo:
```ts
import inspetoriasRoutes from './modules/inspetorias/inspetorias.routes'
import delegaciasRoutes from './modules/delegacias/delegacias.routes'
import participantesRoutes from './modules/participantes/participantes.routes'
```

Localizar o bloco de `app.use` que termina com:
```ts
app.use('/categorias', categoriasRoutes)
app.use('/municipios', municipiosRoutes)
```

Adicionar logo abaixo:
```ts
app.use('/inspetorias', inspetoriasRoutes)
app.use('/delegacias', delegaciasRoutes)
app.use('/participantes', participantesRoutes)
```

- [ ] **Step 2: tsc**

```bash
cd backend && npx tsc --noEmit
```
Esperado: clean.

- [ ] **Step 3: Smoke test local (opcional)**

Se o backend dev estiver acessível em `localhost:3000`, sem token:
```bash
curl -s -o /dev/null -w "inspetorias: %{http_code}\ndelegacias: %{http_code}\nparticipantes: %{http_code}\n" \
  http://localhost:3000/inspetorias \
  -w "" && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/delegacias \
  && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/participantes
```
Esperado: 401 em todas (rotas registradas, exigem token). Se rota desconhecida → 404, algo no Step 1 não foi feito.

Se o backend não estiver rodando, pular este Step e validar no deploy.

- [ ] **Step 4: Commit**

```bash
git add backend/src/index.ts
git commit -m "feat(backend): wire inspetorias, delegacias and participantes routes"
```

---

## Task 6: Frontend — types/participante.ts + limpeza de types/fundacao.ts

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\types\participante.ts`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\types\fundacao.ts`

- [ ] **Step 1: Criar `types/participante.ts`**

```ts
import type { Municipio } from './municipio'

export type Inspetoria = {
  id: number
  nome: string
  criado_em: string
  atualizado_em: string
}

export type Delegacia = {
  id: number
  nome: string
  criado_em: string
  atualizado_em: string
}

export type Participante = {
  id: number
  nome: string
  subtitulo: string | null
  inspetoria_id: number | null
  inspetoria: Inspetoria | null
  delegacia_id: number | null
  delegacia: Delegacia | null
  municipio_id: number
  municipio: Municipio
  criado_em: string
  atualizado_em: string
}
```

- [ ] **Step 2: Atualizar `types/fundacao.ts`**

O conteúdo atual do arquivo é:
```ts
import type { Municipio } from './municipio'

export type Delegacao = {
  id: number
  nome: string
  municipio_id: number
  municipio: Municipio
  logo_path: string | null
  criado_em: string
  atualizado_em: string
}

export type Modalidade = { ... }
export type Genero = ...
export type Categoria = { ... }
```

Remover o `import type { Municipio } from './municipio'` (se não for usado por mais ninguém no arquivo — verificar) e o bloco `export type Delegacao = { ... }` inteiro. Preservar `Modalidade`, `Genero` e `Categoria`.

Conteúdo final esperado (sem `Delegacao`, sem o `import Municipio`):
```ts
export type Modalidade = {
  id: number
  nome: string
  descricao: string | null
  _count?: { categorias: number }
  criado_em: string
  atualizado_em: string
}

export type Genero = 'MASCULINO' | 'FEMININO' | 'MISTO' | 'LIVRE'

export type Categoria = {
  id: number
  modalidade_id: number
  modalidade: { id: number; nome: string }
  nome: string
  genero: Genero
  idade_min: number | null
  idade_max: number | null
  criado_em: string
  atualizado_em: string
}
```

- [ ] **Step 3: tsc**

```bash
cd frontend && npx tsc --noEmit
```
Esperado: errors em `pages/delegacoes/*` (que serão removidos na Task 11) e em `services/delegacoes.ts` (removido na Task 7) ainda referenciando `Delegacao`. Se aparecerem outros, fixar.

Como o tsconfig do frontend não é strict, esses erros podem não aparecer mesmo. Não é problema — vão sumir na Task 7/11 quando os arquivos forem deletados.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/participante.ts frontend/src/types/fundacao.ts
git commit -m "feat(frontend): add Participante types; remove Delegacao type"
```

---

## Task 7: Frontend — 3 services novos + remover services/delegacoes.ts

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\services\inspetorias.ts`
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\services\delegacias.ts`
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\services\participantes.ts`
- Delete: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\services\delegacoes.ts`

- [ ] **Step 1: Criar `services/inspetorias.ts`**

```ts
import api from './api'
import type { Inspetoria } from '../types/participante'

const BASE = '/inspetorias'

export const inspetoriasService = {
  listar: () => api.get<Inspetoria[]>(BASE).then(r => r.data),
  buscar: (id: number) => api.get<Inspetoria>(`${BASE}/${id}`).then(r => r.data),
  criar: (data: { nome: string }) => api.post<Inspetoria>(BASE, data).then(r => r.data),
  editar: (id: number, data: { nome?: string }) => api.put<Inspetoria>(`${BASE}/${id}`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
```

- [ ] **Step 2: Criar `services/delegacias.ts`**

```ts
import api from './api'
import type { Delegacia } from '../types/participante'

const BASE = '/delegacias'

export const delegaciasService = {
  listar: () => api.get<Delegacia[]>(BASE).then(r => r.data),
  buscar: (id: number) => api.get<Delegacia>(`${BASE}/${id}`).then(r => r.data),
  criar: (data: { nome: string }) => api.post<Delegacia>(BASE, data).then(r => r.data),
  editar: (id: number, data: { nome?: string }) => api.put<Delegacia>(`${BASE}/${id}`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
```

- [ ] **Step 3: Criar `services/participantes.ts`**

```ts
import api from './api'
import type { Participante } from '../types/participante'

const BASE = '/participantes'

type ParticipantePayload = {
  nome: string
  subtitulo?: string
  inspetoria_id?: number | null
  delegacia_id?: number | null
  municipio_id: number
}

export const participantesService = {
  listar: () => api.get<Participante[]>(BASE).then(r => r.data),
  buscar: (id: number) => api.get<Participante>(`${BASE}/${id}`).then(r => r.data),
  criar: (data: ParticipantePayload) => api.post<Participante>(BASE, data).then(r => r.data),
  editar: (id: number, data: Partial<ParticipantePayload>) => api.put<Participante>(`${BASE}/${id}`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
```

- [ ] **Step 4: Apagar `services/delegacoes.ts`**

```bash
rm frontend/src/services/delegacoes.ts
```

(O arquivo ainda é referenciado pelas páginas em `pages/delegacoes/*` que serão removidas na Task 11.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services
git commit -m "feat(frontend): add inspetorias/delegacias/participantes services; remove delegacoes service"
```

---

## Task 8: Frontend — páginas de Inspetorias (List + Form)

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\inspetorias\InspetoriasList.tsx`
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\inspetorias\InspetoriaForm.tsx`

Mesmo shape visual de `ModalidadesList`/`ModalidadeForm`, mas com um campo só (`nome`).

- [ ] **Step 1: Criar `InspetoriasList.tsx`**

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import { inspetoriasService } from '../../services/inspetorias'
import type { Inspetoria } from '../../types/participante'

export default function InspetoriasList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['inspetorias'],
    queryFn: inspetoriasService.listar,
  })

  const { mutate: remover } = useMutation({
    mutationFn: inspetoriasService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inspetorias'] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const columns = [
    { header: 'Nome', accessor: (row: Inspetoria) => row.nome },
    {
      header: 'Ações',
      accessor: (row: Inspetoria) => (
        <div className="flex gap-2">
          <button onClick={() => navigate(`/inspetorias/${row.id}/editar`)} className="text-indigo-400 hover:text-indigo-300 text-xs">Editar</button>
          <button onClick={() => { if (confirm(`Remover "${row.nome}"?`)) remover(row.id) }} className="text-red-400 hover:text-red-300 text-xs">Remover</button>
        </div>
      ),
      className: 'w-28',
    },
  ]

  return (
    <div className="text-white">
      <PageHeader title="Inspetorias" actionLabel="+ Nova Inspetoria" actionTo="/inspetorias/novo" />
      <div className="p-6">
        {isLoading ? <p className="text-gray-400 text-sm">Carregando...</p>
          : <DataTable columns={columns} data={data} keyExtractor={r => r.id} emptyMessage="Nenhuma inspetoria cadastrada." />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar `InspetoriaForm.tsx`**

```tsx
import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { inspetoriasService } from '../../services/inspetorias'

export default function InspetoriaForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['inspetorias', Number(id)],
    queryFn: () => inspetoriasService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => { if (existing) setNome(existing.nome) }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => isEdit
      ? inspetoriasService.editar(Number(id), { nome })
      : inspetoriasService.criar({ nome }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inspetorias'] }); navigate('/inspetorias') },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  return (
    <div className="text-white">
      <PageHeader title={isEdit ? 'Editar Inspetoria' : 'Nova Inspetoria'} backTo="/inspetorias" />
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

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/inspetorias
git commit -m "feat(frontend): add Inspetorias list and form pages"
```

---

## Task 9: Frontend — páginas de Delegacias (List + Form)

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\delegacias\DelegaciasList.tsx`
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\delegacias\DelegaciaForm.tsx`

Idêntico ao padrão de Inspetorias.

- [ ] **Step 1: Criar `DelegaciasList.tsx`**

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import { delegaciasService } from '../../services/delegacias'
import type { Delegacia } from '../../types/participante'

export default function DelegaciasList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['delegacias'],
    queryFn: delegaciasService.listar,
  })

  const { mutate: remover } = useMutation({
    mutationFn: delegaciasService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['delegacias'] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const columns = [
    { header: 'Nome', accessor: (row: Delegacia) => row.nome },
    {
      header: 'Ações',
      accessor: (row: Delegacia) => (
        <div className="flex gap-2">
          <button onClick={() => navigate(`/delegacias/${row.id}/editar`)} className="text-indigo-400 hover:text-indigo-300 text-xs">Editar</button>
          <button onClick={() => { if (confirm(`Remover "${row.nome}"?`)) remover(row.id) }} className="text-red-400 hover:text-red-300 text-xs">Remover</button>
        </div>
      ),
      className: 'w-28',
    },
  ]

  return (
    <div className="text-white">
      <PageHeader title="Delegacias" actionLabel="+ Nova Delegacia" actionTo="/delegacias/nova" />
      <div className="p-6">
        {isLoading ? <p className="text-gray-400 text-sm">Carregando...</p>
          : <DataTable columns={columns} data={data} keyExtractor={r => r.id} emptyMessage="Nenhuma delegacia cadastrada." />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar `DelegaciaForm.tsx`**

```tsx
import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { delegaciasService } from '../../services/delegacias'

export default function DelegaciaForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['delegacias', Number(id)],
    queryFn: () => delegaciasService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => { if (existing) setNome(existing.nome) }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => isEdit
      ? delegaciasService.editar(Number(id), { nome })
      : delegaciasService.criar({ nome }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['delegacias'] }); navigate('/delegacias') },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  return (
    <div className="text-white">
      <PageHeader title={isEdit ? 'Editar Delegacia' : 'Nova Delegacia'} backTo="/delegacias" />
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

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/delegacias
git commit -m "feat(frontend): add Delegacias list and form pages"
```

---

## Task 10: Frontend — páginas de Participantes (List + Form)

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\participantes\ParticipantesList.tsx`
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\participantes\ParticipanteForm.tsx`

`ParticipanteForm` usa `<MunicipioSelect />` para o município (já existe em `frontend/src/components/MunicipioSelect.tsx`) e `<select>` simples para inspetoria/delegacia.

- [ ] **Step 1: Criar `ParticipantesList.tsx`**

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import { participantesService } from '../../services/participantes'
import type { Participante } from '../../types/participante'

export default function ParticipantesList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['participantes'],
    queryFn: participantesService.listar,
  })

  const { mutate: remover } = useMutation({
    mutationFn: participantesService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['participantes'] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const columns = [
    { header: 'Nome', accessor: (row: Participante) => row.nome },
    { header: 'Subtítulo', accessor: (row: Participante) => row.subtitulo ?? '—' },
    { header: 'Inspetoria', accessor: (row: Participante) => row.inspetoria?.nome ?? '—' },
    { header: 'Delegacia', accessor: (row: Participante) => row.delegacia?.nome ?? '—' },
    { header: 'Município', accessor: (row: Participante) => `${row.municipio.nome} — ${row.municipio.uf}` },
    {
      header: 'Ações',
      accessor: (row: Participante) => (
        <div className="flex gap-2">
          <button onClick={() => navigate(`/participantes/${row.id}/editar`)} className="text-indigo-400 hover:text-indigo-300 text-xs">Editar</button>
          <button onClick={() => { if (confirm(`Remover "${row.nome}"?`)) remover(row.id) }} className="text-red-400 hover:text-red-300 text-xs">Remover</button>
        </div>
      ),
      className: 'w-28',
    },
  ]

  return (
    <div className="text-white">
      <PageHeader title="Participantes" actionLabel="+ Novo Participante" actionTo="/participantes/novo" />
      <div className="p-6">
        {isLoading ? <p className="text-gray-400 text-sm">Carregando...</p>
          : <DataTable columns={columns} data={data} keyExtractor={r => r.id} emptyMessage="Nenhum participante cadastrado." />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar `ParticipanteForm.tsx`**

```tsx
import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import MunicipioSelect from '../../components/MunicipioSelect'
import { participantesService } from '../../services/participantes'
import { inspetoriasService } from '../../services/inspetorias'
import { delegaciasService } from '../../services/delegacias'

export default function ParticipanteForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [nome, setNome] = useState('')
  const [subtitulo, setSubtitulo] = useState('')
  const [inspetoriaId, setInspetoriaId] = useState<number | ''>('')
  const [delegaciaId, setDelegaciaId] = useState<number | ''>('')
  const [municipioId, setMunicipioId] = useState<number | null>(null)
  const [erro, setErro] = useState('')

  const { data: inspetorias = [] } = useQuery({
    queryKey: ['inspetorias'],
    queryFn: inspetoriasService.listar,
  })

  const { data: delegacias = [] } = useQuery({
    queryKey: ['delegacias'],
    queryFn: delegaciasService.listar,
  })

  const { data: existing } = useQuery({
    queryKey: ['participantes', Number(id)],
    queryFn: () => participantesService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setNome(existing.nome)
      setSubtitulo(existing.subtitulo ?? '')
      setInspetoriaId(existing.inspetoria_id ?? '')
      setDelegaciaId(existing.delegacia_id ?? '')
      setMunicipioId(existing.municipio_id)
    }
  }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      const payload = {
        nome,
        subtitulo: subtitulo || undefined,
        inspetoria_id: inspetoriaId === '' ? null : Number(inspetoriaId),
        delegacia_id: delegaciaId === '' ? null : Number(delegaciaId),
        municipio_id: municipioId!,
      }
      return isEdit
        ? participantesService.editar(Number(id), payload)
        : participantesService.criar(payload as any)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['participantes'] }); navigate('/participantes') },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!municipioId) {
      setErro('Selecione um município.')
      return
    }
    salvar()
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="text-white">
      <PageHeader title={isEdit ? 'Editar Participante' : 'Novo Participante'} backTo="/participantes" />
      <div className="p-6 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} required className={inputClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Subtítulo (opcional)</label>
            <input value={subtitulo} onChange={e => setSubtitulo(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Inspetoria (opcional)</label>
            <select value={inspetoriaId} onChange={e => setInspetoriaId(e.target.value === '' ? '' : Number(e.target.value))} className={inputClass}>
              <option value="">— Sem inspetoria —</option>
              {inspetorias.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Delegacia (opcional)</label>
            <select value={delegaciaId} onChange={e => setDelegaciaId(e.target.value === '' ? '' : Number(e.target.value))} className={inputClass}>
              <option value="">— Sem delegacia —</option>
              {delegacias.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Município</label>
            <MunicipioSelect value={municipioId} onChange={setMunicipioId} />
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

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/participantes
git commit -m "feat(frontend): add Participantes list and form pages"
```

---

## Task 11: Remover páginas de Delegações + atualizar App.tsx + Layout.tsx

**Files:**
- Delete: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\delegacoes\` (2 arquivos)
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\App.tsx`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\components\Layout.tsx`

- [ ] **Step 1: Apagar `pages/delegacoes/`**

```bash
rm frontend/src/pages/delegacoes/DelegacoesList.tsx
rm frontend/src/pages/delegacoes/DelegacaoForm.tsx
rmdir frontend/src/pages/delegacoes
```

- [ ] **Step 2: Atualizar `App.tsx`**

O conteúdo atual de `App.tsx` (após features anteriores):
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import DelegacoesList from './pages/delegacoes/DelegacoesList'
import DelegacaoForm from './pages/delegacoes/DelegacaoForm'
import ModalidadesList from './pages/modalidades/ModalidadesList'
...
import MunicipiosImport from './pages/municipios/MunicipiosImport'
import Novidades from './pages/Novidades'
```

Remover os 2 imports de `delegacoes` e adicionar 6 novos (Inspetorias × 2, Delegacias × 2, Participantes × 2):

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import ModalidadesList from './pages/modalidades/ModalidadesList'
import ModalidadeForm from './pages/modalidades/ModalidadeForm'
import CategoriasList from './pages/categorias/CategoriasList'
import CategoriaForm from './pages/categorias/CategoriaForm'
import MunicipiosList from './pages/municipios/MunicipiosList'
import MunicipioForm from './pages/municipios/MunicipioForm'
import MunicipiosImport from './pages/municipios/MunicipiosImport'
import Novidades from './pages/Novidades'
import InspetoriasList from './pages/inspetorias/InspetoriasList'
import InspetoriaForm from './pages/inspetorias/InspetoriaForm'
import DelegaciasList from './pages/delegacias/DelegaciasList'
import DelegaciaForm from './pages/delegacias/DelegaciaForm'
import ParticipantesList from './pages/participantes/ParticipantesList'
import ParticipanteForm from './pages/participantes/ParticipanteForm'
```

Dentro do `<Route element={<Layout />}>`, substituir o redirect raiz e remover as 3 rotas de delegacoes. Resultado final (preservando rotas existentes de municipios/modalidades/categorias/novidades):

```tsx
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/participantes" replace />} />

            <Route path="/inspetorias"            element={<InspetoriasList />} />
            <Route path="/inspetorias/novo"       element={<InspetoriaForm />} />
            <Route path="/inspetorias/:id/editar" element={<InspetoriaForm />} />

            <Route path="/delegacias"             element={<DelegaciasList />} />
            <Route path="/delegacias/nova"        element={<DelegaciaForm />} />
            <Route path="/delegacias/:id/editar"  element={<DelegaciaForm />} />

            <Route path="/participantes"            element={<ParticipantesList />} />
            <Route path="/participantes/novo"       element={<ParticipanteForm />} />
            <Route path="/participantes/:id/editar" element={<ParticipanteForm />} />

            <Route path="/modalidades" element={<ModalidadesList />} />
            <Route path="/modalidades/nova" element={<ModalidadeForm />} />
            <Route path="/modalidades/:id/editar" element={<ModalidadeForm />} />

            <Route path="/categorias" element={<CategoriasList />} />
            <Route path="/categorias/nova" element={<CategoriaForm />} />
            <Route path="/categorias/:id/editar" element={<CategoriaForm />} />

            <Route path="/municipios" element={<MunicipiosList />} />
            <Route path="/municipios/novo" element={<MunicipioForm />} />
            <Route path="/municipios/:id/editar" element={<MunicipioForm />} />
            <Route path="/municipios/importar" element={<MunicipiosImport />} />

            <Route path="/novidades" element={<Novidades />} />
          </Route>
```

(Indentação de 12 espaços para casar com os outros `<Route>` no arquivo.)

- [ ] **Step 3: Atualizar `Layout.tsx` (sidebar)**

Localizar o array `navGroups` no topo. O grupo `Cadastros` está com 4 itens hoje:
```tsx
  {
    title: 'Cadastros',
    items: [
      { label: 'Municípios', to: '/municipios' },
      { label: 'Delegações', to: '/delegacoes' },
      { label: 'Modalidades', to: '/modalidades' },
      { label: 'Categorias', to: '/categorias' },
    ],
  },
```

Substituir por:
```tsx
  {
    title: 'Cadastros',
    items: [
      { label: 'Municípios',    to: '/municipios' },
      { label: 'Inspetorias',   to: '/inspetorias' },
      { label: 'Delegacias',    to: '/delegacias' },
      { label: 'Participantes', to: '/participantes' },
      { label: 'Modalidades',   to: '/modalidades' },
      { label: 'Categorias',    to: '/categorias' },
    ],
  },
```

Demais grupos (Competições etc.) intocados.

- [ ] **Step 4: Sanity grep — sem resquícios de Delegacao/delegacoes**

Do root do repo:
```bash
grep -rni "delegacao\|delegacoes" frontend/src backend/src 2>/dev/null
```
Esperado: sem resultados (o arquivo `delegacias.*` ainda matcha "delegaci" mas não "delegaco/delegação"). Se aparecer, fixar antes do commit.

- [ ] **Step 5: tsc + build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```
Esperado: tsc clean, vite build OK.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Layout.tsx
git rm -r frontend/src/pages/delegacoes
git commit -m "feat(frontend): remove Delegacoes pages; wire participantes/inspetorias/delegacias routes and sidebar"
```

---

## Task 12: Bump versão + entrada no CHANGELOG.md

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\package.json`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\CHANGELOG.md`

- [ ] **Step 1: Bump version**

Editar `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\package.json`. Atualmente:
```json
{
  "name": "prosports",
  "version": "1.1.0",
  ...
}
```
Mudar **somente** `"version"` de `"1.1.0"` para `"1.2.0"`. Preservar nome, scripts, etc.

- [ ] **Step 2: Adicionar bloco no `CHANGELOG.md`**

Inserir o novo bloco logo após o cabeçalho do arquivo e antes do bloco `## [1.1.0]`. O resultado fica:

```md
# Changelog

Todos os releases notáveis deste projeto.

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento: [SemVer](https://semver.org/lang/pt-BR/).

## [1.2.0] - 2026-05-28

### Added
- Entidade Inspetoria com CRUD admin.
- Entidade Delegacia com CRUD admin.
- Entidade Participante (substitui Delegação) com FKs para Inspetoria, Delegacia e Município.
- Campo Subtítulo opcional em Participante.

### Changed
- Renomeada "Delegações" para "Participantes" no sidebar e nas rotas.
- Município agora bloqueia exclusão se houver Participante vinculado (antes era Delegação).

### Removed
- Entidade Delegação (substituída por Participante).
- Campo logo do registro (não era usado pelos novos requisitos).

## [1.1.0] - 2026-05-28

### Added
- Cadastro de Municípios com importação de CSV (IBGE).
...
```

(Bloco `[1.1.0]` e `[1.0.0]` permanecem como estão.)

- [ ] **Step 3: Commit**

```bash
git add package.json CHANGELOG.md
git commit -m "chore(release): v1.2.0 — Participantes + Inspetoria + Delegacia"
```

---

## Task 13: End-to-end smoke test (manual, pós-deploy)

**Files:** (sem edição — verificação manual)

- [ ] **Step 1: Push e aguardar CI**

```bash
git push origin develop
```
CI roda `prisma migrate deploy` (aplica a migration destrutiva) e reconstrói os 2 containers. Acompanhar:
```bash
ssh -o BatchMode=yes wagner@192.168.56.113 'docker compose -f /home/wagner/actions-runner/_work/prosports/prosports/docker-compose.yml logs -f --tail=20 backend frontend' 
```
(Ctrl-C quando ver "Server running on port 3000".)

- [ ] **Step 2: Verificar rotas no backend**

```bash
curl -s -o /dev/null -w "/inspetorias: %{http_code}\n/delegacias: %{http_code}\n/participantes: %{http_code}\n" \
  http://192.168.56.113:3000/inspetorias \
  && curl -s -o /dev/null -w "" http://192.168.56.113:3000/delegacias \
  && curl -s -o /dev/null -w "" http://192.168.56.113:3000/participantes
```
Esperado: todas devolvem 401 (sem token).

- [ ] **Step 3: Frontend — sidebar + login**

Abrir http://192.168.56.113:8080 em modo anônimo. Login `admin@prosports.com` / `admin123`. Sidebar:
- "Cadastros" deve listar nessa ordem: Municípios · Inspetorias · Delegacias · Participantes · Modalidades · Categorias.
- Rodapé do sidebar mostra `v1.2.0 (<sha>)` com **badge indigo** (porque o localStorage ainda tem `1.1.0` da sessão anterior).

- [ ] **Step 4: CRUD básico**

1. **Cadastros → Inspetorias** → "+ Nova Inspetoria" → salvar "1ª Inspetoria". Repetir com "2ª Inspetoria". Lista mostra ambas.
2. **Cadastros → Delegacias** → "+ Nova Delegacia" → salvar "DP Centro" e "DP Sul".
3. **Cadastros → Participantes** → "+ Novo Participante":
   - Nome: "Capitão Silva"
   - Subtítulo: "Comandante"
   - Inspetoria: "1ª Inspetoria"
   - Delegacia: "DP Centro"
   - Município: digite "São Paulo" no autocomplete → selecionar "São Paulo — SP"
   - Salvar.
4. Lista mostra a linha com todas as 5 colunas preenchidas (`São Paulo — SP`).

- [ ] **Step 5: 409 ao excluir referenciados**

1. Em **Inspetorias**, tentar remover "1ª Inspetoria". Esperado: alerta "Remova os participantes vinculados antes de excluir esta inspetoria.".
2. Em **Delegacias**, tentar remover "DP Centro". Esperado: alerta análogo.
3. Em **Municípios**, filtrar UF=SP, buscar "São Paulo", tentar remover. Esperado: "Remova os participantes vinculados antes de excluir este município.".

- [ ] **Step 6: Novidades**

Clicar no rodapé `v1.2.0` → abre `/novidades`. A primeira entrada deve ser `v1.2.0 — 2026-05-28` com Added (4 itens), Changed (2) e Removed (2). Voltar pro sidebar — o badge indigo deve ter sumido.

- [ ] **Step 7: Reportar**

Se todos os 6 passos passarem, fechar a sessão. Se algum falhar, anotar request/response (aba Network) e voltar para iteração.

---

## Self-review

Cobertura do spec:

| Spec | Coberto por |
|---|---|
| Drop Delegacao, criar Inspetoria/Delegacia/Participante | Task 1 (atômica) |
| Back-ref `participantes` em Municipio | Task 1 (schema) |
| `municipios.service` usa `participante.count` | Task 1 (Steps 3-4) |
| Módulos backend novos | Tasks 2, 3, 4 |
| Registro de rotas | Task 5 |
| Tipos frontend | Task 6 |
| Services frontend | Task 7 |
| Páginas Inspetorias/Delegacias/Participantes | Tasks 8, 9, 10 |
| Remoção do front antigo, App + Sidebar | Task 11 |
| Bump 1.2.0 + CHANGELOG | Task 12 |
| Deploy + smoke test | Task 13 |

Riscos do spec (migração destrutiva, esquecer atualização do `municipios.service`, resquícios de Delegacao) endereçados nas Tasks 1 (atômica), 1 Steps 3-4, e 11 Step 4 (grep).
