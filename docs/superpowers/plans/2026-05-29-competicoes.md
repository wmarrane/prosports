# Competições Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a entidade `Competicao` (nome único, lista de UFs onde acontece, flag `adicionar_subtitulo`) com CRUD admin, mover o item "Competições" do sidebar para o grupo "Cadastros" (removendo o item morto "Edições"), e extrair a constante `UFS` para um módulo compartilhado.

**Architecture:** Backend ganha um módulo novo `competicoes` (service/controller/routes/tests) seguindo o padrão de `modalidades`/`inspetorias`. Service valida cada UF contra `SIGLAS_VALIDAS` de `municipios/uf.ts` e mapeia violação de unique constraint para 409. Frontend tem types/service novos + páginas `CompeticoesList` e `CompeticaoForm` (com grid de 27 checkboxes para UFs). Sidebar reorganizado: grupo "Competições" inteiro removido, item movido para o fim de "Cadastros".

**Tech Stack:** Prisma (Postgres com `String[]` para array), Express + Zod, Vitest, React 18 + Vite + React Query + Tailwind + React Router.

**Spec:** `docs/superpowers/specs/2026-05-29-competicoes-design.md`

---

## File Structure

**Backend — Create:**
- `backend/src/modules/competicoes/competicoes.service.ts`
- `backend/src/modules/competicoes/competicoes.service.test.ts`
- `backend/src/modules/competicoes/competicoes.controller.ts`
- `backend/src/modules/competicoes/competicoes.routes.ts`
- `backend/prisma/migrations/<timestamp>_add_competicao/migration.sql` (auto-generated)

**Backend — Modify:**
- `backend/prisma/schema.prisma` — adicionar model `Competicao`.
- `backend/src/index.ts` — registrar `competicoesRoutes`.

**Frontend — Create:**
- `frontend/src/lib/ufs.ts` (constante extraída)
- `frontend/src/types/competicao.ts`
- `frontend/src/services/competicoes.ts`
- `frontend/src/pages/competicoes/CompeticoesList.tsx`
- `frontend/src/pages/competicoes/CompeticaoForm.tsx`

**Frontend — Modify:**
- `frontend/src/pages/municipios/MunicipiosList.tsx` — importar `UFS` de `lib/ufs`.
- `frontend/src/pages/municipios/MunicipioForm.tsx` — idem.
- `frontend/src/App.tsx` — adicionar 3 rotas `/competicoes/*`.
- `frontend/src/components/Layout.tsx` — mover item, remover grupo "Competições".

**Release:**
- `package.json` (root): `1.2.0` → `1.3.0`.
- `CHANGELOG.md` (root): novo bloco `## [1.3.0]` no topo.

---

## Task 1: Prisma — model `Competicao` + migration

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\prisma\schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_add_competicao/migration.sql` (auto-generated)

- [ ] **Step 1: Adicionar o model no fim do `schema.prisma`**

Abrir `backend/prisma/schema.prisma`. Adicionar o bloco abaixo no final do arquivo (depois do último model existente, sem tocar nos outros):

```prisma
model Competicao {
  id                  Int       @id @default(autoincrement())
  nome                String    @unique
  estados             String[]
  adicionar_subtitulo Boolean   @default(false)
  criado_em           DateTime  @default(now())
  atualizado_em       DateTime  @updatedAt
}
```

- [ ] **Step 2: Gerar a migration**

De `backend/`:
```bash
npx prisma migrate dev --name add_competicao
```

Sem dados a preservar, sem prompt de data loss. Cria a tabela e regenera o client.

Se a CLI bloquear por shell não-TTY ou rede, usar fallback:
```bash
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > /tmp/migration.sql
# inspecionar /tmp/migration.sql; criar pasta backend/prisma/migrations/<timestamp>_add_competicao/ e copiar o conteúdo para migration.sql; aplicar com `npx prisma migrate deploy` em seguida.
```

Após o migrate, rodar `npx prisma generate` para garantir que o client tenha `prisma.competicao`.

- [ ] **Step 3: Verificar a migration.sql gerada**

Abrir `backend/prisma/migrations/<timestamp>_add_competicao/migration.sql` e confirmar:
- `CREATE TABLE "Competicao"`
- `"nome" TEXT NOT NULL`
- `"estados" TEXT[]`
- `"adicionar_subtitulo" BOOLEAN NOT NULL DEFAULT false`
- `CREATE UNIQUE INDEX "Competicao_nome_key" ON "Competicao"("nome")`

Sem alteração em outras tabelas.

- [ ] **Step 4: tsc + suite atual**

```bash
npx tsc --noEmit
npx vitest run
```
Esperado: tsc clean; suíte atual (50 tests) intacta.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): add Competicao model"
```

---

## Task 2: Backend — service `competicoes` com tests (TDD)

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\competicoes\competicoes.service.ts`
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\competicoes\competicoes.service.test.ts`

- [ ] **Step 1: Criar o test (conteúdo exato)**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

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

import prisma from '../../lib/prisma'
import * as service from './competicoes.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('competicoes.service', () => {
  it('listar retorna lista ordenada por nome', async () => {
    mockPrisma.competicao.findMany.mockResolvedValue([{ id: 1, nome: 'Copa A' }])
    const result = await service.listar()
    expect(result).toEqual([{ id: 1, nome: 'Copa A' }])
    expect(mockPrisma.competicao.findMany).toHaveBeenCalledWith({ orderBy: { nome: 'asc' } })
  })

  it('buscarPorId lança 404 quando não encontrado', async () => {
    mockPrisma.competicao.findUnique.mockResolvedValue(null)
    await expect(service.buscarPorId(99)).rejects.toMatchObject({ status: 404 })
  })

  it('criar aceita UFs válidas e default false em adicionar_subtitulo', async () => {
    mockPrisma.competicao.create.mockResolvedValue({ id: 1 })
    await service.criar({ nome: 'Copa Brasil', estados: ['SP', 'RJ'] })
    expect(mockPrisma.competicao.create).toHaveBeenCalledWith({
      data: { nome: 'Copa Brasil', estados: ['SP', 'RJ'], adicionar_subtitulo: false },
    })
  })

  it('criar respeita adicionar_subtitulo=true quando passado', async () => {
    mockPrisma.competicao.create.mockResolvedValue({ id: 1 })
    await service.criar({ nome: 'Copa', estados: ['MG'], adicionar_subtitulo: true })
    expect(mockPrisma.competicao.create).toHaveBeenCalledWith({
      data: { nome: 'Copa', estados: ['MG'], adicionar_subtitulo: true },
    })
  })

  it('criar rejeita UF inválida com 400', async () => {
    await expect(
      service.criar({ nome: 'Copa', estados: ['SP', 'XX'] })
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('XX') })
    expect(mockPrisma.competicao.create).not.toHaveBeenCalled()
  })

  it('criar mapeia P2002 (unique nome) para 409', async () => {
    mockPrisma.competicao.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }))
    await expect(
      service.criar({ nome: 'Copa', estados: ['SP'] })
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining('Já existe') })
  })

  it('editar valida estados quando presente', async () => {
    await expect(
      service.editar(1, { estados: ['ZZ'] })
    ).rejects.toMatchObject({ status: 400 })
    expect(mockPrisma.competicao.update).not.toHaveBeenCalled()
  })

  it('editar passa pela validação se estados ausente', async () => {
    mockPrisma.competicao.update.mockResolvedValue({ id: 1 })
    await service.editar(1, { nome: 'Renomeada' })
    expect(mockPrisma.competicao.update).toHaveBeenCalledWith({
      where: { id: 1 }, data: { nome: 'Renomeada' },
    })
  })

  it('remover deleta direto', async () => {
    mockPrisma.competicao.delete.mockResolvedValue({ id: 1 })
    await service.remover(1)
    expect(mockPrisma.competicao.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })
})
```

- [ ] **Step 2: Rodar test — deve FAIL (module not found)**

```bash
cd backend && npx vitest run src/modules/competicoes/competicoes.service.test.ts
```

- [ ] **Step 3: Implementar o service**

```ts
import prisma from '../../lib/prisma'
import { SIGLAS_VALIDAS } from '../municipios/uf'

function validateUfs(estados: string[]) {
  for (const uf of estados) {
    if (!SIGLAS_VALIDAS.has(uf)) {
      throw Object.assign(new Error(`UF inválida: '${uf}'`), { status: 400 })
    }
  }
}

async function mapPrismaError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw Object.assign(new Error('Já existe uma competição com este nome.'), { status: 409 })
    }
    throw err
  }
}

export async function listar() {
  return prisma.competicao.findMany({ orderBy: { nome: 'asc' } })
}

export async function buscarPorId(id: number) {
  const item = await prisma.competicao.findUnique({ where: { id } })
  if (!item) throw Object.assign(new Error('Competição não encontrada'), { status: 404 })
  return item
}

export async function criar(input: {
  nome: string
  estados: string[]
  adicionar_subtitulo?: boolean
}) {
  validateUfs(input.estados)
  const data = {
    nome: input.nome,
    estados: input.estados,
    adicionar_subtitulo: input.adicionar_subtitulo ?? false,
  }
  return mapPrismaError(() => prisma.competicao.create({ data }))
}

export async function editar(
  id: number,
  input: Partial<{ nome: string; estados: string[]; adicionar_subtitulo: boolean }>
) {
  if (input.estados !== undefined) validateUfs(input.estados)
  return mapPrismaError(() => prisma.competicao.update({ where: { id }, data: input }))
}

export async function remover(id: number) {
  return prisma.competicao.delete({ where: { id } })
}
```

- [ ] **Step 4: Rodar test — 9 devem passar**

```bash
npx vitest run src/modules/competicoes/competicoes.service.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/competicoes/competicoes.service.ts backend/src/modules/competicoes/competicoes.service.test.ts
git commit -m "feat(competicoes): add service with UF validation and unique-name 409 mapping"
```

---

## Task 3: Backend — controller + routes + register

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\competicoes\competicoes.controller.ts`
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\competicoes\competicoes.routes.ts`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\index.ts`

- [ ] **Step 1: Criar `competicoes.controller.ts`**

```ts
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './competicoes.service'

const createSchema = z.object({
  nome: z.string().min(1),
  estados: z.array(z.string().length(2)).min(1, 'Selecione ao menos uma UF'),
  adicionar_subtitulo: z.boolean().optional().default(false),
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

- [ ] **Step 2: Criar `competicoes.routes.ts`**

```ts
import { Router } from 'express'
import { requireAuth, requireRole } from '../../middleware/auth'
import * as ctrl from './competicoes.controller'

const router = Router()
const admin = [requireAuth, requireRole('ADMIN')]

router.get('/', requireAuth, ctrl.listar)
router.get('/:id', requireAuth, ctrl.buscarPorId)
router.post('/', ...admin, ctrl.criar)
router.put('/:id', ...admin, ctrl.editar)
router.delete('/:id', ...admin, ctrl.remover)

export default router
```

- [ ] **Step 3: Registrar em `backend/src/index.ts`**

Localizar o bloco de imports de módulos. Adicionar após o último (provavelmente `participantesRoutes`):

```ts
import competicoesRoutes from './modules/competicoes/competicoes.routes'
```

E no bloco de `app.use`, adicionar após `app.use('/participantes', participantesRoutes)`:

```ts
app.use('/competicoes', competicoesRoutes)
```

- [ ] **Step 4: tsc + suite completa**

```bash
cd backend && npx tsc --noEmit && npx vitest run
```
Esperado: tsc clean, 59 tests passando (50 anteriores + 9 novos).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/competicoes/competicoes.controller.ts backend/src/modules/competicoes/competicoes.routes.ts backend/src/index.ts
git commit -m "feat(competicoes): expose CRUD endpoints"
```

---

## Task 4: Frontend — extrair `lib/ufs.ts` e atualizar Municipios

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\lib\ufs.ts`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\municipios\MunicipiosList.tsx`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\municipios\MunicipioForm.tsx`

- [ ] **Step 1: Criar `lib/ufs.ts`**

```ts
export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
```

- [ ] **Step 2: Atualizar `MunicipiosList.tsx`**

Localizar a constante `UFS` no topo do arquivo (linha 9, logo após os imports):

```tsx
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const PAGE_SIZE = 50
```

Remover **somente** a linha `const UFS = [...]` (deixar `PAGE_SIZE` intacto). E adicionar o import junto aos outros imports no topo:

```tsx
import { UFS } from '../../lib/ufs'
```

- [ ] **Step 3: Atualizar `MunicipioForm.tsx`**

Localizar a mesma `const UFS = [...]` no topo do arquivo (linha 8). Remover essa linha e adicionar o import:

```tsx
import { UFS } from '../../lib/ufs'
```

- [ ] **Step 4: tsc + build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```
Esperado: clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/ufs.ts frontend/src/pages/municipios/MunicipiosList.tsx frontend/src/pages/municipios/MunicipioForm.tsx
git commit -m "refactor(frontend): extract UFS constant to lib/ufs"
```

---

## Task 5: Frontend — types + service de Competição

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\types\competicao.ts`
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\services\competicoes.ts`

- [ ] **Step 1: Criar `types/competicao.ts`**

```ts
export type Competicao = {
  id: number
  nome: string
  estados: string[]
  adicionar_subtitulo: boolean
  criado_em: string
  atualizado_em: string
}
```

- [ ] **Step 2: Criar `services/competicoes.ts`**

```ts
import api from './api'
import type { Competicao } from '../types/competicao'

const BASE = '/competicoes'

type CompeticaoPayload = {
  nome: string
  estados: string[]
  adicionar_subtitulo?: boolean
}

export const competicoesService = {
  listar: () => api.get<Competicao[]>(BASE).then(r => r.data),
  buscar: (id: number) => api.get<Competicao>(`${BASE}/${id}`).then(r => r.data),
  criar: (data: CompeticaoPayload) => api.post<Competicao>(BASE, data).then(r => r.data),
  editar: (id: number, data: Partial<CompeticaoPayload>) => api.put<Competicao>(`${BASE}/${id}`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
```

- [ ] **Step 3: tsc**

```bash
cd frontend && npx tsc --noEmit
```
Esperado: clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/competicao.ts frontend/src/services/competicoes.ts
git commit -m "feat(frontend): add Competicao type and service"
```

---

## Task 6: Frontend — páginas (List + Form)

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\competicoes\CompeticoesList.tsx`
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\competicoes\CompeticaoForm.tsx`

- [ ] **Step 1: Criar `CompeticoesList.tsx`**

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import { competicoesService } from '../../services/competicoes'
import type { Competicao } from '../../types/competicao'

export default function CompeticoesList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['competicoes'],
    queryFn: competicoesService.listar,
  })

  const { mutate: remover } = useMutation({
    mutationFn: competicoesService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['competicoes'] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const columns = [
    { header: 'Nome', accessor: (row: Competicao) => row.nome },
    { header: 'Estados', accessor: (row: Competicao) => row.estados.slice().sort().join(', ') },
    {
      header: 'Subtítulo',
      accessor: (row: Competicao) => row.adicionar_subtitulo ? '✓' : '—',
      className: 'w-20 text-center',
    },
    {
      header: 'Ações',
      accessor: (row: Competicao) => (
        <div className="flex gap-2">
          <button onClick={() => navigate(`/competicoes/${row.id}/editar`)} className="text-indigo-400 hover:text-indigo-300 text-xs">Editar</button>
          <button onClick={() => { if (confirm(`Remover "${row.nome}"?`)) remover(row.id) }} className="text-red-400 hover:text-red-300 text-xs">Remover</button>
        </div>
      ),
      className: 'w-28',
    },
  ]

  return (
    <div className="text-white">
      <PageHeader title="Competições" actionLabel="+ Nova Competição" actionTo="/competicoes/nova" />
      <div className="p-6">
        {isLoading ? <p className="text-gray-400 text-sm">Carregando...</p>
          : <DataTable columns={columns} data={data} keyExtractor={r => r.id} emptyMessage="Nenhuma competição cadastrada." />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar `CompeticaoForm.tsx`**

```tsx
import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { competicoesService } from '../../services/competicoes'
import { UFS } from '../../lib/ufs'

export default function CompeticaoForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [nome, setNome] = useState('')
  const [estados, setEstados] = useState<string[]>([])
  const [adicionarSubtitulo, setAdicionarSubtitulo] = useState(false)
  const [erro, setErro] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['competicoes', Number(id)],
    queryFn: () => competicoesService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setNome(existing.nome)
      setEstados(existing.estados)
      setAdicionarSubtitulo(existing.adicionar_subtitulo)
    }
  }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      const payload = { nome, estados, adicionar_subtitulo: adicionarSubtitulo }
      return isEdit
        ? competicoesService.editar(Number(id), payload)
        : competicoesService.criar(payload)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['competicoes'] }); navigate('/competicoes') },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  function toggleUf(uf: string) {
    setEstados(prev => prev.includes(uf) ? prev.filter(x => x !== uf) : [...prev, uf])
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (estados.length === 0) {
      setErro('Selecione ao menos uma UF.')
      return
    }
    salvar()
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="text-white">
      <PageHeader title={isEdit ? 'Editar Competição' : 'Nova Competição'} backTo="/competicoes" />
      <div className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} required className={inputClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Estados (selecione ao menos uma UF)</label>
            <div className="grid grid-cols-4 gap-2">
              {UFS.map(uf => (
                <label key={uf} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={estados.includes(uf)}
                    onChange={() => toggleUf(uf)}
                    className="rounded border-gray-600 bg-gray-900 text-indigo-500 focus:ring-indigo-500"
                  />
                  <span className="text-gray-200">{uf}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={adicionarSubtitulo}
                onChange={e => setAdicionarSubtitulo(e.target.checked)}
                className="rounded border-gray-600 bg-gray-900 text-indigo-500 focus:ring-indigo-500"
              />
              Adicionar subtítulo aos participantes
            </label>
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

```bash
cd frontend && npx tsc --noEmit
```
Esperado: clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/competicoes
git commit -m "feat(frontend): add Competicoes list and form pages"
```

---

## Task 7: Frontend — App.tsx routes + Layout.tsx sidebar

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\App.tsx`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\components\Layout.tsx`

- [ ] **Step 1: Adicionar imports em `App.tsx`**

Localizar o bloco de imports de páginas (após `ParticipanteForm`). Adicionar:

```tsx
import CompeticoesList from './pages/competicoes/CompeticoesList'
import CompeticaoForm from './pages/competicoes/CompeticaoForm'
```

- [ ] **Step 2: Adicionar as 3 rotas no `App.tsx`**

Dentro do `<Route element={<Layout />}>`, depois das rotas de `/municipios/*` (e antes de `/novidades`), adicionar:

```tsx
            <Route path="/competicoes"            element={<CompeticoesList />} />
            <Route path="/competicoes/nova"       element={<CompeticaoForm />} />
            <Route path="/competicoes/:id/editar" element={<CompeticaoForm />} />
```

(Indentação de 12 espaços; sufixo `/nova` por gênero feminino.)

- [ ] **Step 3: Atualizar `Layout.tsx` (sidebar)**

Localizar o array `navGroups`. O estado atual é:

```tsx
const navGroups: NavGroup[] = [
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
  {
    title: 'Competições',
    items: [
      { label: 'Edições', to: '/edicoes' },
      { label: 'Competições', to: '/competicoes' },
    ],
  },
]
```

Substituir TODO o array `navGroups` por:

```tsx
const navGroups: NavGroup[] = [
  {
    title: 'Cadastros',
    items: [
      { label: 'Municípios',    to: '/municipios' },
      { label: 'Inspetorias',   to: '/inspetorias' },
      { label: 'Delegacias',    to: '/delegacias' },
      { label: 'Participantes', to: '/participantes' },
      { label: 'Modalidades',   to: '/modalidades' },
      { label: 'Categorias',    to: '/categorias' },
      { label: 'Competições',   to: '/competicoes' },
    ],
  },
]
```

O grupo "Competições" inteiro some; o item "Competições" foi para o fim de "Cadastros"; "Edições" desapareceu.

- [ ] **Step 4: tsc + build**

```bash
cd frontend && npx tsc --noEmit && npm run build
```
Esperado: tsc clean, vite build OK.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat(frontend): wire Competicoes routes and move sidebar item to Cadastros"
```

---

## Task 8: Bump versão + CHANGELOG

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\package.json`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\CHANGELOG.md`

- [ ] **Step 1: Bump version**

Editar `package.json` do root. Atualmente:
```json
{
  "name": "prosports",
  "version": "1.2.0",
  ...
}
```
Mudar **apenas** `"version"` de `"1.2.0"` para `"1.3.0"`.

- [ ] **Step 2: Adicionar bloco no `CHANGELOG.md`**

Inserir o novo bloco logo após o cabeçalho do arquivo e antes do bloco `## [1.2.0]`:

```md
## [1.3.0] - 2026-05-29

### Added
- Entidade Competição com CRUD admin (nome único, lista de UFs onde acontece, flag "adicionar subtítulo").

### Changed
- Sidebar reorganizado: item "Competições" movido para o grupo "Cadastros".
- Constante de UFs do Brasil extraída para `frontend/src/lib/ufs.ts` (DRY).

### Removed
- Item "Edições" do sidebar (entidade ainda não implementada).
- Grupo "Competições" do sidebar (item único movido para Cadastros).
```

(Os blocos `[1.2.0]`, `[1.1.0]` e `[1.0.0]` permanecem inalterados abaixo.)

- [ ] **Step 3: Commit**

```bash
git add package.json CHANGELOG.md
git commit -m "chore(release): v1.3.0 — Competicao + sidebar reorganization"
```

---

## Task 9: End-to-end smoke test (manual, pós-deploy)

**Files:** (sem edição — verificação manual)

- [ ] **Step 1: Push e aguardar CI**

```bash
git push origin develop
```
CI roda `prisma migrate deploy` (cria a tabela `Competicao`) e reconstrói os 2 containers (~5 min).

- [ ] **Step 2: Verificar rotas no backend**

```bash
curl -s -o /dev/null -w "/competicoes: %{http_code} (want 401)\n" http://192.168.56.113:3000/competicoes
```
Esperado: 401.

- [ ] **Step 3: Smoke test no browser (anônimo)**

Abrir http://192.168.56.113:8080. Login `admin@prosports.com` / `admin123`.

1. **Sidebar:** grupo "Competições" sumiu; "Competições" aparece como último item de "Cadastros". Não há item "Edições".
2. **Cadastros → Competições** → lista vazia.
3. "+ Nova Competição" → preencher:
   - Nome: "Copa Brasil 2026"
   - Marcar SP e RJ no grid
   - Marcar checkbox "Adicionar subtítulo aos participantes"
   - Salvar. Volta para a lista; mostra linha com `RJ, SP` em Estados e `✓` em Subtítulo.
4. Clicar Editar → marcar MG e PR → Salvar. Lista mostra `MG, PR, RJ, SP`.
5. Criar outra competição com o mesmo nome "Copa Brasil 2026" → erro 409 amigável ("Já existe uma competição com este nome.").
6. Criar uma competição sem nenhuma UF marcada → bloqueado client-side ("Selecione ao menos uma UF.").
7. Excluir uma competição → some da lista.
8. **Cadastros → Municípios** continua funcionando (lista, importação, autocomplete — confirma que o refactor da UFS não quebrou nada).
9. **Sidebar rodapé:** mostra `v1.3.0 (<sha>)` com badge indigo.
10. **Click no rodapé** → `/novidades` mostra entrada `1.3.0 — 2026-05-29` no topo com Added/Changed/Removed.

- [ ] **Step 4: Reportar**

Se todos os passos passarem, fechar a sessão. Se algum falhar, capturar request/response (aba Network) e voltar para iteração.

---

## Self-review

Cobertura do spec:

| Spec | Coberto por |
|---|---|
| Model `Competicao` + migration | Task 1 |
| Service backend com validação de UF e mapeamento P2002 → 409 | Task 2 |
| Controller (Zod) + routes + registro em index.ts | Task 3 |
| Refactor: extrair `UFS` para `lib/ufs.ts` + atualizar Municipios | Task 4 |
| Types + service frontend | Task 5 |
| Páginas (List + Form com grid de UFs e checkbox) | Task 6 |
| Rotas + sidebar reorganizado (remove grupo Competições + Edições, adiciona ao fim de Cadastros) | Task 7 |
| Bump 1.3.0 + CHANGELOG | Task 8 |
| Deploy + smoke test | Task 9 |

Riscos do spec (validação dupla UF/Zod, refactor UFS quebrar Municípios, P2002 não capturado) endereçados nas Tasks 2 (test específico de P2002 → 409), 4 (build após o refactor) e 6 (validação client-side bloqueia submit vazio).
