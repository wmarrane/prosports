# Import com validação + remover inscritos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover todos os inscritos de uma modalidade (bloqueando se houver sorteio); imports CSV com validação de participante cadastrado (inscritos e campeões não criam participante; Participantes cria), todos com template.

**Architecture:** Um helper backend `resolverParticipantes` (casa município por `UF:nome` e participante existente por `município:nome`, sem criar nada) é a fonte única de resolução, reutilizado pelos imports de inscritos, campeões e participantes. Cada import tem service+controller+rota próprios e um modal frontend (espelhando `ImportInscricoesModal`). Sem migration.

**Tech Stack:** Node/Express, Prisma/PostgreSQL, zod, Vitest (mock de prisma via `vi.mock`); React 18 + TS + Vite, react-query, PapaParse, `downloadCsvTemplate`.

Spec: `docs/superpowers/specs/2026-06-10-import-inscritos-campeoes-design.md`.

---

## File Structure

**Backend**
- `backend/src/modules/participantes/resolver-participantes.service.ts` (novo) — `resolverParticipantes(rows)`.
- `backend/src/modules/inscricoes/inscricoes.service.ts` — `removerTodosDaModalidade` + `importar` reescrito (sem auto-create).
- `backend/src/modules/inscricoes/inscricoes.controller.ts` + `inscricoes.routes.ts` — rota DELETE.
- `backend/src/modules/campeoes_anteriores/campeoes_anteriores.service.ts` + controller + routes — `importar`.
- `backend/src/modules/participantes/participantes.service.ts` + controller + routes — `importar`.

**Frontend**
- `frontend/src/types/inscricao.ts` — contadores `nao_cadastrados`.
- `frontend/src/services/inscricoes.ts` — `removerTodosDaModalidade`.
- `frontend/src/services/campeoes-anteriores.ts` — `importar`.
- `frontend/src/services/participantes.ts` — `importar`.
- `frontend/src/components/import/ImportInscricoesModal.tsx` — copy + contador.
- `frontend/src/components/import/ImportCampeoesModal.tsx` (novo).
- `frontend/src/components/import/ImportParticipantesModal.tsx` (novo).
- `frontend/src/pages/eventos/EventoInscricoes.tsx` — botão "Remover todos" + botão import campeões + montar os modais.
- `frontend/src/pages/participantes/ParticipantesList.tsx` — botão "Importar CSV" + montar modal.

---

## Task 1: Helper `resolverParticipantes`

**Files:**
- Create: `backend/src/modules/participantes/resolver-participantes.service.ts`
- Test: `backend/src/modules/participantes/resolver-participantes.service.test.ts`

- [ ] **Step 1: Escrever os testes** — criar `backend/src/modules/participantes/resolver-participantes.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    municipio: { findMany: vi.fn() },
    participante: { findMany: vi.fn() },
  },
}))

import prisma from '../../lib/prisma'
import { resolverParticipantes } from './resolver-participantes.service'

const mockPrisma = prisma as any
beforeEach(() => vi.clearAllMocks())

describe('resolverParticipantes', () => {
  it('resolve municipio e participante existentes (case-insensitive)', async () => {
    mockPrisma.municipio.findMany.mockResolvedValue([{ id: 7, nome: 'São Paulo', uf: 'SP' }])
    mockPrisma.participante.findMany.mockResolvedValue([{ id: 99, nome: 'João Silva', municipio_id: 7 }])
    const out = await resolverParticipantes([
      { nome: 'joão silva', municipio_uf: 'sp', municipio_nome: 'são paulo' },
    ])
    expect(out).toEqual([{ municipio_id: 7, participante_id: 99 }])
  })

  it('municipio inexistente → municipio_id null', async () => {
    mockPrisma.municipio.findMany.mockResolvedValue([])
    mockPrisma.participante.findMany.mockResolvedValue([])
    const out = await resolverParticipantes([
      { nome: 'Maria', municipio_uf: 'RJ', municipio_nome: 'Niterói' },
    ])
    expect(out).toEqual([{ municipio_id: null, participante_id: null }])
  })

  it('municipio existe mas participante não → participante_id null', async () => {
    mockPrisma.municipio.findMany.mockResolvedValue([{ id: 7, nome: 'São Paulo', uf: 'SP' }])
    mockPrisma.participante.findMany.mockResolvedValue([])
    const out = await resolverParticipantes([
      { nome: 'Novato', municipio_uf: 'SP', municipio_nome: 'São Paulo' },
    ])
    expect(out).toEqual([{ municipio_id: 7, participante_id: null }])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/modules/participantes/resolver-participantes.service.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar** — criar `backend/src/modules/participantes/resolver-participantes.service.ts`:

```ts
import prisma from '../../lib/prisma'

export type ResolucaoParticipante = {
  municipio_id: number | null
  participante_id: number | null
}

type RowLite = { nome: string; municipio_uf: string; municipio_nome: string }

// Resolve cada linha para o município e o participante EXISTENTES.
// Nunca cria nada. municipio_id null = município não encontrado;
// participante_id null = participante não cadastrado (mesmo com município ok).
export async function resolverParticipantes(rows: RowLite[]): Promise<ResolucaoParticipante[]> {
  const ufs = Array.from(new Set(rows.map(r => r.municipio_uf.trim().toUpperCase())))
  const municipios = ufs.length > 0
    ? await prisma.municipio.findMany({
        where: { uf: { in: ufs } },
        select: { id: true, nome: true, uf: true },
      })
    : []
  const municipioByKey = new Map<string, number>()
  for (const m of municipios) {
    municipioByKey.set(`${m.uf.toUpperCase()}:${m.nome.toLowerCase()}`, m.id)
  }

  const municipioIds = municipios.map(m => m.id)
  const participantes = municipioIds.length > 0
    ? await prisma.participante.findMany({
        where: { municipio_id: { in: municipioIds } },
        select: { id: true, nome: true, municipio_id: true },
      })
    : []
  const participanteByKey = new Map<string, number>()
  for (const p of participantes) {
    participanteByKey.set(`${p.municipio_id}:${p.nome.toLowerCase()}`, p.id)
  }

  return rows.map(r => {
    const uf = r.municipio_uf.trim().toUpperCase()
    const munNome = r.municipio_nome.trim().toLowerCase()
    const municipio_id = municipioByKey.get(`${uf}:${munNome}`) ?? null
    if (municipio_id == null) return { municipio_id: null, participante_id: null }
    const participante_id = participanteByKey.get(`${municipio_id}:${r.nome.trim().toLowerCase()}`) ?? null
    return { municipio_id, participante_id }
  })
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run src/modules/participantes/resolver-participantes.service.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/participantes/resolver-participantes.service.ts backend/src/modules/participantes/resolver-participantes.service.test.ts
git commit -m "feat(participantes): helper resolverParticipantes (resolve município/participante sem criar)"
```

---

## Task 2: Item 1 — Remover todos os inscritos da modalidade

**Files:**
- Modify: `backend/src/modules/inscricoes/inscricoes.service.ts`
- Modify: `backend/src/modules/inscricoes/inscricoes.controller.ts`
- Modify: `backend/src/modules/inscricoes/inscricoes.routes.ts`
- Test: `backend/src/modules/inscricoes/inscricoes.service.test.ts`
- Modify: `frontend/src/services/inscricoes.ts`
- Modify: `frontend/src/pages/eventos/EventoInscricoes.tsx`

- [ ] **Step 1: Teste do guardrail** — em `backend/src/modules/inscricoes/inscricoes.service.test.ts`, garantir que o mock de prisma tenha `sorteio: { findFirst: vi.fn() }` e `inscricao: { deleteMany: vi.fn(), ... }` no objeto `default` do `vi.mock` (adicionar as chaves que faltarem). Adicionar o teste:

```ts
  it('removerTodosDaModalidade bloqueia quando há sorteio', async () => {
    mockPrisma.sorteio.findFirst.mockResolvedValue({ id: 1 })
    await expect(service.removerTodosDaModalidade(5, 2)).rejects.toMatchObject({ status: 400 })
    expect(mockPrisma.inscricao.deleteMany).not.toHaveBeenCalled()
  })

  it('removerTodosDaModalidade deleta quando não há sorteio', async () => {
    mockPrisma.sorteio.findFirst.mockResolvedValue(null)
    mockPrisma.inscricao.deleteMany.mockResolvedValue({ count: 4 })
    const r = await service.removerTodosDaModalidade(5, 2)
    expect(r).toEqual({ count: 4 })
    expect(mockPrisma.inscricao.deleteMany).toHaveBeenCalledWith({ where: { evento_id: 5, modalidade_id: 2 } })
  })
```

Run: `cd backend && npx vitest run src/modules/inscricoes/inscricoes.service.test.ts`
Expected: FAIL — `removerTodosDaModalidade` não existe.

- [ ] **Step 2: Implementar o service** — em `backend/src/modules/inscricoes/inscricoes.service.ts`, adicionar (após `remover`):

```ts
export async function removerTodosDaModalidade(
  evento_id: number,
  modalidade_id: number,
): Promise<{ count: number }> {
  const sorteio = await prisma.sorteio.findFirst({
    where: { evento_id, modalidade_id },
    select: { id: true },
  })
  if (sorteio) {
    throw Object.assign(
      new Error('Apague o sorteio desta modalidade antes de remover os inscritos.'),
      { status: 400 },
    )
  }
  return prisma.inscricao.deleteMany({ where: { evento_id, modalidade_id } })
}
```

Run: `cd backend && npx vitest run src/modules/inscricoes/inscricoes.service.test.ts`
Expected: PASS.

- [ ] **Step 3: Controller + rota**

Em `backend/src/modules/inscricoes/inscricoes.controller.ts`, adicionar:

```ts
export async function removerTodosDaModalidade(req: Request, res: Response, next: NextFunction) {
  try {
    const evento_id = Number(req.params.eventoId)
    const modalidade_id = Number(req.params.modalidadeId)
    res.json(await service.removerTodosDaModalidade(evento_id, modalidade_id))
  } catch (err) { next(err) }
}
```

Em `backend/src/modules/inscricoes/inscricoes.routes.ts`, adicionar (antes de `router.delete('/:id', ...)` para evitar conflito de rota):

```ts
router.delete('/evento/:eventoId/modalidade/:modalidadeId', ...admin, ctrl.removerTodosDaModalidade)
```

- [ ] **Step 4: Build backend**

Run: `cd backend && npm run build`
Expected: tsc limpo.

- [ ] **Step 5: Service frontend + botão**

Em `frontend/src/services/inscricoes.ts`, adicionar ao objeto `inscricoesService`:

```ts
  removerTodosDaModalidade: (evento_id: number, modalidade_id: number) =>
    api.delete<{ count: number }>(`${BASE}/evento/${evento_id}/modalidade/${modalidade_id}`).then(r => r.data),
```

Em `frontend/src/pages/eventos/EventoInscricoes.tsx`:

(a) adicionar estado após `const [modalidadesModalOpen, setModalidadesModalOpen] = useState(false)`:
```tsx
  const [removerInscritosOpen, setRemoverInscritosOpen] = useState(false)
```

(b) adicionar a mutation (junto às outras `useMutation`, ex.: após `removerInscricao`):
```tsx
  const { mutate: removerTodosInscritos, isPending: removendoInscritos } = useMutation({
    mutationFn: () => inscricoesService.removerTodosDaModalidade(eventoId, modalidadeId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inscricoes', eventoId, modalidadeId] })
      queryClient.invalidateQueries({ queryKey: ['inscricoes-counts', eventoId] })
      setRemoverInscritosOpen(false)
      toast.success('Inscritos removidos.')
    },
    onError: (err: any) => { setRemoverInscritosOpen(false); toast.error(err?.response?.data?.message ?? 'Erro ao remover inscritos.') },
  })
```

(c) no cabeçalho do card "Inscritos", localizar o grupo de botões que contém `<Download size={14} /> Importar CSV` e `Inscrever`. Adicionar, ANTES do botão "Importar CSV", um botão de remover (só quando há inscritos):
```tsx
                      {inscricoes.length > 0 && (
                        <button
                          onClick={() => setRemoverInscritosOpen(true)}
                          className="btn btn-ghost btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--danger)' }}
                          title="Remover todos os inscritos desta modalidade"
                        >
                          <Trash2 size={14} /> Remover todos
                        </button>
                      )}
```
(`Trash2` já está importado de lucide-react.)

(d) montar um `ConfirmDialog` (junto aos outros, perto do fim do JSX):
```tsx
      <ConfirmDialog
        open={removerInscritosOpen}
        onClose={() => setRemoverInscritosOpen(false)}
        onConfirm={() => removerTodosInscritos()}
        title="Remover todos os inscritos?"
        description={`Os ${inscricoes.length} inscritos desta modalidade serão removidos. Esta ação não pode ser desfeita.`}
        confirmLabel={removendoInscritos ? 'Removendo...' : 'Remover todos'}
      />
```

- [ ] **Step 6: Build frontend**

Run: `cd frontend && npx tsc -b && npm run build`
Expected: conclui sem erros.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/inscricoes/inscricoes.service.ts backend/src/modules/inscricoes/inscricoes.controller.ts backend/src/modules/inscricoes/inscricoes.routes.ts backend/src/modules/inscricoes/inscricoes.service.test.ts frontend/src/services/inscricoes.ts frontend/src/pages/eventos/EventoInscricoes.tsx
git commit -m "feat(inscricoes): remover todos os inscritos da modalidade (bloqueia se houver sorteio)"
```

---

## Task 3: Item 2 — Import de inscritos sem criar participante

**Files:**
- Modify: `backend/src/modules/inscricoes/inscricoes.service.ts`
- Test: `backend/src/modules/inscricoes/inscricoes.service.test.ts`
- Modify: `frontend/src/types/inscricao.ts`
- Modify: `frontend/src/components/import/ImportInscricoesModal.tsx`

- [ ] **Step 1: Reescrever `importar`** — em `backend/src/modules/inscricoes/inscricoes.service.ts`:

(a) atualizar os tipos:
```ts
export type ImportRowResult = {
  linha: number
  nome: string
  status: 'criada' | 'duplicada' | 'erro'
  erro?: string
}

export type ImportResult = {
  rows: ImportRowResult[]
  contadores: {
    criadas: number
    duplicadas: number
    erros: number
    nao_cadastrados: number
  }
}
```

(b) substituir TODO o corpo da função `importar` por (mantém a validação evento/modalidade do começo; troca a resolução/criação):
```ts
export async function importar(input: {
  evento_id: number
  modalidade_id: number
  dry_run: boolean
  rows: ImportRow[]
}): Promise<ImportResult> {
  const [evento, modalidade] = await Promise.all([
    prisma.evento.findUnique({ where: { id: input.evento_id }, select: { id: true, competicao_id: true } }),
    prisma.modalidade.findUnique({ where: { id: input.modalidade_id }, select: { id: true, competicao_id: true } }),
  ])
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })
  if (!modalidade) throw Object.assign(new Error('Modalidade não encontrada'), { status: 404 })
  if (evento.competicao_id !== modalidade.competicao_id) {
    throw Object.assign(new Error('A modalidade não pertence à competição deste evento.'), { status: 400 })
  }

  const resolucoes = await resolverParticipantes(input.rows)

  const inscricoes = await prisma.inscricao.findMany({
    where: { evento_id: input.evento_id, modalidade_id: input.modalidade_id },
    select: { participante_id: true },
  })
  const inscritosSet = new Set<number>(inscricoes.map(i => i.participante_id))

  const results: ImportRowResult[] = []
  const contadores = { criadas: 0, duplicadas: 0, erros: 0, nao_cadastrados: 0 }

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i]
    const linha = i + 1
    const nome = row.nome.trim()
    const r = resolucoes[i]

    if (r.municipio_id == null) {
      results.push({ linha, nome, status: 'erro', erro: `Município '${row.municipio_nome}/${row.municipio_uf}' não encontrado` })
      contadores.erros++
      continue
    }
    if (r.participante_id == null) {
      results.push({ linha, nome, status: 'erro', erro: "Participante não cadastrado. Cadastre em 'Participantes' primeiro." })
      contadores.erros++
      contadores.nao_cadastrados++
      continue
    }
    if (inscritosSet.has(r.participante_id)) {
      results.push({ linha, nome, status: 'duplicada' })
      contadores.duplicadas++
      continue
    }
    if (!input.dry_run) {
      await prisma.inscricao.create({
        data: { evento_id: input.evento_id, modalidade_id: input.modalidade_id, participante_id: r.participante_id },
      })
    }
    inscritosSet.add(r.participante_id)
    results.push({ linha, nome, status: 'criada' })
    contadores.criadas++
  }

  return { rows: results, contadores }
}
```

(c) adicionar o import do helper no topo do arquivo:
```ts
import { resolverParticipantes } from '../participantes/resolver-participantes.service'
```

- [ ] **Step 2: Atualizar o teste** — em `backend/src/modules/inscricoes/inscricoes.service.test.ts`, o `vi.mock('../../lib/prisma', ...)` precisa cobrir o que o helper usa: garantir `municipio: { findMany: vi.fn() }` e `participante: { findMany: vi.fn() }` no objeto `default`. Adicionar o teste:

```ts
  it('importar NÃO cria participante; não cadastrado vira erro e conta nao_cadastrados', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 5, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 1 })
    mockPrisma.municipio.findMany.mockResolvedValue([{ id: 7, nome: 'São Paulo', uf: 'SP' }])
    // só "João" cadastrado; "Maria" não
    mockPrisma.participante.findMany.mockResolvedValue([{ id: 99, nome: 'João', municipio_id: 7 }])
    mockPrisma.inscricao.findMany.mockResolvedValue([])
    mockPrisma.inscricao.create.mockResolvedValue({})

    const res = await service.importar({
      evento_id: 5, modalidade_id: 2, dry_run: false,
      rows: [
        { nome: 'João', municipio_uf: 'SP', municipio_nome: 'São Paulo' },
        { nome: 'Maria', municipio_uf: 'SP', municipio_nome: 'São Paulo' },
      ],
    })
    expect(res.contadores.criadas).toBe(1)
    expect(res.contadores.nao_cadastrados).toBe(1)
    expect(res.contadores.erros).toBe(1)
    // só 1 inscrição criada (a do cadastrado), nunca cria participante
    expect(mockPrisma.inscricao.create).toHaveBeenCalledTimes(1)
    expect(mockPrisma.participante.create).not.toHaveBeenCalled?.()
  })
```

Garantir que o mock tenha `inscricao: { create: vi.fn(), findMany: vi.fn(), ... }`. Se o teste antigo de import (que esperava `participantes_criados`/auto-create) existir, **atualizá-lo/removê-lo** para refletir o novo comportamento (sem auto-create). Rodar e ajustar até verde:

Run: `cd backend && npx vitest run src/modules/inscricoes/inscricoes.service.test.ts`
Expected: PASS.

Run: `cd backend && npm run build`
Expected: tsc limpo.

- [ ] **Step 3: Tipos frontend** — em `frontend/src/types/inscricao.ts`, substituir:
```ts
export type ImportRowResult = {
  linha: number
  nome: string
  status: 'criada' | 'duplicada' | 'erro'
  erro?: string
}

export type ImportResult = {
  rows: ImportRowResult[]
  contadores: {
    criadas: number
    duplicadas: number
    erros: number
    nao_cadastrados: number
  }
}
```

- [ ] **Step 4: Ajustar o modal** — em `frontend/src/components/import/ImportInscricoesModal.tsx`:

(a) no resumo (passos review e done), trocar o 4º card "Participantes novos" por "Não cadastrados". Substituir as DUAS ocorrências de:
```tsx
                <div className="text-2xl font-bold text-[var(--brand-500)]">{preview.contadores.participantes_criados}</div>
                <div className="text-xs text-[var(--t3)]">Participantes novos</div>
```
e a equivalente com `commit.contadores.participantes_criados`, por (respeitando `preview`/`commit`):
```tsx
                <div className="text-2xl font-bold text-[var(--danger)]">{preview.contadores.nao_cadastrados}</div>
                <div className="text-xs text-[var(--t3)]">Não cadastrados</div>
```
(no bloco `done`, usar `commit.contadores.nao_cadastrados`.)

(b) na coluna "Detalhe" da tabela, trocar:
```tsx
                        {r.erro ?? (r.participante_criado ? 'Novo participante' : '')}
```
por:
```tsx
                        {r.erro ?? ''}
```

(c) nas instruções (lista `ul`), substituir o item:
```tsx
                <li>Participantes já cadastrados são reaproveitados; novos são criados automaticamente.</li>
```
por:
```tsx
                <li>Os participantes precisam estar cadastrados em <b>Participantes</b>. Não cadastrados são listados como erro para você cadastrar e reimportar.</li>
```

- [ ] **Step 5: Build frontend**

Run: `cd frontend && npx tsc -b && npm run build`
Expected: conclui sem erros.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/inscricoes/inscricoes.service.ts backend/src/modules/inscricoes/inscricoes.service.test.ts frontend/src/types/inscricao.ts frontend/src/components/import/ImportInscricoesModal.tsx
git commit -m "feat(inscricoes): import exige participante cadastrado (não cria; lista não cadastrados)"
```

---

## Task 4: Item 3 — Import de campeões por modalidade

**Files:**
- Modify: `backend/src/modules/campeoes_anteriores/campeoes_anteriores.service.ts`
- Modify: `backend/src/modules/campeoes_anteriores/campeoes_anteriores.controller.ts`
- Modify: `backend/src/modules/campeoes_anteriores/campeoes_anteriores.routes.ts`
- Test: `backend/src/modules/campeoes_anteriores/campeoes_anteriores.service.test.ts`
- Modify: `frontend/src/services/campeoes-anteriores.ts`
- Create: `frontend/src/components/import/ImportCampeoesModal.tsx`
- Modify: `frontend/src/pages/eventos/EventoInscricoes.tsx`

- [ ] **Step 1: Implementar o service de import** — em `backend/src/modules/campeoes_anteriores/campeoes_anteriores.service.ts`:

(a) adicionar o import do helper no topo:
```ts
import { resolverParticipantes } from '../participantes/resolver-participantes.service'
```

(b) adicionar os tipos + função (após `remover`):
```ts
export type ImportCampeaoRow = {
  posicao: number
  nome: string
  municipio_uf: string
  municipio_nome: string
  subtitulo?: string
}

export type ImportCampeaoRowResult = {
  linha: number
  posicao: number
  nome: string
  status: 'criada' | 'duplicada' | 'erro'
  erro?: string
}

export type ImportCampeoesResult = {
  rows: ImportCampeaoRowResult[]
  contadores: { criadas: number; duplicadas: number; erros: number }
}

export async function importar(input: {
  evento_id: number
  modalidade_id: number
  dry_run: boolean
  rows: ImportCampeaoRow[]
}): Promise<ImportCampeoesResult> {
  const [evento, modalidade] = await Promise.all([
    prisma.evento.findUnique({ where: { id: input.evento_id }, select: { competicao_id: true } }),
    prisma.modalidade.findUnique({ where: { id: input.modalidade_id }, select: { competicao_id: true } }),
  ])
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })
  if (!modalidade) throw Object.assign(new Error('Modalidade não encontrada'), { status: 404 })
  if (evento.competicao_id !== modalidade.competicao_id) {
    throw Object.assign(new Error('A modalidade não pertence à competição deste evento.'), { status: 400 })
  }

  const resolucoes = await resolverParticipantes(input.rows)

  const existentes = await prisma.campeaoAnterior.findMany({
    where: { evento_id: input.evento_id, modalidade_id: input.modalidade_id },
    select: { posicao: true },
  })
  const posicoesOcupadas = new Set<number>(existentes.map(c => c.posicao))

  const results: ImportCampeaoRowResult[] = []
  const contadores = { criadas: 0, duplicadas: 0, erros: 0 }

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i]
    const linha = i + 1
    const nome = row.nome.trim()
    const posicao = row.posicao
    const r = resolucoes[i]

    if (!Number.isInteger(posicao) || posicao < 1 || posicao > 12) {
      results.push({ linha, posicao, nome, status: 'erro', erro: 'Posição deve ser um inteiro de 1 a 12.' })
      contadores.erros++
      continue
    }
    if (r.municipio_id == null) {
      results.push({ linha, posicao, nome, status: 'erro', erro: `Município '${row.municipio_nome}/${row.municipio_uf}' não encontrado` })
      contadores.erros++
      continue
    }
    if (r.participante_id == null) {
      results.push({ linha, posicao, nome, status: 'erro', erro: "Participante não cadastrado. Cadastre em 'Participantes' primeiro." })
      contadores.erros++
      continue
    }
    if (posicoesOcupadas.has(posicao)) {
      results.push({ linha, posicao, nome, status: 'duplicada' })
      contadores.duplicadas++
      continue
    }
    if (!input.dry_run) {
      await prisma.campeaoAnterior.create({
        data: {
          evento_id: input.evento_id,
          modalidade_id: input.modalidade_id,
          participante_id: r.participante_id,
          posicao,
        },
      })
    }
    posicoesOcupadas.add(posicao)
    results.push({ linha, posicao, nome, status: 'criada' })
    contadores.criadas++
  }

  return { rows: results, contadores }
}
```

- [ ] **Step 2: Controller + rota**

Em `backend/src/modules/campeoes_anteriores/campeoes_anteriores.controller.ts`, adicionar:
```ts
const importRowSchema = z.object({
  posicao: z.coerce.number().int().min(1).max(12),
  nome: z.string().min(1).max(200),
  municipio_uf: z.string().length(2),
  municipio_nome: z.string().min(1).max(120),
  subtitulo: z.string().max(200).optional(),
})
const importSchema = z.object({
  evento_id: z.coerce.number().int().positive(),
  modalidade_id: z.coerce.number().int().positive(),
  dry_run: z.boolean(),
  rows: z.array(importRowSchema).min(1).max(500),
})

export async function importar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = importSchema.parse(req.body)
    res.json(await service.importar(body))
  } catch (err) { next(err) }
}
```

Em `backend/src/modules/campeoes_anteriores/campeoes_anteriores.routes.ts`, adicionar (após `router.post('/', ...)`):
```ts
router.post('/import', ...admin, ctrl.importar)
```

- [ ] **Step 3: Teste backend** — em `backend/src/modules/campeoes_anteriores/campeoes_anteriores.service.test.ts` (criar se não existir, com o mock de prisma incluindo `evento`, `modalidade`, `campeaoAnterior: { findMany, create }`, `municipio: { findMany }`, `participante: { findMany }`):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    evento: { findUnique: vi.fn() },
    modalidade: { findUnique: vi.fn() },
    campeaoAnterior: { findMany: vi.fn(), create: vi.fn() },
    municipio: { findMany: vi.fn() },
    participante: { findMany: vi.fn() },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './campeoes_anteriores.service'

const mockPrisma = prisma as any
beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.evento.findUnique.mockResolvedValue({ competicao_id: 1 })
  mockPrisma.modalidade.findUnique.mockResolvedValue({ competicao_id: 1 })
  mockPrisma.municipio.findMany.mockResolvedValue([{ id: 7, nome: 'São Paulo', uf: 'SP' }])
  mockPrisma.participante.findMany.mockResolvedValue([{ id: 99, nome: 'João', municipio_id: 7 }])
  mockPrisma.campeaoAnterior.findMany.mockResolvedValue([])
  mockPrisma.campeaoAnterior.create.mockResolvedValue({})
})

describe('campeoes importar', () => {
  it('cria campeão válido', async () => {
    const res = await service.importar({
      evento_id: 5, modalidade_id: 2, dry_run: false,
      rows: [{ posicao: 1, nome: 'João', municipio_uf: 'SP', municipio_nome: 'São Paulo' }],
    })
    expect(res.contadores.criadas).toBe(1)
    expect(mockPrisma.campeaoAnterior.create).toHaveBeenCalledTimes(1)
  })

  it('pula posição já ocupada (duplicada)', async () => {
    mockPrisma.campeaoAnterior.findMany.mockResolvedValue([{ posicao: 1 }])
    const res = await service.importar({
      evento_id: 5, modalidade_id: 2, dry_run: false,
      rows: [{ posicao: 1, nome: 'João', municipio_uf: 'SP', municipio_nome: 'São Paulo' }],
    })
    expect(res.contadores.duplicadas).toBe(1)
    expect(res.contadores.criadas).toBe(0)
    expect(mockPrisma.campeaoAnterior.create).not.toHaveBeenCalled()
  })

  it('participante não cadastrado vira erro', async () => {
    const res = await service.importar({
      evento_id: 5, modalidade_id: 2, dry_run: false,
      rows: [{ posicao: 2, nome: 'Maria', municipio_uf: 'SP', municipio_nome: 'São Paulo' }],
    })
    expect(res.contadores.erros).toBe(1)
    expect(res.rows[0].erro).toContain('não cadastrado')
  })
})
```

Run: `cd backend && npx vitest run src/modules/campeoes_anteriores/campeoes_anteriores.service.test.ts`
Expected: PASS (3 testes).

Run: `cd backend && npm run build`
Expected: tsc limpo.

- [ ] **Step 4: Service frontend** — em `frontend/src/services/campeoes-anteriores.ts`, adicionar os tipos + método:

```ts
export type ImportCampeaoRow = {
  posicao: number
  nome: string
  municipio_uf: string
  municipio_nome: string
  subtitulo?: string
}
export type ImportCampeaoRowResult = {
  linha: number
  posicao: number
  nome: string
  status: 'criada' | 'duplicada' | 'erro'
  erro?: string
}
export type ImportCampeoesResult = {
  rows: ImportCampeaoRowResult[]
  contadores: { criadas: number; duplicadas: number; erros: number }
}
```
e dentro de `campeoesAnterioresService`:
```ts
  importar: (data: { evento_id: number; modalidade_id: number; dry_run: boolean; rows: ImportCampeaoRow[] }) =>
    api.post<ImportCampeoesResult>(`${BASE}/import`, data).then(r => r.data),
```

- [ ] **Step 5: Modal de import de campeões** — criar `frontend/src/components/import/ImportCampeoesModal.tsx`:

```tsx
import { useState } from 'react'
import Papa from 'papaparse'
import { campeoesAnterioresService } from '../../services/campeoes-anteriores'
import type { ImportCampeaoRow, ImportCampeoesResult } from '../../services/campeoes-anteriores'
import { downloadCsvTemplate } from '../../lib/csv-template'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'

type Props = {
  open: boolean
  eventoId: number
  modalidadeId: number
  onClose: () => void
  onImported: () => void
}

const REQUIRED_HEADERS = ['posicao', 'nome', 'municipio_uf', 'municipio_nome'] as const
type Step = 'upload' | 'review' | 'done'

function StatusBadge({ status }: { status: 'criada' | 'duplicada' | 'erro' }) {
  const map = {
    criada: { label: 'Criada', color: 'bg-[var(--success-soft)] text-[var(--success-700)] border-[var(--success)]' },
    duplicada: { label: 'Duplicada', color: 'bg-[var(--warn-soft)] text-[var(--warn-700)] border-[var(--warn)]' },
    erro: { label: 'Erro', color: 'bg-[var(--danger-soft)] text-[var(--danger-700)] border-[var(--danger)]' },
  } as const
  const m = map[status]
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${m.color}`}>{m.label}</span>
}

export default function ImportCampeoesModal({ open, eventoId, modalidadeId, onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<ImportCampeaoRow[]>([])
  const [preview, setPreview] = useState<ImportCampeoesResult | null>(null)
  const [commit, setCommit] = useState<ImportCampeoesResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const template = {
    filename: 'modelo_campeoes.csv',
    headers: ['posicao', 'nome', 'municipio_uf', 'municipio_nome', 'subtitulo'],
    exampleRows: [
      ['1', 'João Silva', 'SP', 'São Paulo', ''],
      ['2', 'Maria Souza', 'RJ', 'Rio de Janeiro', ''],
      ['3', 'Pedro Oliveira', 'MG', 'Belo Horizonte', ''],
    ],
  }

  function reset() { setStep('upload'); setFile(null); setRows([]); setPreview(null); setCommit(null); setLoading(false); setErro('') }
  function handleClose() { reset(); onClose() }

  function handleParseNext() {
    if (!file) { setErro('Selecione um arquivo CSV.'); return }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const headers = result.meta.fields ?? []
        const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h))
        if (missing.length > 0) { setErro(`Cabeçalho inválido. Coluna(s) obrigatória(s) ausente(s): ${missing.join(', ')}`); return }
        const parsed: ImportCampeaoRow[] = result.data
          .map(r => ({
            posicao: Number((r.posicao ?? '').trim()),
            nome: (r.nome ?? '').trim(),
            municipio_uf: (r.municipio_uf ?? '').trim(),
            municipio_nome: (r.municipio_nome ?? '').trim(),
            subtitulo: r.subtitulo?.trim() || undefined,
          }))
          .filter(r => r.nome && r.municipio_uf && r.municipio_nome)
        if (parsed.length === 0) { setErro('Nenhuma linha válida encontrada no CSV.'); return }
        setRows(parsed)
        runPreview(parsed)
      },
      error: (err) => setErro(`Erro ao ler CSV: ${err.message}`),
    })
  }

  async function runPreview(parsedRows: ImportCampeaoRow[]) {
    setLoading(true); setErro('')
    try {
      const res = await campeoesAnterioresService.importar({ evento_id: eventoId, modalidade_id: modalidadeId, dry_run: true, rows: parsedRows })
      setPreview(res); setStep('review')
    } catch (err: any) { setErro(err?.response?.data?.message ?? 'Erro ao validar.') } finally { setLoading(false) }
  }

  async function handleCommit() {
    setLoading(true); setErro('')
    try {
      const res = await campeoesAnterioresService.importar({ evento_id: eventoId, modalidade_id: modalidadeId, dry_run: false, rows })
      setCommit(res); setStep('done')
    } catch (err: any) { setErro(err?.response?.data?.message ?? 'Erro ao importar.') } finally { setLoading(false) }
  }

  function handleDone() { onImported(); handleClose() }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-30" onClick={handleClose}>
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6 max-w-3xl w-full mx-4 max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--t1)]">Importar campeões (CSV)</h3>
          <div className="text-xs text-[var(--t3)]">Passo {step === 'upload' ? '1' : step === 'review' ? '2' : '3'} de 3</div>
        </div>

        {step === 'upload' && (
          <div className="space-y-4">
            <section style={{ background: 'var(--card-bg-2)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--grad-brand-deep)', color: '#fff', display: 'grid', placeItems: 'center' }}><FileSpreadsheet size={16} /></div>
                  <div><div className="eyebrow">Passo 1</div><div className="text-sm font-semibold text-[var(--t1)]">Baixar modelo + instruções</div></div>
                </div>
                <button type="button" onClick={() => downloadCsvTemplate(template)} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Download size={14} /> Baixar modelo CSV</button>
              </div>
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-md)', padding: 12, fontFamily: 'var(--font-mono)', fontSize: 11, overflowX: 'auto', marginBottom: 10 }}>
                <div className="font-bold text-[var(--brand-500)] mb-1">posicao,nome,municipio_uf,municipio_nome,subtitulo</div>
                <div className="text-[var(--t3)]">1,João Silva,SP,São Paulo,</div>
                <div className="text-[var(--t3)]">2,Maria Souza,RJ,Rio de Janeiro,</div>
              </div>
              <ul className="text-xs text-[var(--t3)] space-y-1 ml-4 list-disc">
                <li><b>posicao</b>: colocação (1 a 12).</li>
                <li><b>nome</b>, <b>municipio_uf</b>, <b>municipio_nome</b>: identificam o participante (que precisa estar cadastrado em <b>Participantes</b>).</li>
                <li>Posições já preenchidas são ignoradas (duplicadas); não cadastrados viram erro.</li>
                <li>UTF-8, separador vírgula, cabeçalho na primeira linha.</li>
              </ul>
            </section>

            <section style={{ background: 'var(--card-bg-2)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
              <div className="flex items-center gap-2.5 mb-3">
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', color: '#fff', display: 'grid', placeItems: 'center' }}><Upload size={16} /></div>
                <div><div className="eyebrow">Passo 2</div><div className="text-sm font-semibold text-[var(--t1)]">Enviar arquivo preenchido</div></div>
              </div>
              <input type="file" accept=".csv,text/csv" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setErro('') } }} className="block w-full text-sm text-[var(--t1)] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[var(--brand-500)] file:text-white file:cursor-pointer file:font-semibold hover:file:bg-[var(--brand-400)]" />
              {file && <p className="text-xs text-[var(--t3)] mt-2">Selecionado: <b className="text-[var(--t1)]">{file.name}</b> · {(file.size / 1024).toFixed(1)} KB</p>}
            </section>

            {erro && <p className="text-sm text-[var(--danger)]">{erro}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={handleClose} className="px-4 py-2 text-sm text-[var(--t2)] hover:text-[var(--t1)]">Cancelar</button>
              <button onClick={handleParseNext} disabled={!file || loading} className="btn btn-primary disabled:opacity-50">{loading ? 'Validando...' : 'Próximo'}</button>
            </div>
          </div>
        )}

        {step === 'review' && preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3"><div className="text-2xl font-bold text-[var(--success)]">{preview.contadores.criadas}</div><div className="text-xs text-[var(--t3)]">Serão criadas</div></div>
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3"><div className="text-2xl font-bold text-[var(--warn)]">{preview.contadores.duplicadas}</div><div className="text-xs text-[var(--t3)]">Duplicadas</div></div>
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3"><div className="text-2xl font-bold text-[var(--danger)]">{preview.contadores.erros}</div><div className="text-xs text-[var(--t3)]">Erros</div></div>
            </div>
            <div className="border border-[var(--card-border)] rounded-lg overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--card-bg-2)] text-[var(--t2)] text-xs"><tr><th className="text-left px-3 py-2 w-12">#</th><th className="text-left px-3 py-2 w-16">Pos.</th><th className="text-left px-3 py-2">Nome</th><th className="text-left px-3 py-2 w-28">Status</th><th className="text-left px-3 py-2">Detalhe</th></tr></thead>
                <tbody>
                  {preview.rows.map(r => (
                    <tr key={r.linha} className="border-t border-[var(--card-border)]">
                      <td className="px-3 py-2 font-mono text-xs text-[var(--t3)]">{r.linha}</td>
                      <td className="px-3 py-2 font-mono text-xs text-[var(--t2)]">{r.posicao}</td>
                      <td className="px-3 py-2 text-[var(--t1)]">{r.nome}</td>
                      <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-2 text-xs text-[var(--t3)]">{r.erro ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {erro && <p className="text-sm text-[var(--danger)]">{erro}</p>}
            <div className="flex justify-between gap-2 pt-2">
              <button onClick={() => { setStep('upload'); setPreview(null) }} className="px-4 py-2 text-sm text-[var(--t2)] hover:text-[var(--t1)]">← Voltar</button>
              <button onClick={handleCommit} disabled={loading || preview.contadores.criadas === 0} className="btn btn-primary disabled:opacity-50">{loading ? 'Importando...' : preview.contadores.criadas === 0 ? 'Nada para importar' : `Importar ${preview.contadores.criadas}`}</button>
            </div>
          </div>
        )}

        {step === 'done' && commit && (
          <div className="space-y-4 text-center">
            <div className="text-5xl">✅</div>
            <h4 className="text-xl font-semibold text-[var(--t1)]">Importação concluída</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3"><div className="text-2xl font-bold text-[var(--success)]">{commit.contadores.criadas}</div><div className="text-xs text-[var(--t3)]">Criadas</div></div>
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3"><div className="text-2xl font-bold text-[var(--warn)]">{commit.contadores.duplicadas}</div><div className="text-xs text-[var(--t3)]">Duplicadas</div></div>
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3"><div className="text-2xl font-bold text-[var(--danger)]">{commit.contadores.erros}</div><div className="text-xs text-[var(--t3)]">Erros</div></div>
            </div>
            <div className="pt-2"><button onClick={handleDone} className="btn btn-primary">Fechar</button></div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Botão no card "Campeões do ano anterior"** — em `frontend/src/pages/eventos/EventoInscricoes.tsx`:

(a) import (após o de `ModalidadesDoEventoModal`):
```tsx
import ImportCampeoesModal from '../../components/import/ImportCampeoesModal'
```
(b) estado (após `removerInscritosOpen`):
```tsx
  const [importCampeoesOpen, setImportCampeoesOpen] = useState(false)
```
(c) no cabeçalho do card "Campeões do ano anterior" (o `<section>` que contém o `<Crown size={18} />` e o `<h3>Campeões do ano anterior</h3>`), adicionar um botão de importar à direita do título. Logo após o `</div>` que fecha o bloco do título (o `<div>` com eyebrow "Histórico" + h3), inserir:
```tsx
                    <button
                      onClick={() => setImportCampeoesOpen(true)}
                      className="btn btn-ghost btn-sm ml-auto"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Download size={14} /> Importar CSV
                    </button>
```
(e ajustar o container do título para `flex items-center` com `gap` se necessário, garantindo que `ml-auto` empurre o botão para a direita.)
(d) montar o modal (perto dos outros modais, dentro do return):
```tsx
      {modalidadeId != null && (
        <ImportCampeoesModal
          open={importCampeoesOpen}
          eventoId={eventoId}
          modalidadeId={modalidadeId}
          onClose={() => setImportCampeoesOpen(false)}
          onImported={() => queryClient.invalidateQueries({ queryKey: ['campeoes-anteriores', eventoId, modalidadeId] })}
        />
      )}
```

- [ ] **Step 7: Build frontend**

Run: `cd frontend && npx tsc -b && npm run build`
Expected: conclui sem erros.

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/campeoes_anteriores frontend/src/services/campeoes-anteriores.ts frontend/src/components/import/ImportCampeoesModal.tsx frontend/src/pages/eventos/EventoInscricoes.tsx
git commit -m "feat(campeoes): import CSV de campeões por modalidade (template + validação)"
```

---

## Task 5: Item 4 — Import de Participantes

**Files:**
- Modify: `backend/src/modules/participantes/participantes.service.ts`
- Modify: `backend/src/modules/participantes/participantes.controller.ts`
- Modify: `backend/src/modules/participantes/participantes.routes.ts`
- Test: `backend/src/modules/participantes/participantes.service.test.ts`
- Modify: `frontend/src/services/participantes.ts`
- Create: `frontend/src/components/import/ImportParticipantesModal.tsx`
- Modify: `frontend/src/pages/participantes/ParticipantesList.tsx`

- [ ] **Step 1: Implementar `importar`** — em `backend/src/modules/participantes/participantes.service.ts`:

(a) import no topo:
```ts
import { resolverParticipantes } from './resolver-participantes.service'
```
(b) tipos + função (após `remover`):
```ts
export type ImportParticipanteRow = {
  nome: string
  municipio_uf: string
  municipio_nome: string
  subtitulo?: string
}
export type ImportParticipanteRowResult = {
  linha: number
  nome: string
  status: 'criada' | 'duplicada' | 'erro'
  erro?: string
}
export type ImportParticipantesResult = {
  rows: ImportParticipanteRowResult[]
  contadores: { criadas: number; duplicadas: number; erros: number }
}

export async function importar(input: {
  dry_run: boolean
  rows: ImportParticipanteRow[]
}): Promise<ImportParticipantesResult> {
  const resolucoes = await resolverParticipantes(input.rows)

  const results: ImportParticipanteRowResult[] = []
  const contadores = { criadas: 0, duplicadas: 0, erros: 0 }
  // Identidade já criada DENTRO deste arquivo (município_id:nome) p/ evitar duplicar
  const criadosNoArquivo = new Set<string>()

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i]
    const linha = i + 1
    const nome = row.nome.trim()
    const subtitulo = row.subtitulo?.trim() || undefined
    const r = resolucoes[i]

    if (r.municipio_id == null) {
      results.push({ linha, nome, status: 'erro', erro: `Município '${row.municipio_nome}/${row.municipio_uf}' não encontrado` })
      contadores.erros++
      continue
    }
    const chave = `${r.municipio_id}:${nome.toLowerCase()}`
    if (r.participante_id != null || criadosNoArquivo.has(chave)) {
      results.push({ linha, nome, status: 'duplicada' })
      contadores.duplicadas++
      continue
    }
    if (!input.dry_run) {
      await prisma.participante.create({ data: { nome, municipio_id: r.municipio_id, subtitulo } })
    }
    criadosNoArquivo.add(chave)
    results.push({ linha, nome, status: 'criada' })
    contadores.criadas++
  }

  return { rows: results, contadores }
}
```

- [ ] **Step 2: Controller + rota**

Em `backend/src/modules/participantes/participantes.controller.ts`, adicionar (com `import { z } from 'zod'` se ainda não houver):
```ts
const importRowSchema = z.object({
  nome: z.string().min(1).max(200),
  municipio_uf: z.string().length(2),
  municipio_nome: z.string().min(1).max(120),
  subtitulo: z.string().max(200).optional(),
})
const importSchema = z.object({
  dry_run: z.boolean(),
  rows: z.array(importRowSchema).min(1).max(5000),
})

export async function importar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = importSchema.parse(req.body)
    res.json(await service.importar(body))
  } catch (err) { next(err) }
}
```

Em `backend/src/modules/participantes/participantes.routes.ts`, adicionar (após `router.post('/', ...)`):
```ts
router.post('/import', ...admin, ctrl.importar)
```

- [ ] **Step 3: Teste backend** — criar/editar `backend/src/modules/participantes/participantes.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/prisma', () => ({
  default: {
    municipio: { findMany: vi.fn() },
    participante: { findMany: vi.fn(), create: vi.fn() },
  },
}))

import prisma from '../../lib/prisma'
import * as service from './participantes.service'

const mockPrisma = prisma as any
beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.municipio.findMany.mockResolvedValue([{ id: 7, nome: 'São Paulo', uf: 'SP' }])
  mockPrisma.participante.create.mockResolvedValue({})
})

describe('participantes importar', () => {
  it('cria novo e pula existente (mesmo município+nome)', async () => {
    mockPrisma.participante.findMany.mockResolvedValue([{ id: 99, nome: 'João', municipio_id: 7 }])
    const res = await service.importar({
      dry_run: false,
      rows: [
        { nome: 'João', municipio_uf: 'SP', municipio_nome: 'São Paulo' }, // existe → duplicada
        { nome: 'Novo', municipio_uf: 'SP', municipio_nome: 'São Paulo' }, // cria
      ],
    })
    expect(res.contadores.criadas).toBe(1)
    expect(res.contadores.duplicadas).toBe(1)
    expect(mockPrisma.participante.create).toHaveBeenCalledTimes(1)
  })

  it('município inexistente vira erro', async () => {
    mockPrisma.municipio.findMany.mockResolvedValue([])
    mockPrisma.participante.findMany.mockResolvedValue([])
    const res = await service.importar({
      dry_run: false,
      rows: [{ nome: 'X', municipio_uf: 'ZZ', municipio_nome: 'Inexistente' }],
    })
    expect(res.contadores.erros).toBe(1)
    expect(mockPrisma.participante.create).not.toHaveBeenCalled()
  })

  it('pula duplicado dentro do próprio arquivo', async () => {
    mockPrisma.participante.findMany.mockResolvedValue([])
    const res = await service.importar({
      dry_run: false,
      rows: [
        { nome: 'Ana', municipio_uf: 'SP', municipio_nome: 'São Paulo' },
        { nome: 'ana', municipio_uf: 'SP', municipio_nome: 'são paulo' },
      ],
    })
    expect(res.contadores.criadas).toBe(1)
    expect(res.contadores.duplicadas).toBe(1)
  })
})
```

Run: `cd backend && npx vitest run src/modules/participantes/participantes.service.test.ts`
Expected: PASS (3 testes).

Run: `cd backend && npm run build`
Expected: tsc limpo.

- [ ] **Step 4: Service frontend** — em `frontend/src/services/participantes.ts`, adicionar os tipos + método:

```ts
export type ImportParticipanteRow = {
  nome: string
  municipio_uf: string
  municipio_nome: string
  subtitulo?: string
}
export type ImportParticipanteRowResult = {
  linha: number
  nome: string
  status: 'criada' | 'duplicada' | 'erro'
  erro?: string
}
export type ImportParticipantesResult = {
  rows: ImportParticipanteRowResult[]
  contadores: { criadas: number; duplicadas: number; erros: number }
}
```
e dentro de `participantesService`:
```ts
  importar: (data: { dry_run: boolean; rows: ImportParticipanteRow[] }) =>
    api.post<ImportParticipantesResult>(`${BASE}/import`, data).then(r => r.data),
```

- [ ] **Step 5: Modal de import de participantes** — criar `frontend/src/components/import/ImportParticipantesModal.tsx`:

```tsx
import { useState } from 'react'
import Papa from 'papaparse'
import { participantesService } from '../../services/participantes'
import type { ImportParticipanteRow, ImportParticipantesResult } from '../../services/participantes'
import { downloadCsvTemplate } from '../../lib/csv-template'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'

type Props = { open: boolean; onClose: () => void; onImported: () => void }

const REQUIRED_HEADERS = ['nome', 'municipio_uf', 'municipio_nome'] as const
type Step = 'upload' | 'review' | 'done'

function StatusBadge({ status }: { status: 'criada' | 'duplicada' | 'erro' }) {
  const map = {
    criada: { label: 'Criada', color: 'bg-[var(--success-soft)] text-[var(--success-700)] border-[var(--success)]' },
    duplicada: { label: 'Duplicada', color: 'bg-[var(--warn-soft)] text-[var(--warn-700)] border-[var(--warn)]' },
    erro: { label: 'Erro', color: 'bg-[var(--danger-soft)] text-[var(--danger-700)] border-[var(--danger)]' },
  } as const
  const m = map[status]
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${m.color}`}>{m.label}</span>
}

export default function ImportParticipantesModal({ open, onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<ImportParticipanteRow[]>([])
  const [preview, setPreview] = useState<ImportParticipantesResult | null>(null)
  const [commit, setCommit] = useState<ImportParticipantesResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const template = {
    filename: 'modelo_participantes.csv',
    headers: ['nome', 'municipio_uf', 'municipio_nome', 'subtitulo'],
    exampleRows: [
      ['João Silva', 'SP', 'São Paulo', ''],
      ['Maria Souza', 'RJ', 'Rio de Janeiro', ''],
      ['Pedro Oliveira', 'MG', 'Belo Horizonte', ''],
    ],
  }

  function reset() { setStep('upload'); setFile(null); setRows([]); setPreview(null); setCommit(null); setLoading(false); setErro('') }
  function handleClose() { reset(); onClose() }

  function handleParseNext() {
    if (!file) { setErro('Selecione um arquivo CSV.'); return }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const headers = result.meta.fields ?? []
        const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h))
        if (missing.length > 0) { setErro(`Cabeçalho inválido. Coluna(s) obrigatória(s) ausente(s): ${missing.join(', ')}`); return }
        const parsed: ImportParticipanteRow[] = result.data
          .map(r => ({
            nome: (r.nome ?? '').trim(),
            municipio_uf: (r.municipio_uf ?? '').trim(),
            municipio_nome: (r.municipio_nome ?? '').trim(),
            subtitulo: r.subtitulo?.trim() || undefined,
          }))
          .filter(r => r.nome && r.municipio_uf && r.municipio_nome)
        if (parsed.length === 0) { setErro('Nenhuma linha válida encontrada no CSV.'); return }
        setRows(parsed)
        runPreview(parsed)
      },
      error: (err) => setErro(`Erro ao ler CSV: ${err.message}`),
    })
  }

  async function runPreview(parsedRows: ImportParticipanteRow[]) {
    setLoading(true); setErro('')
    try { const res = await participantesService.importar({ dry_run: true, rows: parsedRows }); setPreview(res); setStep('review') }
    catch (err: any) { setErro(err?.response?.data?.message ?? 'Erro ao validar.') } finally { setLoading(false) }
  }

  async function handleCommit() {
    setLoading(true); setErro('')
    try { const res = await participantesService.importar({ dry_run: false, rows }); setCommit(res); setStep('done') }
    catch (err: any) { setErro(err?.response?.data?.message ?? 'Erro ao importar.') } finally { setLoading(false) }
  }

  function handleDone() { onImported(); handleClose() }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-30" onClick={handleClose}>
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl p-6 max-w-3xl w-full mx-4 max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--t1)]">Importar participantes (CSV)</h3>
          <div className="text-xs text-[var(--t3)]">Passo {step === 'upload' ? '1' : step === 'review' ? '2' : '3'} de 3</div>
        </div>

        {step === 'upload' && (
          <div className="space-y-4">
            <section style={{ background: 'var(--card-bg-2)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--grad-brand-deep)', color: '#fff', display: 'grid', placeItems: 'center' }}><FileSpreadsheet size={16} /></div>
                  <div><div className="eyebrow">Passo 1</div><div className="text-sm font-semibold text-[var(--t1)]">Baixar modelo + instruções</div></div>
                </div>
                <button type="button" onClick={() => downloadCsvTemplate(template)} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Download size={14} /> Baixar modelo CSV</button>
              </div>
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-md)', padding: 12, fontFamily: 'var(--font-mono)', fontSize: 11, overflowX: 'auto', marginBottom: 10 }}>
                <div className="font-bold text-[var(--brand-500)] mb-1">nome,municipio_uf,municipio_nome,subtitulo</div>
                <div className="text-[var(--t3)]">João Silva,SP,São Paulo,</div>
                <div className="text-[var(--t3)]">Maria Souza,RJ,Rio de Janeiro,</div>
              </div>
              <ul className="text-xs text-[var(--t3)] space-y-1 ml-4 list-disc">
                <li><b>nome</b>: nome do participante (obrigatório).</li>
                <li><b>municipio_uf</b> / <b>municipio_nome</b>: o município precisa já existir no sistema.</li>
                <li><b>subtitulo</b>: opcional.</li>
                <li>Participante já existente (mesmo município + nome) é ignorado (duplicada).</li>
                <li>UTF-8, separador vírgula, cabeçalho na primeira linha.</li>
              </ul>
            </section>

            <section style={{ background: 'var(--card-bg-2)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
              <div className="flex items-center gap-2.5 mb-3">
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', color: '#fff', display: 'grid', placeItems: 'center' }}><Upload size={16} /></div>
                <div><div className="eyebrow">Passo 2</div><div className="text-sm font-semibold text-[var(--t1)]">Enviar arquivo preenchido</div></div>
              </div>
              <input type="file" accept=".csv,text/csv" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setErro('') } }} className="block w-full text-sm text-[var(--t1)] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[var(--brand-500)] file:text-white file:cursor-pointer file:font-semibold hover:file:bg-[var(--brand-400)]" />
              {file && <p className="text-xs text-[var(--t3)] mt-2">Selecionado: <b className="text-[var(--t1)]">{file.name}</b> · {(file.size / 1024).toFixed(1)} KB</p>}
            </section>

            {erro && <p className="text-sm text-[var(--danger)]">{erro}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={handleClose} className="px-4 py-2 text-sm text-[var(--t2)] hover:text-[var(--t1)]">Cancelar</button>
              <button onClick={handleParseNext} disabled={!file || loading} className="btn btn-primary disabled:opacity-50">{loading ? 'Validando...' : 'Próximo'}</button>
            </div>
          </div>
        )}

        {step === 'review' && preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3"><div className="text-2xl font-bold text-[var(--success)]">{preview.contadores.criadas}</div><div className="text-xs text-[var(--t3)]">Serão criados</div></div>
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3"><div className="text-2xl font-bold text-[var(--warn)]">{preview.contadores.duplicadas}</div><div className="text-xs text-[var(--t3)]">Duplicados</div></div>
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3"><div className="text-2xl font-bold text-[var(--danger)]">{preview.contadores.erros}</div><div className="text-xs text-[var(--t3)]">Erros</div></div>
            </div>
            <div className="border border-[var(--card-border)] rounded-lg overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--card-bg-2)] text-[var(--t2)] text-xs"><tr><th className="text-left px-3 py-2 w-12">#</th><th className="text-left px-3 py-2">Nome</th><th className="text-left px-3 py-2 w-28">Status</th><th className="text-left px-3 py-2">Detalhe</th></tr></thead>
                <tbody>
                  {preview.rows.map(r => (
                    <tr key={r.linha} className="border-t border-[var(--card-border)]">
                      <td className="px-3 py-2 font-mono text-xs text-[var(--t3)]">{r.linha}</td>
                      <td className="px-3 py-2 text-[var(--t1)]">{r.nome}</td>
                      <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-2 text-xs text-[var(--t3)]">{r.erro ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {erro && <p className="text-sm text-[var(--danger)]">{erro}</p>}
            <div className="flex justify-between gap-2 pt-2">
              <button onClick={() => { setStep('upload'); setPreview(null) }} className="px-4 py-2 text-sm text-[var(--t2)] hover:text-[var(--t1)]">← Voltar</button>
              <button onClick={handleCommit} disabled={loading || preview.contadores.criadas === 0} className="btn btn-primary disabled:opacity-50">{loading ? 'Importando...' : preview.contadores.criadas === 0 ? 'Nada para importar' : `Importar ${preview.contadores.criadas}`}</button>
            </div>
          </div>
        )}

        {step === 'done' && commit && (
          <div className="space-y-4 text-center">
            <div className="text-5xl">✅</div>
            <h4 className="text-xl font-semibold text-[var(--t1)]">Importação concluída</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3"><div className="text-2xl font-bold text-[var(--success)]">{commit.contadores.criadas}</div><div className="text-xs text-[var(--t3)]">Criados</div></div>
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3"><div className="text-2xl font-bold text-[var(--warn)]">{commit.contadores.duplicadas}</div><div className="text-xs text-[var(--t3)]">Duplicados</div></div>
              <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg p-3"><div className="text-2xl font-bold text-[var(--danger)]">{commit.contadores.erros}</div><div className="text-xs text-[var(--t3)]">Erros</div></div>
            </div>
            <div className="pt-2"><button onClick={handleDone} className="btn btn-primary">Fechar</button></div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Botão na página Participantes** — em `frontend/src/pages/participantes/ParticipantesList.tsx`:

(a) imports:
```tsx
import ImportParticipantesModal from '../../components/import/ImportParticipantesModal'
import { Download } from 'lucide-react'
```
(b) estado (após `const [removerAlvo, ...]`):
```tsx
  const [importOpen, setImportOpen] = useState(false)
```
(c) no `PageHeader`, trocar a prop `actions` por (botão de importar + o existente):
```tsx
        actions={
          <div className="flex gap-2">
            <button onClick={() => setImportOpen(true)} className="btn btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Download size={16} /> Importar CSV
            </button>
            <button onClick={() => navigate('/participantes/novo')} className="btn btn-primary">
              <Plus size={16} /> Novo Participante
            </button>
          </div>
        }
```
(d) montar o modal antes do fechamento do componente (junto ao `ConfirmDialog` de remover):
```tsx
      <ImportParticipantesModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['participantes'] })}
      />
```

- [ ] **Step 7: Build frontend**

Run: `cd frontend && npx tsc -b && npm run build`
Expected: conclui sem erros.

- [ ] **Step 8: Commit**

```bash
git add backend/src/modules/participantes/participantes.service.ts backend/src/modules/participantes/participantes.controller.ts backend/src/modules/participantes/participantes.routes.ts backend/src/modules/participantes/participantes.service.test.ts frontend/src/services/participantes.ts frontend/src/components/import/ImportParticipantesModal.tsx frontend/src/pages/participantes/ParticipantesList.tsx
git commit -m "feat(participantes): import CSV de participantes (template + validação de município)"
```

---

## Self-review (cobertura da spec)

- Helper `resolverParticipantes` (resolve sem criar; município/participante) → Task 1 ✓
- Item 1 remover-todos com guardrail de sorteio (400) + botão/confirm → Task 2 ✓
- Item 2 import inscritos sem auto-create; não cadastrado = erro; contador `nao_cadastrados`; import parcial; modal atualizado → Task 3 ✓
- Item 3 import campeões por modalidade; pula posição ocupada; valida 1-12 e participante; template; modal + botão no card Campeões → Task 4 ✓
- Item 4 import participantes (cria; município deve existir; pula duplicado banco/arquivo); template; modal + botão na página Participantes → Task 5 ✓
- Tipos consistentes: `ResolucaoParticipante { municipio_id, participante_id }`; `ImportResult.contadores` por contexto; rotas `DELETE /inscricoes/evento/:eventoId/modalidade/:modalidadeId`, `POST /campeoes-anteriores/import`, `POST /participantes/import` ✓
- Sem migration; validação por testes (mock prisma) + `npm run build` + manual ✓
