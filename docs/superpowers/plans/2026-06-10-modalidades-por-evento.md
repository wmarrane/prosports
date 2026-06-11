# Modalidades por evento (participação/exclusão) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que um evento não adote todas as modalidades herdadas da competição, via um modelo por exclusão (padrão = todas participam), com um painel dedicado e a exclusão respeitada em todas as saídas do evento.

**Architecture:** Nova tabela `EventoModalidadeExcluida` (presença = excluída). Um helper backend é a fonte única de "modalidades do evento" (competição menos excluídas); todas as saídas server-side (lista de eventos/contadores, key-access, site público, relatório) passam por ele. Um endpoint `GET /eventos/:id/modalidades` (filtrado) alimenta as telas de evento do front. Endpoints GET/PUT de exclusões (com guardrail que bloqueia excluir modalidade com inscritos/sorteio) e um painel "Modalidades do evento" em EventoInscricoes.

**Tech Stack:** Node/Express, Prisma/PostgreSQL, Vitest (mock de prisma via `vi.mock`); React 18 + TS + Vite, react-query, Vitest (sem jsdom; `renderToStaticMarkup`/funções puras). Spec: `docs/superpowers/specs/2026-06-10-modalidades-por-evento-design.md`.

---

## File Structure

**Backend**
- `backend/prisma/schema.prisma` — model `EventoModalidadeExcluida` + back-relations.
- `backend/prisma/migrations/20260610000000_add_evento_modalidade_excluida/migration.sql` (novo) — cria a tabela.
- `backend/src/modules/eventos/evento-modalidades.service.ts` (novo) — helper `getModalidadeIdsExcluidas`, `modalidadesDoEvento`.
- `backend/src/modules/eventos/modalidades-excluidas.service.ts` (novo) — `getExcluidas`, `setExcluidas` (com guardrail).
- `backend/src/modules/eventos/modalidades-excluidas.controller.ts` (novo) — handlers GET/PUT excluídas + GET modalidades filtradas.
- `backend/src/modules/eventos/eventos.routes.ts` — registra as 3 rotas.
- `backend/src/modules/eventos/eventos.service.ts` — `listar` aplica exclusão e adiciona `modalidades_pendentes`.
- `backend/src/modules/key_access/key_access.service.ts` — `getModalidades` filtra excluídas.
- `backend/src/modules/site-publico/site-publico.service.ts` — `publicar` filtra excluídas.
- `backend/src/modules/relatorios/relatorio_congresso.service.ts` — `loadEventoComModalidades` filtra excluídas.

**Frontend**
- `frontend/src/services/eventos.ts` — `getModalidadesExcluidas`, `setModalidadesExcluidas`, `getModalidadesDoEvento`.
- `frontend/src/types/evento.ts` — adiciona `modalidades_pendentes?: number`.
- `frontend/src/pages/eventos/ModalidadesDoEventoModal.tsx` (novo) — painel de seleção.
- `frontend/src/pages/eventos/EventoInscricoes.tsx` — botão do painel + sidebar/contador usam modalidades filtradas.
- `frontend/src/pages/congresso/CongressoStepModalidade.tsx` e `ModoCongresso.tsx` — usam modalidades filtradas.
- `frontend/src/pages/Painel.tsx` — pendentes via `modalidades_pendentes` do servidor.

---

## Task 1: Modelo + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260610000000_add_evento_modalidade_excluida/migration.sql`

- [ ] **Step 1: Adicionar o model e back-relations no schema**

Em `backend/prisma/schema.prisma`, adicionar ao final do model `Evento` (depois da linha `anfitriao_ordem EventoModalidadeAnfitriao[]`, antes de `criado_em`):

```prisma
  modalidades_excluidas EventoModalidadeExcluida[]
```

Adicionar ao final do model `Modalidade` (depois da linha `anfitriao_ordem     EventoModalidadeAnfitriao[]`, antes de `criado_em`):

```prisma
  modalidades_excluidas EventoModalidadeExcluida[]
```

Adicionar o novo model logo após o model `EventoModalidadeAnfitriao` (final do arquivo):

```prisma
model EventoModalidadeExcluida {
  id            Int        @id @default(autoincrement())
  evento        Evento     @relation(fields: [evento_id], references: [id], onDelete: Cascade)
  evento_id     Int
  modalidade    Modalidade @relation(fields: [modalidade_id], references: [id], onDelete: Cascade)
  modalidade_id Int

  @@unique([evento_id, modalidade_id])
  @@index([evento_id])
  @@map("evento_modalidade_excluida")
}
```

- [ ] **Step 2: Criar a migration SQL manual**

Criar `backend/prisma/migrations/20260610000000_add_evento_modalidade_excluida/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "evento_modalidade_excluida" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "modalidade_id" INTEGER NOT NULL,
    CONSTRAINT "evento_modalidade_excluida_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evento_modalidade_excluida_evento_id_modalidade_id_key" ON "evento_modalidade_excluida"("evento_id", "modalidade_id");
CREATE INDEX "evento_modalidade_excluida_evento_id_idx" ON "evento_modalidade_excluida"("evento_id");

-- AddForeignKey
ALTER TABLE "evento_modalidade_excluida" ADD CONSTRAINT "evento_modalidade_excluida_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evento_modalidade_excluida" ADD CONSTRAINT "evento_modalidade_excluida_modalidade_id_fkey" FOREIGN KEY ("modalidade_id") REFERENCES "Modalidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Gerar o Prisma Client e validar**

Run: `cd backend && npx prisma generate`
Expected: "Generated Prisma Client" sem erros.

Run: `cd backend && npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid".

NÃO rodar `prisma migrate dev` (banco dev compartilhado; o projeto usa migrations manuais; o `migrate deploy` roda no CI).

- [ ] **Step 4: Build do backend**

Run: `cd backend && npm run build`
Expected: `tsc` sem erros (o novo model fica disponível no client).

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260610000000_add_evento_modalidade_excluida
git commit -m "feat(db): tabela EventoModalidadeExcluida (modalidades por evento)"
```

---

## Task 2: Helper "modalidades do evento" (fonte única)

**Files:**
- Create: `backend/src/modules/eventos/evento-modalidades.service.ts`
- Test: `backend/src/modules/eventos/evento-modalidades.service.test.ts`

- [ ] **Step 1: Escrever os testes (mock de prisma)**

Criar `backend/src/modules/eventos/evento-modalidades.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    eventoModalidadeExcluida: { findMany: vi.fn() },
    evento: { findUnique: vi.fn() },
    modalidade: { findMany: vi.fn() },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './evento-modalidades.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('getModalidadeIdsExcluidas', () => {
  it('retorna Set dos modalidade_id excluidos do evento', async () => {
    mockPrisma.eventoModalidadeExcluida.findMany.mockResolvedValue([
      { modalidade_id: 2 }, { modalidade_id: 5 },
    ])
    const set = await service.getModalidadeIdsExcluidas(10)
    expect(mockPrisma.eventoModalidadeExcluida.findMany).toHaveBeenCalledWith({
      where: { evento_id: 10 },
      select: { modalidade_id: true },
    })
    expect([...set].sort()).toEqual([2, 5])
  })
})

describe('modalidadesDoEvento', () => {
  it('retorna modalidades da competicao menos as excluidas', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 10, competicao_id: 7 })
    mockPrisma.modalidade.findMany.mockResolvedValue([
      { id: 1, nome: 'A' }, { id: 2, nome: 'B' }, { id: 3, nome: 'C' },
    ])
    mockPrisma.eventoModalidadeExcluida.findMany.mockResolvedValue([{ modalidade_id: 2 }])
    const mods = await service.modalidadesDoEvento(10)
    expect(mods.map((m: any) => m.id)).toEqual([1, 3])
  })

  it('404 quando evento nao existe', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue(null)
    await expect(service.modalidadesDoEvento(99)).rejects.toMatchObject({ status: 404 })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/modules/eventos/evento-modalidades.service.test.ts`
Expected: FAIL — módulo `./evento-modalidades.service` não existe.

- [ ] **Step 3: Implementar o helper**

Criar `backend/src/modules/eventos/evento-modalidades.service.ts`:

```ts
import prisma from '../../lib/prisma'

export async function getModalidadeIdsExcluidas(evento_id: number): Promise<Set<number>> {
  const rows = await prisma.eventoModalidadeExcluida.findMany({
    where: { evento_id },
    select: { modalidade_id: true },
  })
  return new Set(rows.map(r => r.modalidade_id))
}

const MOD_INCLUDE = { competicao: true, tipo_modalidade: true } as const

// Modalidades da competição do evento, menos as excluídas. Fonte única do
// conceito "modalidades do evento".
export async function modalidadesDoEvento(evento_id: number) {
  const evento = await prisma.evento.findUnique({
    where: { id: evento_id },
    select: { competicao_id: true },
  })
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })

  const [modalidades, excluidas] = await Promise.all([
    prisma.modalidade.findMany({
      where: { competicao_id: evento.competicao_id },
      orderBy: { nome: 'asc' },
      include: MOD_INCLUDE,
    }),
    getModalidadeIdsExcluidas(evento_id),
  ])
  return modalidades.filter(m => !excluidas.has(m.id))
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run src/modules/eventos/evento-modalidades.service.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/eventos/evento-modalidades.service.ts backend/src/modules/eventos/evento-modalidades.service.test.ts
git commit -m "feat(eventos): helper modalidadesDoEvento (competição menos excluídas)"
```

---

## Task 3: Endpoints de exclusões + modalidades filtradas (com guardrail)

**Files:**
- Create: `backend/src/modules/eventos/modalidades-excluidas.service.ts`
- Create: `backend/src/modules/eventos/modalidades-excluidas.controller.ts`
- Modify: `backend/src/modules/eventos/eventos.routes.ts`
- Test: `backend/src/modules/eventos/modalidades-excluidas.service.test.ts`

- [ ] **Step 1: Escrever os testes do service (guardrail)**

Criar `backend/src/modules/eventos/modalidades-excluidas.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    evento: { findUnique: vi.fn() },
    modalidade: { findMany: vi.fn() },
    inscricao: { findMany: vi.fn() },
    sorteio: { findMany: vi.fn() },
    eventoModalidadeExcluida: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
  },
}))

import prisma from '../../lib/prisma'
import * as service from './modalidades-excluidas.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('getExcluidas', () => {
  it('retorna array de modalidade_id excluidos', async () => {
    mockPrisma.eventoModalidadeExcluida.findMany.mockResolvedValue([{ modalidade_id: 3 }, { modalidade_id: 4 }])
    expect(await service.getExcluidas(1)).toEqual([3, 4])
  })
})

describe('setExcluidas', () => {
  beforeEach(() => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 7 })
    mockPrisma.modalidade.findMany.mockResolvedValue([{ id: 2 }, { id: 3 }, { id: 4 }])
    mockPrisma.inscricao.findMany.mockResolvedValue([])
    mockPrisma.sorteio.findMany.mockResolvedValue([])
  })

  it('substitui o conjunto quando nao ha dados', async () => {
    await service.setExcluidas(1, [2, 3])
    expect(mockPrisma.eventoModalidadeExcluida.deleteMany).toHaveBeenCalledWith({ where: { evento_id: 1 } })
    expect(mockPrisma.eventoModalidadeExcluida.createMany).toHaveBeenCalledWith({
      data: [
        { evento_id: 1, modalidade_id: 2 },
        { evento_id: 1, modalidade_id: 3 },
      ],
    })
  })

  it('conjunto vazio limpa todas as exclusoes', async () => {
    await service.setExcluidas(1, [])
    expect(mockPrisma.eventoModalidadeExcluida.deleteMany).toHaveBeenCalledWith({ where: { evento_id: 1 } })
    expect(mockPrisma.eventoModalidadeExcluida.createMany).not.toHaveBeenCalled()
  })

  it('400 quando id nao pertence a competicao', async () => {
    await expect(service.setExcluidas(1, [999])).rejects.toMatchObject({ status: 400 })
    expect(mockPrisma.eventoModalidadeExcluida.deleteMany).not.toHaveBeenCalled()
  })

  it('400 quando modalidade a excluir tem inscritos', async () => {
    mockPrisma.inscricao.findMany.mockResolvedValue([{ modalidade_id: 2 }])
    await expect(service.setExcluidas(1, [2])).rejects.toMatchObject({ status: 400 })
    expect(mockPrisma.eventoModalidadeExcluida.deleteMany).not.toHaveBeenCalled()
  })

  it('400 quando modalidade a excluir tem sorteio', async () => {
    mockPrisma.sorteio.findMany.mockResolvedValue([{ modalidade_id: 3 }])
    await expect(service.setExcluidas(1, [3])).rejects.toMatchObject({ status: 400 })
  })

  it('404 quando evento nao existe', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue(null)
    await expect(service.setExcluidas(1, [2])).rejects.toMatchObject({ status: 404 })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/modules/eventos/modalidades-excluidas.service.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o service**

Criar `backend/src/modules/eventos/modalidades-excluidas.service.ts`:

```ts
import prisma from '../../lib/prisma'

export async function getExcluidas(evento_id: number): Promise<number[]> {
  const rows = await prisma.eventoModalidadeExcluida.findMany({
    where: { evento_id },
    select: { modalidade_id: true },
  })
  return rows.map(r => r.modalidade_id)
}

// Substitui o conjunto de modalidades excluídas do evento.
// Guardrail: não permite excluir modalidade que tenha inscritos ou sorteio
// nesse evento. Valida que os ids pertencem à competição do evento.
export async function setExcluidas(evento_id: number, ids: number[]): Promise<{ excluidas: number[] }> {
  const evento = await prisma.evento.findUnique({
    where: { id: evento_id },
    select: { competicao_id: true },
  })
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })

  const unicos = [...new Set(ids)]

  if (unicos.length > 0) {
    const daCompeticao = await prisma.modalidade.findMany({
      where: { competicao_id: evento.competicao_id, id: { in: unicos } },
      select: { id: true },
    })
    const validos = new Set(daCompeticao.map(m => m.id))
    const invalidos = unicos.filter(id => !validos.has(id))
    if (invalidos.length > 0) {
      throw Object.assign(
        new Error(`Modalidade(s) fora desta competição: ${invalidos.join(', ')}.`),
        { status: 400 },
      )
    }

    const [comInscritos, comSorteio] = await Promise.all([
      prisma.inscricao.findMany({
        where: { evento_id, modalidade_id: { in: unicos } },
        distinct: ['modalidade_id'],
        select: { modalidade_id: true },
      }),
      prisma.sorteio.findMany({
        where: { evento_id, modalidade_id: { in: unicos } },
        select: { modalidade_id: true },
      }),
    ])
    const bloqueados = new Set<number>([
      ...comInscritos.map(x => x.modalidade_id),
      ...comSorteio.map(x => x.modalidade_id),
    ])
    if (bloqueados.size > 0) {
      throw Object.assign(
        new Error(`Não é possível remover modalidade(s) com inscritos ou sorteio: ${[...bloqueados].join(', ')}. Apague os dados antes.`),
        { status: 400, modalidades_bloqueadas: [...bloqueados] },
      )
    }
  }

  await prisma.$transaction([
    prisma.eventoModalidadeExcluida.deleteMany({ where: { evento_id } }),
    ...(unicos.length > 0
      ? [prisma.eventoModalidadeExcluida.createMany({
          data: unicos.map(modalidade_id => ({ evento_id, modalidade_id })),
        })]
      : []),
  ])

  return { excluidas: unicos }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run src/modules/eventos/modalidades-excluidas.service.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Implementar o controller**

Criar `backend/src/modules/eventos/modalidades-excluidas.controller.ts`:

```ts
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './modalidades-excluidas.service'
import { modalidadesDoEvento } from './evento-modalidades.service'

const setSchema = z.object({
  excluidas: z.array(z.number().int().positive()),
})

export async function getExcluidas(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.getExcluidas(Number(req.params.id)))
  } catch (err) { next(err) }
}

export async function setExcluidas(req: Request, res: Response, next: NextFunction) {
  try {
    const body = setSchema.parse(req.body)
    res.json(await service.setExcluidas(Number(req.params.id), body.excluidas))
  } catch (err) { next(err) }
}

export async function getModalidadesDoEvento(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await modalidadesDoEvento(Number(req.params.id)))
  } catch (err) { next(err) }
}
```

- [ ] **Step 6: Registrar as rotas**

Em `backend/src/modules/eventos/eventos.routes.ts`, adicionar o import (junto aos outros, após a linha `import * as anfitriaoOrdem from './anfitriao-ordem.controller'`):

```ts
import * as modalidadesExcluidas from './modalidades-excluidas.controller'
```

E adicionar as rotas logo após as rotas de `anfitriao-ordem` (após a linha `router.put('/:id/anfitriao-ordem', ...admin, anfitriaoOrdem.setAnfitriaoOrdem)`):

```ts
router.get('/:id/modalidades', requireAuth, modalidadesExcluidas.getModalidadesDoEvento)
router.get('/:id/modalidades-excluidas', requireAuth, modalidadesExcluidas.getExcluidas)
router.put('/:id/modalidades-excluidas', ...admin, modalidadesExcluidas.setExcluidas)
```

- [ ] **Step 7: Build**

Run: `cd backend && npm run build`
Expected: `tsc` sem erros.

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/eventos/modalidades-excluidas.service.ts backend/src/modules/eventos/modalidades-excluidas.service.test.ts backend/src/modules/eventos/modalidades-excluidas.controller.ts backend/src/modules/eventos/eventos.routes.ts
git commit -m "feat(eventos): endpoints de modalidades excluídas + modalidades filtradas (guardrail)"
```

---

## Task 4: Aplicar exclusão nas saídas server-side

**Files:**
- Modify: `backend/src/modules/eventos/eventos.service.ts`
- Test: `backend/src/modules/eventos/eventos.service.test.ts`
- Modify: `backend/src/modules/key_access/key_access.service.ts`
- Modify: `backend/src/modules/site-publico/site-publico.service.ts`
- Modify: `backend/src/modules/relatorios/relatorio_congresso.service.ts`

- [ ] **Step 1: eventos.service — adicionar exclusão e `modalidades_pendentes`**

Em `backend/src/modules/eventos/eventos.service.ts`, dentro de `listar`, depois do bloco que monta `sorteadasByEvento` (após o `for (const s of sorteios) { ... }`), adicionar a busca de exclusões:

```ts
  const exclusoes = await prisma.eventoModalidadeExcluida.findMany({
    where: { evento_id: { in: eventIds } },
    select: { evento_id: true, modalidade_id: true },
  })
  const excludedByEvento: Record<number, Set<number>> = {}
  for (const x of exclusoes) {
    ;(excludedByEvento[x.evento_id] ??= new Set()).add(x.modalidade_id)
  }
```

E substituir o `return eventos.map(...)` final por:

```ts
  return eventos.map(e => {
    const counts = countsByEvento[e.id] ?? {}
    const sorteadas = sorteadasByEvento[e.id] ?? new Set<number>()
    const excluidas = excludedByEvento[e.id] ?? new Set<number>()
    const sorteaveisIds = new Set<number>()
    let pendentes = 0
    for (const m of (e as any).competicao?.modalidades ?? []) {
      if (excluidas.has(m.id)) continue
      if (sorteadas.has(m.id)) sorteaveisIds.add(m.id)
      const sorteavel = isSorteavel(
        { tipo: m.tipo_modalidade.tipo, mensagens_inscritos: m.mensagens_inscritos },
        counts[m.id] ?? 0,
      )
      if (sorteavel) {
        sorteaveisIds.add(m.id)
        if (!sorteadas.has(m.id)) pendentes++
      }
    }
    return { ...e, modalidades_sorteaveis: sorteaveisIds.size, modalidades_pendentes: pendentes }
  })
```

- [ ] **Step 2: Atualizar o mock e adicionar teste em eventos.service.test.ts**

Em `backend/src/modules/eventos/eventos.service.test.ts`, no `vi.mock('../../lib/prisma', ...)`, adicionar o model ao objeto `default` (após `sorteio: { findMany: vi.fn() },`):

```ts
    eventoModalidadeExcluida: { findMany: vi.fn() },
```

E adicionar este teste dentro do `describe('eventos.service', ...)`:

```ts
  it('listar exclui modalidades excluidas do contador e calcula pendentes', async () => {
    mockPrisma.evento.findMany.mockResolvedValue([
      { id: 1, competicao: { modalidades: [
        { id: 10, mensagens_inscritos: [], tipo_modalidade: { tipo: 'grupos' } },
        { id: 11, mensagens_inscritos: [], tipo_modalidade: { tipo: 'grupos' } },
        { id: 12, mensagens_inscritos: [], tipo_modalidade: { tipo: 'grupos' } },
      ] } },
    ])
    mockPrisma.inscricao.groupBy.mockResolvedValue([
      { evento_id: 1, modalidade_id: 10, _count: { _all: 4 } },
      { evento_id: 1, modalidade_id: 11, _count: { _all: 4 } },
      { evento_id: 1, modalidade_id: 12, _count: { _all: 4 } },
    ])
    mockPrisma.sorteio.findMany.mockResolvedValue([
      { evento_id: 1, modalidade_id: 10 },
    ])
    mockPrisma.eventoModalidadeExcluida.findMany.mockResolvedValue([
      { evento_id: 1, modalidade_id: 12 },
    ])
    const [e] = await service.listar() as any[]
    // 10 sorteada + 11 sorteável (pendente); 12 excluída e fora da conta
    expect(e.modalidades_sorteaveis).toBe(2)
    expect(e.modalidades_pendentes).toBe(1)
  })
```

- [ ] **Step 3: Rodar os testes de eventos.service**

Run: `cd backend && npx vitest run src/modules/eventos/eventos.service.test.ts`
Expected: PASS (testes existentes + o novo).

- [ ] **Step 4: key_access.getModalidades — filtrar excluídas**

Em `backend/src/modules/key_access/key_access.service.ts`, adicionar o import no topo (após `import { signKeyToken } from '../../lib/key-jwt'`):

```ts
import { getModalidadeIdsExcluidas } from '../eventos/evento-modalidades.service'
```

E em `getModalidades`, substituir o `Promise.all([...])` por uma versão que também carrega as exclusões, e filtrar o retorno. Trocar:

```ts
  const [modalidades, counts] = await Promise.all([
    prisma.modalidade.findMany({
      where: { competicao_id: evento.competicao_id },
      orderBy: { nome: 'asc' },
      include: { tipo_modalidade: { select: { tipo: true } } },
    }),
    prisma.inscricao.groupBy({
      by: ['modalidade_id'],
      where: { evento_id: evento.id },
      _count: { _all: true },
    }),
  ])

  const countMap = new Map(counts.map((c) => [c.modalidade_id, c._count._all]))
  return modalidades.map((m) => ({
    ...m,
    inscritos_count: countMap.get(m.id) ?? 0,
  }))
```

por:

```ts
  const [modalidades, counts, excluidas] = await Promise.all([
    prisma.modalidade.findMany({
      where: { competicao_id: evento.competicao_id },
      orderBy: { nome: 'asc' },
      include: { tipo_modalidade: { select: { tipo: true } } },
    }),
    prisma.inscricao.groupBy({
      by: ['modalidade_id'],
      where: { evento_id: evento.id },
      _count: { _all: true },
    }),
    getModalidadeIdsExcluidas(evento.id),
  ])

  const countMap = new Map(counts.map((c) => [c.modalidade_id, c._count._all]))
  return modalidades
    .filter((m) => !excluidas.has(m.id))
    .map((m) => ({
      ...m,
      inscritos_count: countMap.get(m.id) ?? 0,
    }))
```

- [ ] **Step 5: site-publico.publicar — filtrar excluídas**

Em `backend/src/modules/site-publico/site-publico.service.ts`, adicionar o import no topo (após a linha `import { composeSubtituloLine, type CampoSubtitulo } from '../../lib/compose-subtitulo'`):

```ts
import { getModalidadeIdsExcluidas } from '../eventos/evento-modalidades.service'
```

E em `publicar`, logo após o bloco `const modalidades = await prisma.modalidade.findMany({ ... })`, filtrar:

```ts
  const excluidasIds = await getModalidadeIdsExcluidas(eventoId)
  const modalidadesFiltradas = modalidades.filter(m => !excluidasIds.has(m.id))
```

E na chamada de `montaSnapshot({ ... })`, trocar `modalidades,` por `modalidades: modalidadesFiltradas,`.

- [ ] **Step 6: relatorio_congresso — filtrar excluídas**

Em `backend/src/modules/relatorios/relatorio_congresso.service.ts`, adicionar o import no topo (após `import { aplicarEstilo, aplicarBordas, aplicarBordaExterna, COR } from './xlsx-style'`):

```ts
import { getModalidadeIdsExcluidas } from '../eventos/evento-modalidades.service'
```

E em `loadEventoComModalidades`, trocar:

```ts
  const modalidades = evento.competicao?.modalidades ?? []
  return { evento, modalidades }
```

por:

```ts
  const excluidasIds = await getModalidadeIdsExcluidas(evento_id)
  const modalidades = (evento.competicao?.modalidades ?? []).filter(m => !excluidasIds.has(m.id))
  return { evento, modalidades }
```

- [ ] **Step 7: Build + suite backend**

Run: `cd backend && npm run build`
Expected: `tsc` sem erros.

Run: `cd backend && npx vitest run`
Expected: toda a suíte passa (incluindo os novos testes).

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/eventos/eventos.service.ts backend/src/modules/eventos/eventos.service.test.ts backend/src/modules/key_access/key_access.service.ts backend/src/modules/site-publico/site-publico.service.ts backend/src/modules/relatorios/relatorio_congresso.service.ts
git commit -m "feat(eventos): respeitar modalidades excluídas em contadores, mobile, site público e relatório"
```

---

## Task 5: Frontend — serviço + tipo

**Files:**
- Modify: `frontend/src/services/eventos.ts`
- Modify: `frontend/src/types/evento.ts`

- [ ] **Step 1: Adicionar métodos no eventosService**

Em `frontend/src/services/eventos.ts`, adicionar o import do tipo `Modalidade` no topo (após `import type { Evento } from '../types/evento'`):

```ts
import type { Modalidade } from '../types/modalidade'
```

E adicionar, dentro do objeto `eventosService` (após `setAnfitriaoOrdem: ...`):

```ts
  getModalidadesDoEvento: (eventoId: number) =>
    api.get<Modalidade[]>(`${BASE}/${eventoId}/modalidades`).then(r => r.data),
  getModalidadesExcluidas: (eventoId: number) =>
    api.get<number[]>(`${BASE}/${eventoId}/modalidades-excluidas`).then(r => r.data),
  setModalidadesExcluidas: (eventoId: number, excluidas: number[]) =>
    api.put<{ excluidas: number[] }>(`${BASE}/${eventoId}/modalidades-excluidas`, { excluidas }).then(r => r.data),
```

- [ ] **Step 2: Adicionar `modalidades_pendentes` ao tipo Evento**

Em `frontend/src/types/evento.ts`, localizar o campo `modalidades_sorteaveis?: number` (se existir) e adicionar logo abaixo:

```ts
  modalidades_pendentes?: number
```

Se `modalidades_sorteaveis?: number` não existir no tipo, adicionar ambos os campos opcionais no mesmo nível dos demais campos do tipo `Evento`:

```ts
  modalidades_sorteaveis?: number
  modalidades_pendentes?: number
```

- [ ] **Step 3: Verificar tipos**

Run: `cd frontend && npx tsc -b`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/eventos.ts frontend/src/types/evento.ts
git commit -m "feat(eventos): serviço de modalidades do evento/excluídas + campo modalidades_pendentes"
```

---

## Task 6: Painel "Modalidades do evento" (UI)

**Files:**
- Create: `frontend/src/pages/eventos/ModalidadesDoEventoModal.tsx`
- Modify: `frontend/src/pages/eventos/EventoInscricoes.tsx`

- [ ] **Step 1: Criar o modal**

Criar `frontend/src/pages/eventos/ModalidadesDoEventoModal.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { modalidadesService } from '../../services/modalidades'
import { eventosService } from '../../services/eventos'
import { sorteiosService } from '../../services/sorteios'
import { inscricoesService } from '../../services/inscricoes'
import { useToast } from '../../components/Toast'
import { X, Check } from 'lucide-react'

type Props = {
  open: boolean
  eventoId: number
  competicaoId: number
  onClose: () => void
}

export default function ModalidadesDoEventoModal({ open, eventoId, competicaoId, onClose }: Props) {
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades', competicaoId],
    queryFn: () => modalidadesService.listar({ competicao_id: competicaoId }),
    enabled: open,
  })
  const { data: excluidas = [] } = useQuery({
    queryKey: ['modalidades-excluidas', eventoId],
    queryFn: () => eventosService.getModalidadesExcluidas(eventoId),
    enabled: open,
  })
  const { data: counts = {} } = useQuery({
    queryKey: ['inscricoes-counts', eventoId],
    queryFn: () => inscricoesService.counts(eventoId),
    enabled: open,
  })
  const { data: sorteios = [] } = useQuery({
    queryKey: ['sorteios', eventoId],
    queryFn: () => sorteiosService.listar({ evento_id: eventoId }),
    enabled: open,
  })

  // participa = true quando NÃO está em "excluidas"
  const [participa, setParticipa] = useState<Record<number, boolean>>({})
  useEffect(() => {
    if (!open) return
    const excl = new Set(excluidas)
    const map: Record<number, boolean> = {}
    for (const m of modalidades) map[m.id] = !excl.has(m.id)
    setParticipa(map)
  }, [open, modalidades, excluidas])

  const sorteadasIds = new Set(sorteios.map(s => s.modalidade_id))
  function temDados(id: number): boolean {
    return (counts as Record<number, number>)[id] > 0 || sorteadasIds.has(id)
  }

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      const ids = modalidades.filter(m => !participa[m.id]).map(m => m.id)
      return eventosService.setModalidadesExcluidas(eventoId, ids)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modalidades-excluidas', eventoId] })
      queryClient.invalidateQueries({ queryKey: ['evento-modalidades', eventoId] })
      queryClient.invalidateQueries({ queryKey: ['eventos'] })
      toast.success('Modalidades do evento atualizadas.')
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao salvar modalidades.'),
  })

  if (!open) return null

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 320 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-2xl)', padding: 28, maxWidth: 560, width: '100%', margin: '0 16px', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="sec-title mb-2" style={{ fontSize: 'clamp(18px, 2vw, 24px)' }}>Modalidades do evento</h3>
        <p className="text-sm text-[var(--t3)] mb-4">
          Desmarque as modalidades que <b>não</b> participam deste evento. Modalidades com inscritos ou sorteio não podem ser removidas.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {modalidades.map(m => {
            const travada = temDados(m.id)
            const checked = participa[m.id] ?? true
            return (
              <label
                key={m.id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--card-bg-2)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-lg)', opacity: travada ? 0.7 : 1, cursor: travada ? 'not-allowed' : 'pointer' }}
                title={travada ? 'Possui inscritos/sorteio — apague antes de remover' : ''}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={travada}
                  onChange={e => setParticipa(p => ({ ...p, [m.id]: e.target.checked }))}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--t1)' }}>{m.nome}</div>
                  <div className="text-[var(--t4)]" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>{m.sigla}</div>
                </div>
                {travada && <span className="text-[var(--t4)]" style={{ fontSize: 11 }}>tem dados</span>}
              </label>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} className="btn btn-ghost"><X size={16} /> Cancelar</button>
          <button onClick={() => salvar()} disabled={isPending} className="btn btn-primary">
            <Check size={16} /> {isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Montar o modal + botão em EventoInscricoes**

Em `frontend/src/pages/eventos/EventoInscricoes.tsx`, adicionar o import (após `import SorteioPrint, { SorteioPrintContent, SorteioPrintHeader } from './SorteioPrint'`):

```tsx
import ModalidadesDoEventoModal from './ModalidadesDoEventoModal'
```

Adicionar estado logo após `const [exportandoHtml, setExportandoHtml] = useState(false)`:

```tsx
  const [modalidadesModalOpen, setModalidadesModalOpen] = useState(false)
```

Adicionar o botão no banner, imediatamente após o botão "Editar evento":

```tsx
              <button
                onClick={() => setModalidadesModalOpen(true)}
                className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)] font-semibold ml-2"
              >
                Modalidades do evento
              </button>
```

Montar o modal logo antes do fechamento final do componente (antes do `<style>{` responsivo no final do JSX, dentro do return):

```tsx
      {evento && (
        <ModalidadesDoEventoModal
          open={modalidadesModalOpen}
          eventoId={eventoId}
          competicaoId={evento.competicao_id}
          onClose={() => setModalidadesModalOpen(false)}
        />
      )}
```

- [ ] **Step 3: Verificar tipos e build**

Run: `cd frontend && npx tsc -b`
Expected: sem erros.

Run: `cd frontend && npm run build`
Expected: conclui sem erros.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/eventos/ModalidadesDoEventoModal.tsx frontend/src/pages/eventos/EventoInscricoes.tsx
git commit -m "feat(ui): painel Modalidades do evento (marca/desmarca participação)"
```

---

## Task 7: Telas de evento consomem modalidades filtradas

**Files:**
- Modify: `frontend/src/pages/eventos/EventoInscricoes.tsx`
- Modify: `frontend/src/pages/congresso/CongressoStepModalidade.tsx`
- Modify: `frontend/src/pages/congresso/ModoCongresso.tsx`
- Modify: `frontend/src/pages/Painel.tsx`

- [ ] **Step 1: EventoInscricoes — sidebar/contador usam modalidades do evento (filtradas)**

Em `frontend/src/pages/eventos/EventoInscricoes.tsx`, localizar a query de modalidades:

```tsx
  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades', evento?.competicao_id],
    queryFn: () => modalidadesService.listar({ competicao_id: evento!.competicao_id }),
    enabled: !!evento,
  })
```

e trocar por (passa a trazer só as participantes do evento):

```tsx
  const { data: modalidades = [] } = useQuery({
    queryKey: ['evento-modalidades', eventoId],
    queryFn: () => eventosService.getModalidadesDoEvento(eventoId),
    enabled: !!evento,
  })
```

(O `modalidadesService` continua importado por causa de outros usos; se o linter acusar import não usado, remover apenas se não houver mais referências.)

- [ ] **Step 2: CongressoStepModalidade — usar modalidades do evento**

Em `frontend/src/pages/congresso/CongressoStepModalidade.tsx`, trocar a query:

```tsx
  const { data: modalidades = [], isLoading } = useQuery({
    queryKey: ['modalidades', evento?.competicao_id],
    queryFn: () => modalidadesService.listar({ competicao_id: evento!.competicao_id }),
    enabled: !!evento,
  })
```

por:

```tsx
  const { data: modalidades = [], isLoading } = useQuery({
    queryKey: ['evento-modalidades', eventoId],
    queryFn: () => eventosService.getModalidadesDoEvento(eventoId),
    enabled: !!evento,
  })
```

(`eventosService` já está importado neste arquivo. Se `modalidadesService` ficar sem uso, remover o import.)

- [ ] **Step 3: ModoCongresso — usar modalidades do evento**

Em `frontend/src/pages/congresso/ModoCongresso.tsx`, trocar a query:

```tsx
  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades', competicaoId],
    queryFn: () => modalidadesService.listar({ competicao_id: competicaoId! }),
    enabled: !!competicaoId,
  })
```

por (usa o eventoId, já em escopo):

```tsx
  const { data: modalidades = [] } = useQuery({
    queryKey: ['evento-modalidades', eventoId],
    queryFn: () => eventosService.getModalidadesDoEvento(eventoId!),
    enabled: eventoId != null,
  })
```

(`eventosService` já está importado. Se `modalidadesService` ficar sem uso, remover o import.)

- [ ] **Step 4: Painel — pendentes via `modalidades_pendentes` do servidor**

Em `frontend/src/pages/Painel.tsx`, substituir o cálculo client-side de `proximos` (o bloco `const proximos = useMemo(() => { ... }, [...])`) por:

```tsx
  const proximos = useMemo(() => {
    return eventosAtivos
      .map(e => ({ evento: e, pendentes: e.modalidades_pendentes ?? 0 }))
      .filter(p => p.pendentes > 0)
      .sort((a, b) => new Date(a.evento.data_hora).getTime() - new Date(b.evento.data_hora).getTime())
  }, [eventosAtivos])
```

Remover, se ficarem sem uso após essa troca, as queries/variáveis `modalidades`, `sorteios` e `countsByEvento`/`countsQueries` **apenas se** não forem usadas em outro ponto do arquivo. Verificar com `npx tsc -b` (variáveis não usadas viram erro no build do projeto). Se forem usadas em outro lugar, manter.

- [ ] **Step 5: Verificar tipos e build**

Run: `cd frontend && npx tsc -b`
Expected: sem erros (resolver imports/variáveis não usados que o build acusar).

Run: `cd frontend && npm run build`
Expected: conclui sem erros.

- [ ] **Step 6: Verificação manual**

`cd frontend && npm run dev` (backend rodando, banco dev com a migration aplicada):
- Abrir um evento → "Modalidades do evento" → desmarcar uma modalidade sem dados → Salvar.
- Conferir que ela some da barra lateral, do contador "X/Y", do Painel (pendentes), do Modo Congresso, do acesso mobile e (após publicar) do site público e do relatório.
- Tentar desmarcar uma modalidade com inscritos/sorteio → checkbox travado; via API o PUT retorna 400 (defesa do guardrail).
- Reincluir a modalidade (marcar de novo) → volta a aparecer.
- Modalidade nova criada na competição aparece automaticamente no evento.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/eventos/EventoInscricoes.tsx frontend/src/pages/congresso/CongressoStepModalidade.tsx frontend/src/pages/congresso/ModoCongresso.tsx frontend/src/pages/Painel.tsx
git commit -m "feat(ui): telas de evento respeitam modalidades excluídas (admin, congresso, painel)"
```

---

## Self-review (cobertura da spec)

- Modelo por exclusão (`EventoModalidadeExcluida`, presença = excluída; sem backfill) → Task 1 ✓
- Helper fonte única `modalidadesDoEvento` / `getModalidadeIdsExcluidas` → Task 2 ✓
- Endpoints GET/PUT excluídas + `GET /eventos/:id/modalidades` filtrado → Task 3 ✓
- Guardrail (bloquear excluir com inscritos/sorteio; validar competição; 400) → Task 3 (service + testes) ✓
- Abrangência server-side: contador/lista (+`modalidades_pendentes`), key-access mobile, site público, relatório XLSX → Task 4 ✓
- Serviço frontend + tipo → Task 5 ✓
- Painel dedicado "Modalidades do evento" com checkboxes e travas p/ modalidades com dados → Task 6 ✓
- Telas de evento (admin sidebar/contador, Modo Congresso, Painel) refletem exclusões → Task 7 ✓
- Modalidade nova entra automaticamente (modelo por exclusão) → garantido pelo design (Task 1/2) ✓
- Migration manual exige prod DB ligado no deploy-main → nota em Task 1 / processo de deploy ✓
- Testes: helper, guardrail, contadores; build front+back; manual → Tasks 2-4, 6-7 ✓
- Conjunto vazio = todas participam → Task 3 (teste) ✓
