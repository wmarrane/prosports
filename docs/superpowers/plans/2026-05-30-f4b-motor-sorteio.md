# F4b — Motor de Sorteio + Persistência Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend-only: motor de sorteio (funções puras determinísticas com semente) + entidade `Sorteio` (persistência por evento×modalidade) + endpoints CRUD/executar. Bump para `1.9.0`.

**Architecture:** Engine puro em `backend/src/modules/sorteios/engine.ts` com PRNG mulberry32 + seedToInt (FNV-1a) + 3 algoritmos: `drawGroups` (usa lookup `sistema_disputas_grupos`), `drawBracket` (pad até potência de 2 com null byes), `shuffleOrder` (Fisher-Yates). Service orquestra (fetch + validação + dispatch por tipo + upsert). Sem UI nesta sub-fase.

**Tech Stack:** Prisma (Postgres + jsonb), Express + Zod, Node `crypto`, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-30-f4b-motor-sorteio-design.md`

---

## File Structure

**Backend — Create:**
- `backend/prisma/migrations/<ts>_add_sorteio/migration.sql` (manual)
- `backend/src/modules/sorteios/engine.ts`
- `backend/src/modules/sorteios/engine.test.ts`
- `backend/src/modules/sorteios/sorteios.service.ts`
- `backend/src/modules/sorteios/sorteios.service.test.ts`
- `backend/src/modules/sorteios/sorteios.controller.ts`
- `backend/src/modules/sorteios/sorteios.routes.ts`

**Backend — Modify:**
- `backend/prisma/schema.prisma` — adicionar `model Sorteio` + back-refs em `Evento` e `Modalidade`.
- `backend/src/index.ts` — registrar `sorteiosRoutes` antes de `/inscricoes`.

**Release:**
- `package.json` (root): `1.8.0` → `1.9.0`.
- `CHANGELOG.md`: bloco novo `[1.9.0]`.

---

## Task 1: Prisma — model Sorteio + migration manual

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\prisma\schema.prisma`
- Create: `backend/prisma/migrations/20260530180000_add_sorteio/migration.sql`

- [ ] **Step 1: Editar `schema.prisma` — back-refs em Evento e Modalidade**

Localizar o bloco `model Evento` e adicionar `sorteios Sorteio[]` na lista de relações (depois de `inscricoes Inscricao[]`). Bloco final do `Evento`:

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
  sorteios        Sorteio[]
  criado_em       DateTime      @default(now())
  atualizado_em   DateTime      @updatedAt

  @@unique([competicao_id, nome])
}
```

Localizar o bloco `model Modalidade` e adicionar `sorteios Sorteio[]`:

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
  sorteios            Sorteio[]
  criado_em           DateTime        @default(now())
  atualizado_em       DateTime        @updatedAt

  @@unique([competicao_id, nome])
  @@unique([competicao_id, sigla])
}
```

- [ ] **Step 2: Editar `schema.prisma` — adicionar model `Sorteio` no final**

Append ao final do arquivo (após `model Inscricao`):

```prisma
model Sorteio {
  id              Int          @id @default(autoincrement())
  evento          Evento       @relation(fields: [evento_id], references: [id], onDelete: Cascade)
  evento_id       Int
  modalidade      Modalidade   @relation(fields: [modalidade_id], references: [id])
  modalidade_id   Int
  tipo            TipoDisputa
  seed            String
  resultado       Json
  gerado_em       DateTime     @default(now())
  atualizado_em   DateTime     @updatedAt

  @@unique([evento_id, modalidade_id])
  @@index([evento_id])
}
```

- [ ] **Step 3: Criar migration manualmente**

Criar diretório `backend/prisma/migrations/20260530180000_add_sorteio/`.

Criar `migration.sql` com conteúdo exato:

```sql
-- Add Sorteio table.

CREATE TABLE "Sorteio" (
  "id" SERIAL PRIMARY KEY,
  "evento_id" INTEGER NOT NULL,
  "modalidade_id" INTEGER NOT NULL,
  "tipo" "TipoDisputa" NOT NULL,
  "seed" TEXT NOT NULL,
  "resultado" JSONB NOT NULL,
  "gerado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Sorteio_evento_id_fkey"
    FOREIGN KEY ("evento_id") REFERENCES "Evento"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Sorteio_modalidade_id_fkey"
    FOREIGN KEY ("modalidade_id") REFERENCES "Modalidade"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Sorteio_evento_id_modalidade_id_key"
  ON "Sorteio"("evento_id","modalidade_id");

CREATE INDEX "Sorteio_evento_id_idx"
  ON "Sorteio"("evento_id");
```

- [ ] **Step 4: Regenerar Prisma client local**

De `backend/`:
```
npx prisma generate
```

Esperado: "Generated Prisma Client".

- [ ] **Step 5: tsc + full suite**

De `backend/`:
```
npx tsc --noEmit && npx vitest run
```

Esperado: tsc clean; todos os testes existentes seguem passando.

- [ ] **Step 6: Commit**

```
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): add Sorteio model (unique por evento×modalidade, resultado jsonb)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Engine — PRNG + algoritmos (TDD funções puras)

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\sorteios\engine.ts`
- Create: `backend/src/modules/sorteios/engine.test.ts`

- [ ] **Step 1: Criar `engine.test.ts`**

Conteúdo exato:

```ts
import { describe, it, expect } from 'vitest'
import {
  shuffleSeeded,
  drawGroups,
  drawBracket,
  shuffleOrder,
} from './engine'

describe('shuffleSeeded', () => {
  it('mesma seed produz mesma saída', () => {
    const a = shuffleSeeded([1,2,3,4,5,6,7,8,9,10], 'abc')
    const b = shuffleSeeded([1,2,3,4,5,6,7,8,9,10], 'abc')
    expect(a).toEqual(b)
  })

  it('seeds diferentes produzem saídas diferentes', () => {
    const a = shuffleSeeded([1,2,3,4,5,6,7,8,9,10], 'abc')
    const b = shuffleSeeded([1,2,3,4,5,6,7,8,9,10], 'xyz')
    expect(a).not.toEqual(b)
  })

  it('não muta o array original', () => {
    const input = [1,2,3,4,5]
    const snapshot = [...input]
    shuffleSeeded(input, 'seed')
    expect(input).toEqual(snapshot)
  })

  it('preserva todos os elementos (permutação)', () => {
    const input = [10,20,30,40,50]
    const out = shuffleSeeded(input, 'seed')
    expect(out.sort()).toEqual([10,20,30,40,50])
  })
})

describe('drawGroups', () => {
  it('6 participantes + regra (2g, 2 de 3, 0 de 4) distribui em 2 grupos de 3 com todos os ids', () => {
    const regra = { id: 1, quantidade_grupos: 2, grupos_3_componentes: 2, grupos_4_componentes: 0, numero_classificados: 2 }
    const out = drawGroups([1,2,3,4,5,6], regra, 'seed1')
    expect(out.regra_id).toBe(1)
    expect(out.classificados_por_grupo).toBe(2)
    expect(out.grupos).toHaveLength(2)
    expect(out.grupos[0].letra).toBe('A')
    expect(out.grupos[1].letra).toBe('B')
    expect(out.grupos[0].participantes).toHaveLength(3)
    expect(out.grupos[1].participantes).toHaveLength(3)
    const todos = [...out.grupos[0].participantes, ...out.grupos[1].participantes].sort()
    expect(todos).toEqual([1,2,3,4,5,6])
  })

  it('7 participantes + regra (2g, 1 de 3, 1 de 4) → primeiro grupo 3, segundo 4', () => {
    const regra = { id: 2, quantidade_grupos: 2, grupos_3_componentes: 1, grupos_4_componentes: 1, numero_classificados: 2 }
    const out = drawGroups([10,20,30,40,50,60,70], regra, 'seed2')
    expect(out.grupos).toHaveLength(2)
    expect(out.grupos[0].participantes).toHaveLength(3)
    expect(out.grupos[1].participantes).toHaveLength(4)
    const todos = [...out.grupos[0].participantes, ...out.grupos[1].participantes].sort((a,b)=>a-b)
    expect(todos).toEqual([10,20,30,40,50,60,70])
  })
})

describe('drawBracket', () => {
  it('5 participantes → size 8, 3 byes (null), todos pids presentes', () => {
    const out = drawBracket([1,2,3,4,5], 'seed')
    expect(out.size).toBe(8)
    expect(out.slots).toHaveLength(8)
    const nulls = out.slots.filter(s => s === null).length
    expect(nulls).toBe(3)
    const pids = out.slots.filter((s): s is number => s !== null).sort()
    expect(pids).toEqual([1,2,3,4,5])
  })

  it('8 participantes → size 8, 0 byes', () => {
    const out = drawBracket([1,2,3,4,5,6,7,8], 'seed')
    expect(out.size).toBe(8)
    expect(out.slots.filter(s => s === null)).toHaveLength(0)
  })

  it('1 participante → size 1, slots = [pid]', () => {
    const out = drawBracket([42], 'seed')
    expect(out.size).toBe(1)
    expect(out.slots).toEqual([42])
  })
})

describe('shuffleOrder', () => {
  it('tamanho preservado e mesma seed → mesma ordem', () => {
    const a = shuffleOrder([1,2,3,4,5], 'seed')
    const b = shuffleOrder([1,2,3,4,5], 'seed')
    expect(a.ordem).toHaveLength(5)
    expect(a).toEqual(b)
  })
})
```

- [ ] **Step 2: Run test — FAIL**

De `backend/`:
```
npx vitest run src/modules/sorteios/engine.test.ts
```

Esperado: FAIL com `Cannot find module './engine'`.

- [ ] **Step 3: Criar `engine.ts`**

Conteúdo exato:

```ts
function mulberry32(seed: number) {
  return function() {
    let t = (seed += 0x6D2B79F5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedToInt(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export function shuffleSeeded<T>(arr: readonly T[], seed: string): T[] {
  const rng = mulberry32(seedToInt(seed))
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

type RegraGrupos = {
  id: number
  quantidade_grupos: number
  grupos_3_componentes: number
  grupos_4_componentes: number
  numero_classificados: number
}

export type GruposResultado = {
  regra_id: number
  classificados_por_grupo: number
  grupos: { letra: string; participantes: number[] }[]
}

export function drawGroups(
  participantes: readonly number[],
  regra: RegraGrupos,
  seed: string,
): GruposResultado {
  const shuffled = shuffleSeeded(participantes, seed)
  const grupos: { letra: string; participantes: number[] }[] = []
  let i = 0
  const total = regra.grupos_3_componentes + regra.grupos_4_componentes
  for (let g = 0; g < total; g++) {
    const tam = g < regra.grupos_3_componentes ? 3 : 4
    grupos.push({
      letra: String.fromCharCode(65 + g),
      participantes: shuffled.slice(i, i + tam),
    })
    i += tam
  }
  return {
    regra_id: regra.id,
    classificados_por_grupo: regra.numero_classificados,
    grupos,
  }
}

export type BracketResultado = {
  size: number
  slots: (number | null)[]
}

export function drawBracket(participantes: readonly number[], seed: string): BracketResultado {
  const n = participantes.length
  const size = n <= 1 ? 1 : 2 ** Math.ceil(Math.log2(n))
  const padded: (number | null)[] = [...participantes, ...Array(size - n).fill(null)]
  const shuffled = shuffleSeeded(padded, seed)
  return { size, slots: shuffled }
}

export type OrdemResultado = { ordem: number[] }

export function shuffleOrder(participantes: readonly number[], seed: string): OrdemResultado {
  return { ordem: shuffleSeeded(participantes, seed) }
}
```

- [ ] **Step 4: Run test — todos passam**

```
npx vitest run src/modules/sorteios/engine.test.ts
```

Esperado: 10 testes passam (4 shuffleSeeded + 2 drawGroups + 3 drawBracket + 1 shuffleOrder).

- [ ] **Step 5: Commit**

```
git add backend/src/modules/sorteios/engine.ts backend/src/modules/sorteios/engine.test.ts
git commit -m "feat(sorteios): add deterministic engine (mulberry32 + 3 algoritmos)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Service — orquestração + validações (TDD)

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\sorteios\sorteios.service.ts`
- Create: `backend/src/modules/sorteios/sorteios.service.test.ts`

- [ ] **Step 1: Criar `sorteios.service.test.ts`**

Conteúdo exato:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    sorteio: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
    evento: {
      findUnique: vi.fn(),
    },
    modalidade: {
      findUnique: vi.fn(),
    },
    inscricao: {
      findMany: vi.fn(),
    },
    sistemaDisputasGrupos: {
      findFirst: vi.fn(),
    },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './sorteios.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('sorteios.service', () => {
  it('listar com filtros passa where corretamente', async () => {
    mockPrisma.sorteio.findMany.mockResolvedValue([])
    await service.listar({ evento_id: 5, modalidade_id: 2 })
    expect(mockPrisma.sorteio.findMany).toHaveBeenCalledWith({
      where: { evento_id: 5, modalidade_id: 2 },
      orderBy: { gerado_em: 'desc' },
    })
  })

  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.sorteio.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('remover deleta direto', async () => {
    mockPrisma.sorteio.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.sorteio.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })

  it('executar lança 404 se evento não existe', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue(null)
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 1, competicao_id: 1, tipo_modalidade: { tipo: 'chaves' } })
    await expect(service.executar({ evento_id: 1, modalidade_id: 1 }))
      .rejects.toMatchObject({ status: 404, message: expect.stringContaining('Evento') })
  })

  it('executar lança 404 se modalidade não existe', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue(null)
    await expect(service.executar({ evento_id: 1, modalidade_id: 1 }))
      .rejects.toMatchObject({ status: 404, message: expect.stringContaining('Modalidade') })
  })

  it('executar lança 400 se competições não batem', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 1, competicao_id: 2, tipo_modalidade: { tipo: 'chaves' } })
    await expect(service.executar({ evento_id: 1, modalidade_id: 1 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('competição') })
  })

  it('executar lança 400 se tipo === especifico', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 1, competicao_id: 1, tipo_modalidade: { tipo: 'especifico' } })
    await expect(service.executar({ evento_id: 1, modalidade_id: 1 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('específico') })
  })

  it('executar lança 400 se 0 inscritos', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 1, competicao_id: 1, tipo_modalidade: { tipo: 'chaves' } })
    mockPrisma.inscricao.findMany.mockResolvedValue([])
    await expect(service.executar({ evento_id: 1, modalidade_id: 1 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('inscrito') })
  })

  it('executar (grupos) lança 400 amigável se sem regra na tabela', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 1, competicao_id: 1, tipo_modalidade: { tipo: 'grupos' } })
    mockPrisma.inscricao.findMany.mockResolvedValue([
      { participante_id: 1 }, { participante_id: 2 }, { participante_id: 3 },
    ])
    mockPrisma.sistemaDisputasGrupos.findFirst.mockResolvedValue(null)
    await expect(service.executar({ evento_id: 1, modalidade_id: 1 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('3 equipes') })
  })

  it('executar (grupos) faz upsert com resultado quando regra existe', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 1, tipo_modalidade: { tipo: 'grupos' } })
    mockPrisma.inscricao.findMany.mockResolvedValue([
      { participante_id: 11 }, { participante_id: 12 }, { participante_id: 13 },
      { participante_id: 14 }, { participante_id: 15 }, { participante_id: 16 },
    ])
    mockPrisma.sistemaDisputasGrupos.findFirst.mockResolvedValue({
      id: 100, quantidade_grupos: 2, grupos_3_componentes: 2, grupos_4_componentes: 0, numero_classificados: 2,
    })
    mockPrisma.sorteio.upsert.mockImplementation(async (args: any) => ({ id: 1, ...args.create }))
    const result = await service.executar({ evento_id: 1, modalidade_id: 2 })
    expect(mockPrisma.sorteio.upsert).toHaveBeenCalledTimes(1)
    const call = mockPrisma.sorteio.upsert.mock.calls[0][0]
    expect(call.where).toEqual({ evento_id_modalidade_id: { evento_id: 1, modalidade_id: 2 } })
    expect(call.create.tipo).toBe('grupos')
    expect(call.create.evento_id).toBe(1)
    expect(call.create.modalidade_id).toBe(2)
    expect(typeof call.create.seed).toBe('string')
    expect(call.create.seed.length).toBeGreaterThan(0)
    expect(call.create.resultado.regra_id).toBe(100)
    expect(call.create.resultado.grupos).toHaveLength(2)
    expect(result.tipo).toBe('grupos')
  })

  it('executar (chaves) faz upsert com bracket', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 1, tipo_modalidade: { tipo: 'chaves' } })
    mockPrisma.inscricao.findMany.mockResolvedValue([
      { participante_id: 1 }, { participante_id: 2 }, { participante_id: 3 }, { participante_id: 4 }, { participante_id: 5 },
    ])
    mockPrisma.sorteio.upsert.mockImplementation(async (args: any) => ({ id: 1, ...args.create }))
    await service.executar({ evento_id: 1, modalidade_id: 2 })
    const call = mockPrisma.sorteio.upsert.mock.calls[0][0]
    expect(call.create.tipo).toBe('chaves')
    expect(call.create.resultado.size).toBe(8)
    expect(call.create.resultado.slots).toHaveLength(8)
  })

  it('executar (ordem_entrada) faz upsert com ordem', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 1, tipo_modalidade: { tipo: 'ordem_entrada' } })
    mockPrisma.inscricao.findMany.mockResolvedValue([
      { participante_id: 1 }, { participante_id: 2 }, { participante_id: 3 },
    ])
    mockPrisma.sorteio.upsert.mockImplementation(async (args: any) => ({ id: 1, ...args.create }))
    await service.executar({ evento_id: 1, modalidade_id: 2 })
    const call = mockPrisma.sorteio.upsert.mock.calls[0][0]
    expect(call.create.tipo).toBe('ordem_entrada')
    expect(call.create.resultado.ordem).toHaveLength(3)
    expect(call.create.resultado.ordem.sort()).toEqual([1,2,3])
  })
})
```

- [ ] **Step 2: Run test — FAIL**

De `backend/`:
```
npx vitest run src/modules/sorteios/sorteios.service.test.ts
```

Esperado: FAIL com `Cannot find module './sorteios.service'`.

- [ ] **Step 3: Criar `sorteios.service.ts`**

Conteúdo exato:

```ts
import { randomBytes } from 'crypto'
import prisma from '../../lib/prisma'
import * as engine from './engine'

function novaSeed(): string {
  return randomBytes(8).toString('hex')
}

export async function listar(filtros: { evento_id?: number; modalidade_id?: number }) {
  const where: { evento_id?: number; modalidade_id?: number } = {}
  if (filtros.evento_id !== undefined) where.evento_id = filtros.evento_id
  if (filtros.modalidade_id !== undefined) where.modalidade_id = filtros.modalidade_id
  return prisma.sorteio.findMany({ where, orderBy: { gerado_em: 'desc' } })
}

export async function buscarPorId(id: number) {
  const item = await prisma.sorteio.findUnique({ where: { id } })
  if (!item) throw Object.assign(new Error('Sorteio não encontrado'), { status: 404 })
  return item
}

export async function remover(id: number) {
  return prisma.sorteio.delete({ where: { id } })
}

export async function executar(input: { evento_id: number; modalidade_id: number }) {
  const [evento, modalidade] = await Promise.all([
    prisma.evento.findUnique({
      where: { id: input.evento_id },
      select: { id: true, competicao_id: true },
    }),
    prisma.modalidade.findUnique({
      where: { id: input.modalidade_id },
      select: {
        id: true,
        competicao_id: true,
        tipo_modalidade: { select: { tipo: true } },
      },
    }),
  ])
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })
  if (!modalidade) throw Object.assign(new Error('Modalidade não encontrada'), { status: 404 })
  if (evento.competicao_id !== modalidade.competicao_id) {
    throw Object.assign(
      new Error('A modalidade não pertence à competição deste evento.'),
      { status: 400 },
    )
  }

  const tipo = modalidade.tipo_modalidade.tipo

  if (tipo === 'especifico') {
    throw Object.assign(
      new Error("Modalidade do tipo 'específico' não possui sorteio automático."),
      { status: 400 },
    )
  }

  const inscricoes = await prisma.inscricao.findMany({
    where: { evento_id: input.evento_id, modalidade_id: input.modalidade_id },
    orderBy: { criado_em: 'asc' },
    select: { participante_id: true },
  })
  if (inscricoes.length === 0) {
    throw Object.assign(
      new Error('Nenhum participante inscrito nesta modalidade.'),
      { status: 400 },
    )
  }
  const pids = inscricoes.map(i => i.participante_id)
  const seed = novaSeed()
  let resultado: unknown

  if (tipo === 'grupos') {
    const regra = await prisma.sistemaDisputasGrupos.findFirst({
      where: { competicao_id: evento.competicao_id, quantidade_equipes: pids.length },
    })
    if (!regra) {
      throw Object.assign(
        new Error(
          `Não há regra de composição de grupos para ${pids.length} equipes nesta competição. Cadastre em Administração.`,
        ),
        { status: 400 },
      )
    }
    resultado = engine.drawGroups(pids, regra, seed)
  } else if (tipo === 'chaves') {
    resultado = engine.drawBracket(pids, seed)
  } else if (tipo === 'ordem_entrada') {
    resultado = engine.shuffleOrder(pids, seed)
  } else {
    throw Object.assign(new Error(`Tipo desconhecido: ${tipo}`), { status: 500 })
  }

  return prisma.sorteio.upsert({
    where: {
      evento_id_modalidade_id: {
        evento_id: input.evento_id,
        modalidade_id: input.modalidade_id,
      },
    },
    create: {
      evento_id: input.evento_id,
      modalidade_id: input.modalidade_id,
      tipo,
      seed,
      resultado: resultado as any,
    },
    update: {
      tipo,
      seed,
      resultado: resultado as any,
    },
  })
}
```

- [ ] **Step 4: Run test — 12 pass**

```
npx vitest run src/modules/sorteios/sorteios.service.test.ts
```

Esperado: 12 testes passam.

- [ ] **Step 5: Commit**

```
git add backend/src/modules/sorteios/sorteios.service.ts backend/src/modules/sorteios/sorteios.service.test.ts
git commit -m "feat(sorteios): add service with cross-FK validation, tipo dispatch, upsert" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Controller + routes + wire em index.ts

**Files:**
- Create: `backend/src/modules/sorteios/sorteios.controller.ts`
- Create: `backend/src/modules/sorteios/sorteios.routes.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Criar `sorteios.controller.ts`**

Conteúdo exato:

```ts
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './sorteios.service'

const executarSchema = z.object({
  evento_id: z.coerce.number().int().positive(),
  modalidade_id: z.coerce.number().int().positive(),
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

export async function executar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = executarSchema.parse(req.body)
    res.json(await service.executar(body))
  } catch (err) { next(err) }
}

export async function remover(req: Request, res: Response, next: NextFunction) {
  try {
    await service.remover(Number(req.params.id))
    res.status(204).send()
  } catch (err) { next(err) }
}
```

- [ ] **Step 2: Criar `sorteios.routes.ts`**

Conteúdo exato:

```ts
import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as ctrl from './sorteios.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]

router.get('/', requireAuth, ctrl.listar)
router.get('/:id', requireAuth, ctrl.buscarPorId)
router.post('/executar', ...admin, ctrl.executar)
router.delete('/:id', ...admin, ctrl.remover)

export default router
```

- [ ] **Step 3: Registrar em `backend/src/index.ts`**

Adicionar import junto aos demais módulos (após `inscricoesRoutes`):

```ts
import sorteiosRoutes from './modules/sorteios/sorteios.routes'
```

E no bloco `app.use`, adicionar **antes** do `app.use('/inscricoes', inscricoesRoutes)`:

```ts
app.use('/sorteios', sorteiosRoutes)
```

- [ ] **Step 4: tsc + full suite**

De `backend/`:
```
npx tsc --noEmit && npx vitest run
```

Esperado: tsc clean, suíte completa verde (10 engine + 12 service = 22 testes novos somados ao total).

- [ ] **Step 5: Commit**

```
git add backend/src/modules/sorteios/sorteios.controller.ts backend/src/modules/sorteios/sorteios.routes.ts backend/src/index.ts
git commit -m "feat(sorteios): expose CRUD + executar endpoints" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Bump versão + CHANGELOG

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\package.json`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\CHANGELOG.md`

- [ ] **Step 1: Bump version**

Editar `package.json` (root). Mudar **somente** `"version": "1.8.0"` para `"version": "1.9.0"`.

- [ ] **Step 2: Adicionar bloco no `CHANGELOG.md`**

Inserir o bloco abaixo logo após o cabeçalho e **antes** do bloco `## [1.8.0]`:

```md
## [1.9.0] - 2026-05-30

### Added
- Entidade Sorteio: persiste resultado por (evento, modalidade) com seed de auditoria e tipo snapshot. Re-sorteio sobrescreve.
- Motor de sorteio determinístico (PRNG mulberry32): drawGroups (consulta sistema_disputas_grupos), drawBracket (pad até potência de 2 com byes), shuffleOrder.
- Endpoints `/sorteios` (GET lista, GET id, DELETE) e `POST /sorteios/executar` (gera + persiste via upsert). Sem UI nesta fase.

### Notes
- Tipo `especifico` não suporta sorteio automático (retorna 400).
- Tipo `grupos` exige regra cadastrada em `sistema_disputas_grupos` para o N de inscritos da competição (400 amigável quando ausente).
```

- [ ] **Step 3: Commit**

```
git add package.json CHANGELOG.md
git commit -m "chore(release): v1.9.0 — F4b motor de sorteio + persistência" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Push + smoke (pós-deploy CI)

**Files:** (sem edição — verificação)

- [ ] **Step 1: Push**

```
git push origin develop
```

CI roda `prisma migrate deploy` (cria tabela Sorteio + índices + FKs) e reconstrói containers (~4-5min).

- [ ] **Step 2: Verificar deploy**

```
curl -s -o /dev/null -w "/health: %{http_code}\n" http://192.168.56.113:3000/health
curl -s -o /dev/null -w "/sorteios (no auth): %{http_code}\n" http://192.168.56.113:3000/sorteios
```

Esperado: `/health 200`, `/sorteios 401`.

Conferir tabela no DB (via container):
```
ssh wagner@192.168.56.113 'docker exec prosports-backend-1 sh -c "cd /app && node -e \"const{PrismaClient}=require(\\\"@prisma/client\\\");const p=new PrismaClient();p.\\\$queryRawUnsafe(\\\"SELECT column_name FROM information_schema.columns WHERE table_name = \\\\\\\"Sorteio\\\\\\\"\\\").then(r=>{console.log(r);process.exit(0)})\""'
```

Esperado: 8 colunas (id, evento_id, modalidade_id, tipo, seed, resultado, gerado_em, atualizado_em).

- [ ] **Step 3: Smoke via curl (admin token)**

Obter token (login admin) e usar nos próximos requests. Para uma modalidade `grupos` com regra cadastrada e ≥3 inscritos:

```
# Executar primeiro sorteio
curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"evento_id":X,"modalidade_id":Y}' \
  http://192.168.56.113:3000/sorteios/executar | jq .
```
Esperado: 200 com `{id, tipo:"grupos", seed:"...", resultado:{regra_id, grupos:[{letra:"A", participantes:[...]}, ...]}}`.

```
# Re-sortear (upsert)
curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"evento_id":X,"modalidade_id":Y}' \
  http://192.168.56.113:3000/sorteios/executar | jq .
```
Esperado: 200 com mesma `id`, `seed` diferente.

```
# Listar
curl -s -H "Authorization: Bearer $TOKEN" "http://192.168.56.113:3000/sorteios?evento_id=X" | jq .
```
Esperado: array com 1 sorteio.

```
# Tentar com tipo especifico → 400
# (usar uma modalidade com tipo especifico)
curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"evento_id":X,"modalidade_id":Z}' \
  http://192.168.56.113:3000/sorteios/executar | jq .
```
Esperado: 400 com mensagem `"específico"`.

```
# Tentar grupos com N sem regra → 400
# (inscrever um N que não está na tabela, ex: N=4 se só tem 6+ cadastrado)
```
Esperado: 400 com `"Não há regra de composição de grupos para 4 equipes..."`.

```
# DELETE
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" http://192.168.56.113:3000/sorteios/<id>
# GET retorna 404 agora
```

- [ ] **Step 4: Reportar**

Se passou, F4b fechada. F4c pode usar `/sorteios/executar` e `GET /sorteios` para construir a UI.

---

## Self-review

Cobertura do spec:

| Spec | Coberto por |
|---|---|
| Prisma model `Sorteio` + back-refs + cascade no Evento | Task 1 |
| Migration manual (sem `migrate diff`) | Task 1 |
| Engine puro: mulberry32 + seedToInt + shuffleSeeded + drawGroups + drawBracket + shuffleOrder | Task 2 |
| Service: listar/buscarPorId/remover/executar com dispatch por tipo + lookup grupos + upsert + seed crypto | Task 3 |
| Erros 400 (sem regra grupos, especifico, 0 inscritos), 404 (evento/modalidade) | Task 3 |
| Controller Zod + rotas (GET/GET:id/POST executar/DELETE) | Task 4 |
| Wire em index.ts antes de /inscricoes | Task 4 |
| Bump 1.9.0 + CHANGELOG | Task 5 |
| Smoke pós-deploy via curl | Task 6 |
| Tipo snapshot no Sorteio | Task 3 (Service passa `tipo` no create/update) |

Riscos endereçados:
- **Drift `migrate diff`**: migração manual em Task 1 (segue lição F2).
- **upsert composite key**: usa `evento_id_modalidade_id` (Prisma convention para `@@unique([evento_id, modalidade_id])`).
- **Determinismo do engine**: testes diretos com mesma seed (Task 2) confirmam.
- **Edge cases bracket**: 1 participante (size=1), 5 participantes (size=8 com 3 nulls), 8 (size=8 sem nulls) cobertos.
- **Inscricao read sem include**: service só lê `participante_id` (select reduzido) — eficiência e foco.
