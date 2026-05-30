# F3 — TipoModalidade.tipo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar campo `tipo` (Postgres enum `TipoDisputa` com valores `grupos`/`chaves`/`especifico`/`ordem_entrada`, default `grupos`) na entidade `TipoModalidade`, com UI admin (select no form + coluna na lista). Bump para `1.7.0`.

**Architecture:** Postgres enum nativo gerenciado pelo Prisma (mesmo padrão de `Role`, `EventoStatus`). Backend: service pass-through do campo, Zod opcional no controller (DB default cobre ausência). Frontend: helper `tipo-disputa.ts` (padrão `evento-status.ts`), select no form, coluna na lista.

**Tech Stack:** Prisma (Postgres + enum), Express + Zod, Vitest. React 18 + Vite + React Query + Tailwind + tokens R2P.

**Spec:** `docs/superpowers/specs/2026-05-30-f3-tipo-modalidade-design.md`

---

## File Structure

**Backend — Create:**
- `backend/prisma/migrations/<ts>_add_tipo_disputa/migration.sql`

**Backend — Modify:**
- `backend/prisma/schema.prisma` — add `enum TipoDisputa` + `tipo` field em `TipoModalidade`.
- `backend/src/modules/tipos_modalidade/tipos_modalidade.service.ts` — `criar`/`editar` aceitam `tipo?`.
- `backend/src/modules/tipos_modalidade/tipos_modalidade.service.test.ts` — +3 testes.
- `backend/src/modules/tipos_modalidade/tipos_modalidade.controller.ts` — Zod aceita `tipo?` (enum).

**Frontend — Create:**
- `frontend/src/lib/tipo-disputa.ts` — `TIPO_DISPUTA_LABEL` + `TIPO_DISPUTA_VALUES`.

**Frontend — Modify:**
- `frontend/src/types/modalidade.ts` — add `TipoDisputa` + `tipo` em `TipoModalidade`.
- `frontend/src/services/tipos-modalidade.ts` — payload aceita `tipo?`.
- `frontend/src/pages/tipos-modalidade/TipoModalidadeForm.tsx` — select de tipo.
- `frontend/src/pages/tipos-modalidade/TiposModalidadeList.tsx` — coluna Tipo.

**Release:**
- `package.json` (root): `1.6.0` → `1.7.0`.
- `CHANGELOG.md`: novo bloco `[1.7.0]`.

---

## Task 1: Prisma — enum TipoDisputa + campo tipo

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\prisma\schema.prisma`
- Create: `backend/prisma/migrations/<ts>_add_tipo_disputa/migration.sql` (manual)

- [ ] **Step 1: Editar `schema.prisma`**

Localizar o bloco `model TipoModalidade` (após `model Competicao`, deve estar perto da linha 101). Substituir por:

```prisma
model TipoModalidade {
  id            Int          @id @default(autoincrement())
  nome          String       @unique
  tipo          TipoDisputa  @default(grupos)
  modalidades   Modalidade[]
  criado_em     DateTime     @default(now())
  atualizado_em DateTime     @updatedAt
}
```

Apenas para o final do arquivo, **após** o bloco `model Evento` e antes/depois de `model SistemaDisputasGrupos`, adicionar o enum:

```prisma
enum TipoDisputa {
  grupos
  chaves
  especifico
  ordem_entrada
}
```

- [ ] **Step 2: Criar a migração manualmente**

Substituir `<ts>` pelo timestamp no formato `YYYYMMDDhhmmss` (ex.: `20260530140000`).

Criar diretório:
```
backend/prisma/migrations/20260530140000_add_tipo_disputa/
```

Criar arquivo `migration.sql` com conteúdo exato:

```sql
-- Add TipoDisputa enum and tipo column to TipoModalidade.

CREATE TYPE "TipoDisputa" AS ENUM ('grupos', 'chaves', 'especifico', 'ordem_entrada');

ALTER TABLE "TipoModalidade"
  ADD COLUMN "tipo" "TipoDisputa" NOT NULL DEFAULT 'grupos';
```

- [ ] **Step 3: Regenerar Prisma client local**

De `backend/`:
```
npx prisma generate
```

Esperado: "Generated Prisma Client".

- [ ] **Step 4: tsc + suíte completa**

De `backend/`:
```
npx tsc --noEmit && npx vitest run
```

Esperado: tsc clean; suíte completa passa (nenhum teste novo ainda — esta task só introduz o schema; os tipos antigos seguem válidos porque `tipo` tem default).

- [ ] **Step 5: Commit**

```
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): add TipoDisputa enum and tipo column on TipoModalidade" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Backend — service aceita `tipo` (TDD)

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\tipos_modalidade\tipos_modalidade.service.ts`
- Modify: `backend/src/modules/tipos_modalidade/tipos_modalidade.service.test.ts`

- [ ] **Step 1: Adicionar 3 novos testes**

Abrir `tipos_modalidade.service.test.ts`. Manter os 6 testes existentes. **Antes** do teste `remover lança 409...`, inserir os 3 testes abaixo:

```ts
  it('criar com tipo passa o valor para prisma.create', async () => {
    mockPrisma.tipoModalidade.create.mockResolvedValue({ id: 1, nome: 'Atletismo', tipo: 'ordem_entrada' })
    await service.criar({ nome: 'Atletismo', tipo: 'ordem_entrada' })
    expect(mockPrisma.tipoModalidade.create).toHaveBeenCalledWith({ data: { nome: 'Atletismo', tipo: 'ordem_entrada' } })
  })

  it('criar sem tipo NÃO inclui a chave no data (deixa default do DB resolver)', async () => {
    mockPrisma.tipoModalidade.create.mockResolvedValue({ id: 1, nome: 'Vôlei' })
    await service.criar({ nome: 'Vôlei' })
    expect(mockPrisma.tipoModalidade.create).toHaveBeenCalledWith({ data: { nome: 'Vôlei' } })
  })

  it('editar com tipo atualiza o campo', async () => {
    mockPrisma.tipoModalidade.update.mockResolvedValue({ id: 1, nome: 'X', tipo: 'chaves' })
    await service.editar(1, { tipo: 'chaves' })
    expect(mockPrisma.tipoModalidade.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { tipo: 'chaves' } })
  })
```

Atualizar também o teste existente `criar chama prisma.create com nome` (linha ~37) para refletir o novo shape sem mudar comportamento — sua chamada `service.criar({ nome: 'Coletivo' })` deve continuar gerando `data: { nome: 'Coletivo' }` (sem `tipo`). Esse teste já está correto, **nenhuma mudança**, apenas confirmar.

- [ ] **Step 2: Rodar testes — alguns falham (typecheck)**

De `backend/`:
```
npx vitest run src/modules/tipos_modalidade/tipos_modalidade.service.test.ts
```

Esperado: os novos testes falham porque o service atual não aceita `tipo`. TypeScript pode acusar erro em `service.criar({ nome, tipo })`.

- [ ] **Step 3: Atualizar `tipos_modalidade.service.ts`**

Substituir o arquivo inteiro por:

```ts
import prisma from '../../lib/prisma'

type TipoDisputa = 'grupos' | 'chaves' | 'especifico' | 'ordem_entrada'

export async function listar() {
  return prisma.tipoModalidade.findMany({ orderBy: { nome: 'asc' } })
}

export async function buscarPorId(id: number) {
  const item = await prisma.tipoModalidade.findUnique({ where: { id } })
  if (!item) throw Object.assign(new Error('Tipo de modalidade não encontrado'), { status: 404 })
  return item
}

export async function criar(data: { nome: string; tipo?: TipoDisputa }) {
  return prisma.tipoModalidade.create({ data })
}

export async function editar(id: number, data: { nome?: string; tipo?: TipoDisputa }) {
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

- [ ] **Step 4: Rodar testes — 9 passam**

```
npx vitest run src/modules/tipos_modalidade/tipos_modalidade.service.test.ts
```

Esperado: 9 testes passam (6 existentes + 3 novos).

- [ ] **Step 5: Commit**

```
git add backend/src/modules/tipos_modalidade
git commit -m "feat(tipos-modalidade): service aceita campo tipo (TipoDisputa)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Backend — controller Zod aceita `tipo`

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\tipos_modalidade\tipos_modalidade.controller.ts`

- [ ] **Step 1: Atualizar schema Zod**

Substituir o arquivo inteiro por:

```ts
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './tipos_modalidade.service'

const TIPO_VALUES = ['grupos','chaves','especifico','ordem_entrada'] as const

const createSchema = z.object({
  nome: z.string().min(1),
  tipo: z.enum(TIPO_VALUES).optional(),
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

- [ ] **Step 2: tsc + full suite**

De `backend/`:
```
npx tsc --noEmit && npx vitest run
```

Esperado: tsc clean, suíte completa verde.

- [ ] **Step 3: Commit**

```
git add backend/src/modules/tipos_modalidade/tipos_modalidade.controller.ts
git commit -m "feat(tipos-modalidade): controller Zod aceita tipo opcional" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Frontend — type `TipoDisputa` + `tipo` em `TipoModalidade`

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\types\modalidade.ts`
- Modify: `frontend/src/services/tipos-modalidade.ts`

- [ ] **Step 1: Atualizar `types/modalidade.ts`**

Substituir o arquivo inteiro por:

```ts
import type { Competicao } from './competicao'

export type TipoDisputa = 'grupos' | 'chaves' | 'especifico' | 'ordem_entrada'

export type TipoModalidade = {
  id: number
  nome: string
  tipo: TipoDisputa
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

- [ ] **Step 2: Atualizar `services/tipos-modalidade.ts`**

Substituir o arquivo inteiro por:

```ts
import api from './api'
import type { TipoModalidade, TipoDisputa } from '../types/modalidade'

const BASE = '/tipos-modalidade'

type TipoModalidadePayload = {
  nome: string
  tipo?: TipoDisputa
}

export const tiposModalidadeService = {
  listar: () => api.get<TipoModalidade[]>(BASE).then(r => r.data),
  buscar: (id: number) => api.get<TipoModalidade>(`${BASE}/${id}`).then(r => r.data),
  criar: (data: TipoModalidadePayload) => api.post<TipoModalidade>(BASE, data).then(r => r.data),
  editar: (id: number, data: Partial<TipoModalidadePayload>) => api.put<TipoModalidade>(`${BASE}/${id}`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
```

- [ ] **Step 3: tsc**

De `frontend/`:
```
npx tsc --noEmit
```

Esperado: clean (consumidores que ainda não tratam `tipo` no read continuam OK porque é apenas um campo adicional na resposta).

- [ ] **Step 4: Commit**

```
git add frontend/src/types/modalidade.ts frontend/src/services/tipos-modalidade.ts
git commit -m "feat(frontend): add TipoDisputa type and tipo on TipoModalidade payload" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Frontend — helper `tipo-disputa.ts`

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\lib\tipo-disputa.ts`

- [ ] **Step 1: Criar o arquivo**

Conteúdo exato:

```ts
import type { TipoDisputa } from '../types/modalidade'

export const TIPO_DISPUTA_LABEL: Record<TipoDisputa, string> = {
  grupos: 'Grupos',
  chaves: 'Chaves',
  especifico: 'Específico',
  ordem_entrada: 'Ordem de Entrada',
}

export const TIPO_DISPUTA_VALUES: TipoDisputa[] = ['grupos', 'chaves', 'especifico', 'ordem_entrada']
```

- [ ] **Step 2: tsc**

```
cd frontend && npx tsc --noEmit
```

Esperado: clean.

- [ ] **Step 3: Commit**

```
git add frontend/src/lib/tipo-disputa.ts
git commit -m "feat(frontend): add tipo-disputa helper (labels + values)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Frontend — `TipoModalidadeForm` com select de tipo

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\tipos-modalidade\TipoModalidadeForm.tsx`

- [ ] **Step 1: Atualizar o componente**

Substituir o arquivo inteiro por:

```tsx
import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { tiposModalidadeService } from '../../services/tipos-modalidade'
import { TIPO_DISPUTA_LABEL, TIPO_DISPUTA_VALUES } from '../../lib/tipo-disputa'
import type { TipoDisputa } from '../../types/modalidade'

export default function TipoModalidadeForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoDisputa>('grupos')
  const [erro, setErro] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['tipos-modalidade', Number(id)],
    queryFn: () => tiposModalidadeService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setNome(existing.nome)
      setTipo(existing.tipo)
    }
  }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => isEdit
      ? tiposModalidadeService.editar(Number(id), { nome, tipo })
      : tiposModalidadeService.criar({ nome, tipo }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tipos-modalidade'] }); navigate('/tipos-modalidade') },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]'

  return (
    <div className="text-[var(--t1)]">
      <PageHeader title={isEdit ? 'Editar Tipo' : 'Novo Tipo de Modalidade'} backTo="/tipos-modalidade" />
      <div className="p-6 max-w-lg">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); setErro(''); salvar() }} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} required className={inputClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Tipo de disputa</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as TipoDisputa)} className={inputClass}>
              {TIPO_DISPUTA_VALUES.map(t => <option key={t} value={t}>{TIPO_DISPUTA_LABEL[t]}</option>)}
            </select>
          </div>

          {erro && <p className="text-sm text-[var(--danger)]">{erro}</p>}
          <button type="submit" disabled={isPending}
            className="px-6 py-2 bg-[var(--brand-500)] hover:bg-[var(--brand-400)] disabled:opacity-50 text-[var(--t1)] text-sm font-medium rounded-lg transition-colors">
            {isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: tsc**

```
cd frontend && npx tsc --noEmit
```

Esperado: clean.

- [ ] **Step 3: Commit**

```
git add frontend/src/pages/tipos-modalidade/TipoModalidadeForm.tsx
git commit -m "feat(frontend): add tipo de disputa select on TipoModalidadeForm" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Frontend — `TiposModalidadeList` com coluna Tipo

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\tipos-modalidade\TiposModalidadeList.tsx`

- [ ] **Step 1: Atualizar o componente**

Substituir o arquivo inteiro por:

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import { tiposModalidadeService } from '../../services/tipos-modalidade'
import type { TipoModalidade } from '../../types/modalidade'
import { TIPO_DISPUTA_LABEL } from '../../lib/tipo-disputa'

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
    { header: 'Tipo', accessor: (row: TipoModalidade) => TIPO_DISPUTA_LABEL[row.tipo], className: 'w-48' },
    {
      header: 'Ações',
      accessor: (row: TipoModalidade) => (
        <div className="flex gap-2">
          <button onClick={() => navigate(`/tipos-modalidade/${row.id}/editar`)} className="text-[var(--brand-500)] hover:text-[var(--brand-400)] text-xs">Editar</button>
          <button onClick={() => { if (confirm(`Remover "${row.nome}"?`)) remover(row.id) }} className="text-[var(--danger)] hover:text-[var(--danger-700)] text-xs">Remover</button>
        </div>
      ),
      className: 'w-28',
    },
  ]

  return (
    <div className="text-[var(--t1)]">
      <PageHeader title="Tipos de Modalidade" actionLabel="+ Novo Tipo" actionTo="/tipos-modalidade/novo" />
      <div className="p-6">
        {isLoading ? <p className="text-[var(--t3)] text-sm">Carregando...</p>
          : <DataTable columns={columns} data={data} keyExtractor={r => r.id} emptyMessage="Nenhum tipo cadastrado." />}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: tsc + build**

```
cd frontend && npx tsc --noEmit && npm run build
```

Esperado: tsc clean, vite build OK.

- [ ] **Step 3: Commit**

```
git add frontend/src/pages/tipos-modalidade/TiposModalidadeList.tsx
git commit -m "feat(frontend): add Tipo column on TiposModalidadeList" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Bump versão + CHANGELOG

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\package.json`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\CHANGELOG.md`

- [ ] **Step 1: Bump version**

Editar `package.json` (root). Mudar **somente** `"version": "1.6.0"` para `"version": "1.7.0"`.

- [ ] **Step 2: Adicionar bloco no `CHANGELOG.md`**

Inserir o bloco abaixo logo após o cabeçalho e **antes** do bloco `## [1.6.0]`:

```md
## [1.7.0] - 2026-05-30

### Added
- TipoModalidade ganha campo `tipo` (enum TipoDisputa: grupos / chaves / específico / ordem de entrada) — discriminador que o futuro Workspace (F4) usa para decidir o fluxo de disputa.
- UI admin: select de tipo no formulário e coluna "Tipo" na lista de Tipos de Modalidade.

### Changed
- Tipos de Modalidade existentes recebem `tipo = 'grupos'` por default (reclassificação manual via /admin pós-deploy).
```

- [ ] **Step 3: Commit**

```
git add package.json CHANGELOG.md
git commit -m "chore(release): v1.7.0 — F3 TipoModalidade.tipo" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Push + smoke (pós-deploy CI)

**Files:** (sem edição — verificação)

- [ ] **Step 1: Push**

```
git push origin develop
```

CI roda `prisma migrate deploy` (cria enum + coluna com default `grupos`) e reconstrói containers.

- [ ] **Step 2: Verificar deploy**

```
curl -s -o /dev/null -w "/health: %{http_code}\n" http://192.168.56.113:3000/health
```

Esperado: 200.

Conferir enum no DB (via container backend):
```
ssh wagner@192.168.56.113 "docker exec prosports-backend-1 sh -c 'cd /app && node -e \"const{PrismaClient}=require(\\\"@prisma/client\\\");const p=new PrismaClient();p.\\\$queryRawUnsafe(\\\"SELECT enum_range(NULL::\\\\\\\"TipoDisputa\\\\\\\")\\\").then(r=>{console.log(r);process.exit(0)})\"'"
```

Esperado: array `['grupos','chaves','especifico','ordem_entrada']`.

- [ ] **Step 3: Smoke no browser**

Abrir http://192.168.56.113:8080, login `admin@prosports.com` / `admin123`:

1. Sidebar → Administração → **Tipos de Modalidade** → lista mostra coluna Tipo. Registros existentes aparecem como "Grupos".
2. Editar um tipo existente → trocar para "Chaves" → salvar → volta à lista, coluna atualizada.
3. "+ Novo Tipo" → Nome "Atletismo", Tipo "Ordem de Entrada" → salvar → aparece na lista.
4. Footer mostra `v1.7.0 (<sha>)`.

- [ ] **Step 4: Reportar**

Se passou, fechar a sessão F3. Se falhar, capturar request/response e iterar.

---

## Self-review

Cobertura do spec:

| Spec | Coberto por |
|---|---|
| Enum Postgres `TipoDisputa` + coluna `tipo` com default `grupos` | Task 1 |
| Service aceita `tipo?` em criar/editar | Task 2 |
| Controller Zod aceita `tipo?` | Task 3 |
| Type `TipoDisputa` + atualização de `TipoModalidade` + service payload | Task 4 |
| Helper `tipo-disputa.ts` (labels + values) | Task 5 |
| Form: select de tipo | Task 6 |
| List: coluna Tipo | Task 7 |
| Bump 1.7.0 + CHANGELOG | Task 8 |
| Smoke pós-deploy | Task 9 |

Riscos:
- **Drift do `migrate diff`** (vide memory `feedback_prisma_migrate_diff_drift.md`): Task 1 evita o problema escrevendo a migração manualmente (sem `migrate diff`), com apenas `CREATE TYPE` + `ALTER TABLE ... ADD COLUMN`. Nenhum DROP TABLE possível.
- **Modalidade não muda:** intencional — `tipo` é propriedade do TipoModalidade, não da Modalidade individual.
- **Reclassificação dos existentes** é manual pós-deploy (default `grupos`).
