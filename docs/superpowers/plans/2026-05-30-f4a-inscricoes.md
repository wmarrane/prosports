# F4a — Inscrições Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a entidade `Inscricao` (vínculo Evento × Modalidade × Participante) com CRUD admin: backend completo (service+tests+controller+routes), frontend (type+service+ParticipanteSelect+página EventoInscricoes), botão de acesso no card do EventosList. Bump para `1.8.0`.

**Architecture:** Tabela `Inscricao` com FKs (cascade no Evento, restrict nas demais) e unique composto. Backend padrão do projeto (service com `mapPrismaError` para P2002 → 409, e validação cross-FK: modalidade.competicao_id deve bater com evento.competicao_id → 400). Frontend: tela `/eventos/:id/inscricoes` com chips de modalidade + DataTable de inscritos + modal de inscrever. Componente reutilizável `ParticipanteSelect` (autocomplete client-side já que `/participantes` retorna lista completa sem busca server-side).

**Tech Stack:** Prisma (Postgres + composite unique), Express + Zod, Vitest. React 18 + Vite + React Query + Tailwind + tokens R2P.

**Spec:** `docs/superpowers/specs/2026-05-30-f4a-inscricoes-design.md`

---

## File Structure

**Backend — Create:**
- `backend/prisma/migrations/<ts>_add_inscricao/migration.sql` (manual)
- `backend/src/modules/inscricoes/inscricoes.service.ts`
- `backend/src/modules/inscricoes/inscricoes.service.test.ts`
- `backend/src/modules/inscricoes/inscricoes.controller.ts`
- `backend/src/modules/inscricoes/inscricoes.routes.ts`

**Backend — Modify:**
- `backend/prisma/schema.prisma` — adicionar model `Inscricao` + back-refs em `Evento`, `Modalidade`, `Participante`.
- `backend/src/index.ts` — registrar `inscricoesRoutes` antes de `/eventos`.

**Frontend — Create:**
- `frontend/src/types/inscricao.ts`
- `frontend/src/services/inscricoes.ts`
- `frontend/src/components/ParticipanteSelect.tsx`
- `frontend/src/pages/eventos/EventoInscricoes.tsx`

**Frontend — Modify:**
- `frontend/src/pages/eventos/EventosList.tsx` — botão "Inscrições" no card.
- `frontend/src/App.tsx` — rota `/eventos/:id/inscricoes`.

**Release:**
- `package.json` (root): `1.7.0` → `1.8.0`.
- `CHANGELOG.md`: bloco novo `[1.8.0]`.

---

## Task 1: Prisma — model Inscricao + migration manual

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\prisma\schema.prisma`
- Create: `backend/prisma/migrations/20260530160000_add_inscricao/migration.sql`

- [ ] **Step 1: Editar `schema.prisma`**

Localizar o bloco `model Evento` e adicionar a back-ref `inscricoes Inscricao[]` no final do bloco (antes do fechamento `}`). Bloco final do `Evento`:

```prisma
model Evento {
  id              Int           @id @default(autoincrement())
  nome            String
  data_hora       DateTime
  local           String
  organizador     String?
  status          EventoStatus  @default(rascunho)
  competicao      Competicao    @relation(fields: [competicao_id], references: [id])
  competicao_id   Int
  municipio       Municipio     @relation(fields: [municipio_id], references: [id])
  municipio_id    Int
  inscricoes      Inscricao[]
  criado_em       DateTime      @default(now())
  atualizado_em   DateTime      @updatedAt

  @@unique([competicao_id, nome])
}
```

Localizar `model Modalidade` e adicionar `inscricoes Inscricao[]`:

```prisma
model Modalidade {
  id                  Int             @id @default(autoincrement())
  nome                String
  sigla               String
  competicao          Competicao      @relation(fields: [competicao_id], references: [id])
  competicao_id       Int
  tipo_modalidade     TipoModalidade  @relation(fields: [tipo_modalidade_id], references: [id])
  tipo_modalidade_id  Int
  inscricoes          Inscricao[]
  criado_em           DateTime        @default(now())
  atualizado_em       DateTime        @updatedAt

  @@unique([competicao_id, nome])
  @@unique([competicao_id, sigla])
}
```

Localizar `model Participante` e adicionar `inscricoes Inscricao[]`:

```prisma
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
  inscricoes    Inscricao[]
  criado_em     DateTime     @default(now())
  atualizado_em DateTime     @updatedAt
}
```

No final do arquivo (após os demais models/enums), adicionar:

```prisma
model Inscricao {
  id              Int          @id @default(autoincrement())
  evento          Evento       @relation(fields: [evento_id], references: [id], onDelete: Cascade)
  evento_id       Int
  modalidade      Modalidade   @relation(fields: [modalidade_id], references: [id])
  modalidade_id   Int
  participante    Participante @relation(fields: [participante_id], references: [id])
  participante_id Int
  criado_em       DateTime     @default(now())
  atualizado_em   DateTime     @updatedAt

  @@unique([evento_id, modalidade_id, participante_id])
  @@index([evento_id, modalidade_id])
}
```

- [ ] **Step 2: Criar migration manualmente**

Criar diretório:
```
backend/prisma/migrations/20260530160000_add_inscricao/
```

Criar arquivo `migration.sql` com conteúdo exato:

```sql
-- Add Inscricao table (Evento × Modalidade × Participante).

CREATE TABLE "Inscricao" (
  "id" SERIAL PRIMARY KEY,
  "evento_id" INTEGER NOT NULL,
  "modalidade_id" INTEGER NOT NULL,
  "participante_id" INTEGER NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Inscricao_evento_id_fkey"
    FOREIGN KEY ("evento_id") REFERENCES "Evento"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Inscricao_modalidade_id_fkey"
    FOREIGN KEY ("modalidade_id") REFERENCES "Modalidade"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Inscricao_participante_id_fkey"
    FOREIGN KEY ("participante_id") REFERENCES "Participante"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Inscricao_evento_id_modalidade_id_participante_id_key"
  ON "Inscricao"("evento_id","modalidade_id","participante_id");

CREATE INDEX "Inscricao_evento_id_modalidade_id_idx"
  ON "Inscricao"("evento_id","modalidade_id");
```

- [ ] **Step 3: Regenerar Prisma client local**

De `backend/`:
```
npx prisma generate
```

Esperado: "Generated Prisma Client".

- [ ] **Step 4: tsc + full suite**

De `backend/`:
```
npx tsc --noEmit && npx vitest run
```

Esperado: tsc clean; todos os testes existentes seguem passando.

- [ ] **Step 5: Commit**

```
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): add Inscricao model (Evento × Modalidade × Participante)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Backend — `inscricoes` service + tests (TDD)

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\inscricoes\inscricoes.service.ts`
- Create: `backend/src/modules/inscricoes/inscricoes.service.test.ts`

- [ ] **Step 1: Criar test file**

Criar `backend/src/modules/inscricoes/inscricoes.service.test.ts` com conteúdo exato:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    inscricao: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    evento: {
      findUnique: vi.fn(),
    },
    modalidade: {
      findUnique: vi.fn(),
    },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './inscricoes.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

const INCLUDE = { participante: true }

describe('inscricoes.service', () => {
  it('listar com filtros passa where corretamente', async () => {
    mockPrisma.inscricao.findMany.mockResolvedValue([])
    await service.listar({ evento_id: 7, modalidade_id: 3 })
    expect(mockPrisma.inscricao.findMany).toHaveBeenCalledWith({
      where: { evento_id: 7, modalidade_id: 3 },
      orderBy: { criado_em: 'asc' },
      include: INCLUDE,
    })
  })

  it('listar sem filtros chama findMany com where vazio', async () => {
    mockPrisma.inscricao.findMany.mockResolvedValue([])
    await service.listar({})
    expect(mockPrisma.inscricao.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { criado_em: 'asc' },
      include: INCLUDE,
    })
  })

  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.inscricao.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('criar lança 404 se evento não existe', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue(null)
    mockPrisma.modalidade.findUnique.mockResolvedValue({ competicao_id: 1 })
    await expect(service.criar({ evento_id: 1, modalidade_id: 1, participante_id: 1 }))
      .rejects.toMatchObject({ status: 404, message: expect.stringContaining('Evento') })
    expect(mockPrisma.inscricao.create).not.toHaveBeenCalled()
  })

  it('criar lança 404 se modalidade não existe', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue(null)
    await expect(service.criar({ evento_id: 1, modalidade_id: 1, participante_id: 1 }))
      .rejects.toMatchObject({ status: 404, message: expect.stringContaining('Modalidade') })
    expect(mockPrisma.inscricao.create).not.toHaveBeenCalled()
  })

  it('criar lança 400 se competições não batem', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ competicao_id: 2 })
    await expect(service.criar({ evento_id: 1, modalidade_id: 1, participante_id: 1 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('competição') })
    expect(mockPrisma.inscricao.create).not.toHaveBeenCalled()
  })

  it('criar chama prisma.create com include quando competições batem', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.inscricao.create.mockResolvedValue({ id: 1 })
    const data = { evento_id: 1, modalidade_id: 1, participante_id: 1 }
    await service.criar(data)
    expect(mockPrisma.inscricao.create).toHaveBeenCalledWith({ data, include: INCLUDE })
  })

  it('criar mapeia P2002 para 409', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.inscricao.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))
    await expect(service.criar({ evento_id: 1, modalidade_id: 1, participante_id: 1 }))
      .rejects.toMatchObject({ status: 409, message: expect.stringContaining('inscrito') })
  })

  it('remover deleta direto', async () => {
    mockPrisma.inscricao.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.inscricao.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
```

- [ ] **Step 2: Run test — FAIL**

De `backend/`:
```
npx vitest run src/modules/inscricoes/inscricoes.service.test.ts
```

Esperado: FAIL com `Cannot find module './inscricoes.service'`.

- [ ] **Step 3: Criar `inscricoes.service.ts`**

Criar `backend/src/modules/inscricoes/inscricoes.service.ts` com conteúdo exato:

```ts
import prisma from '../../lib/prisma'

const INCLUDE = { participante: true } as const

async function mapPrismaError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw Object.assign(
        new Error('Este participante já está inscrito nesta modalidade do evento.'),
        { status: 409 }
      )
    }
    throw err
  }
}

type CreateInput = {
  evento_id: number
  modalidade_id: number
  participante_id: number
}

export async function listar(filtros: { evento_id?: number; modalidade_id?: number }) {
  const where: { evento_id?: number; modalidade_id?: number } = {}
  if (filtros.evento_id !== undefined) where.evento_id = filtros.evento_id
  if (filtros.modalidade_id !== undefined) where.modalidade_id = filtros.modalidade_id
  return prisma.inscricao.findMany({
    where,
    orderBy: { criado_em: 'asc' },
    include: INCLUDE,
  })
}

export async function buscarPorId(id: number) {
  const item = await prisma.inscricao.findUnique({ where: { id }, include: INCLUDE })
  if (!item) throw Object.assign(new Error('Inscrição não encontrada'), { status: 404 })
  return item
}

export async function criar(data: CreateInput) {
  const [evento, modalidade] = await Promise.all([
    prisma.evento.findUnique({ where: { id: data.evento_id }, select: { competicao_id: true } }),
    prisma.modalidade.findUnique({ where: { id: data.modalidade_id }, select: { competicao_id: true } }),
  ])
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })
  if (!modalidade) throw Object.assign(new Error('Modalidade não encontrada'), { status: 404 })
  if (evento.competicao_id !== modalidade.competicao_id) {
    throw Object.assign(
      new Error('A modalidade não pertence à competição deste evento.'),
      { status: 400 }
    )
  }
  return mapPrismaError(() => prisma.inscricao.create({ data, include: INCLUDE }))
}

export async function remover(id: number) {
  return prisma.inscricao.delete({ where: { id } })
}
```

- [ ] **Step 4: Run test — 9 pass**

```
npx vitest run src/modules/inscricoes/inscricoes.service.test.ts
```

Esperado: 9 testes passam.

- [ ] **Step 5: Commit**

```
git add backend/src/modules/inscricoes/inscricoes.service.ts backend/src/modules/inscricoes/inscricoes.service.test.ts
git commit -m "feat(inscricoes): add service with cross-FK validation and P2002 mapping" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Backend — controller + routes + wire em index.ts

**Files:**
- Create: `backend/src/modules/inscricoes/inscricoes.controller.ts`
- Create: `backend/src/modules/inscricoes/inscricoes.routes.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Criar `inscricoes.controller.ts`**

Conteúdo exato:

```ts
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './inscricoes.service'

const createSchema = z.object({
  evento_id: z.coerce.number().int().positive(),
  modalidade_id: z.coerce.number().int().positive(),
  participante_id: z.coerce.number().int().positive(),
})

const listQuerySchema = z.object({
  evento_id: z.coerce.number().int().positive().optional(),
  modalidade_id: z.coerce.number().int().positive().optional(),
})

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const filtros = listQuerySchema.parse(req.query)
    res.json(await service.listar(filtros))
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

export async function remover(req: Request, res: Response, next: NextFunction) {
  try {
    await service.remover(Number(req.params.id))
    res.status(204).send()
  } catch (err) { next(err) }
}
```

- [ ] **Step 2: Criar `inscricoes.routes.ts`**

Conteúdo exato:

```ts
import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as ctrl from './inscricoes.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]

router.get('/', requireAuth, ctrl.listar)
router.get('/:id', requireAuth, ctrl.buscarPorId)
router.post('/', ...admin, ctrl.criar)
router.delete('/:id', ...admin, ctrl.remover)

export default router
```

- [ ] **Step 3: Registrar em `backend/src/index.ts`**

Adicionar import após `eventosRoutes`:

```ts
import inscricoesRoutes from './modules/inscricoes/inscricoes.routes'
```

E no bloco `app.use`, adicionar **antes** do `app.use('/eventos', eventosRoutes)`:

```ts
app.use('/inscricoes', inscricoesRoutes)
```

- [ ] **Step 4: tsc + full suite**

De `backend/`:
```
npx tsc --noEmit && npx vitest run
```

Esperado: tsc clean, suíte completa verde.

- [ ] **Step 5: Commit**

```
git add backend/src/modules/inscricoes/inscricoes.controller.ts backend/src/modules/inscricoes/inscricoes.routes.ts backend/src/index.ts
git commit -m "feat(inscricoes): expose CRUD endpoints" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Frontend — type Inscricao

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\types\inscricao.ts`

- [ ] **Step 1: Criar `types/inscricao.ts`**

Conteúdo exato:

```ts
import type { Participante } from './participante'

export type Inscricao = {
  id: number
  evento_id: number
  modalidade_id: number
  participante_id: number
  participante: Participante
  criado_em: string
  atualizado_em: string
}
```

- [ ] **Step 2: tsc**

De `frontend/`:
```
npx tsc --noEmit
```

Esperado: clean.

- [ ] **Step 3: Commit**

```
git add frontend/src/types/inscricao.ts
git commit -m "feat(frontend): add Inscricao type" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Frontend — service inscricoes

**Files:**
- Create: `frontend/src/services/inscricoes.ts`

- [ ] **Step 1: Criar `services/inscricoes.ts`**

Conteúdo exato:

```ts
import api from './api'
import type { Inscricao } from '../types/inscricao'

const BASE = '/inscricoes'

type InscricaoPayload = {
  evento_id: number
  modalidade_id: number
  participante_id: number
}

export const inscricoesService = {
  listar: (params?: { evento_id?: number; modalidade_id?: number }) =>
    api.get<Inscricao[]>(BASE, { params }).then(r => r.data),
  criar: (data: InscricaoPayload) => api.post<Inscricao>(BASE, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
```

- [ ] **Step 2: tsc**

De `frontend/`:
```
npx tsc --noEmit
```

Esperado: clean.

- [ ] **Step 3: Commit**

```
git add frontend/src/services/inscricoes.ts
git commit -m "feat(frontend): add inscricoes service" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Frontend — componente ParticipanteSelect

**Files:**
- Create: `frontend/src/components/ParticipanteSelect.tsx`

**Context (importante):** `participantesService.listar()` retorna `Participante[]` (sem busca server-side, sem paginação). O autocomplete filtra client-side. Carregar uma vez na abertura, manter em cache via React Query.

- [ ] **Step 1: Criar `ParticipanteSelect.tsx`**

Conteúdo exato:

```tsx
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { participantesService } from '../services/participantes'
import type { Participante } from '../types/participante'

type Props = {
  value: number | null
  onChange: (id: number | null, participante: Participante | null) => void
  excludeIds?: number[]
  placeholder?: string
}

export default function ParticipanteSelect({
  value,
  onChange,
  excludeIds = [],
  placeholder = 'Busque pelo nome do participante...',
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: all = [], isLoading } = useQuery({
    queryKey: ['participantes'],
    queryFn: participantesService.listar,
  })

  const selected = value != null ? all.find(p => p.id === value) ?? null : null

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const q = query.trim().toLowerCase()
  const excludeSet = new Set(excludeIds)
  const filtered = all
    .filter(p => !excludeSet.has(p.id))
    .filter(p => q.length === 0 ? true : (
      p.nome.toLowerCase().includes(q) ||
      (p.subtitulo?.toLowerCase().includes(q) ?? false)
    ))
    .slice(0, 30)

  function pick(p: Participante) {
    onChange(p.id, p)
    setQuery('')
    setOpen(false)
  }

  function clear() {
    onChange(null, null)
    setQuery('')
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]'

  return (
    <div className="relative" ref={containerRef}>
      {selected && !open ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm">
          <span>{selected.nome}{selected.subtitulo ? ` — ${selected.subtitulo}` : ''}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(true)} className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)]">Trocar</button>
            <button type="button" onClick={clear} className="text-xs text-[var(--danger)] hover:text-[var(--danger-700)]">Remover</button>
          </div>
        </div>
      ) : (
        <input
          autoFocus={open}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={inputClass}
        />
      )}
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg shadow-lg max-h-60 overflow-auto">
          {isLoading && <p className="px-3 py-2 text-xs text-[var(--t3)]">Carregando...</p>}
          {!isLoading && filtered.length === 0 && (
            <p className="px-3 py-2 text-xs text-[var(--t3)]">Nenhum participante encontrado.</p>
          )}
          {filtered.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p)}
              className="w-full text-left px-3 py-2 text-sm text-[var(--t1)] hover:bg-[var(--card-bg-2)]"
            >
              {p.nome}{p.subtitulo ? ` — ${p.subtitulo}` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: tsc**

De `frontend/`:
```
npx tsc --noEmit
```

Esperado: clean.

- [ ] **Step 3: Commit**

```
git add frontend/src/components/ParticipanteSelect.tsx
git commit -m "feat(frontend): add ParticipanteSelect (client-side autocomplete)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Frontend — página EventoInscricoes

**Files:**
- Create: `frontend/src/pages/eventos/EventoInscricoes.tsx`

**Context:** `modalidadesService.listar({ competicao_id? })` aceita filtro server-side. `eventosService.buscar(id)` retorna `Evento` com `competicao` populado.

- [ ] **Step 1: Criar `EventoInscricoes.tsx`**

Conteúdo exato:

```tsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import ParticipanteSelect from '../../components/ParticipanteSelect'
import { eventosService } from '../../services/eventos'
import { modalidadesService } from '../../services/modalidades'
import { inscricoesService } from '../../services/inscricoes'
import type { Inscricao } from '../../types/inscricao'

export default function EventoInscricoes() {
  const { id } = useParams()
  const eventoId = Number(id)
  const queryClient = useQueryClient()

  const [modalidadeId, setModalidadeId] = useState<number | null>(null)
  const [inscreverOpen, setInscreverOpen] = useState(false)
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [erroModal, setErroModal] = useState('')

  const { data: evento } = useQuery({
    queryKey: ['eventos', eventoId],
    queryFn: () => eventosService.buscar(eventoId),
  })

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades', evento?.competicao_id],
    queryFn: () => modalidadesService.listar({ competicao_id: evento!.competicao_id }),
    enabled: !!evento,
  })

  const { data: inscricoes = [], isLoading: loadingInscricoes } = useQuery({
    queryKey: ['inscricoes', eventoId, modalidadeId],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId, modalidade_id: modalidadeId! }),
    enabled: modalidadeId != null,
  })

  const { mutate: criar, isPending: salvando } = useMutation({
    mutationFn: () => inscricoesService.criar({
      evento_id: eventoId,
      modalidade_id: modalidadeId!,
      participante_id: pickedId!,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inscricoes', eventoId, modalidadeId] })
      setInscreverOpen(false)
      setPickedId(null)
      setErroModal('')
    },
    onError: (err: any) => setErroModal(err?.response?.data?.message ?? 'Erro ao inscrever.'),
  })

  const { mutate: remover } = useMutation({
    mutationFn: inscricoesService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inscricoes', eventoId, modalidadeId] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const excludeIds = inscricoes.map(i => i.participante_id)

  const columns = [
    { header: 'Nome', accessor: (row: Inscricao) => row.participante.nome },
    { header: 'Subtítulo', accessor: (row: Inscricao) => row.participante.subtitulo ?? '—' },
    {
      header: 'Município',
      accessor: (row: Inscricao) => row.participante.municipio
        ? `${row.participante.municipio.nome} — ${row.participante.municipio.uf}`
        : '—',
    },
    {
      header: 'Ações',
      accessor: (row: Inscricao) => (
        <button
          onClick={() => { if (confirm(`Remover inscrição de "${row.participante.nome}"?`)) remover(row.id) }}
          className="text-[var(--danger)] hover:text-[var(--danger-700)] text-xs"
        >Remover</button>
      ),
      className: 'w-24',
    },
  ]

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="OPERAÇÃO"
        title={evento ? evento.nome : 'Inscrições'}
        sub={evento?.competicao?.nome}
        backTo="/eventos"
      />
      <div className="p-6 space-y-5">
        <div className="flex flex-wrap gap-2">
          {modalidades.length === 0 && (
            <p className="text-sm text-[var(--t3)]">Nenhuma modalidade nesta competição.</p>
          )}
          {modalidades.map(m => {
            const active = m.id === modalidadeId
            return (
              <button
                key={m.id}
                onClick={() => setModalidadeId(m.id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  active
                    ? 'bg-[var(--brand-500)] text-white border-[var(--brand-500)]'
                    : 'bg-[var(--card-bg-2)] text-[var(--t1)] border-[var(--card-border)] hover:border-[var(--brand-400)]'
                }`}
              >
                {m.nome} ({m.sigla})
              </button>
            )
          })}
        </div>

        {modalidadeId == null ? (
          <p className="text-sm text-[var(--t3)]">Selecione uma modalidade para ver os inscritos.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-medium text-[var(--t2)]">
                {inscricoes.length} {inscricoes.length === 1 ? 'inscrito' : 'inscritos'}
              </h2>
              <button
                onClick={() => { setInscreverOpen(true); setPickedId(null); setErroModal('') }}
                className="btn btn-primary"
              >+ Inscrever</button>
            </div>
            {loadingInscricoes ? (
              <p className="text-sm text-[var(--t3)]">Carregando...</p>
            ) : (
              <DataTable columns={columns} data={inscricoes} keyExtractor={r => r.id} emptyMessage="Nenhum inscrito nesta modalidade." />
            )}
          </div>
        )}
      </div>

      {inscreverOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-20" onClick={() => setInscreverOpen(false)}>
          <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[var(--t1)] mb-4">Inscrever participante</h3>
            <ParticipanteSelect value={pickedId} onChange={(id) => setPickedId(id)} excludeIds={excludeIds} />
            {erroModal && <p className="text-sm text-[var(--danger)] mt-3">{erroModal}</p>}
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setInscreverOpen(false)} className="px-4 py-2 text-sm text-[var(--t2)] hover:text-[var(--t1)]">Cancelar</button>
              <button
                onClick={() => criar()}
                disabled={!pickedId || salvando}
                className="btn btn-primary disabled:opacity-50"
              >{salvando ? 'Salvando...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: tsc**

De `frontend/`:
```
npx tsc --noEmit
```

Esperado: clean.

- [ ] **Step 3: Commit**

```
git add frontend/src/pages/eventos/EventoInscricoes.tsx
git commit -m "feat(frontend): add EventoInscricoes page (chips de modalidade + modal de inscrever)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Frontend — botão "Inscrições" no card + rota em App.tsx

**Files:**
- Modify: `frontend/src/pages/eventos/EventosList.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Editar `EventosList.tsx` — adicionar botão "Inscrições" antes do "Remover"**

Localizar o bloco no card do evento que renderiza o botão "Remover":

```tsx
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={(e) => handleRemove(e, ev)}
                    className="text-xs text-[var(--danger)] hover:text-[var(--danger-700)]"
                  >
                    Remover
                  </button>
                </div>
```

Substituir por:

```tsx
                <div className="mt-3 flex justify-end gap-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/eventos/${ev.id}/inscricoes`) }}
                    className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)]"
                  >
                    Inscrições
                  </button>
                  <button
                    onClick={(e) => handleRemove(e, ev)}
                    className="text-xs text-[var(--danger)] hover:text-[var(--danger-700)]"
                  >
                    Remover
                  </button>
                </div>
```

- [ ] **Step 2: Editar `App.tsx` — adicionar rota**

Localizar o bloco com as rotas de eventos:

```tsx
            <Route path="/eventos"             element={<EventosList />} />
            <Route path="/eventos/novo"        element={<EventoForm />} />
            <Route path="/eventos/:id/editar"  element={<EventoForm />} />
```

Adicionar import junto aos demais (após `EventoForm`):

```tsx
import EventoInscricoes from './pages/eventos/EventoInscricoes'
```

E inserir uma rota nova logo após a rota de editar:

```tsx
            <Route path="/eventos"                  element={<EventosList />} />
            <Route path="/eventos/novo"             element={<EventoForm />} />
            <Route path="/eventos/:id/editar"       element={<EventoForm />} />
            <Route path="/eventos/:id/inscricoes"   element={<EventoInscricoes />} />
```

- [ ] **Step 3: tsc + build**

De `frontend/`:
```
npx tsc --noEmit && npm run build
```

Esperado: tsc clean, vite build OK.

- [ ] **Step 4: Commit**

```
git add frontend/src/pages/eventos/EventosList.tsx frontend/src/App.tsx
git commit -m "feat(frontend): wire /eventos/:id/inscricoes route and card button" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Bump versão + CHANGELOG

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\package.json`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\CHANGELOG.md`

- [ ] **Step 1: Bump version**

Editar `package.json` (root). Mudar **somente** `"version": "1.7.0"` para `"version": "1.8.0"`.

- [ ] **Step 2: Adicionar bloco no `CHANGELOG.md`**

Inserir o bloco abaixo logo após o cabeçalho e **antes** do bloco `## [1.7.0]`:

```md
## [1.8.0] - 2026-05-30

### Added
- Entidade Inscricao: vínculo Evento × Modalidade × Participante (unique composto, sem duplicatas).
- Tela /eventos/:id/inscricoes com chips de modalidade, lista de inscritos e modal de inscrever (autocomplete sobre pool global de Participantes).
- Componente reutilizável `ParticipanteSelect` (autocomplete client-side).

### Changed
- Card do Evento (lista /eventos) ganha botão "Inscrições" que leva à nova tela operacional.
- Apagar um Evento agora também remove suas inscrições em cascata.
```

- [ ] **Step 3: Commit**

```
git add package.json CHANGELOG.md
git commit -m "chore(release): v1.8.0 — F4a Inscrições" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Push + smoke (pós-deploy CI)

**Files:** (sem edição — verificação)

- [ ] **Step 1: Push**

```
git push origin develop
```

CI roda `prisma migrate deploy` (cria tabela Inscricao + índices + FKs) e reconstrói containers (~4-5min).

- [ ] **Step 2: Verificar deploy**

```
curl -s -o /dev/null -w "/health: %{http_code}\n" http://192.168.56.113:3000/health
curl -s -o /dev/null -w "/inscricoes (no auth): %{http_code}\n" http://192.168.56.113:3000/inscricoes
curl -s -o /dev/null -w "frontend: %{http_code}\n" http://192.168.56.113:8080/
```

Esperado: `/health 200`, `/inscricoes 401`, frontend `200`.

- [ ] **Step 3: Smoke no browser**

Abrir http://192.168.56.113:8080, login `admin@prosports.com` / `admin123`:

1. Sidebar → Operação → Eventos → algum card existente tem botão "Inscrições".
2. Click "Inscrições" → abre `/eventos/:id/inscricoes`. Header mostra nome do evento + nome da competição.
3. Chips de modalidade aparecem (das modalidades da competição do evento). Se vazio, criar uma Modalidade primeiro em Administração.
4. Selecionar uma modalidade → "Nenhum inscrito nesta modalidade." + botão "+ Inscrever".
5. "+ Inscrever" → modal abre com `ParticipanteSelect`. Digitar parte do nome → dropdown mostra resultados → escolher → "Confirmar" → modal fecha, linha aparece na tabela.
6. Tentar inscrever o mesmo participante de novo → o `excludeIds` deve sumir com ele do dropdown. Mas via API curl, tentar `POST /inscricoes` com dup → 409 "Este participante já está inscrito...".
7. Trocar para outra modalidade → lista vazia (ou diferente).
8. Click "Remover" em uma linha → confirm → linha some.
9. Rodapé sidebar mostra `v1.8.0 (<sha>)`.

- [ ] **Step 4: Reportar**

Se passou, F4a fechada. Se falhar, capturar request/response e iterar.

---

## Self-review

Cobertura do spec:

| Spec | Coberto por |
|---|---|
| Prisma model `Inscricao` + back-refs + cascade apenas no Evento | Task 1 |
| Migration manual (sem `migrate diff`) | Task 1 |
| Service com validação cross-FK (400) + mapPrismaError (409) | Task 2 |
| Controller Zod + routes (GET / GET:id / POST / DELETE) | Task 3 |
| Tests vitest (9 casos) | Task 2 |
| Wire em index.ts antes de /eventos | Task 3 |
| Type `Inscricao` (com participante populado) | Task 4 |
| Service inscricoes (listar/criar/remover) | Task 5 |
| Componente `ParticipanteSelect` (autocomplete) | Task 6 |
| Página `EventoInscricoes` (chips + DataTable + modal) | Task 7 |
| Botão "Inscrições" no card + rota App.tsx | Task 8 |
| Bump 1.8.0 + CHANGELOG | Task 9 |
| Smoke pós-deploy | Task 10 |

Riscos endereçados:
- **Drift `migrate diff`**: migração manual em Task 1 (segue lição de F2).
- **Pool global sem busca server-side**: confirmei `participantesService.listar()` retorna `Participante[]` flat; `ParticipanteSelect` (Task 6) faz filtro client-side com `slice(0, 30)` para não estourar a UI.
- **modalidadesService.listar**: confirmei suporte a `competicao_id` server-side, usado em Task 7.
- **excludeIds = participantes já inscritos**: passado para `ParticipanteSelect` no modal, evita duplicata pelo UI antes mesmo do 409 backend.
- **Cascade silencioso ao apagar Evento**: documentado no spec/CHANGELOG, comportamento esperado.
