# F5 — Import CSV de Inscrições Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar inscrições em lote via CSV dentro de uma (evento, modalidade). Wizard 3 passos no frontend (upload → review/dry-run → commit). Auto-cria Participantes globais que ainda não existem (match case-insensitive por nome + municipio_id). Modo parcial: linhas com erro não bloqueiam as boas. Bump para `1.11.0`.

**Architecture:** Backend `inscricoes.service.importar` é puro — dry_run e commit usam o mesmo algoritmo, com índices em memória (municipios, participantes existentes + criados, inscricoes existentes + criadas) que vão sendo populados durante o loop. Diferença: dry_run NÃO chama writes do Prisma (apenas simula); commit chama `participante.create` e `inscricao.create` por linha. Frontend: parsing CSV client-side via `papaparse`, modal com state machine 3 steps.

**Tech Stack:** Express + Zod + Prisma (sem nova entidade — usa Participante, Municipio, Inscricao existentes), Vitest. React 18 + Vite + papaparse (nova dep frontend).

**Spec:** `docs/superpowers/specs/2026-05-30-f5-import-inscricoes-design.md`

---

## File Structure

**Backend — Modify:**
- `backend/src/modules/inscricoes/inscricoes.service.ts` — adicionar `importar(input)`.
- `backend/src/modules/inscricoes/inscricoes.service.test.ts` — +10 testes.
- `backend/src/modules/inscricoes/inscricoes.controller.ts` — adicionar handler `importar` + Zod schema.
- `backend/src/modules/inscricoes/inscricoes.routes.ts` — rota `POST /import`.

**Frontend — Modify:**
- `frontend/package.json` — adicionar `papaparse` + `@types/papaparse`.
- `frontend/src/types/inscricao.ts` — adicionar `ImportRow`, `ImportRowResult`, `ImportResult`.
- `frontend/src/services/inscricoes.ts` — adicionar `importar`.
- `frontend/src/pages/eventos/EventoInscricoes.tsx` — adicionar botão "Importar CSV" + abertura do modal.

**Frontend — Create:**
- `frontend/src/components/import/ImportInscricoesModal.tsx` — wizard 3 steps.

**Release:**
- `package.json` (root): `1.10.0` → `1.11.0`.
- `CHANGELOG.md`: bloco novo `[1.11.0]`.

---

## Task 1: Backend service — `importar` (TDD)

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\inscricoes\inscricoes.service.ts`
- Modify: `backend/src/modules/inscricoes/inscricoes.service.test.ts`

- [ ] **Step 1: Atualizar `vi.mock` no test file**

Localizar o `vi.mock('../../lib/prisma', ...)` no topo de `inscricoes.service.test.ts`. Substituir o bloco inteiro por:

```ts
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
    municipio: {
      findMany: vi.fn(),
    },
    participante: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))
```

- [ ] **Step 2: Adicionar 10 testes de `importar` no final do `describe('inscricoes.service')`**

Inserir ANTES do `})` que fecha o `describe`:

```ts
  describe('importar', () => {
    const baseInput = (overrides: any = {}) => ({
      evento_id: 1,
      modalidade_id: 2,
      dry_run: false,
      rows: [],
      ...overrides,
    })

    function setupOk() {
      mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 10 })
      mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 10 })
      mockPrisma.municipio.findMany.mockResolvedValue([
        { id: 100, nome: 'São Paulo', uf: 'SP' },
        { id: 101, nome: 'Rio de Janeiro', uf: 'RJ' },
      ])
      mockPrisma.participante.findMany.mockResolvedValue([])
      mockPrisma.inscricao.findMany.mockResolvedValue([])
    }

    it('lança 404 se evento não existe', async () => {
      mockPrisma.evento.findUnique.mockResolvedValue(null)
      mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 10 })
      await expect(service.importar(baseInput({ rows: [{ nome: 'X', municipio_uf: 'SP', municipio_nome: 'São Paulo' }] })))
        .rejects.toMatchObject({ status: 404, message: expect.stringContaining('Evento') })
    })

    it('lança 404 se modalidade não existe', async () => {
      mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 10 })
      mockPrisma.modalidade.findUnique.mockResolvedValue(null)
      await expect(service.importar(baseInput({ rows: [{ nome: 'X', municipio_uf: 'SP', municipio_nome: 'São Paulo' }] })))
        .rejects.toMatchObject({ status: 404, message: expect.stringContaining('Modalidade') })
    })

    it('lança 400 se competições não batem', async () => {
      mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 10 })
      mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 99 })
      await expect(service.importar(baseInput({ rows: [{ nome: 'X', municipio_uf: 'SP', municipio_nome: 'São Paulo' }] })))
        .rejects.toMatchObject({ status: 400, message: expect.stringContaining('competição') })
    })

    it('linha com município inexistente → erro', async () => {
      setupOk()
      const result = await service.importar(baseInput({
        rows: [{ nome: 'João', municipio_uf: 'SP', municipio_nome: 'Cidade Inexistente' }],
      }))
      expect(result.rows[0]).toMatchObject({ linha: 1, status: 'erro', erro: expect.stringContaining('Município') })
      expect(result.contadores).toEqual({ criadas: 0, duplicadas: 0, erros: 1, participantes_criados: 0 })
      expect(mockPrisma.inscricao.create).not.toHaveBeenCalled()
      expect(mockPrisma.participante.create).not.toHaveBeenCalled()
    })

    it('participante existente já inscrito → duplicada', async () => {
      setupOk()
      mockPrisma.participante.findMany.mockResolvedValue([
        { id: 500, nome: 'joão', municipio_id: 100 },
      ])
      mockPrisma.inscricao.findMany.mockResolvedValue([{ participante_id: 500 }])
      const result = await service.importar(baseInput({
        rows: [{ nome: 'João', municipio_uf: 'SP', municipio_nome: 'são paulo' }],
      }))
      expect(result.rows[0]).toMatchObject({ status: 'duplicada' })
      expect(result.contadores).toEqual({ criadas: 0, duplicadas: 1, erros: 0, participantes_criados: 0 })
      expect(mockPrisma.inscricao.create).not.toHaveBeenCalled()
      expect(mockPrisma.participante.create).not.toHaveBeenCalled()
    })

    it('participante existente NÃO inscrito → criada (sem criar participante)', async () => {
      setupOk()
      mockPrisma.participante.findMany.mockResolvedValue([
        { id: 500, nome: 'João Silva', municipio_id: 100 },
      ])
      mockPrisma.inscricao.findMany.mockResolvedValue([])
      mockPrisma.inscricao.create.mockResolvedValue({ id: 999 })
      const result = await service.importar(baseInput({
        rows: [{ nome: 'João Silva', municipio_uf: 'SP', municipio_nome: 'São Paulo' }],
      }))
      expect(result.rows[0]).toMatchObject({ status: 'criada', participante_criado: false })
      expect(mockPrisma.inscricao.create).toHaveBeenCalledWith({
        data: { evento_id: 1, modalidade_id: 2, participante_id: 500 },
      })
      expect(mockPrisma.participante.create).not.toHaveBeenCalled()
    })

    it('participante novo → criada (criando participante)', async () => {
      setupOk()
      mockPrisma.participante.create.mockResolvedValue({ id: 777 })
      mockPrisma.inscricao.create.mockResolvedValue({ id: 998 })
      const result = await service.importar(baseInput({
        rows: [{ nome: 'Maria', municipio_uf: 'RJ', municipio_nome: 'Rio de Janeiro', subtitulo: 'Atleta B' }],
      }))
      expect(result.rows[0]).toMatchObject({ status: 'criada', participante_criado: true })
      expect(mockPrisma.participante.create).toHaveBeenCalledWith({
        data: { nome: 'Maria', municipio_id: 101, subtitulo: 'Atleta B' },
      })
      expect(mockPrisma.inscricao.create).toHaveBeenCalledWith({
        data: { evento_id: 1, modalidade_id: 2, participante_id: 777 },
      })
      expect(result.contadores).toEqual({ criadas: 1, duplicadas: 0, erros: 0, participantes_criados: 1 })
    })

    it('2 linhas com mesmo participante novo → 1 criada + 1 duplicada (index em memória)', async () => {
      setupOk()
      mockPrisma.participante.create.mockResolvedValue({ id: 777 })
      mockPrisma.inscricao.create.mockResolvedValue({ id: 998 })
      const result = await service.importar(baseInput({
        rows: [
          { nome: 'Maria', municipio_uf: 'RJ', municipio_nome: 'Rio de Janeiro' },
          { nome: 'maria', municipio_uf: 'RJ', municipio_nome: 'Rio de Janeiro' },
        ],
      }))
      expect(result.rows[0]).toMatchObject({ status: 'criada', participante_criado: true })
      expect(result.rows[1]).toMatchObject({ status: 'duplicada' })
      expect(mockPrisma.participante.create).toHaveBeenCalledTimes(1)
      expect(mockPrisma.inscricao.create).toHaveBeenCalledTimes(1)
    })

    it('dry_run não chama nenhum create', async () => {
      setupOk()
      const result = await service.importar(baseInput({
        dry_run: true,
        rows: [
          { nome: 'Maria', municipio_uf: 'RJ', municipio_nome: 'Rio de Janeiro' },
          { nome: 'João Silva', municipio_uf: 'SP', municipio_nome: 'São Paulo' },
        ],
      }))
      expect(mockPrisma.participante.create).not.toHaveBeenCalled()
      expect(mockPrisma.inscricao.create).not.toHaveBeenCalled()
      expect(result.contadores.criadas).toBe(2)
      expect(result.contadores.participantes_criados).toBe(2)
    })

    it('match case-insensitive em participante.nome (evita duplicata por capitalização)', async () => {
      setupOk()
      mockPrisma.participante.findMany.mockResolvedValue([
        { id: 500, nome: 'João Silva', municipio_id: 100 },
      ])
      const result = await service.importar(baseInput({
        dry_run: true,
        rows: [{ nome: 'joão silva', municipio_uf: 'SP', municipio_nome: 'São Paulo' }],
      }))
      // Não cria participante (matched existente case-insensitive)
      expect(result.rows[0]).toMatchObject({ status: 'criada', participante_criado: false })
    })
  })
```

- [ ] **Step 3: Rodar testes — FAIL**

De `backend/`:
```
npx vitest run src/modules/inscricoes/inscricoes.service.test.ts
```

Esperado: FAIL com `service.importar is not a function` (ou TS error similar).

- [ ] **Step 4: Implementar `importar` no service**

Adicionar ao final de `backend/src/modules/inscricoes/inscricoes.service.ts` (depois do `remover`):

```ts
export type ImportRow = {
  nome: string
  municipio_uf: string
  municipio_nome: string
  subtitulo?: string
}

export type ImportRowResult = {
  linha: number
  nome: string
  status: 'criada' | 'duplicada' | 'erro'
  erro?: string
  participante_criado?: boolean
}

export type ImportResult = {
  rows: ImportRowResult[]
  contadores: {
    criadas: number
    duplicadas: number
    erros: number
    participantes_criados: number
  }
}

export async function importar(input: {
  evento_id: number
  modalidade_id: number
  dry_run: boolean
  rows: ImportRow[]
}): Promise<ImportResult> {
  const [evento, modalidade] = await Promise.all([
    prisma.evento.findUnique({
      where: { id: input.evento_id },
      select: { id: true, competicao_id: true },
    }),
    prisma.modalidade.findUnique({
      where: { id: input.modalidade_id },
      select: { id: true, competicao_id: true },
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

  // Pre-load: municípios por UFs distintas presentes nos rows
  const ufsSet = new Set(input.rows.map(r => r.municipio_uf.toUpperCase()))
  const municipios = await prisma.municipio.findMany({
    where: { uf: { in: Array.from(ufsSet) } },
    select: { id: true, nome: true, uf: true },
  })
  const municipiosByKey = new Map<string, number>()
  for (const m of municipios) {
    municipiosByKey.set(`${m.uf.toUpperCase()}:${m.nome.toLowerCase()}`, m.id)
  }

  // Pre-load: participantes dos municípios encontrados
  const municipioIds = municipios.map(m => m.id)
  const participantes = municipioIds.length > 0
    ? await prisma.participante.findMany({
        where: { municipio_id: { in: municipioIds } },
        select: { id: true, nome: true, municipio_id: true },
      })
    : []
  const participantesByKey = new Map<string, number>()
  for (const p of participantes) {
    participantesByKey.set(`${p.municipio_id}:${p.nome.toLowerCase()}`, p.id)
  }

  // Pre-load: inscrições já existentes nesta (evento, modalidade)
  const inscricoes = await prisma.inscricao.findMany({
    where: { evento_id: input.evento_id, modalidade_id: input.modalidade_id },
    select: { participante_id: true },
  })
  const inscritosSet = new Set<number>(inscricoes.map(i => i.participante_id))

  const results: ImportRowResult[] = []
  const contadores = { criadas: 0, duplicadas: 0, erros: 0, participantes_criados: 0 }

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i]
    const linha = i + 1
    const nome = row.nome.trim()
    const uf = row.municipio_uf.trim().toUpperCase()
    const munNome = row.municipio_nome.trim()
    const subtitulo = row.subtitulo?.trim() || undefined

    const munKey = `${uf}:${munNome.toLowerCase()}`
    const municipio_id = municipiosByKey.get(munKey)
    if (!municipio_id) {
      results.push({ linha, nome, status: 'erro', erro: `Município '${munNome}/${uf}' não encontrado` })
      contadores.erros++
      continue
    }

    const partKey = `${municipio_id}:${nome.toLowerCase()}`
    let participante_id = participantesByKey.get(partKey)
    let participante_criado = false

    if (!participante_id) {
      if (input.dry_run) {
        // Simula criação — usa id sintético (negativo) só para tracking interno
        participante_id = -linha
      } else {
        const created = await prisma.participante.create({
          data: { nome, municipio_id, subtitulo },
        })
        participante_id = created.id
      }
      participantesByKey.set(partKey, participante_id)
      participante_criado = true
      contadores.participantes_criados++
    }

    if (inscritosSet.has(participante_id)) {
      results.push({ linha, nome, status: 'duplicada' })
      contadores.duplicadas++
      continue
    }

    if (!input.dry_run) {
      await prisma.inscricao.create({
        data: {
          evento_id: input.evento_id,
          modalidade_id: input.modalidade_id,
          participante_id,
        },
      })
    }
    inscritosSet.add(participante_id)
    results.push({ linha, nome, status: 'criada', participante_criado })
    contadores.criadas++
  }

  return { rows: results, contadores }
}
```

- [ ] **Step 5: Rodar testes — pass**

```
npx vitest run src/modules/inscricoes/inscricoes.service.test.ts
```

Esperado: todos os testes passam (9 anteriores + 10 novos = 19).

- [ ] **Step 6: Commit**

```
git add backend/src/modules/inscricoes/inscricoes.service.ts backend/src/modules/inscricoes/inscricoes.service.test.ts
git commit -m "feat(inscricoes): add bulk import with dry-run and auto-create participantes" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Controller — Zod + handler `importar`

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\inscricoes\inscricoes.controller.ts`
- Modify: `backend/src/modules/inscricoes/inscricoes.routes.ts`

- [ ] **Step 1: Substituir o arquivo `inscricoes.controller.ts` inteiro**

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

const importRowSchema = z.object({
  nome: z.string().min(1).max(200),
  municipio_uf: z.string().length(2),
  municipio_nome: z.string().min(1).max(120),
  subtitulo: z.string().max(200).optional(),
})

const importSchema = z.object({
  evento_id: z.coerce.number().int().positive(),
  modalidade_id: z.coerce.number().int().positive(),
  dry_run: z.boolean(),
  rows: z.array(importRowSchema).min(1).max(2000),
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

export async function importar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = importSchema.parse(req.body)
    res.json(await service.importar(body))
  } catch (err) { next(err) }
}
```

- [ ] **Step 2: Substituir o arquivo `inscricoes.routes.ts` inteiro**

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
router.post('/import', ...admin, ctrl.importar)
router.delete('/:id', ...admin, ctrl.remover)

export default router
```

- [ ] **Step 3: tsc + full suite**

De `backend/`:
```
npx tsc --noEmit && npx vitest run
```

Esperado: tsc clean, suíte completa verde.

- [ ] **Step 4: Commit**

```
git add backend/src/modules/inscricoes/inscricoes.controller.ts backend/src/modules/inscricoes/inscricoes.routes.ts
git commit -m "feat(inscricoes): expose POST /import endpoint" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Frontend — instalar papaparse + tipos + service

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\package.json` (via npm install)
- Modify: `frontend/src/types/inscricao.ts`
- Modify: `frontend/src/services/inscricoes.ts`

- [ ] **Step 1: Instalar papaparse + types**

De `frontend/`:
```
npm install papaparse @types/papaparse
```

Esperado: dependências adicionadas a `package.json` + `package-lock.json`.

- [ ] **Step 2: Substituir `frontend/src/types/inscricao.ts` inteiro**

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

export type ImportRow = {
  nome: string
  municipio_uf: string
  municipio_nome: string
  subtitulo?: string
}

export type ImportRowResult = {
  linha: number
  nome: string
  status: 'criada' | 'duplicada' | 'erro'
  erro?: string
  participante_criado?: boolean
}

export type ImportResult = {
  rows: ImportRowResult[]
  contadores: {
    criadas: number
    duplicadas: number
    erros: number
    participantes_criados: number
  }
}
```

- [ ] **Step 3: Substituir `frontend/src/services/inscricoes.ts` inteiro**

Conteúdo exato:

```ts
import api from './api'
import type { Inscricao, ImportRow, ImportResult } from '../types/inscricao'

const BASE = '/inscricoes'

type InscricaoPayload = {
  evento_id: number
  modalidade_id: number
  participante_id: number
}

type ImportPayload = {
  evento_id: number
  modalidade_id: number
  dry_run: boolean
  rows: ImportRow[]
}

export const inscricoesService = {
  listar: (params?: { evento_id?: number; modalidade_id?: number }) =>
    api.get<Inscricao[]>(BASE, { params }).then(r => r.data),
  criar: (data: InscricaoPayload) => api.post<Inscricao>(BASE, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
  importar: (data: ImportPayload) =>
    api.post<ImportResult>(`${BASE}/import`, data).then(r => r.data),
}
```

- [ ] **Step 4: tsc**

De `frontend/`:
```
npx tsc --noEmit
```

Esperado: clean.

- [ ] **Step 5: Commit**

```
git add frontend/package.json frontend/package-lock.json frontend/src/types/inscricao.ts frontend/src/services/inscricoes.ts
git commit -m "feat(frontend): add papaparse dep + ImportRow/Result types + service.importar" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Frontend — `ImportInscricoesModal` (wizard 3 steps)

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\components\import\ImportInscricoesModal.tsx`

- [ ] **Step 1: Criar o componente**

Conteúdo exato:

```tsx
import { useState } from 'react'
import Papa from 'papaparse'
import { inscricoesService } from '../../services/inscricoes'
import type { ImportRow, ImportResult } from '../../types/inscricao'

type Props = {
  open: boolean
  eventoId: number
  modalidadeId: number
  onClose: () => void
  onImported: () => void
}

const REQUIRED_HEADERS = ['nome', 'municipio_uf', 'municipio_nome'] as const
type Step = 'upload' | 'review' | 'done'

function StatusBadge({ status }: { status: 'criada' | 'duplicada' | 'erro' }) {
  const map = {
    criada: { label: 'Criada', color: 'bg-[var(--success-soft)] text-[var(--success-700)] border-[var(--success)]' },
    duplicada: { label: 'Duplicada', color: 'bg-[var(--warn-soft)] text-[var(--warn-700)] border-[var(--warn)]' },
    erro: { label: 'Erro', color: 'bg-[var(--danger-soft)] text-[var(--danger-700)] border-[var(--danger)]' },
  } as const
  const m = map[status]
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${m.color}`}>
      {m.label}
    </span>
  )
}

export default function ImportInscricoesModal({ open, eventoId, modalidadeId, onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [commit, setCommit] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  function reset() {
    setStep('upload')
    setFile(null)
    setRows([])
    setPreview(null)
    setCommit(null)
    setLoading(false)
    setErro('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setErro('') }
  }

  function handleParseNext() {
    if (!file) { setErro('Selecione um arquivo CSV.'); return }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const headers = result.meta.fields ?? []
        const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h))
        if (missing.length > 0) {
          setErro(`Cabeçalho inválido. Coluna(s) obrigatória(s) ausente(s): ${missing.join(', ')}`)
          return
        }
        const parsed: ImportRow[] = result.data
          .map(r => ({
            nome: (r.nome ?? '').trim(),
            municipio_uf: (r.municipio_uf ?? '').trim(),
            municipio_nome: (r.municipio_nome ?? '').trim(),
            subtitulo: r.subtitulo?.trim() || undefined,
          }))
          .filter(r => r.nome && r.municipio_uf && r.municipio_nome)
        if (parsed.length === 0) {
          setErro('Nenhuma linha válida encontrada no CSV.')
          return
        }
        setRows(parsed)
        runPreview(parsed)
      },
      error: (err) => setErro(`Erro ao ler CSV: ${err.message}`),
    })
  }

  async function runPreview(parsedRows: ImportRow[]) {
    setLoading(true)
    setErro('')
    try {
      const res = await inscricoesService.importar({
        evento_id: eventoId,
        modalidade_id: modalidadeId,
        dry_run: true,
        rows: parsedRows,
      })
      setPreview(res)
      setStep('review')
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Erro ao validar.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCommit() {
    setLoading(true)
    setErro('')
    try {
      const res = await inscricoesService.importar({
        evento_id: eventoId,
        modalidade_id: modalidadeId,
        dry_run: false,
        rows,
      })
      setCommit(res)
      setStep('done')
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Erro ao importar.')
    } finally {
      setLoading(false)
    }
  }

  function handleDone() {
    onImported()
    handleClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-30" onClick={handleClose}>
      <div
        className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6 max-w-3xl w-full mx-4 max-h-[85vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--t1)]">Importar inscrições (CSV)</h3>
          <div className="text-xs text-[var(--t3)]">
            Passo {step === 'upload' ? '1' : step === 'review' ? '2' : '3'} de 3
          </div>
        </div>

        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--t2)]">
              Cabeçalho obrigatório: <code className="font-mono text-xs">nome,municipio_uf,municipio_nome,subtitulo</code> (subtítulo é opcional).
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-[var(--t1)] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[var(--brand-500)] file:text-white file:cursor-pointer"
            />
            {file && <p className="text-xs text-[var(--t3)]">Arquivo: {file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
            {erro && <p className="text-sm text-[var(--danger)]">{erro}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={handleClose} className="px-4 py-2 text-sm text-[var(--t2)] hover:text-[var(--t1)]">Cancelar</button>
              <button
                onClick={handleParseNext}
                disabled={!file || loading}
                className="btn btn-primary disabled:opacity-50"
              >{loading ? 'Validando...' : 'Próximo'}</button>
            </div>
          </div>
        )}

        {step === 'review' && preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3">
                <div className="text-2xl font-bold text-[var(--success)]">{preview.contadores.criadas}</div>
                <div className="text-xs text-[var(--t3)]">Serão criadas</div>
              </div>
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3">
                <div className="text-2xl font-bold text-[var(--warn)]">{preview.contadores.duplicadas}</div>
                <div className="text-xs text-[var(--t3)]">Duplicadas</div>
              </div>
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3">
                <div className="text-2xl font-bold text-[var(--danger)]">{preview.contadores.erros}</div>
                <div className="text-xs text-[var(--t3)]">Erros</div>
              </div>
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3">
                <div className="text-2xl font-bold text-[var(--brand-500)]">{preview.contadores.participantes_criados}</div>
                <div className="text-xs text-[var(--t3)]">Participantes novos</div>
              </div>
            </div>

            <div className="border border-[var(--card-border)] rounded-lg overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--card-bg-2)] text-[var(--t2)] text-xs">
                  <tr>
                    <th className="text-left px-3 py-2 w-12">#</th>
                    <th className="text-left px-3 py-2">Nome</th>
                    <th className="text-left px-3 py-2 w-28">Status</th>
                    <th className="text-left px-3 py-2">Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map(r => (
                    <tr key={r.linha} className="border-t border-[var(--card-border)]">
                      <td className="px-3 py-2 font-mono text-xs text-[var(--t3)]">{r.linha}</td>
                      <td className="px-3 py-2 text-[var(--t1)]">{r.nome}</td>
                      <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-2 text-xs text-[var(--t3)]">
                        {r.erro ?? (r.participante_criado ? 'Novo participante' : '')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {erro && <p className="text-sm text-[var(--danger)]">{erro}</p>}

            <div className="flex justify-between gap-2 pt-2">
              <button onClick={() => { setStep('upload'); setPreview(null) }} className="px-4 py-2 text-sm text-[var(--t2)] hover:text-[var(--t1)]">← Voltar</button>
              <button
                onClick={handleCommit}
                disabled={loading || preview.contadores.criadas === 0}
                className="btn btn-primary disabled:opacity-50"
              >
                {loading
                  ? 'Importando...'
                  : preview.contadores.criadas === 0
                    ? 'Nada para importar'
                    : `Importar ${preview.contadores.criadas} inscriç${preview.contadores.criadas === 1 ? 'ão' : 'ões'}`}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && commit && (
          <div className="space-y-4 text-center">
            <div className="text-5xl">✅</div>
            <h4 className="text-xl font-semibold text-[var(--t1)]">Importação concluída</h4>
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3">
                <div className="text-2xl font-bold text-[var(--success)]">{commit.contadores.criadas}</div>
                <div className="text-xs text-[var(--t3)]">Criadas</div>
              </div>
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3">
                <div className="text-2xl font-bold text-[var(--warn)]">{commit.contadores.duplicadas}</div>
                <div className="text-xs text-[var(--t3)]">Duplicadas</div>
              </div>
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3">
                <div className="text-2xl font-bold text-[var(--danger)]">{commit.contadores.erros}</div>
                <div className="text-xs text-[var(--t3)]">Erros</div>
              </div>
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3">
                <div className="text-2xl font-bold text-[var(--brand-500)]">{commit.contadores.participantes_criados}</div>
                <div className="text-xs text-[var(--t3)]">Participantes novos</div>
              </div>
            </div>
            <div className="pt-2">
              <button onClick={handleDone} className="btn btn-primary">Fechar</button>
            </div>
          </div>
        )}
      </div>
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
git add frontend/src/components/import/ImportInscricoesModal.tsx
git commit -m "feat(frontend): add ImportInscricoesModal (wizard 3 passos + papaparse)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Integrar botão "Importar CSV" na página `EventoInscricoes`

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\eventos\EventoInscricoes.tsx`

- [ ] **Step 1: Adicionar import do componente**

Localizar a lista de imports no topo. Após `import ParticipanteSelect from '../../components/ParticipanteSelect'`, adicionar:

```tsx
import ImportInscricoesModal from '../../components/import/ImportInscricoesModal'
```

- [ ] **Step 2: Adicionar state para o modal**

Localizar o bloco de useState (após `const [erroSorteio, setErroSorteio] = useState('')`). Adicionar:

```tsx
const [importOpen, setImportOpen] = useState(false)
```

- [ ] **Step 3: Adicionar botão "Importar CSV" ao lado de "+ Inscrever"**

Localizar o bloco do botão "+ Inscrever":

```tsx
              <button
                onClick={() => { setInscreverOpen(true); setPickedId(null); setErroModal('') }}
                className="btn btn-primary"
              >+ Inscrever</button>
```

Substituir por (envolvendo num flex container):

```tsx
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
```

- [ ] **Step 4: Renderizar o modal de import**

Localizar o bloco do modal de Inscrever (`{inscreverOpen && (...)}`). Adicionar logo após, antes do fechamento do componente:

```tsx
      <ImportInscricoesModal
        open={importOpen}
        eventoId={eventoId}
        modalidadeId={modalidadeId ?? 0}
        onClose={() => setImportOpen(false)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['inscricoes', eventoId, modalidadeId] })}
      />
```

- [ ] **Step 5: tsc + build**

De `frontend/`:
```
npx tsc --noEmit && npm run build
```

Esperado: tsc clean, vite build OK.

- [ ] **Step 6: Commit**

```
git add frontend/src/pages/eventos/EventoInscricoes.tsx
git commit -m "feat(frontend): wire Importar CSV button + modal no workspace" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Bump versão + CHANGELOG

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\package.json`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\CHANGELOG.md`

- [ ] **Step 1: Bump version**

Editar `package.json` (root). Mudar **somente** `"version": "1.10.0"` para `"version": "1.11.0"`.

- [ ] **Step 2: Adicionar bloco no `CHANGELOG.md`**

Inserir o bloco abaixo logo após o cabeçalho e **antes** do bloco `## [1.10.0]`:

```md
## [1.11.0] - 2026-05-30

### Added
- Importação CSV em massa de inscrições no workspace de evento (`/eventos/:id/inscricoes`) — wizard 3 passos: upload → revisão (dry-run com contadores e tabela por linha) → importação.
- Auto-criação de Participante global quando o CSV traz nome+município que ainda não existe (match case-insensitive).
- Endpoint `POST /inscricoes/import` (admin) com modo `dry_run` para preview sem persistência.

### Notes
- CSV header obrigatório: `nome,municipio_uf,municipio_nome,subtitulo` (subtítulo opcional). Linhas com município inexistente viram erro e não bloqueiam as demais.
- Limite de 2000 linhas por import.
```

- [ ] **Step 3: Commit**

```
git add package.json CHANGELOG.md
git commit -m "chore(release): v1.11.0 — F5 Import CSV de Inscrições" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Push + smoke (pós-deploy CI)

**Files:** (sem edição — verificação)

- [ ] **Step 1: Push**

```
git push origin develop
```

CI reconstrói backend (sem migrations novas) e frontend (com nova dep papaparse, primeiro `npm ci` vai baixá-la). ~4-5min.

- [ ] **Step 2: Verificar deploy**

```
curl -s -o /dev/null -w "/health: %{http_code}\n" http://192.168.56.113:3000/health
curl -s -o /dev/null -w "/inscricoes/import (no auth): %{http_code}\n" -X POST http://192.168.56.113:3000/inscricoes/import
curl -s -o /dev/null -w "frontend: %{http_code}\n" http://192.168.56.113:8080/
```

Esperado: `/health 200`, `/inscricoes/import 401`, frontend `200`.

- [ ] **Step 3: Smoke no browser**

Abrir http://192.168.56.113:8080, login `admin@prosports.com` / `admin123`. Preparar um CSV de teste:

```csv
nome,municipio_uf,municipio_nome,subtitulo
João Silva,SP,São Paulo,Atleta A
Maria Souza,RJ,Rio de Janeiro,
Pedro Oliveira,SP,Cidade Que Não Existe,
```

1. /eventos → Inscrições em algum evento → selecionar uma modalidade.
2. Botão "Importar CSV" aparece ao lado de "+ Inscrever".
3. Click → modal abre no passo 1 ("Passo 1 de 3").
4. Selecionar arquivo CSV → click "Próximo".
5. Passo 2 mostra tabela: linha 1 e 2 com status "Criada" (Participante novo se nomes inéditos), linha 3 com status "Erro" e detalhe "Município 'Cidade Que Não Existe/SP' não encontrado". Contadores corretos.
6. Click "Importar 2 inscrições".
7. Passo 3 mostra resumo verde com ✅ + contadores finais.
8. Click "Fechar" → modal fecha, lista de inscritos da modalidade atualiza com as 2 novas.
9. Testar header inválido: subir um CSV faltando `municipio_nome` → erro inline no passo 1 antes de submeter.
10. Testar duplicata: importar o mesmo CSV de novo → todas as 2 linhas válidas viram "Duplicada" na revisão (não inscreve de novo).
11. Rodapé sidebar: `v1.11.0`.

- [ ] **Step 4: Reportar**

Se passou, F5 fechada.

---

## Self-review

Cobertura do spec:

| Spec | Coberto por |
|---|---|
| Service `importar` com dry_run + commit, pre-load de municípios/participantes/inscrições, index em memória, match case-insensitive em nome de participante e município | Task 1 |
| Auto-criar Participante quando não existe (mesmo batch → 1 cria + 1 duplicada) | Task 1 |
| Validações 404 evento/modalidade, 400 competições mismatch | Task 1 |
| Linha com erro não bloqueia outras (parcial) | Task 1 |
| Controller Zod (max 2000 rows) + route `POST /import` (admin) | Task 2 |
| Frontend: papaparse dep + tipos + service | Task 3 |
| Modal wizard 3 passos com header validation, dry-run preview, commit, done summary | Task 4 |
| Botão "Importar CSV" + wire do modal na página | Task 5 |
| Bump 1.11.0 + CHANGELOG | Task 6 |
| Smoke pós-deploy via browser com CSV de teste | Task 7 |

Riscos endereçados:
- **Dry_run testável**: caminho simulado que NÃO chama `participante.create` nem `inscricao.create` (Task 1 implementation + Task 1 test #9 confirma com spy).
- **Index em memória resolve duplicatas dentro do mesmo batch**: Task 1 test #8 cobre.
- **Case-insensitive match**: município e participante, Task 1 test #5 (município) e #10 (participante).
- **Header inválido capturado no client antes de enviar**: Task 4 step `handleParseNext` valida `missing.length > 0`.
- **CSV sem linhas válidas**: Task 4 erro inline.
- **modalidadeId pode ser null quando o modal abre**: garantido pela UX — botão só aparece quando modalidade está selecionada (Task 5 step 3 fica dentro do bloco condicional `modalidadeId != null` da página). Mas como fallback, `modalidadeId ?? 0` é passado pro modal (Task 5 step 4) — se for 0 e o usuário tentar usar de algum jeito, o backend retornaria 404 modalidade, capturado em `erro`.
- **Performance de pre-load**: aceito por enquanto (spec).
- **Sem nova entidade**: usa Inscricao, Participante, Municipio existentes — nada de migração.
