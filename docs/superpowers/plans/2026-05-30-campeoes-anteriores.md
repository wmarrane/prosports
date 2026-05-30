# Campeões do Ano Anterior — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar entidade `CampeaoAnterior` (3 slots fixos por evento×modalidade: 1º/2º/3º com FK para Participante), CRUD admin, e sinalização visual (🥇🥈🥉) em 3 telas: tabela de inscrições, render de sorteio (F4c) e Modo Congresso (F6). Bump para `1.15.0`.

**Architecture:** Backend padrão do projeto (service+tests+controller+routes), seguindo o mesmo padrão da Inscricao (cascade Evento, restrict Modalidade/Participante, validação cross-FK competicao_id, P2002 → 409). Frontend: tipo + service + componente `CampeaoBadge` reutilizado em 3 lugares. `EventoInscricoes` ganha nova seção de cadastro + sinalização inline na tabela. Os 3 componentes de sorteio (Grupos/Chaves/Ordem) ganham prop opcional `campeoesByParticipanteId` — não quebra usos atuais. `CongressoStepSorteio` carrega a query e passa para os componentes.

**Tech Stack:** Prisma + Postgres (manual migration), Express + Zod, Vitest. React 18 + TypeScript + React Query + tokens R2P.

**Spec:** `docs/superpowers/specs/2026-05-30-campeoes-anteriores-design.md`

---

## File Structure

**Backend — Create:**
- `backend/prisma/migrations/<ts>_add_campeao_anterior/migration.sql`
- `backend/src/modules/campeoes_anteriores/campeoes_anteriores.service.ts`
- `backend/src/modules/campeoes_anteriores/campeoes_anteriores.service.test.ts`
- `backend/src/modules/campeoes_anteriores/campeoes_anteriores.controller.ts`
- `backend/src/modules/campeoes_anteriores/campeoes_anteriores.routes.ts`

**Backend — Modify:**
- `backend/prisma/schema.prisma` — model `CampeaoAnterior` + back-refs em Evento, Modalidade, Participante.
- `backend/src/index.ts` — wire `campeoesAnterioresRoutes` antes de `/inscricoes`.

**Frontend — Create:**
- `frontend/src/types/campeao-anterior.ts`
- `frontend/src/services/campeoes-anteriores.ts`
- `frontend/src/components/CampeaoBadge.tsx`

**Frontend — Modify:**
- `frontend/src/pages/eventos/EventoInscricoes.tsx` — nova query + seção 3 slots + badge na tabela + passa map pros componentes de sorteio.
- `frontend/src/components/sorteio-result/SorteioGrupos.tsx` — prop nova + render badge.
- `frontend/src/components/sorteio-result/SorteioChaves.tsx` — idem.
- `frontend/src/components/sorteio-result/SorteioOrdem.tsx` — idem.
- `frontend/src/pages/congresso/CongressoStepSorteio.tsx` — query nova + passa map.

**Release:**
- `package.json` (root): `1.14.0` → `1.15.0`.
- `CHANGELOG.md`: bloco novo `[1.15.0]`.

---

## Task 1: Prisma — model + back-refs + migration manual

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\prisma\schema.prisma`
- Create: `backend/prisma/migrations/20260530200000_add_campeao_anterior/migration.sql`

- [ ] **Step 1: Editar `schema.prisma` — back-refs**

Adicionar `campeoes_anteriores CampeaoAnterior[]` nos 3 models (entre as outras relações, antes de `criado_em`):

```prisma
model Evento {
  // ... campos existentes ...
  inscricoes           Inscricao[]
  sorteios             Sorteio[]
  campeoes_anteriores  CampeaoAnterior[]
  criado_em            DateTime  @default(now())
  // ...
}

model Modalidade {
  // ... campos existentes ...
  inscricoes           Inscricao[]
  sorteios             Sorteio[]
  campeoes_anteriores  CampeaoAnterior[]
  criado_em            DateTime  @default(now())
  // ...
}

model Participante {
  // ... campos existentes ...
  inscricoes           Inscricao[]
  campeoes_anteriores  CampeaoAnterior[]
  criado_em            DateTime  @default(now())
  // ...
}
```

- [ ] **Step 2: Append do model ao final de `schema.prisma`**

```prisma
model CampeaoAnterior {
  id              Int           @id @default(autoincrement())
  evento          Evento        @relation(fields: [evento_id], references: [id], onDelete: Cascade)
  evento_id       Int
  modalidade      Modalidade    @relation(fields: [modalidade_id], references: [id])
  modalidade_id   Int
  participante    Participante  @relation(fields: [participante_id], references: [id])
  participante_id Int
  posicao         Int
  criado_em       DateTime      @default(now())
  atualizado_em   DateTime      @updatedAt

  @@unique([evento_id, modalidade_id, posicao])
  @@index([evento_id, modalidade_id])
}
```

- [ ] **Step 3: Criar migration manualmente**

Criar diretório `backend/prisma/migrations/20260530200000_add_campeao_anterior/` e arquivo `migration.sql`:

```sql
-- Add CampeaoAnterior table (3 slots fixos por evento × modalidade).

CREATE TABLE "CampeaoAnterior" (
  "id" SERIAL PRIMARY KEY,
  "evento_id" INTEGER NOT NULL,
  "modalidade_id" INTEGER NOT NULL,
  "participante_id" INTEGER NOT NULL,
  "posicao" INTEGER NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampeaoAnterior_evento_id_fkey"
    FOREIGN KEY ("evento_id") REFERENCES "Evento"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CampeaoAnterior_modalidade_id_fkey"
    FOREIGN KEY ("modalidade_id") REFERENCES "Modalidade"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CampeaoAnterior_participante_id_fkey"
    FOREIGN KEY ("participante_id") REFERENCES "Participante"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CampeaoAnterior_evento_id_modalidade_id_posicao_key"
  ON "CampeaoAnterior"("evento_id", "modalidade_id", "posicao");

CREATE INDEX "CampeaoAnterior_evento_id_modalidade_id_idx"
  ON "CampeaoAnterior"("evento_id", "modalidade_id");
```

- [ ] **Step 4: Regenerar Prisma client**

De `backend/`: `npx prisma generate`. Esperado: "Generated Prisma Client".

- [ ] **Step 5: tsc + full suite**

De `backend/`: `npx tsc --noEmit && npx vitest run`. Esperado: tsc clean, todos testes existentes passam.

- [ ] **Step 6: Commit**

```
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): add CampeaoAnterior model (3 slots por evento × modalidade)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Backend — service `campeoes_anteriores` + tests (TDD)

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\campeoes_anteriores\campeoes_anteriores.service.ts`
- Create: `backend/src/modules/campeoes_anteriores/campeoes_anteriores.service.test.ts`

- [ ] **Step 1: Criar test file**

Conteúdo exato de `backend/src/modules/campeoes_anteriores/campeoes_anteriores.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    campeaoAnterior: {
      findMany: vi.fn(),
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
import * as service from './campeoes_anteriores.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

const INCLUDE = { participante: true }

describe('campeoes_anteriores.service', () => {
  it('listar com filtros passa where correto', async () => {
    mockPrisma.campeaoAnterior.findMany.mockResolvedValue([])
    await service.listar({ evento_id: 5, modalidade_id: 2 })
    expect(mockPrisma.campeaoAnterior.findMany).toHaveBeenCalledWith({
      where: { evento_id: 5, modalidade_id: 2 },
      orderBy: [{ modalidade_id: 'asc' }, { posicao: 'asc' }],
      include: INCLUDE,
    })
  })

  it('listar sem filtros chama findMany com where vazio', async () => {
    mockPrisma.campeaoAnterior.findMany.mockResolvedValue([])
    await service.listar({})
    expect(mockPrisma.campeaoAnterior.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ modalidade_id: 'asc' }, { posicao: 'asc' }],
      include: INCLUDE,
    })
  })

  it('criar lança 404 se evento não existe', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue(null)
    mockPrisma.modalidade.findUnique.mockResolvedValue({ competicao_id: 1 })
    await expect(service.criar({ evento_id: 1, modalidade_id: 1, participante_id: 1, posicao: 1 }))
      .rejects.toMatchObject({ status: 404, message: expect.stringContaining('Evento') })
  })

  it('criar lança 404 se modalidade não existe', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue(null)
    await expect(service.criar({ evento_id: 1, modalidade_id: 1, participante_id: 1, posicao: 1 }))
      .rejects.toMatchObject({ status: 404, message: expect.stringContaining('Modalidade') })
  })

  it('criar lança 400 se competições não batem', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ competicao_id: 2 })
    await expect(service.criar({ evento_id: 1, modalidade_id: 1, participante_id: 1, posicao: 1 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('competição') })
  })

  it('criar chama prisma.create com data + include quando OK', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.campeaoAnterior.create.mockResolvedValue({ id: 1 })
    const data = { evento_id: 1, modalidade_id: 2, participante_id: 3, posicao: 1 as 1 | 2 | 3 }
    await service.criar(data)
    expect(mockPrisma.campeaoAnterior.create).toHaveBeenCalledWith({ data, include: INCLUDE })
  })

  it('criar mapeia P2002 para 409', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ competicao_id: 1 })
    mockPrisma.campeaoAnterior.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))
    await expect(service.criar({ evento_id: 1, modalidade_id: 1, participante_id: 1, posicao: 1 }))
      .rejects.toMatchObject({ status: 409, message: expect.stringContaining('posição') })
  })

  it('remover deleta direto', async () => {
    mockPrisma.campeaoAnterior.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.campeaoAnterior.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
```

- [ ] **Step 2: Run test — FAIL**

De `backend/`: `npx vitest run src/modules/campeoes_anteriores/campeoes_anteriores.service.test.ts`. Esperado: FAIL com `Cannot find module './campeoes_anteriores.service'`.

- [ ] **Step 3: Criar service**

Conteúdo exato de `backend/src/modules/campeoes_anteriores/campeoes_anteriores.service.ts`:

```ts
import prisma from '../../lib/prisma'

const INCLUDE = { participante: true } as const

async function mapPrismaError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw Object.assign(
        new Error('Já existe campeão cadastrado para esta posição.'),
        { status: 409 },
      )
    }
    throw err
  }
}

type Posicao = 1 | 2 | 3

type CreateInput = {
  evento_id: number
  modalidade_id: number
  participante_id: number
  posicao: Posicao
}

export async function listar(filtros: { evento_id?: number; modalidade_id?: number }) {
  const where: { evento_id?: number; modalidade_id?: number } = {}
  if (filtros.evento_id !== undefined) where.evento_id = filtros.evento_id
  if (filtros.modalidade_id !== undefined) where.modalidade_id = filtros.modalidade_id
  return prisma.campeaoAnterior.findMany({
    where,
    orderBy: [{ modalidade_id: 'asc' }, { posicao: 'asc' }],
    include: INCLUDE,
  })
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
      { status: 400 },
    )
  }
  return mapPrismaError(() => prisma.campeaoAnterior.create({ data, include: INCLUDE }))
}

export async function remover(id: number) {
  return prisma.campeaoAnterior.delete({ where: { id } })
}
```

- [ ] **Step 4: Run test — 8 pass**

```
npx vitest run src/modules/campeoes_anteriores/campeoes_anteriores.service.test.ts
```

Esperado: 8 testes passam.

- [ ] **Step 5: Commit**

```
git add backend/src/modules/campeoes_anteriores/campeoes_anteriores.service.ts backend/src/modules/campeoes_anteriores/campeoes_anteriores.service.test.ts
git commit -m "feat(campeoes-anteriores): add service with cross-FK validation and P2002 mapping" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Backend — controller + routes + wire

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\campeoes_anteriores\campeoes_anteriores.controller.ts`
- Create: `backend/src/modules/campeoes_anteriores/campeoes_anteriores.routes.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Criar `campeoes_anteriores.controller.ts`**

Conteúdo exato:

```ts
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './campeoes_anteriores.service'

const createSchema = z.object({
  evento_id: z.coerce.number().int().positive(),
  modalidade_id: z.coerce.number().int().positive(),
  participante_id: z.coerce.number().int().positive(),
  posicao: z.coerce.number().int().min(1).max(3),
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

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchema.parse(req.body)
    res.status(201).json(await service.criar(body as any))
  } catch (err) { next(err) }
}

export async function remover(req: Request, res: Response, next: NextFunction) {
  try {
    await service.remover(Number(req.params.id))
    res.status(204).send()
  } catch (err) { next(err) }
}
```

- [ ] **Step 2: Criar `campeoes_anteriores.routes.ts`**

Conteúdo exato:

```ts
import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as ctrl from './campeoes_anteriores.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]

router.get('/', requireAuth, ctrl.listar)
router.post('/', ...admin, ctrl.criar)
router.delete('/:id', ...admin, ctrl.remover)

export default router
```

- [ ] **Step 3: Modificar `backend/src/index.ts`**

Adicionar import após `inscricoesRoutes`:

```ts
import campeoesAnterioresRoutes from './modules/campeoes_anteriores/campeoes_anteriores.routes'
```

E no bloco `app.use`, adicionar **antes** do `app.use('/inscricoes', inscricoesRoutes)`:

```ts
app.use('/campeoes-anteriores', campeoesAnterioresRoutes)
```

- [ ] **Step 4: tsc + full suite**

De `backend/`: `npx tsc --noEmit && npx vitest run`. Esperado: tsc clean, suíte completa verde.

- [ ] **Step 5: Commit**

```
git add backend/src/modules/campeoes_anteriores/campeoes_anteriores.controller.ts backend/src/modules/campeoes_anteriores/campeoes_anteriores.routes.ts backend/src/index.ts
git commit -m "feat(campeoes-anteriores): expose CRUD endpoints (GET, POST, DELETE)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Frontend — type, service, CampeaoBadge

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\types\campeao-anterior.ts`
- Create: `frontend/src/services/campeoes-anteriores.ts`
- Create: `frontend/src/components/CampeaoBadge.tsx`

- [ ] **Step 1: Criar `types/campeao-anterior.ts`**

Conteúdo exato:

```ts
import type { Participante } from './participante'

export type CampeaoAnterior = {
  id: number
  evento_id: number
  modalidade_id: number
  participante_id: number
  participante: Participante
  posicao: 1 | 2 | 3
  criado_em: string
  atualizado_em: string
}
```

- [ ] **Step 2: Criar `services/campeoes-anteriores.ts`**

Conteúdo exato:

```ts
import api from './api'
import type { CampeaoAnterior } from '../types/campeao-anterior'

const BASE = '/campeoes-anteriores'

type CampeaoPayload = {
  evento_id: number
  modalidade_id: number
  participante_id: number
  posicao: 1 | 2 | 3
}

export const campeoesAnterioresService = {
  listar: (params?: { evento_id?: number; modalidade_id?: number }) =>
    api.get<CampeaoAnterior[]>(BASE, { params }).then(r => r.data),
  criar: (data: CampeaoPayload) => api.post<CampeaoAnterior>(BASE, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
```

- [ ] **Step 3: Criar `components/CampeaoBadge.tsx`**

Conteúdo exato:

```tsx
const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' } as const
const LABELS = {
  1: '1º colocado no ano anterior',
  2: '2º colocado no ano anterior',
  3: '3º colocado no ano anterior',
} as const

type Props = {
  posicao: 1 | 2 | 3
  large?: boolean
}

export default function CampeaoBadge({ posicao, large = false }: Props) {
  return (
    <span
      title={LABELS[posicao]}
      className={large ? 'text-2xl' : 'text-base'}
      style={{ display: 'inline-block', lineHeight: 1 }}
    >
      {MEDALS[posicao]}
    </span>
  )
}
```

- [ ] **Step 4: tsc**

De `frontend/`: `npx tsc --noEmit`. Esperado: clean.

- [ ] **Step 5: Commit**

```
git add frontend/src/types/campeao-anterior.ts frontend/src/services/campeoes-anteriores.ts frontend/src/components/CampeaoBadge.tsx
git commit -m "feat(frontend): add CampeaoAnterior type, service and CampeaoBadge component" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Componentes de sorteio — prop `campeoesByParticipanteId`

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\components\sorteio-result\SorteioGrupos.tsx`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\components\sorteio-result\SorteioChaves.tsx`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\components\sorteio-result\SorteioOrdem.tsx`

**Contexto:** A prop é opcional. Quando o map existe e contém o pid sendo renderizado, prepende `<CampeaoBadge posicao={pos} large={large} />` antes do nome do participante. Não muda nenhum comportamento atual quando a prop é omitida.

- [ ] **Step 1: Substituir `SorteioGrupos.tsx` inteiro**

```tsx
import type { GruposResultado } from '../../types/sorteio'
import type { Participante } from '../../types/participante'
import CampeaoBadge from '../CampeaoBadge'

type Props = {
  resultado: GruposResultado
  participantesById: Map<number, Participante>
  large?: boolean
  campeoesByParticipanteId?: Map<number, 1 | 2 | 3>
}

export default function SorteioGrupos({ resultado, participantesById, large = false, campeoesByParticipanteId }: Props) {
  const minCol = large ? 360 : 240
  const gap = large ? 24 : 16
  const cardPad = large ? 'p-6' : 'p-4'
  const titleClass = large ? 'text-2xl font-bold text-[var(--t1)]' : 'text-base font-semibold text-[var(--t1)]'
  const subClass = large ? 'text-sm text-[var(--t3)]' : 'text-xs text-[var(--t3)]'
  const itemClass = large ? 'text-xl text-[var(--t1)]' : 'text-sm text-[var(--t1)]'
  const subItemClass = large ? 'text-base text-[var(--t3)] ml-2' : 'text-xs text-[var(--t3)] ml-1'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minCol}px, 1fr))`, gap }}>
      {resultado.grupos.map(g => (
        <div
          key={g.letra}
          className={`bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-xl ${cardPad}`}
        >
          <div className={`flex justify-between items-center ${large ? 'mb-4' : 'mb-3'}`}>
            <h4 className={titleClass}>Grupo {g.letra}</h4>
            <span className={subClass}>{resultado.classificados_por_grupo} classificados</span>
          </div>
          <ul className={large ? 'space-y-3' : 'space-y-1.5'}>
            {g.participantes.map(pid => {
              const p = participantesById.get(pid)
              const pos = campeoesByParticipanteId?.get(pid)
              return (
                <li key={pid} className={`${itemClass} inline-flex items-center gap-2 w-full`}>
                  {pos && <CampeaoBadge posicao={pos} large={large} />}
                  <span>
                    {p ? p.nome : <span className="text-[var(--t4)]">—</span>}
                    {p?.subtitulo && <span className={subItemClass}>— {p.subtitulo}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Substituir `SorteioChaves.tsx` inteiro**

```tsx
import type { ChavesResultado } from '../../types/sorteio'
import type { Participante } from '../../types/participante'
import CampeaoBadge from '../CampeaoBadge'

type Props = {
  resultado: ChavesResultado
  participantesById: Map<number, Participante>
  large?: boolean
  campeoesByParticipanteId?: Map<number, 1 | 2 | 3>
}

export default function SorteioChaves({ resultado, participantesById, large = false, campeoesByParticipanteId }: Props) {
  const cardPad = large ? 'p-6' : 'p-4'
  const itemSpacing = large ? 'space-y-3' : 'space-y-1.5'
  const indexClass = large ? 'font-mono text-base text-[var(--t3)] w-12' : 'font-mono text-[var(--t3)] w-8'
  const nameClass = large ? 'text-xl text-[var(--t1)]' : 'text-sm text-[var(--t1)]'
  const subClass = large ? 'text-base text-[var(--t3)] ml-2' : 'text-xs text-[var(--t3)] ml-1'
  const byeClass = large ? 'text-xl text-[var(--t4)] italic' : 'text-sm text-[var(--t4)] italic'

  return (
    <div className={`bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-xl ${cardPad}`}>
      <ul className={itemSpacing}>
        {resultado.slots.map((pid, idx) => (
          <li key={idx} className="flex items-center gap-3">
            <span className={indexClass}>{String(idx + 1).padStart(2, '0')}</span>
            {pid == null ? (
              <span className={byeClass}>BYE</span>
            ) : (
              (() => {
                const p = participantesById.get(pid)
                const pos = campeoesByParticipanteId?.get(pid)
                return (
                  <span className="inline-flex items-center gap-2">
                    {pos && <CampeaoBadge posicao={pos} large={large} />}
                    {p
                      ? <span className={nameClass}>{p.nome}{p.subtitulo ? <span className={subClass}>— {p.subtitulo}</span> : null}</span>
                      : <span className="text-[var(--t4)]">—</span>}
                  </span>
                )
              })()
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Substituir `SorteioOrdem.tsx` inteiro**

```tsx
import type { OrdemResultado } from '../../types/sorteio'
import type { Participante } from '../../types/participante'
import CampeaoBadge from '../CampeaoBadge'

type Props = {
  resultado: OrdemResultado
  participantesById: Map<number, Participante>
  large?: boolean
  campeoesByParticipanteId?: Map<number, 1 | 2 | 3>
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function SorteioOrdem({ resultado, participantesById, large = false, campeoesByParticipanteId }: Props) {
  const cardPad = large ? 'p-6' : 'p-4'
  const itemSpacing = large ? 'space-y-3' : 'space-y-1.5'
  const itemClass = large ? 'text-xl text-[var(--t1)]' : 'text-sm text-[var(--t1)]'
  const medalSize = large ? 'text-3xl' : 'text-base'
  const indexClass = large ? 'font-mono text-base text-[var(--t3)] w-12 inline-block' : 'font-mono text-[var(--t3)] w-8 inline-block'
  const subClass = large ? 'text-base text-[var(--t3)] ml-2' : 'text-xs text-[var(--t3)] ml-1'

  return (
    <div className={`bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-xl ${cardPad}`}>
      <ol className={itemSpacing}>
        {resultado.ordem.map((pid, idx) => {
          const p = participantesById.get(pid)
          const pos = campeoesByParticipanteId?.get(pid)
          const prefix = idx < 3
            ? <span className={medalSize}>{MEDALS[idx]}</span>
            : <span className={indexClass}>{String(idx + 1).padStart(2, '0')}</span>
          return (
            <li key={pid} className={`flex items-center gap-3 ${itemClass}`}>
              <span className="w-12 inline-flex items-center justify-center">{prefix}</span>
              {pos && <CampeaoBadge posicao={pos} large={large} />}
              {p
                ? <span>{p.nome}{p.subtitulo ? <span className={subClass}>— {p.subtitulo}</span> : null}</span>
                : <span className="text-[var(--t4)]">—</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
```

- [ ] **Step 4: tsc + build**

De `frontend/`: `npx tsc --noEmit && npm run build`. Esperado: tsc clean, vite build OK. Render atual no /eventos/:id/inscricoes continua igual (prop opcional não usada ainda).

- [ ] **Step 5: Commit**

```
git add frontend/src/components/sorteio-result
git commit -m "feat(frontend): add campeoesByParticipanteId prop to sorteio result components" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `EventoInscricoes` — query + seção + sinalização

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\eventos\EventoInscricoes.tsx`

**Contexto:** A página atual já tem queries de evento, modalidades, inscricoes e sorteios; mutations criar/remover de inscrição + sortear/apagar. Vamos adicionar:
1. Query `campeoes-anteriores` (enabled quando modalidadeId != null).
2. `useMemo` para `campeoesByParticipanteId`.
3. Mutations `criarCampeao` e `removerCampeao` com invalidate.
4. Sub-componente inline `CampeaoSlot` para cada slot.
5. Render do badge na coluna "Nome" da DataTable.
6. Passar `campeoesByParticipanteId` para `SorteioGrupos/Chaves/Ordem`.
7. Nova seção "Campeões do ano anterior" depois de "Sorteio".

- [ ] **Step 1: Substituir `EventoInscricoes.tsx` inteiro**

```tsx
import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import ParticipanteSelect from '../../components/ParticipanteSelect'
import ImportInscricoesModal from '../../components/import/ImportInscricoesModal'
import CampeaoBadge from '../../components/CampeaoBadge'
import SorteioGrupos from '../../components/sorteio-result/SorteioGrupos'
import SorteioChaves from '../../components/sorteio-result/SorteioChaves'
import SorteioOrdem from '../../components/sorteio-result/SorteioOrdem'
import { eventosService } from '../../services/eventos'
import { modalidadesService } from '../../services/modalidades'
import { inscricoesService } from '../../services/inscricoes'
import { sorteiosService } from '../../services/sorteios'
import { campeoesAnterioresService } from '../../services/campeoes-anteriores'
import type { Inscricao } from '../../types/inscricao'
import type { Participante } from '../../types/participante'
import type { CampeaoAnterior } from '../../types/campeao-anterior'

function formatDateBR(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

const POSICAO_LABEL: Record<1 | 2 | 3, string> = { 1: '1º lugar', 2: '2º lugar', 3: '3º lugar' }

type CampeaoSlotProps = {
  posicao: 1 | 2 | 3
  campeao: CampeaoAnterior | null
  excludeIds: number[]
  onCriar: (participante_id: number) => void
  onRemover: (id: number) => void
  salvando: boolean
}

function CampeaoSlot({ posicao, campeao, excludeIds, onCriar, onRemover, salvando }: CampeaoSlotProps) {
  const [pickedId, setPickedId] = useState<number | null>(null)

  if (campeao) {
    return (
      <div className="border border-[var(--card-border)] rounded-lg p-3 bg-[var(--card-bg-2)]">
        <div className="flex items-center gap-2 mb-2">
          <CampeaoBadge posicao={posicao} />
          <span className="text-xs text-[var(--t3)]">{POSICAO_LABEL[posicao]}</span>
        </div>
        <div className="text-sm text-[var(--t1)]">{campeao.participante.nome}</div>
        {campeao.participante.subtitulo && (
          <div className="text-xs text-[var(--t3)] mt-0.5">{campeao.participante.subtitulo}</div>
        )}
        <button
          onClick={() => { if (confirm(`Remover ${POSICAO_LABEL[posicao]}?`)) onRemover(campeao.id) }}
          className="mt-2 text-xs text-[var(--danger)] hover:text-[var(--danger-700)]"
        >Remover</button>
      </div>
    )
  }

  return (
    <div className="border border-[var(--card-border)] rounded-lg p-3 bg-[var(--card-bg-2)] space-y-2">
      <div className="flex items-center gap-2">
        <CampeaoBadge posicao={posicao} />
        <span className="text-xs text-[var(--t3)]">{POSICAO_LABEL[posicao]}</span>
      </div>
      <ParticipanteSelect value={pickedId} onChange={(id) => setPickedId(id)} excludeIds={excludeIds} />
      <button
        onClick={() => { if (pickedId) { onCriar(pickedId); setPickedId(null) } }}
        disabled={!pickedId || salvando}
        className="btn btn-primary btn-sm disabled:opacity-50 text-xs"
      >{salvando ? 'Salvando...' : 'Salvar'}</button>
    </div>
  )
}

export default function EventoInscricoes() {
  const { id } = useParams()
  const eventoId = Number(id)
  const queryClient = useQueryClient()

  const [modalidadeId, setModalidadeId] = useState<number | null>(null)
  const [inscreverOpen, setInscreverOpen] = useState(false)
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [erroModal, setErroModal] = useState('')
  const [erroSorteio, setErroSorteio] = useState('')
  const [importOpen, setImportOpen] = useState(false)

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

  const { data: sorteios = [] } = useQuery({
    queryKey: ['sorteios', eventoId],
    queryFn: () => sorteiosService.listar({ evento_id: eventoId }),
  })

  const { data: campeoes = [] } = useQuery({
    queryKey: ['campeoes-anteriores', eventoId, modalidadeId],
    queryFn: () => campeoesAnterioresService.listar({ evento_id: eventoId, modalidade_id: modalidadeId! }),
    enabled: modalidadeId != null,
  })

  const sorteioDaModalidade = modalidadeId != null
    ? sorteios.find(s => s.modalidade_id === modalidadeId) ?? null
    : null

  const modalidadesSorteadasIds = useMemo(
    () => new Set(sorteios.map(s => s.modalidade_id)),
    [sorteios]
  )

  const participantesById = useMemo(() => {
    const m = new Map<number, Participante>()
    for (const i of inscricoes) m.set(i.participante_id, i.participante)
    return m
  }, [inscricoes])

  const campeoesByParticipanteId = useMemo(() => {
    const m = new Map<number, 1 | 2 | 3>()
    for (const c of campeoes) m.set(c.participante_id, c.posicao)
    return m
  }, [campeoes])

  const modalidadeAtual = modalidades.find(m => m.id === modalidadeId)
  const tipoDaModalidade = modalidadeAtual?.tipo_modalidade?.tipo

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

  const { mutate: removerInscricao } = useMutation({
    mutationFn: inscricoesService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inscricoes', eventoId, modalidadeId] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const { mutate: executarSorteio, isPending: executandoSorteio } = useMutation({
    mutationFn: () => sorteiosService.executar({ evento_id: eventoId, modalidade_id: modalidadeId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sorteios', eventoId] })
      setErroSorteio('')
    },
    onError: (err: any) => setErroSorteio(err?.response?.data?.message ?? 'Erro ao sortear.'),
  })

  const { mutate: apagarSorteio } = useMutation({
    mutationFn: (sid: number) => sorteiosService.remover(sid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sorteios', eventoId] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao apagar sorteio.'),
  })

  const { mutate: criarCampeao, isPending: salvandoCampeao } = useMutation({
    mutationFn: (data: { participante_id: number; posicao: 1 | 2 | 3 }) =>
      campeoesAnterioresService.criar({
        evento_id: eventoId,
        modalidade_id: modalidadeId!,
        participante_id: data.participante_id,
        posicao: data.posicao,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campeoes-anteriores', eventoId, modalidadeId] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao salvar campeão.'),
  })

  const { mutate: removerCampeao } = useMutation({
    mutationFn: (cid: number) => campeoesAnterioresService.remover(cid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campeoes-anteriores', eventoId, modalidadeId] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover campeão.'),
  })

  function handleSortear() {
    setErroSorteio('')
    executarSorteio()
  }

  function handleResortear() {
    if (confirm('Re-sortear esta modalidade? Isso vai sobrescrever o resultado atual com uma nova seed.')) {
      setErroSorteio('')
      executarSorteio()
    }
  }

  function handleApagarSorteio(sid: number) {
    if (confirm('Apagar o sorteio? A próxima execução vai gerar um novo do zero.')) {
      apagarSorteio(sid)
    }
  }

  const excludeIds = inscricoes.map(i => i.participante_id)
  const excludeCampeoesIds = campeoes.map(c => c.participante_id)

  const columns = [
    {
      header: 'Nome',
      accessor: (row: Inscricao) => {
        const pos = campeoesByParticipanteId.get(row.participante_id)
        return (
          <span className="inline-flex items-center gap-2">
            {pos && <CampeaoBadge posicao={pos} />}
            {row.participante.nome}
          </span>
        )
      },
    },
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
          onClick={() => { if (confirm(`Remover inscrição de "${row.participante.nome}"?`)) removerInscricao(row.id) }}
          className="text-[var(--danger)] hover:text-[var(--danger-700)] text-xs"
        >Remover</button>
      ),
      className: 'w-24',
    },
  ]

  const totalModalidades = modalidades.length
  const sorteadas = modalidadesSorteadasIds.size
  const pct = totalModalidades > 0 ? Math.round((sorteadas / totalModalidades) * 100) : 0

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="OPERAÇÃO"
        title={evento ? evento.nome : 'Inscrições'}
        sub={evento?.competicao?.nome}
        backTo="/eventos"
      />
      <div className="px-6 pt-4">
        <div className="flex items-center gap-3 text-xs text-[var(--t3)]">
          <span>{sorteadas} de {totalModalidades} modalidades sorteadas</span>
          <div className="flex-1 max-w-xs h-1.5 bg-[var(--card-bg-2)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--brand-500)] transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <div className="p-6 space-y-5">
        <div className="flex flex-wrap gap-2">
          {modalidades.length === 0 && (
            <p className="text-sm text-[var(--t3)]">Nenhuma modalidade nesta competição.</p>
          )}
          {modalidades.map(m => {
            const active = m.id === modalidadeId
            const sorteada = modalidadesSorteadasIds.has(m.id)
            return (
              <button
                key={m.id}
                onClick={() => { setModalidadeId(m.id); setErroSorteio('') }}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  active
                    ? 'bg-[var(--brand-500)] text-white border-[var(--brand-500)]'
                    : 'bg-[var(--card-bg-2)] text-[var(--t1)] border-[var(--card-border)] hover:border-[var(--brand-400)]'
                }`}
              >
                {m.nome} ({m.sigla})
                {sorteada && <span className={`ml-1.5 ${active ? 'text-white' : 'text-[var(--success)]'}`}>✓</span>}
              </button>
            )
          })}
        </div>

        {modalidadeId == null ? (
          <p className="text-sm text-[var(--t3)]">Selecione uma modalidade para ver os inscritos.</p>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-medium text-[var(--t2)]">
                  {inscricoes.length} {inscricoes.length === 1 ? 'inscrito' : 'inscritos'}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setImportOpen(true)}
                    className="px-3 py-2 text-sm text-[var(--t2)] hover:text-[var(--t1)] border border-[var(--card-border)] rounded-lg"
                  >Importar CSV</button>
                  <button
                    onClick={() => { setInscreverOpen(true); setPickedId(null); setErroModal('') }}
                    className="btn btn-primary"
                  >+ Inscrever</button>
                </div>
              </div>
              {loadingInscricoes ? (
                <p className="text-sm text-[var(--t3)]">Carregando...</p>
              ) : (
                <DataTable columns={columns} data={inscricoes} keyExtractor={r => r.id} emptyMessage="Nenhum inscrito nesta modalidade." />
              )}
            </div>

            <div className="border-t border-[var(--card-border)] pt-5 space-y-3">
              <h2 className="text-sm font-medium text-[var(--t2)]">Sorteio</h2>

              {tipoDaModalidade === 'especifico' ? (
                <p className="text-sm text-[var(--t3)]">Esta modalidade não possui sorteio automático.</p>
              ) : sorteioDaModalidade ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div className="text-xs text-[var(--t3)]">
                      seed: <span className="font-mono">{sorteioDaModalidade.seed}</span> · gerado em {formatDateBR(sorteioDaModalidade.gerado_em)}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={handleResortear}
                        disabled={executandoSorteio}
                        className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)] disabled:opacity-50"
                      >{executandoSorteio ? 'Sorteando...' : 'Re-sortear'}</button>
                      <button
                        onClick={() => handleApagarSorteio(sorteioDaModalidade.id)}
                        className="text-xs text-[var(--danger)] hover:text-[var(--danger-700)]"
                      >Apagar sorteio</button>
                    </div>
                  </div>
                  {sorteioDaModalidade.tipo === 'grupos' && (
                    <SorteioGrupos resultado={sorteioDaModalidade.resultado} participantesById={participantesById} campeoesByParticipanteId={campeoesByParticipanteId} />
                  )}
                  {sorteioDaModalidade.tipo === 'chaves' && (
                    <SorteioChaves resultado={sorteioDaModalidade.resultado} participantesById={participantesById} campeoesByParticipanteId={campeoesByParticipanteId} />
                  )}
                  {sorteioDaModalidade.tipo === 'ordem_entrada' && (
                    <SorteioOrdem resultado={sorteioDaModalidade.resultado} participantesById={participantesById} campeoesByParticipanteId={campeoesByParticipanteId} />
                  )}
                  {erroSorteio && <p className="text-sm text-[var(--danger)]">{erroSorteio}</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={handleSortear}
                    disabled={inscricoes.length === 0 || executandoSorteio}
                    className="btn btn-primary disabled:opacity-50"
                  >{executandoSorteio ? 'Sorteando...' : 'Sortear esta modalidade'}</button>
                  {inscricoes.length === 0 && (
                    <p className="text-xs text-[var(--t3)]">Adicione participantes antes de sortear.</p>
                  )}
                  {erroSorteio && <p className="text-sm text-[var(--danger)]">{erroSorteio}</p>}
                </div>
              )}
            </div>

            <div className="border-t border-[var(--card-border)] pt-5 space-y-3">
              <h2 className="text-sm font-medium text-[var(--t2)]">Campeões do ano anterior</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {([1, 2, 3] as const).map(pos => {
                  const c = campeoes.find(x => x.posicao === pos) ?? null
                  return (
                    <CampeaoSlot
                      key={pos}
                      posicao={pos}
                      campeao={c}
                      excludeIds={excludeCampeoesIds}
                      onCriar={(participante_id) => criarCampeao({ participante_id, posicao: pos })}
                      onRemover={(cid) => removerCampeao(cid)}
                      salvando={salvandoCampeao}
                    />
                  )
                })}
              </div>
            </div>
          </>
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

      <ImportInscricoesModal
        open={importOpen}
        eventoId={eventoId}
        modalidadeId={modalidadeId ?? 0}
        onClose={() => setImportOpen(false)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['inscricoes', eventoId, modalidadeId] })}
      />
    </div>
  )
}
```

- [ ] **Step 2: tsc + build**

De `frontend/`: `npx tsc --noEmit && npm run build`. Esperado: tsc clean, vite build OK.

- [ ] **Step 3: Commit**

```
git add frontend/src/pages/eventos/EventoInscricoes.tsx
git commit -m "feat(frontend): add campeões do ano anterior section + signal in inscrições table + pass map to sorteio renders" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Modo Congresso — carregar campeões e passar para componentes

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\congresso\CongressoStepSorteio.tsx`

**Contexto:** Adicionar query de campeões + derivação do map + passar para SorteioGrupos/Chaves/Ordem (com `large`).

- [ ] **Step 1: Substituir `CongressoStepSorteio.tsx` inteiro**

```tsx
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inscricoesService } from '../../services/inscricoes'
import { modalidadesService } from '../../services/modalidades'
import { sorteiosService } from '../../services/sorteios'
import { campeoesAnterioresService } from '../../services/campeoes-anteriores'
import SorteioGrupos from '../../components/sorteio-result/SorteioGrupos'
import SorteioChaves from '../../components/sorteio-result/SorteioChaves'
import SorteioOrdem from '../../components/sorteio-result/SorteioOrdem'
import type { Participante } from '../../types/participante'

type Props = {
  eventoId: number
  modalidadeId: number
  competicaoId: number | undefined
  onProxima: () => void
}

const FG = '#f1f5fb'
const DIM = '#94a3b8'
const DANGER = '#ef4444'

export default function CongressoStepSorteio({ eventoId, modalidadeId, competicaoId, onProxima }: Props) {
  const queryClient = useQueryClient()
  const [erro, setErro] = useState('')

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades', competicaoId],
    queryFn: () => modalidadesService.listar({ competicao_id: competicaoId! }),
    enabled: !!competicaoId,
  })
  const modalidade = modalidades.find(m => m.id === modalidadeId)
  const tipo = modalidade?.tipo_modalidade?.tipo

  const { data: sorteios = [] } = useQuery({
    queryKey: ['sorteios', eventoId],
    queryFn: () => sorteiosService.listar({ evento_id: eventoId }),
  })
  const sorteio = sorteios.find(s => s.modalidade_id === modalidadeId) ?? null

  const { data: inscricoes = [] } = useQuery({
    queryKey: ['inscricoes', eventoId, modalidadeId],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId, modalidade_id: modalidadeId }),
  })

  const { data: campeoes = [] } = useQuery({
    queryKey: ['campeoes-anteriores', eventoId, modalidadeId],
    queryFn: () => campeoesAnterioresService.listar({ evento_id: eventoId, modalidade_id: modalidadeId }),
  })

  const participantesById = useMemo(() => {
    const m = new Map<number, Participante>()
    for (const i of inscricoes) m.set(i.participante_id, i.participante)
    return m
  }, [inscricoes])

  const campeoesByParticipanteId = useMemo(() => {
    const m = new Map<number, 1 | 2 | 3>()
    for (const c of campeoes) m.set(c.participante_id, c.posicao)
    return m
  }, [campeoes])

  const { mutate: executar, isPending: executando } = useMutation({
    mutationFn: () => sorteiosService.executar({ evento_id: eventoId, modalidade_id: modalidadeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sorteios', eventoId] })
      setErro('')
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao sortear.'),
  })

  function handleSortear() {
    setErro('')
    executar()
  }

  function handleNovoSorteio() {
    if (confirm('Realizar novo sorteio? Isso vai sobrescrever o resultado atual com uma nova seed.')) {
      setErro('')
      executar()
    }
  }

  function formatDateBR(iso: string): string {
    try { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) }
    catch { return iso }
  }

  const proximaBtn = (
    <button
      onClick={onProxima}
      style={{
        background: '#1061d8',
        color: '#fff',
        border: 'none',
        borderRadius: 10,
        padding: '12px 24px',
        fontSize: 16,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >Próxima modalidade →</button>
  )

  if (tipo === 'especifico') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', gap: 16 }}>
          <div style={{ fontSize: 48 }}>📋</div>
          <h2 style={{ fontSize: 32, color: FG, fontWeight: 700 }}>{modalidade?.nome}</h2>
          <p style={{ fontSize: 20, color: DIM, maxWidth: 600 }}>
            Esta modalidade é do tipo "Específico" — sem sorteio automático.
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12 }}>{proximaBtn}</div>
      </div>
    )
  }

  if (!sorteio) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', gap: 24 }}>
          <h2 style={{ fontSize: 36, color: FG, fontWeight: 700 }}>{modalidade?.nome}</h2>
          <p style={{ fontSize: 18, color: DIM }}>
            {inscricoes.length} {inscricoes.length === 1 ? 'inscrito' : 'inscritos'}
          </p>
          <button
            onClick={handleSortear}
            disabled={executando || inscricoes.length === 0}
            style={{
              background: '#1061d8',
              color: '#fff',
              border: 'none',
              borderRadius: 14,
              padding: '20px 48px',
              fontSize: 22,
              fontWeight: 700,
              cursor: 'pointer',
              opacity: (executando || inscricoes.length === 0) ? 0.5 : 1,
            }}
          >{executando ? '🎲 Sorteando...' : '🎲 Realizar sorteio'}</button>
          {inscricoes.length === 0 && (
            <p style={{ color: DIM, fontSize: 14 }}>Adicione participantes antes de sortear.</p>
          )}
          {erro && <p style={{ color: DANGER, fontSize: 16 }}>{erro}</p>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 28, color: FG, fontWeight: 700 }}>{modalidade?.nome}</h2>
          <div style={{ fontSize: 13, color: DIM, marginTop: 4 }}>
            seed: <span style={{ fontFamily: 'monospace' }}>{sorteio.seed}</span> · gerado em {formatDateBR(sorteio.gerado_em)}
          </div>
        </div>
        <button
          onClick={handleNovoSorteio}
          disabled={executando}
          style={{
            background: 'transparent',
            color: '#1061d8',
            border: '1px solid #1061d8',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: executando ? 0.5 : 1,
          }}
        >{executando ? 'Sorteando...' : 'Novo sorteio'}</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {sorteio.tipo === 'grupos' && (
          <SorteioGrupos resultado={sorteio.resultado} participantesById={participantesById} large campeoesByParticipanteId={campeoesByParticipanteId} />
        )}
        {sorteio.tipo === 'chaves' && (
          <SorteioChaves resultado={sorteio.resultado} participantesById={participantesById} large campeoesByParticipanteId={campeoesByParticipanteId} />
        )}
        {sorteio.tipo === 'ordem_entrada' && (
          <SorteioOrdem resultado={sorteio.resultado} participantesById={participantesById} large campeoesByParticipanteId={campeoesByParticipanteId} />
        )}
        {erro && <p style={{ color: DANGER, fontSize: 16, marginTop: 12 }}>{erro}</p>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16 }}>{proximaBtn}</div>
    </div>
  )
}
```

- [ ] **Step 2: tsc + build**

De `frontend/`: `npx tsc --noEmit && npm run build`. Esperado: tsc clean, vite build OK.

- [ ] **Step 3: Commit**

```
git add frontend/src/pages/congresso/CongressoStepSorteio.tsx
git commit -m "feat(congresso): load campeões do ano anterior and pass to sorteio renders" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Bump versão + CHANGELOG

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\package.json`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\CHANGELOG.md`

- [ ] **Step 1: Bump version**

Editar `package.json` (root). Mudar **somente** `"version": "1.14.0"` para `"version": "1.15.0"`.

- [ ] **Step 2: Adicionar bloco no `CHANGELOG.md`**

Inserir o bloco abaixo logo após o cabeçalho e **antes** do bloco `## [1.14.0]`:

```md
## [1.15.0] - 2026-05-30

### Added
- Entidade CampeaoAnterior: registra os 3 primeiros colocados do ano anterior por (evento, modalidade), com FK obrigatório para Participante.
- Endpoints `/campeoes-anteriores` (GET com filtros, POST, DELETE).
- Nova seção "Campeões do ano anterior" em `/eventos/:id/inscricoes` (modalidade selecionada) com 3 slots fixos (1º/2º/3º).
- Sinalização visual com medalhas 🥇🥈🥉 em 3 lugares: tabela de inscrições, render do sorteio (F4c) e Modo Congresso (F6).
- Componente reutilizável `CampeaoBadge` (com prop `large` para Datashow).

### Notes
- Componentes de resultado de sorteio ganham prop opcional `campeoesByParticipanteId` — não quebra usos atuais.
- Substituição = DELETE + POST (sem PUT).
- Apagar Evento cascateia (remove campeões anteriores junto).
```

- [ ] **Step 3: Commit**

```
git add package.json CHANGELOG.md
git commit -m "chore(release): v1.15.0 — Campeões do ano anterior" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Push + smoke (pós-deploy CI)

**Files:** (sem edição — verificação)

- [ ] **Step 1: Push**

```
git push origin develop
```

CI roda `prisma migrate deploy` (cria tabela CampeaoAnterior + índices + FKs) e reconstrói containers. ~4-5min.

- [ ] **Step 2: Verificar deploy**

```
curl -s -o /dev/null -w "/health: %{http_code}\n" http://192.168.56.113:3000/health
curl -s -o /dev/null -w "/campeoes-anteriores (no auth): %{http_code}\n" http://192.168.56.113:3000/campeoes-anteriores
curl -s -o /dev/null -w "frontend: %{http_code}\n" http://192.168.56.113:8080/
```

Esperado: `/health 200`, `/campeoes-anteriores 401`, frontend `200`.

- [ ] **Step 3: Smoke no browser**

Abrir http://192.168.56.113:8080, login `admin@prosports.com` / `admin123`:

1. /eventos → Inscrições em algum evento → selecionar modalidade.
2. Nova seção "Campeões do ano anterior" aparece com 3 slots vazios (1º/2º/3º).
3. Slot 1º: autocompletar participante, click "Salvar" → vira "🥇 Nome do participante" + botão Remover.
4. Repetir para 2º e 3º (operador deve escolher participantes diferentes — `excludeIds` previne duplicação no dropdown).
5. Inscrever o mesmo participante (o que está como 1º) como inscrição → linha na DataTable ganha "🥇" antes do nome.
6. Realizar sorteio (tipo grupos) → resultado renderiza com 🥇 ao lado do nome do campeão.
7. Modo Congresso → step Sorteio → 🥇 aparece em fonte grande ao lado do nome.
8. Remover slot (confirm) → some, badge da inscrição também some, badge no sorteio também some.
9. Rodapé sidebar: `v1.15.0`.

- [ ] **Step 4: Reportar**

Se passou, feature fechada.

---

## Self-review

Cobertura do spec:

| Spec | Coberto por |
|---|---|
| Prisma model + back-refs + cascade evento + restrict outros | Task 1 |
| Migration manual (sem `migrate diff`) | Task 1 |
| Service (listar, criar, remover) + validação cross-FK + P2002 → 409 | Task 2 |
| Tests vitest (8 casos) | Task 2 |
| Controller Zod (posicao 1-3) + routes (GET/POST/DELETE) + wire | Task 3 |
| Tipo + service frontend + componente CampeaoBadge | Task 4 |
| Componentes de sorteio com prop opcional + render badge | Task 5 |
| EventoInscricoes: query + memo + seção 3 slots + sinalização tabela + passa map pros componentes | Task 6 |
| Congresso: query + passa map (large) | Task 7 |
| Bump 1.15.0 + CHANGELOG | Task 8 |
| Smoke pós-deploy | Task 9 |

Riscos endereçados:
- **Drift `migrate diff`**: migração manual em Task 1 (segue lição F2).
- **Reuso dos componentes large=false default + map opcional**: Task 5 mantém retro-compatibilidade total.
- **Excludeids previne duplicar participante entre slots no UI**: Task 6 (excludeCampeoesIds).
- **Apagar Modalidade/Participante com campeão**: 500 (FK violation), igual ao Inscricao. Aceito, documentado no spec.
- **`CongressoStepParticipantes` sem badge**: decisão de spec — opcional, deixei fora pra reduzir escopo. Se quiser adicionar depois, é uma query + map num só lugar.
