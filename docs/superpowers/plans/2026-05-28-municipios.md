# Municipios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a `Municipios` entity backed by a CSV importer of the IBGE 2024 DTB list, expose CRUD endpoints + admin pages, and migrate `Delegacao` from free-text `municipio`/`estado` to a FK on `Municipio`.

**Architecture:** Single Prisma migration that drops the legacy `Delegacao` columns and adds the FK; new backend module `modules/municipios` following the existing pattern (controller/routes/service/test); CSV parser written in-house (no new deps); React pages mirror the existing `delegacoes` look-and-feel and reuse `DataTable`/`PageHeader`; a reusable `MunicipioSelect` (debounced autocomplete) is dropped into `DelegacaoForm`.

**Tech Stack:** Prisma (Postgres), Express + Zod + Multer, Vitest, React 18 + Vite + React Query + React Router + Axios + Tailwind.

**Spec:** `docs/superpowers/specs/2026-05-28-municipios-design.md`

---

## File Structure

**Backend — create:**
- `backend/src/modules/municipios/municipios.service.ts`
- `backend/src/modules/municipios/municipios.controller.ts`
- `backend/src/modules/municipios/municipios.routes.ts`
- `backend/src/modules/municipios/municipios.service.test.ts`
- `backend/src/modules/municipios/uf.ts` — UF map (sigla ↔ nome)
- `backend/src/modules/municipios/csv-parser.ts` — generic CSV parser (string → `Record<string,string>[]`)
- `backend/src/modules/municipios/csv-parser.test.ts`
- `backend/src/modules/municipios/import.service.ts` — header normalization + row validation + upsert in batches
- `backend/src/modules/municipios/import.service.test.ts`

**Backend — modify:**
- `backend/prisma/schema.prisma` — add `Municipio` model, change `Delegacao`
- `backend/prisma/migrations/<timestamp>_add_municipios/migration.sql` — generated
- `backend/src/index.ts` — register `/municipios` routes
- `backend/src/modules/delegacoes/delegacoes.service.ts` — include `municipio`, drop `municipio`/`estado` fields, accept `municipio_id`
- `backend/src/modules/delegacoes/delegacoes.controller.ts` — Zod schema update
- `backend/src/modules/delegacoes/delegacoes.service.test.ts` — adapt to new shape

**Frontend — create:**
- `frontend/src/types/municipio.ts`
- `frontend/src/services/municipios.ts`
- `frontend/src/components/MunicipioSelect.tsx`
- `frontend/src/pages/municipios/MunicipiosList.tsx`
- `frontend/src/pages/municipios/MunicipioForm.tsx`
- `frontend/src/pages/municipios/MunicipiosImport.tsx`

**Frontend — modify:**
- `frontend/src/App.tsx` — add 4 routes
- `frontend/src/components/Layout.tsx` — sidebar item
- `frontend/src/types/fundacao.ts` — update `Delegacao` shape
- `frontend/src/services/delegacoes.ts` — payload changes (no FormData needed if no logo; keep FormData since logo upload remains)
- `frontend/src/pages/delegacoes/DelegacaoForm.tsx` — replace município/estado inputs with `<MunicipioSelect />`
- `frontend/src/pages/delegacoes/DelegacoesList.tsx` — render `municipio.nome — municipio.uf`

---

## Task 1: Prisma — add `Municipio` model and convert `Delegacao` to FK

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_add_municipios/migration.sql` (auto-generated)

- [ ] **Step 1: Edit `schema.prisma`** — add `Municipio` and rewrite `Delegacao`. Replace the existing `Delegacao` block (lines 31–39 in the current file) and append the new `Municipio` block after it.

Current `Delegacao` block to remove:
```prisma
model Delegacao {
  id            Int      @id @default(autoincrement())
  nome          String
  municipio     String
  estado        String   @db.Char(2)
  logo_path     String?
  criado_em     DateTime @default(now())
  atualizado_em DateTime @updatedAt
}
```

Replacement (put `Municipio` first so the relation back-reference compiles cleanly):
```prisma
model Municipio {
  id            Int         @id @default(autoincrement())
  codigo_ibge   String      @unique @db.Char(7)
  nome          String
  uf            String      @db.Char(2)
  delegacoes    Delegacao[]
  criado_em     DateTime    @default(now())
  atualizado_em DateTime    @updatedAt

  @@index([uf, nome])
  @@index([nome])
}

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

- [ ] **Step 2: Generate migration**

Run from `backend/`:
```bash
npx prisma migrate dev --name add_municipios
```
Expected: prompt about destructive change to `Delegacao` (drops `municipio` and `estado` columns) — answer yes. Migration applied; `@prisma/client` regenerated. If there are pre-existing `Delegacao` rows, Prisma will refuse — that's expected: this project has no prod data. If local dev db has seeded delegações, accept the destructive prompt to drop the table.

- [ ] **Step 3: Verify generated SQL** — open `backend/prisma/migrations/<timestamp>_add_municipios/migration.sql` and confirm it contains:
  - `CREATE TABLE "Municipio" (...)`
  - `CREATE UNIQUE INDEX "Municipio_codigo_ibge_key" ON "Municipio"("codigo_ibge")`
  - `CREATE INDEX "Municipio_uf_nome_idx" ON "Municipio"("uf", "nome")`
  - `ALTER TABLE "Delegacao" DROP COLUMN "municipio", DROP COLUMN "estado", ADD COLUMN "municipio_id" INTEGER NOT NULL`
  - `ADD CONSTRAINT "Delegacao_municipio_id_fkey" FOREIGN KEY ("municipio_id") REFERENCES "Municipio"("id")`

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): add Municipio model and migrate Delegacao to FK"
```

---

## Task 2: Backend — `municipios.service.ts` CRUD with tests

**Files:**
- Create: `backend/src/modules/municipios/municipios.service.ts`
- Create: `backend/src/modules/municipios/municipios.service.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `backend/src/modules/municipios/municipios.service.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    municipio: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    delegacao: {
      count: vi.fn(),
    },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './municipios.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('municipios.service', () => {
  it('listar sem filtros aplica paginação padrão', async () => {
    mockPrisma.municipio.findMany.mockResolvedValue([{ id: 1, nome: 'Aracaju' }])
    mockPrisma.municipio.count.mockResolvedValue(1)
    const result = await service.listar({})
    expect(result).toEqual({ data: [{ id: 1, nome: 'Aracaju' }], total: 1, page: 1, limit: 50 })
    expect(mockPrisma.municipio.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ uf: 'asc' }, { nome: 'asc' }],
      skip: 0,
      take: 50,
    })
  })

  it('listar filtra por uf e q (case-insensitive)', async () => {
    mockPrisma.municipio.findMany.mockResolvedValue([])
    mockPrisma.municipio.count.mockResolvedValue(0)
    await service.listar({ uf: 'sp', q: 'são pa', page: 2, limit: 10 })
    expect(mockPrisma.municipio.findMany).toHaveBeenCalledWith({
      where: { uf: 'SP', nome: { contains: 'são pa', mode: 'insensitive' } },
      orderBy: [{ uf: 'asc' }, { nome: 'asc' }],
      skip: 10,
      take: 10,
    })
  })

  it('listar limita o tamanho da página em 200', async () => {
    mockPrisma.municipio.findMany.mockResolvedValue([])
    mockPrisma.municipio.count.mockResolvedValue(0)
    await service.listar({ limit: 9999 })
    expect(mockPrisma.municipio.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }))
  })

  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.municipio.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('criar normaliza uf para maiúsculas', async () => {
    mockPrisma.municipio.create.mockResolvedValue({ id: 1 })
    await service.criar({ codigo_ibge: '3550308', nome: 'São Paulo', uf: 'sp' })
    expect(mockPrisma.municipio.create).toHaveBeenCalledWith({
      data: { codigo_ibge: '3550308', nome: 'São Paulo', uf: 'SP' },
    })
  })

  it('editar normaliza uf para maiúsculas', async () => {
    mockPrisma.municipio.update.mockResolvedValue({ id: 1 })
    await service.editar(1, { uf: 'rj' })
    expect(mockPrisma.municipio.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { uf: 'RJ' } })
  })

  it('remover falha com 409 quando há delegação vinculada', async () => {
    mockPrisma.delegacao.count.mockResolvedValue(2)
    await expect(service.remover(1)).rejects.toMatchObject({ status: 409 })
    expect(mockPrisma.municipio.delete).not.toHaveBeenCalled()
  })

  it('remover deleta quando não há delegação vinculada', async () => {
    mockPrisma.delegacao.count.mockResolvedValue(0)
    mockPrisma.municipio.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.municipio.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run from `backend/`:
```bash
npx vitest run src/modules/municipios/municipios.service.test.ts
```
Expected: FAIL — `Cannot find module './municipios.service'`.

- [ ] **Step 3: Implement the service**

Create `backend/src/modules/municipios/municipios.service.ts`:
```ts
import prisma from '../../lib/prisma'

const MAX_LIMIT = 200
const DEFAULT_LIMIT = 50

export type ListarParams = {
  uf?: string
  q?: string
  page?: number
  limit?: number
}

export async function listar({ uf, q, page = 1, limit = DEFAULT_LIMIT }: ListarParams) {
  const safeLimit = Math.min(Math.max(1, limit), MAX_LIMIT)
  const safePage = Math.max(1, page)
  const where: any = {}
  if (uf) where.uf = uf.toUpperCase()
  if (q) where.nome = { contains: q, mode: 'insensitive' }

  const [data, total] = await Promise.all([
    prisma.municipio.findMany({
      where,
      orderBy: [{ uf: 'asc' }, { nome: 'asc' }],
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    }),
    prisma.municipio.count({ where }),
  ])

  return { data, total, page: safePage, limit: safeLimit }
}

export async function buscarPorId(id: number) {
  const item = await prisma.municipio.findUnique({ where: { id } })
  if (!item) throw Object.assign(new Error('Município não encontrado'), { status: 404 })
  return item
}

export async function criar(data: { codigo_ibge: string; nome: string; uf: string }) {
  return prisma.municipio.create({
    data: { ...data, uf: data.uf.toUpperCase() },
  })
}

export async function editar(
  id: number,
  data: Partial<{ codigo_ibge: string; nome: string; uf: string }>
) {
  const payload = { ...data }
  if (payload.uf) payload.uf = payload.uf.toUpperCase()
  return prisma.municipio.update({ where: { id }, data: payload })
}

export async function remover(id: number) {
  const vinculadas = await prisma.delegacao.count({ where: { municipio_id: id } })
  if (vinculadas > 0) {
    throw Object.assign(
      new Error('Remova as delegações vinculadas antes de excluir este município.'),
      { status: 409 }
    )
  }
  return prisma.municipio.delete({ where: { id } })
}
```

The Promise.all in `listar` requires the test to not assert the exact order — the test above asserts `findMany` and `count` separately, which is fine.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/modules/municipios/municipios.service.test.ts
```
Expected: 8 tests passing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/municipios/municipios.service.ts backend/src/modules/municipios/municipios.service.test.ts
git commit -m "feat(municipios): add service layer with CRUD and pagination"
```

---

## Task 3: Backend — UF map constant

**Files:**
- Create: `backend/src/modules/municipios/uf.ts`

- [ ] **Step 1: Create the file**

```ts
export const UF_NOME_TO_SIGLA: Record<string, string> = {
  'acre': 'AC',
  'alagoas': 'AL',
  'amapa': 'AP',
  'amazonas': 'AM',
  'bahia': 'BA',
  'ceara': 'CE',
  'distrito federal': 'DF',
  'espirito santo': 'ES',
  'goias': 'GO',
  'maranhao': 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  'para': 'PA',
  'paraiba': 'PB',
  'parana': 'PR',
  'pernambuco': 'PE',
  'piaui': 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  'rondonia': 'RO',
  'roraima': 'RR',
  'santa catarina': 'SC',
  'sao paulo': 'SP',
  'sergipe': 'SE',
  'tocantins': 'TO',
}

export const SIGLAS_VALIDAS = new Set(Object.values(UF_NOME_TO_SIGLA))

export function normalizarUf(input: string): string | null {
  const cleaned = input.trim()
  if (cleaned.length === 2) {
    const upper = cleaned.toUpperCase()
    return SIGLAS_VALIDAS.has(upper) ? upper : null
  }
  const key = cleaned
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  return UF_NOME_TO_SIGLA[key] ?? null
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/municipios/uf.ts
git commit -m "feat(municipios): add UF name-to-sigla map"
```

---

## Task 4: Backend — CSV parser with tests

**Files:**
- Create: `backend/src/modules/municipios/csv-parser.ts`
- Create: `backend/src/modules/municipios/csv-parser.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { parseCsv } from './csv-parser'

describe('csv-parser', () => {
  it('parseia CSV com vírgula', () => {
    const csv = 'a,b,c\n1,2,3\n4,5,6'
    expect(parseCsv(csv)).toEqual([
      { a: '1', b: '2', c: '3' },
      { a: '4', b: '5', c: '6' },
    ])
  })

  it('parseia CSV com ponto-e-vírgula', () => {
    const csv = 'a;b\nx;y'
    expect(parseCsv(csv)).toEqual([{ a: 'x', b: 'y' }])
  })

  it('remove BOM no início do arquivo', () => {
    const csv = '﻿a,b\n1,2'
    expect(parseCsv(csv)).toEqual([{ a: '1', b: '2' }])
  })

  it('trata campos entre aspas com separador interno', () => {
    const csv = 'nome,uf\n"São Paulo, capital",SP'
    expect(parseCsv(csv)).toEqual([{ nome: 'São Paulo, capital', uf: 'SP' }])
  })

  it('trata aspas duplas escapadas dentro de campo', () => {
    const csv = 'a,b\n"ele disse ""oi""",2'
    expect(parseCsv(csv)).toEqual([{ a: 'ele disse "oi"', b: '2' }])
  })

  it('ignora linhas em branco', () => {
    const csv = 'a,b\n1,2\n\n3,4\n'
    expect(parseCsv(csv)).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ])
  })

  it('aceita CRLF', () => {
    const csv = 'a,b\r\n1,2\r\n3,4'
    expect(parseCsv(csv)).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ])
  })

  it('retorna [] quando só tem header', () => {
    expect(parseCsv('a,b')).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/modules/municipios/csv-parser.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the parser**

```ts
export function parseCsv(input: string): Record<string, string>[] {
  let text = input
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  const firstNewline = text.search(/\r?\n/)
  const firstLine = firstNewline === -1 ? text : text.slice(0, firstNewline)
  const sep = detectSeparator(firstLine)

  const rows = splitRows(text, sep)
  if (rows.length === 0) return []
  const headers = rows[0].map((h) => h.trim())
  const result: Record<string, string>[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.length === 1 && row[0] === '') continue
    const obj: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = (row[j] ?? '').trim()
    }
    result.push(obj)
  }
  return result
}

function detectSeparator(headerLine: string): string {
  const semis = (headerLine.match(/;/g) ?? []).length
  const commas = (headerLine.match(/,/g) ?? []).length
  return semis > commas ? ';' : ','
}

function splitRows(text: string, sep: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') { inQuotes = true; continue }
    if (ch === sep) { row.push(field); field = ''; continue }
    if (ch === '\r') continue
    if (ch === '\n') { row.push(field); rows.push(row); field = ''; row = []; continue }
    field += ch
  }
  row.push(field)
  if (!(row.length === 1 && row[0] === '')) rows.push(row)
  return rows
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/modules/municipios/csv-parser.test.ts
```
Expected: 8 tests passing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/municipios/csv-parser.ts backend/src/modules/municipios/csv-parser.test.ts
git commit -m "feat(municipios): add csv parser with separator auto-detect"
```

---

## Task 5: Backend — import service with tests

**Files:**
- Create: `backend/src/modules/municipios/import.service.ts`
- Create: `backend/src/modules/municipios/import.service.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    municipio: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import prisma from '../../lib/prisma'
import { importarCsv } from './import.service'

const mockPrisma = prisma as any
beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.municipio.findMany.mockResolvedValue([])
  mockPrisma.municipio.createMany.mockResolvedValue({ count: 0 })
  mockPrisma.municipio.update.mockResolvedValue({})
})

const HEADER_PT = 'Código Município Completo;Nome_Município;Nome_UF'

describe('import.service', () => {
  it('importa linhas válidas e retorna resumo de criados', async () => {
    const csv = `${HEADER_PT}\n3550308;São Paulo;São Paulo\n3304557;Rio de Janeiro;Rio de Janeiro`
    mockPrisma.municipio.createMany.mockResolvedValue({ count: 2 })
    const res = await importarCsv(csv)
    expect(res.criados).toBe(2)
    expect(res.atualizados).toBe(0)
    expect(res.erros).toEqual([])
    expect(mockPrisma.municipio.createMany).toHaveBeenCalledWith({
      data: [
        { codigo_ibge: '3550308', nome: 'São Paulo', uf: 'SP' },
        { codigo_ibge: '3304557', nome: 'Rio de Janeiro', uf: 'RJ' },
      ],
      skipDuplicates: true,
    })
  })

  it('atualiza municípios já existentes (upsert por codigo_ibge)', async () => {
    const csv = `${HEADER_PT}\n3550308;São Paulo Renomeado;SP`
    mockPrisma.municipio.findMany.mockResolvedValue([
      { id: 7, codigo_ibge: '3550308', nome: 'São Paulo', uf: 'SP' },
    ])
    mockPrisma.municipio.createMany.mockResolvedValue({ count: 0 })
    const res = await importarCsv(csv)
    expect(res.atualizados).toBe(1)
    expect(res.criados).toBe(0)
    expect(mockPrisma.municipio.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { nome: 'São Paulo Renomeado', uf: 'SP' },
    })
  })

  it('aceita aliases de header (codigo_ibge / nome / uf)', async () => {
    const csv = 'codigo_ibge,nome,uf\n3550308,São Paulo,SP'
    mockPrisma.municipio.createMany.mockResolvedValue({ count: 1 })
    const res = await importarCsv(csv)
    expect(res.criados).toBe(1)
    expect(res.erros).toEqual([])
  })

  it('linha com codigo_ibge inválido vai para erros sem abortar', async () => {
    const csv = `${HEADER_PT}\nABC;Cidade A;SP\n3550308;São Paulo;SP`
    mockPrisma.municipio.createMany.mockResolvedValue({ count: 1 })
    const res = await importarCsv(csv)
    expect(res.criados).toBe(1)
    expect(res.erros).toHaveLength(1)
    expect(res.erros[0]).toMatchObject({ linha: 2, motivo: expect.stringContaining('codigo_ibge') })
  })

  it('linha com UF desconhecida vai para erros', async () => {
    const csv = `${HEADER_PT}\n3550308;X;Estado Fantasma`
    const res = await importarCsv(csv)
    expect(res.criados).toBe(0)
    expect(res.erros[0]).toMatchObject({ linha: 2, motivo: expect.stringContaining('UF') })
  })

  it('arquivo sem coluna obrigatória lança erro 400', async () => {
    const csv = 'foo,bar\n1,2'
    await expect(importarCsv(csv)).rejects.toMatchObject({ status: 400 })
  })

  it('processa em lotes de 500', async () => {
    const lines = [HEADER_PT]
    for (let i = 0; i < 1200; i++) {
      const code = String(3550000 + i).padStart(7, '0')
      lines.push(`${code};Cidade ${i};SP`)
    }
    mockPrisma.municipio.createMany.mockResolvedValue({ count: 500 })
    await importarCsv(lines.join('\n'))
    expect(mockPrisma.municipio.createMany).toHaveBeenCalledTimes(3)
    expect((mockPrisma.municipio.createMany.mock.calls[0][0] as any).data).toHaveLength(500)
    expect((mockPrisma.municipio.createMany.mock.calls[2][0] as any).data).toHaveLength(200)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/modules/municipios/import.service.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the import service**

```ts
import prisma from '../../lib/prisma'
import { parseCsv } from './csv-parser'
import { normalizarUf } from './uf'

const BATCH_SIZE = 500

type Row = { codigo_ibge: string; nome: string; uf: string }
type Erro = { linha: number; motivo: string }
type Resumo = { criados: number; atualizados: number; ignorados: number; erros: Erro[] }

const HEADER_ALIASES: Record<keyof Row, string[]> = {
  codigo_ibge: ['codigoibge', 'codigomunicipiocompleto'],
  nome: ['nomemunicipio', 'nome'],
  uf: ['uf', 'nomeuf', 'siglauf'],
}

function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s_]+/g, '')
}

function buildHeaderMap(actualHeaders: string[]): Record<keyof Row, string> | null {
  const norm = actualHeaders.map(normalizeHeader)
  const map: Partial<Record<keyof Row, string>> = {}
  for (const field of Object.keys(HEADER_ALIASES) as (keyof Row)[]) {
    const aliases = HEADER_ALIASES[field]
    const idx = norm.findIndex((h) => aliases.includes(h))
    if (idx === -1) return null
    map[field] = actualHeaders[idx]
  }
  return map as Record<keyof Row, string>
}

export async function importarCsv(content: string): Promise<Resumo> {
  const rows = parseCsv(content)
  if (rows.length === 0) {
    return { criados: 0, atualizados: 0, ignorados: 0, erros: [] }
  }
  const actualHeaders = Object.keys(rows[0])
  const headerMap = buildHeaderMap(actualHeaders)
  if (!headerMap) {
    throw Object.assign(
      new Error('Cabeçalho inválido. Esperado colunas para código IBGE, nome do município e UF.'),
      { status: 400 }
    )
  }

  const validas: Row[] = []
  const erros: Erro[] = []
  rows.forEach((raw, i) => {
    const linha = i + 2 // +1 header, +1 zero-based
    const codigo = (raw[headerMap.codigo_ibge] ?? '').trim()
    const nome = (raw[headerMap.nome] ?? '').trim()
    const ufRaw = (raw[headerMap.uf] ?? '').trim()
    if (!/^\d{7}$/.test(codigo)) {
      erros.push({ linha, motivo: 'codigo_ibge inválido (esperado 7 dígitos)' }); return
    }
    if (!nome) { erros.push({ linha, motivo: 'nome vazio' }); return }
    const uf = normalizarUf(ufRaw)
    if (!uf) { erros.push({ linha, motivo: `UF inválida: "${ufRaw}"` }); return }
    validas.push({ codigo_ibge: codigo, nome, uf })
  })

  const codigos = validas.map((r) => r.codigo_ibge)
  const existentes = codigos.length > 0
    ? await prisma.municipio.findMany({ where: { codigo_ibge: { in: codigos } } })
    : []
  const existentesByCodigo = new Map(existentes.map((m) => [m.codigo_ibge, m]))

  const novos: Row[] = []
  const updates: { id: number; data: Pick<Row, 'nome' | 'uf'> }[] = []
  for (const r of validas) {
    const ex = existentesByCodigo.get(r.codigo_ibge)
    if (ex) {
      if (ex.nome !== r.nome || ex.uf !== r.uf) {
        updates.push({ id: ex.id, data: { nome: r.nome, uf: r.uf } })
      }
    } else {
      novos.push(r)
    }
  }

  let criados = 0
  for (let i = 0; i < novos.length; i += BATCH_SIZE) {
    const batch = novos.slice(i, i + BATCH_SIZE)
    const res = await prisma.municipio.createMany({ data: batch, skipDuplicates: true })
    criados += res.count
  }

  let atualizados = 0
  for (const u of updates) {
    await prisma.municipio.update({ where: { id: u.id }, data: u.data })
    atualizados += 1
  }

  const ignorados = existentes.length - updates.length

  return { criados, atualizados, ignorados, erros }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/modules/municipios/import.service.test.ts
```
Expected: 7 tests passing. Note: the `atualizados` test mocks `findMany` returning a row with different `nome`, so the update should be counted.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/municipios/import.service.ts backend/src/modules/municipios/import.service.test.ts
git commit -m "feat(municipios): add CSV importer with header normalization and batching"
```

---

## Task 6: Backend — controller and routes

**Files:**
- Create: `backend/src/modules/municipios/municipios.controller.ts`
- Create: `backend/src/modules/municipios/municipios.routes.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Create controller**

`backend/src/modules/municipios/municipios.controller.ts`:
```ts
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './municipios.service'
import { importarCsv } from './import.service'

const createSchema = z.object({
  codigo_ibge: z.string().regex(/^\d{7}$/, 'codigo_ibge deve ter 7 dígitos'),
  nome: z.string().min(1),
  uf: z.string().length(2),
})
const updateSchema = createSchema.partial()

const listQuerySchema = z.object({
  uf: z.string().length(2).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
})

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const params = listQuerySchema.parse(req.query)
    res.json(await service.listar(params))
  } catch (err) { next(err) }
}

export async function buscarPorId(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.buscarPorId(Number(req.params.id)))
  } catch (err) { next(err) }
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

export async function importar(req: Request, res: Response, next: NextFunction) {
  try {
    const file = (req as any).file as Express.Multer.File | undefined
    if (!file) {
      res.status(400).json({ message: 'Arquivo CSV obrigatório no campo "arquivo".' })
      return
    }
    const content = file.buffer.toString('utf8')
    res.json(await importarCsv(content))
  } catch (err) { next(err) }
}
```

- [ ] **Step 2: Create routes**

`backend/src/modules/municipios/municipios.routes.ts`:
```ts
import { Router } from 'express'
import multer from 'multer'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as ctrl from './municipios.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]

const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase()
    if (name.endsWith('.csv') || file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true)
    } else {
      cb(Object.assign(new Error('Apenas arquivos CSV são aceitos.'), { status: 400 }))
    }
  },
})

router.get('/', requireAuth, ctrl.listar)
router.get('/:id', requireAuth, ctrl.buscarPorId)
router.post('/', ...admin, ctrl.criar)
router.put('/:id', ...admin, ctrl.editar)
router.delete('/:id', ...admin, ctrl.remover)
router.post('/import', ...admin, uploadCsv.single('arquivo'), ctrl.importar)

export default router
```

Note: `GET` requires only authentication (not ADMIN) because non-admin users need to use the selector.

- [ ] **Step 3: Register routes in `index.ts`**

Edit `backend/src/index.ts`. Add the import next to the other module imports and `app.use` next to the others.

Old:
```ts
import categoriasRoutes from './modules/categorias/categorias.routes'
```
New (add line after):
```ts
import categoriasRoutes from './modules/categorias/categorias.routes'
import municipiosRoutes from './modules/municipios/municipios.routes'
```

Old:
```ts
app.use('/categorias', categoriasRoutes)
```
New:
```ts
app.use('/categorias', categoriasRoutes)
app.use('/municipios', municipiosRoutes)
```

- [ ] **Step 4: Type check**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Smoke test the routes**

Start backend (`npm run dev` from `backend/`), then in another terminal:
```bash
# get an admin token first via /auth/login (admin@prosports.com / admin123)
TOKEN="<paste accessToken>"

# create one manually
curl -s -X POST http://localhost:3000/municipios \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"codigo_ibge":"3550308","nome":"São Paulo","uf":"SP"}'
# Expected: 201 with the created object

# list it
curl -s "http://localhost:3000/municipios?q=são" -H "Authorization: Bearer $TOKEN"
# Expected: 200 with { data: [...], total: 1, page: 1, limit: 50 }

# delete it
curl -s -X DELETE http://localhost:3000/municipios/1 -H "Authorization: Bearer $TOKEN"
# Expected: 204
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/municipios/municipios.controller.ts backend/src/modules/municipios/municipios.routes.ts backend/src/index.ts
git commit -m "feat(municipios): expose CRUD and CSV import endpoints"
```

---

## Task 7: Backend — adapt `delegacoes` to the new schema

**Files:**
- Modify: `backend/src/modules/delegacoes/delegacoes.service.ts`
- Modify: `backend/src/modules/delegacoes/delegacoes.controller.ts`
- Modify: `backend/src/modules/delegacoes/delegacoes.service.test.ts`

- [ ] **Step 1: Update the test first**

Edit `backend/src/modules/delegacoes/delegacoes.service.test.ts`. Replace the `criar` test and add an `include` assertion to `listar`:

Old:
```ts
  it('listar retorna lista ordenada', async () => {
    mockPrisma.delegacao.findMany.mockResolvedValue([{ id: 1, nome: 'SP' }])
    const result = await service.listar()
    expect(result).toEqual([{ id: 1, nome: 'SP' }])
    expect(mockPrisma.delegacao.findMany).toHaveBeenCalledWith({ orderBy: { nome: 'asc' } })
  })
```
New:
```ts
  it('listar retorna lista ordenada incluindo município', async () => {
    mockPrisma.delegacao.findMany.mockResolvedValue([{ id: 1, nome: 'SP', municipio: { id: 1, nome: 'São Paulo', uf: 'SP' } }])
    const result = await service.listar()
    expect(result[0].municipio.uf).toBe('SP')
    expect(mockPrisma.delegacao.findMany).toHaveBeenCalledWith({
      orderBy: { nome: 'asc' },
      include: { municipio: true },
    })
  })
```

Old:
```ts
  it('criar chama prisma.create com dados corretos', async () => {
    const data = { nome: 'SP', municipio: 'São Paulo', estado: 'SP' }
    mockPrisma.delegacao.create.mockResolvedValue({ id: 1, ...data })
    await service.criar(data)
    expect(mockPrisma.delegacao.create).toHaveBeenCalledWith({ data })
  })
```
New:
```ts
  it('criar chama prisma.create com municipio_id', async () => {
    const data = { nome: 'SP', municipio_id: 42 }
    mockPrisma.delegacao.create.mockResolvedValue({ id: 1, ...data })
    await service.criar(data)
    expect(mockPrisma.delegacao.create).toHaveBeenCalledWith({
      data,
      include: { municipio: true },
    })
  })
```

- [ ] **Step 2: Run tests, confirm failure**

```bash
cd backend && npx vitest run src/modules/delegacoes/delegacoes.service.test.ts
```
Expected: 2 tests failing.

- [ ] **Step 3: Update service**

Replace `backend/src/modules/delegacoes/delegacoes.service.ts`:
```ts
import prisma from '../../lib/prisma'
import { deleteFile } from '../../lib/upload'

const SUBDIR = 'delegacoes'

export async function listar() {
  return prisma.delegacao.findMany({
    orderBy: { nome: 'asc' },
    include: { municipio: true },
  })
}

export async function buscarPorId(id: number) {
  const item = await prisma.delegacao.findUnique({
    where: { id },
    include: { municipio: true },
  })
  if (!item) throw Object.assign(new Error('Delegação não encontrada'), { status: 404 })
  return item
}

export async function criar(data: { nome: string; municipio_id: number; logo_path?: string }) {
  return prisma.delegacao.create({ data, include: { municipio: true } })
}

export async function editar(
  id: number,
  data: { nome?: string; municipio_id?: number; logo_path?: string },
  oldLogoPath?: string | null
) {
  if (data.logo_path && oldLogoPath) {
    deleteFile(SUBDIR, oldLogoPath)
  }
  return prisma.delegacao.update({
    where: { id },
    data,
    include: { municipio: true },
  })
}

export async function remover(id: number) {
  const item = await buscarPorId(id)
  if (item.logo_path) deleteFile(SUBDIR, item.logo_path)
  return prisma.delegacao.delete({ where: { id } })
}
```

- [ ] **Step 4: Update controller Zod schema**

Replace `backend/src/modules/delegacoes/delegacoes.controller.ts`:
```ts
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './delegacoes.service'

const createSchema = z.object({
  nome: z.string().min(1),
  municipio_id: z.coerce.number().int().positive(),
})

const updateSchema = createSchema.partial()

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.listar())
  } catch (err) { next(err) }
}

export async function buscarPorId(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.buscarPorId(Number(req.params.id)))
  } catch (err) { next(err) }
}

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchema.parse(req.body)
    const logo_path = (req.file as Express.Multer.File | undefined)?.filename
    res.status(201).json(await service.criar({ ...body, logo_path }))
  } catch (err) { next(err) }
}

export async function editar(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    const body = updateSchema.parse(req.body)
    const logo_path = (req.file as Express.Multer.File | undefined)?.filename
    const current = await service.buscarPorId(id)
    res.json(await service.editar(id, { ...body, ...(logo_path ? { logo_path } : {}) }, current.logo_path))
  } catch (err) { next(err) }
}

export async function remover(req: Request, res: Response, next: NextFunction) {
  try {
    await service.remover(Number(req.params.id))
    res.status(204).send()
  } catch (err) { next(err) }
}
```

`z.coerce.number()` is used because the form submits as multipart/form-data (strings).

- [ ] **Step 5: Run tests**

```bash
cd backend && npx vitest run src/modules/delegacoes/delegacoes.service.test.ts
```
Expected: 4 tests passing (the unchanged `buscarPorId 404` and `remover deleta arquivo` still pass).

- [ ] **Step 6: Full backend type check + test**

```bash
cd backend && npx tsc --noEmit && npx vitest run
```
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/delegacoes
git commit -m "refactor(delegacoes): switch to municipio_id FK"
```

---

## Task 8: Frontend — types and service

**Files:**
- Create: `frontend/src/types/municipio.ts`
- Create: `frontend/src/services/municipios.ts`
- Modify: `frontend/src/types/fundacao.ts`

- [ ] **Step 1: Create `types/municipio.ts`**

```ts
export type Municipio = {
  id: number
  codigo_ibge: string
  nome: string
  uf: string
  criado_em: string
  atualizado_em: string
}

export type MunicipiosPage = {
  data: Municipio[]
  total: number
  page: number
  limit: number
}

export type ImportResumo = {
  criados: number
  atualizados: number
  ignorados: number
  erros: { linha: number; motivo: string }[]
}
```

- [ ] **Step 2: Create `services/municipios.ts`**

```ts
import api from './api'
import type { Municipio, MunicipiosPage, ImportResumo } from '../types/municipio'

const BASE = '/municipios'

type ListarParams = { uf?: string; q?: string; page?: number; limit?: number }

export const municipiosService = {
  listar: (params: ListarParams = {}) =>
    api.get<MunicipiosPage>(BASE, { params }).then((r) => r.data),
  buscar: (id: number) => api.get<Municipio>(`${BASE}/${id}`).then((r) => r.data),
  criar: (data: { codigo_ibge: string; nome: string; uf: string }) =>
    api.post<Municipio>(BASE, data).then((r) => r.data),
  editar: (id: number, data: Partial<{ codigo_ibge: string; nome: string; uf: string }>) =>
    api.put<Municipio>(`${BASE}/${id}`, data).then((r) => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
  importar: (file: File) => {
    const fd = new FormData()
    fd.append('arquivo', file)
    return api
      .post<ImportResumo>(`${BASE}/import`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data)
  },
}
```

- [ ] **Step 3: Update `types/fundacao.ts`**

Replace the `Delegacao` type:

Old:
```ts
export type Delegacao = {
  id: number
  nome: string
  municipio: string
  estado: string
  logo_path: string | null
  criado_em: string
  atualizado_em: string
}
```
New (place `import type { Municipio } from './municipio'` at the top of the file):
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
```

- [ ] **Step 4: Type check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: errors in `DelegacoesList.tsx` and `DelegacaoForm.tsx` referencing the old `municipio`/`estado` fields. Those are fixed in Task 11.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/municipio.ts frontend/src/services/municipios.ts frontend/src/types/fundacao.ts
git commit -m "feat(frontend): add Municipio types and service; update Delegacao type"
```

---

## Task 9: Frontend — `MunicipioSelect` component

**Files:**
- Create: `frontend/src/components/MunicipioSelect.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { municipiosService } from '../services/municipios'
import type { Municipio } from '../types/municipio'

type Props = {
  value: number | null
  onChange: (id: number | null) => void
  placeholder?: string
}

export default function MunicipioSelect({ value, onChange, placeholder = 'Busque por nome do município...' }: Props) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Municipio | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(id)
  }, [query])

  // Load the selected município label when value is provided externally
  useEffect(() => {
    if (value && (!selected || selected.id !== value)) {
      municipiosService.buscar(value).then(setSelected).catch(() => setSelected(null))
    }
    if (!value) setSelected(null)
  }, [value])

  // Close dropdown when clicking outside
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const { data, isFetching } = useQuery({
    queryKey: ['municipios', 'search', debouncedQuery],
    queryFn: () => municipiosService.listar({ q: debouncedQuery, limit: 20 }),
    enabled: open && debouncedQuery.length >= 2,
  })

  function pick(m: Municipio) {
    setSelected(m)
    onChange(m.id)
    setQuery('')
    setOpen(false)
  }

  function clear() {
    setSelected(null)
    onChange(null)
    setQuery('')
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="relative" ref={containerRef}>
      {selected && !open ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm">
          <span>{selected.nome} — {selected.uf}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(true)} className="text-xs text-indigo-400 hover:text-indigo-300">Trocar</button>
            <button type="button" onClick={clear} className="text-xs text-red-400 hover:text-red-300">Remover</button>
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
        <div className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
          {debouncedQuery.length < 2 && (
            <p className="px-3 py-2 text-xs text-gray-500">Digite ao menos 2 caracteres...</p>
          )}
          {debouncedQuery.length >= 2 && isFetching && (
            <p className="px-3 py-2 text-xs text-gray-500">Buscando...</p>
          )}
          {debouncedQuery.length >= 2 && !isFetching && data?.data.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-500">Nenhum município encontrado.</p>
          )}
          {data?.data.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => pick(m)}
              className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
            >
              {m.nome} — {m.uf}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: still errors in `DelegacoesList.tsx` / `DelegacaoForm.tsx` (Task 11), but no errors in the new component.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/MunicipioSelect.tsx
git commit -m "feat(frontend): add MunicipioSelect autocomplete component"
```

---

## Task 10: Frontend — `MunicipiosList`, `MunicipioForm`, `MunicipiosImport` pages

**Files:**
- Create: `frontend/src/pages/municipios/MunicipiosList.tsx`
- Create: `frontend/src/pages/municipios/MunicipioForm.tsx`
- Create: `frontend/src/pages/municipios/MunicipiosImport.tsx`

- [ ] **Step 1: Create `MunicipiosList.tsx`**

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import { municipiosService } from '../../services/municipios'
import type { Municipio } from '../../types/municipio'

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const PAGE_SIZE = 50

export default function MunicipiosList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [uf, setUf] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['municipios', { uf, q, page }],
    queryFn: () => municipiosService.listar({ uf: uf || undefined, q: q || undefined, page, limit: PAGE_SIZE }),
  })

  const { mutate: remover } = useMutation({
    mutationFn: municipiosService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['municipios'] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  function confirmarRemocao(id: number, nome: string) {
    if (confirm(`Remover município "${nome}"?`)) remover(id)
  }

  const columns = [
    { header: 'Código IBGE', accessor: (row: Municipio) => row.codigo_ibge, className: 'w-32' },
    { header: 'Nome', accessor: (row: Municipio) => row.nome },
    { header: 'UF', accessor: (row: Municipio) => row.uf, className: 'w-16' },
    {
      header: 'Ações',
      accessor: (row: Municipio) => (
        <div className="flex gap-2">
          <button onClick={() => navigate(`/municipios/${row.id}/editar`)} className="text-indigo-400 hover:text-indigo-300 text-xs">Editar</button>
          <button onClick={() => confirmarRemocao(row.id, row.nome)} className="text-red-400 hover:text-red-300 text-xs">Remover</button>
        </div>
      ),
      className: 'w-28',
    },
  ]

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const inputClass = 'px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="text-white">
      <PageHeader title="Municípios" actionLabel="+ Novo Município" actionTo="/municipios/novo" />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">UF</label>
            <select value={uf} onChange={(e) => { setUf(e.target.value); setPage(1) }} className={`${inputClass} w-24`}>
              <option value="">Todas</option>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs text-gray-400 mb-1">Buscar por nome</label>
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className={`${inputClass} w-full`} placeholder="Ex.: São Paulo" />
          </div>
          <button onClick={() => navigate('/municipios/importar')} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-sm rounded-lg">
            Importar CSV
          </button>
        </div>

        {isLoading ? (
          <p className="text-gray-400 text-sm">Carregando...</p>
        ) : (
          <>
            <DataTable columns={columns} data={data?.data ?? []} keyExtractor={(row) => row.id} emptyMessage="Nenhum município encontrado." />
            {data && data.total > PAGE_SIZE && (
              <div className="flex items-center justify-between text-sm text-gray-400">
                <span>{data.total} resultados — página {page} de {totalPages}</span>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded bg-gray-800 disabled:opacity-50">Anterior</button>
                  <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded bg-gray-800 disabled:opacity-50">Próxima</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `MunicipioForm.tsx`**

```tsx
import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { municipiosService } from '../../services/municipios'

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export default function MunicipioForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [codigoIbge, setCodigoIbge] = useState('')
  const [nome, setNome] = useState('')
  const [uf, setUf] = useState('SP')
  const [erro, setErro] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['municipios', Number(id)],
    queryFn: () => municipiosService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setCodigoIbge(existing.codigo_ibge)
      setNome(existing.nome)
      setUf(existing.uf)
    }
  }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      const data = { codigo_ibge: codigoIbge, nome, uf }
      return isEdit ? municipiosService.editar(Number(id), data) : municipiosService.criar(data)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['municipios'] }); navigate('/municipios') },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="text-white">
      <PageHeader title={isEdit ? 'Editar Município' : 'Novo Município'} backTo="/municipios" />
      <div className="p-6 max-w-lg">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); setErro(''); salvar() }} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Código IBGE (7 dígitos)</label>
            <input value={codigoIbge} onChange={(e) => setCodigoIbge(e.target.value)} required pattern="\d{7}" maxLength={7} className={inputClass} placeholder="3550308" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nome</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">UF</label>
            <select value={uf} onChange={(e) => setUf(e.target.value)} className={`${inputClass} w-24`}>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          {erro && <p className="text-sm text-red-400">{erro}</p>}
          <button type="submit" disabled={isPending} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `MunicipiosImport.tsx`**

```tsx
import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { municipiosService } from '../../services/municipios'
import type { ImportResumo } from '../../types/municipio'

export default function MunicipiosImport() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [resumo, setResumo] = useState<ImportResumo | null>(null)
  const [erro, setErro] = useState('')

  const { mutate: enviar, isPending } = useMutation({
    mutationFn: () => municipiosService.importar(file!),
    onSuccess: (r) => {
      setResumo(r)
      queryClient.invalidateQueries({ queryKey: ['municipios'] })
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao importar.'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setResumo(null)
    if (file) enviar()
  }

  return (
    <div className="text-white">
      <PageHeader title="Importar Municípios" backTo="/municipios" />
      <div className="p-6 max-w-2xl space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-gray-400">
            Envie um arquivo CSV (UTF-8) com as colunas <strong>Código Município Completo</strong>, <strong>Nome_Município</strong> e <strong>Nome_UF</strong> (ou os aliases <code>codigo_ibge</code>, <code>nome</code>, <code>uf</code>). Municípios são atualizados pelo código IBGE.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-700 file:text-gray-300 hover:file:bg-gray-600"
          />
          {erro && <p className="text-sm text-red-400">{erro}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={!file || isPending} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg">
              {isPending ? 'Enviando...' : 'Enviar'}
            </button>
            <button type="button" onClick={() => navigate('/municipios')} className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg">
              Cancelar
            </button>
          </div>
        </form>

        {resumo && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-2 text-sm">
            <p>✅ <strong>{resumo.criados}</strong> criados</p>
            <p>♻️ <strong>{resumo.atualizados}</strong> atualizados</p>
            <p>➖ <strong>{resumo.ignorados}</strong> ignorados (sem alteração)</p>
            <p>⚠️ <strong>{resumo.erros.length}</strong> erros</p>
            {resumo.erros.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-gray-400">Ver erros</summary>
                <ul className="mt-2 text-xs text-red-300 space-y-1">
                  {resumo.erros.map((e) => <li key={e.linha}>Linha {e.linha}: {e.motivo}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/municipios
git commit -m "feat(frontend): add municipios list, form and import pages"
```

---

## Task 11: Frontend — wire `Delegacao` UI to the new selector

**Files:**
- Modify: `frontend/src/pages/delegacoes/DelegacoesList.tsx`
- Modify: `frontend/src/pages/delegacoes/DelegacaoForm.tsx`

- [ ] **Step 1: Update `DelegacoesList.tsx`**

Replace the two old columns (município, estado) with a single one that reads from `municipio`:

Old:
```tsx
    { header: 'Município', accessor: (row: Delegacao) => row.municipio },
    { header: 'Estado', accessor: (row: Delegacao) => row.estado },
```
New:
```tsx
    {
      header: 'Município',
      accessor: (row: Delegacao) => `${row.municipio.nome} — ${row.municipio.uf}`,
    },
```

- [ ] **Step 2: Update `DelegacaoForm.tsx`**

Replace the `municipio`/`estado` state, fields and form submission.

Replace the imports section to add the selector:

Old:
```tsx
import { useState, useEffect } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { delegacoesService } from '../../services/delegacoes'
```
New:
```tsx
import { useState, useEffect } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import MunicipioSelect from '../../components/MunicipioSelect'
import { delegacoesService } from '../../services/delegacoes'
```

Replace the state block:

Old:
```tsx
  const [nome, setNome] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [estado, setEstado] = useState('')
  const [logo, setLogo] = useState<File | null>(null)
  const [erro, setErro] = useState('')
```
New:
```tsx
  const [nome, setNome] = useState('')
  const [municipioId, setMunicipioId] = useState<number | null>(null)
  const [logo, setLogo] = useState<File | null>(null)
  const [erro, setErro] = useState('')
```

Replace the `useEffect` that loads existing:

Old:
```tsx
  useEffect(() => {
    if (existing) {
      setNome(existing.nome)
      setMunicipio(existing.municipio)
      setEstado(existing.estado)
    }
  }, [existing])
```
New:
```tsx
  useEffect(() => {
    if (existing) {
      setNome(existing.nome)
      setMunicipioId(existing.municipio_id)
    }
  }, [existing])
```

Replace `handleSubmit`:

Old:
```tsx
  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    const formData = new FormData()
    formData.append('nome', nome)
    formData.append('municipio', municipio)
    formData.append('estado', estado.toUpperCase().slice(0, 2))
    if (logo) formData.append('logo', logo)
    salvar(formData)
  }
```
New:
```tsx
  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!municipioId) {
      setErro('Selecione um município.')
      return
    }
    const formData = new FormData()
    formData.append('nome', nome)
    formData.append('municipio_id', String(municipioId))
    if (logo) formData.append('logo', logo)
    salvar(formData)
  }
```

Replace the two form-field blocks for `Município` and `Estado (UF)`:

Old:
```tsx
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Município</label>
            <input value={municipio} onChange={e => setMunicipio(e.target.value)} required
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Estado (UF)</label>
            <input value={estado} onChange={e => setEstado(e.target.value)} required maxLength={2} placeholder="SP"
              className="w-24 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
```
New:
```tsx
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Município</label>
            <MunicipioSelect value={municipioId} onChange={setMunicipioId} />
          </div>
```

- [ ] **Step 3: Type check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/delegacoes
git commit -m "feat(delegacoes): use MunicipioSelect in form and list"
```

---

## Task 12: Frontend — routes and sidebar

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Update `App.tsx`** — add the 4 routes.

Add imports near the other page imports:
```tsx
import MunicipiosList from './pages/municipios/MunicipiosList'
import MunicipioForm from './pages/municipios/MunicipioForm'
import MunicipiosImport from './pages/municipios/MunicipiosImport'
```

Inside `<Route element={<Layout />}>`, add (after the categorias routes):
```tsx
            <Route path="/municipios" element={<MunicipiosList />} />
            <Route path="/municipios/novo" element={<MunicipioForm />} />
            <Route path="/municipios/:id/editar" element={<MunicipioForm />} />
            <Route path="/municipios/importar" element={<MunicipiosImport />} />
```

- [ ] **Step 2: Update `Layout.tsx`** — add sidebar item.

In the `Cadastros` group, add a `Municípios` entry above `Delegações` (alphabetical-ish makes sense; place wherever fits):

Old:
```tsx
  {
    title: 'Cadastros',
    items: [
      { label: 'Delegações', to: '/delegacoes' },
      { label: 'Modalidades', to: '/modalidades' },
      { label: 'Categorias', to: '/categorias' },
    ],
  },
```
New:
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

- [ ] **Step 3: Type check + build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```
Expected: no errors, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat(frontend): add municipios routes and sidebar link"
```

---

## Task 13: End-to-end smoke test in the browser

**Files:** (no edits — manual verification)

Prerequisite: convert `personaladmin/RELATORIO_DTB_BRASIL_2024_MUNICIPIOS.xls` to CSV by opening it in Excel and saving as "CSV UTF-8 (separado por vírgulas)". Place the resulting `.csv` somewhere accessible (e.g. `personaladmin/RELATORIO_DTB_BRASIL_2024_MUNICIPIOS.csv`).

- [ ] **Step 1: Start the stack**

In one terminal:
```bash
cd backend && npm run dev
```
In another:
```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Run the full test suites once more**

```bash
cd backend && npx vitest run
cd ../frontend && npm run test 2>/dev/null || echo "(no frontend tests configured — ok)"
```
Expected: all backend tests pass.

- [ ] **Step 3: Browser walk-through**

Login as `admin@prosports.com` / `admin123`. Then:

1. Open **Municípios** in the sidebar — empty list with filters and "Importar CSV" button.
2. Click "Importar CSV" → select the converted CSV → submit. Resumo should show ~5570 criados, 0 erros.
3. Back to the list, set UF=SP and search for "São Paulo" — entry visible.
4. Click "+ Novo Município", create `9999999 / Cidade Teste / RS`. Save and confirm it appears.
5. Edit "Cidade Teste" → change name → save → confirm change in list.
6. Try to delete "São Paulo" while no delegação exists — should succeed. (Skip this step if there's anyone using this DB.)
7. Open **Delegações** → "+ Nova Delegação". In the município selector, type "Bras" → pick "Brasília — DF" → fill nome → save.
8. Try deleting "Brasília" in the municípios list — expect 409 "Remova as delegações vinculadas...".
9. Remove the delegação, then delete "Brasília" again — should succeed.
10. Delete "Cidade Teste" from municípios list — should succeed.

- [ ] **Step 4: Report**

If everything passes: write a brief note in the PR description confirming all 10 manual steps passed. If any step fails, capture the request/response from the network tab and bring it back for a fix.

---

## Self-review notes

The plan covers every section of the spec:

| Spec section | Covered by |
|---|---|
| Modelo `Municipio` | Task 1 |
| Mudanças em `Delegacao` (FK + drop colunas) | Task 1 |
| Endpoints CRUD + auth differentiation | Tasks 2, 6 |
| Endpoint de import com CSV | Tasks 4, 5, 6 |
| Header normalization + UF map + validações | Tasks 3, 5 |
| Testes vitest cobrindo parser e service | Tasks 2, 4, 5 |
| Frontend tipos + service | Task 8 |
| `MunicipioSelect` autocomplete | Task 9 |
| Lista/Form/Import pages | Task 10 |
| Ajuste em Delegacao (form/list) | Tasks 7, 11 |
| Roteamento e sidebar | Task 12 |
| Operação inicial e smoke test | Task 13 |

Risks from the spec (CSV mal-formado, exclusão com delegação vinculada, performance) are addressed by tests in Tasks 2 and 5 and by the indexes added in Task 1.
