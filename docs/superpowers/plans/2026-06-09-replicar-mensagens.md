# Replicar mensagens para outras modalidades — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir replicar as regras `mensagens_inscritos` de uma modalidade para outras do mesmo tipo (qualquer competição), substituindo as do alvo.

**Architecture:** Endpoint backend `POST /modalidades/replicar-mensagens` (valida tipo da origem, substitui nos destinos de mesmo tipo). Frontend: método de serviço + helper puro de agrupamento + modal de seleção acionado por um botão no card de mensagens do `ModalidadeForm` (replica as mensagens atuais da tela).

**Tech Stack:** Backend Node/Express/Prisma/Vitest/zod; Frontend React 18/react-query/Vitest. Spec: `docs/superpowers/specs/2026-06-09-replicar-mensagens-design.md`.

---

## File Structure

- `backend/src/modules/modalidades/modalidades.service.ts` — `replicarMensagens(origem_id, destino_ids, mensagens)`.
- `backend/src/modules/modalidades/modalidades.service.test.ts` — testes.
- `backend/src/modules/modalidades/modalidades.controller.ts` — `replicarMensagens` + zod.
- `backend/src/modules/modalidades/modalidades.routes.ts` — rota POST.
- `frontend/src/services/modalidades.ts` — `replicarMensagens`.
- `frontend/src/lib/replicar-alvos.ts` — `agruparAlvosPorCompeticao` (puro) + tipos.
- `frontend/src/lib/replicar-alvos.test.ts` — testes.
- `frontend/src/components/ReplicarMensagensModal.tsx` — modal de seleção.
- `frontend/src/pages/modalidades/ModalidadeForm.tsx` — botão "Replicar para outras modalidades…".

---

## Task 1: Backend — service `replicarMensagens`

**Files:**
- Modify: `backend/src/modules/modalidades/modalidades.service.ts`
- Test: `backend/src/modules/modalidades/modalidades.service.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar dentro do `describe('modalidades.service', ...)` em `modalidades.service.test.ts`:

```ts
  it('replicarMensagens aplica só nos destinos de mesmo tipo e retorna contagem', async () => {
    mockPrisma.modalidade.findUnique.mockResolvedValue({ tipo_modalidade: { tipo: 'grupos' } })
    mockPrisma.modalidade.findMany.mockResolvedValue([
      { id: 2, tipo_modalidade: { tipo: 'grupos' } },
      { id: 3, tipo_modalidade: { tipo: 'chaves' } },
      { id: 1, tipo_modalidade: { tipo: 'grupos' } },
    ])
    mockPrisma.modalidade.update.mockReturnValue('upd' as any)
    mockPrisma.$transaction.mockResolvedValue([])
    const msgs = [{ min: 2, max: 2, mensagem: 'x', pular_sorteio: true }]
    const r = await service.replicarMensagens(1, [2, 3, 1], msgs)
    expect(r).toEqual({ replicadas: 1 })
    expect(mockPrisma.modalidade.update).toHaveBeenCalledTimes(1)
    expect(mockPrisma.modalidade.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { mensagens_inscritos: msgs } })
  })

  it('replicarMensagens lança 404 se origem não existe', async () => {
    mockPrisma.modalidade.findUnique.mockResolvedValue(null)
    await expect(service.replicarMensagens(99, [2], [])).rejects.toMatchObject({ status: 404 })
  })
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd backend && npx vitest run src/modules/modalidades/modalidades.service.test.ts -t replicarMensagens`
Expected: FAIL — `service.replicarMensagens` não existe.

- [ ] **Step 3: Implementar**

Adicionar ao final de `backend/src/modules/modalidades/modalidades.service.ts`:

```ts
export async function replicarMensagens(
  origem_id: number,
  destino_ids: number[],
  mensagens: unknown,
): Promise<{ replicadas: number }> {
  const origem = await prisma.modalidade.findUnique({
    where: { id: origem_id },
    select: { tipo_modalidade: { select: { tipo: true } } },
  })
  if (!origem) throw Object.assign(new Error('Modalidade de origem não encontrada'), { status: 404 })
  const tipo = origem.tipo_modalidade.tipo

  const destinos = await prisma.modalidade.findMany({
    where: { id: { in: destino_ids } },
    select: { id: true, tipo_modalidade: { select: { tipo: true } } },
  })
  const validos = destinos.filter(d => d.id !== origem_id && d.tipo_modalidade.tipo === tipo)

  await prisma.$transaction(
    validos.map(d => prisma.modalidade.update({
      where: { id: d.id },
      data: { mensagens_inscritos: mensagens } as any,
    })),
  )
  return { replicadas: validos.length }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && npx vitest run src/modules/modalidades/modalidades.service.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/modalidades/modalidades.service.ts backend/src/modules/modalidades/modalidades.service.test.ts
git commit -m "feat(modalidades): service replicarMensagens (mesmo tipo, substitui)"
```

---

## Task 2: Backend — controller + rota

**Files:**
- Modify: `backend/src/modules/modalidades/modalidades.controller.ts`
- Modify: `backend/src/modules/modalidades/modalidades.routes.ts`

- [ ] **Step 1: Controller**

Em `backend/src/modules/modalidades/modalidades.controller.ts`, adicionar (após o `updateSchema`):

```ts
const replicarSchema = z.object({
  origem_id: z.number().int().positive(),
  destino_ids: z.array(z.number().int().positive()).min(1),
  mensagens: z.array(z.object({
    min: z.number().int().min(1),
    max: z.number().int().min(1).nullable(),
    mensagem: z.string(),
    pular_sorteio: z.boolean(),
  })),
})
```

E adicionar a função (após `editar`):

```ts
export async function replicarMensagens(req: Request, res: Response, next: NextFunction) {
  try {
    const body = replicarSchema.parse(req.body)
    res.json(await service.replicarMensagens(body.origem_id, body.destino_ids, body.mensagens))
  } catch (err) { next(err) }
}
```

- [ ] **Step 2: Rota**

Em `backend/src/modules/modalidades/modalidades.routes.ts`, adicionar após `router.post('/', ...admin, ctrl.criar)`:

```ts
router.post('/replicar-mensagens', ...admin, ctrl.replicarMensagens)
```

- [ ] **Step 3: Verificar build do backend**

Run: `cd backend && npm run build`
Expected: `tsc` conclui sem erros.

- [ ] **Step 4: Rodar testes do módulo**

Run: `cd backend && npx vitest run src/modules/modalidades`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/modalidades/modalidades.controller.ts backend/src/modules/modalidades/modalidades.routes.ts
git commit -m "feat(modalidades): endpoint POST /replicar-mensagens"
```

---

## Task 3: Frontend — serviço + helper puro de agrupamento

**Files:**
- Modify: `frontend/src/services/modalidades.ts`
- Create: `frontend/src/lib/replicar-alvos.ts`
- Test: `frontend/src/lib/replicar-alvos.test.ts`

- [ ] **Step 1: Método no serviço**

Em `frontend/src/services/modalidades.ts`, adicionar ao objeto `modalidadesService` (após `editar`):

```ts
  replicarMensagens: (data: { origem_id: number; destino_ids: number[]; mensagens: MensagemInscritos[] }) =>
    api.post<{ replicadas: number }>(`${BASE}/replicar-mensagens`, data).then(r => r.data),
```

(`MensagemInscritos` já está importado neste arquivo.)

- [ ] **Step 2: Escrever o teste do helper (falha)**

Criar `frontend/src/lib/replicar-alvos.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { agruparAlvosPorCompeticao } from './replicar-alvos'

const mod = (id: number, nome: string, sigla: string, comp: string, tipo: string) =>
  ({ id, nome, sigla, competicao: { nome: comp }, tipo_modalidade: { tipo } }) as any

describe('agruparAlvosPorCompeticao', () => {
  const lista = [
    mod(1, 'Judô', 'JUD', 'Copa B', 'grupos'),
    mod(2, 'Futsal', 'FUT', 'Copa A', 'grupos'),
    mod(3, 'Vôlei', 'VOL', 'Copa A', 'chaves'),
    mod(4, 'Xadrez', 'XAD', 'Copa A', 'grupos'),
  ]

  it('filtra por tipo, exclui a origem e agrupa por competição (ordenado)', () => {
    const out = agruparAlvosPorCompeticao(lista, { tipo: 'grupos', excluirId: 2 })
    expect(out).toEqual([
      { competicao: 'Copa A', itens: [{ id: 4, nome: 'Xadrez', sigla: 'XAD', competicao: 'Copa A' }] },
      { competicao: 'Copa B', itens: [{ id: 1, nome: 'Judô', sigla: 'JUD', competicao: 'Copa B' }] },
    ])
  })

  it('tipo sem alvos retorna lista vazia', () => {
    expect(agruparAlvosPorCompeticao(lista, { tipo: 'ordem_entrada', excluirId: 0 })).toEqual([])
  })
})
```

- [ ] **Step 3: Rodar e confirmar falha**

Run: `cd frontend && npx vitest run src/lib/replicar-alvos.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 4: Implementar o helper**

Criar `frontend/src/lib/replicar-alvos.ts`:

```ts
export type AlvoModalidade = { id: number; nome: string; sigla: string; competicao: string }
export type GrupoAlvos = { competicao: string; itens: AlvoModalidade[] }

type ModLike = {
  id: number
  nome: string
  sigla: string
  competicao?: { nome: string } | null
  tipo_modalidade: { tipo: string }
}

export function agruparAlvosPorCompeticao(
  modalidades: ModLike[],
  opts: { tipo: string; excluirId: number },
): GrupoAlvos[] {
  const alvos: AlvoModalidade[] = modalidades
    .filter(m => m.tipo_modalidade.tipo === opts.tipo && m.id !== opts.excluirId)
    .map(m => ({ id: m.id, nome: m.nome, sigla: m.sigla, competicao: m.competicao?.nome ?? '—' }))

  const byComp = new Map<string, AlvoModalidade[]>()
  for (const a of alvos) {
    const arr = byComp.get(a.competicao) ?? []
    arr.push(a)
    byComp.set(a.competicao, arr)
  }

  return Array.from(byComp.entries())
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
    .map(([competicao, itens]) => ({
      competicao,
      itens: itens.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR')),
    }))
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/lib/replicar-alvos.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/modalidades.ts frontend/src/lib/replicar-alvos.ts frontend/src/lib/replicar-alvos.test.ts
git commit -m "feat(modalidades-fe): servico replicarMensagens + helper agruparAlvos"
```

---

## Task 4: Frontend — modal + botão no formulário

**Files:**
- Create: `frontend/src/components/ReplicarMensagensModal.tsx`
- Modify: `frontend/src/pages/modalidades/ModalidadeForm.tsx`

- [ ] **Step 1: Criar o modal**

Criar `frontend/src/components/ReplicarMensagensModal.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { X, Check } from '../lib/icons'
import { modalidadesService } from '../services/modalidades'
import { agruparAlvosPorCompeticao } from '../lib/replicar-alvos'
import { useToast } from './Toast'
import type { MensagemInscritos } from '../lib/mensagens-inscritos'

type Props = {
  open: boolean
  onClose: () => void
  tipo: string
  origemId: number
  mensagens: MensagemInscritos[]
}

export default function ReplicarMensagensModal({ open, onClose, tipo, origemId, mensagens }: Props) {
  const toast = useToast()
  const [sel, setSel] = useState<Set<number>>(new Set())

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades'],
    queryFn: () => modalidadesService.listar(),
    enabled: open,
  })

  const grupos = useMemo(
    () => agruparAlvosPorCompeticao(modalidades as any, { tipo, excluirId: origemId }),
    [modalidades, tipo, origemId],
  )
  const totalAlvos = useMemo(() => grupos.reduce((n, g) => n + g.itens.length, 0), [grupos])

  const { mutate: replicar, isPending } = useMutation({
    mutationFn: () => modalidadesService.replicarMensagens({ origem_id: origemId, destino_ids: [...sel], mensagens }),
    onSuccess: (r) => {
      toast.success(`Replicado para ${r.replicadas} modalidade${r.replicadas === 1 ? '' : 's'}.`)
      setSel(new Set())
      onClose()
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao replicar.'),
  })

  if (!open) return null

  function toggle(id: number) {
    setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    setSel(prev => {
      if (prev.size === totalAlvos) return new Set()
      const n = new Set<number>()
      for (const g of grupos) for (const it of g.itens) n.add(it.id)
      return n
    })
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-xl)', padding: 24, width: 'min(560px, 94vw)', maxHeight: '84vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <h3 className="sec-title" style={{ fontSize: 17 }}>Replicar mensagens</h3>
          <button onClick={onClose} className="icon-btn" title="Fechar"><X size={18} /></button>
        </div>
        <p className="text-xs text-[var(--t3)]" style={{ marginBottom: 12 }}>
          As mensagens configuradas substituirão as das modalidades selecionadas (mesmo tipo).
        </p>

        {totalAlvos === 0 ? (
          <div className="text-sm text-[var(--t3)]" style={{ padding: '20px 0' }}>Nenhuma outra modalidade do mesmo tipo.</div>
        ) : (
          <>
            <label className="inline-flex items-center gap-2 text-sm text-[var(--t2)]" style={{ marginBottom: 8 }}>
              <input type="checkbox" checked={sel.size === totalAlvos && totalAlvos > 0} onChange={toggleAll} />
              Selecionar todas ({totalAlvos})
            </label>
            <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--card-border)', borderRadius: 'var(--radius-md)', padding: 8 }}>
              {grupos.map(g => (
                <div key={g.competicao} style={{ marginBottom: 8 }}>
                  <div className="eyebrow" style={{ marginBottom: 4 }}>{g.competicao}</div>
                  {g.itens.map(it => (
                    <label key={it.id} className="flex items-center gap-2 text-sm text-[var(--t1)]" style={{ padding: '4px 6px' }}>
                      <input type="checkbox" checked={sel.has(it.id)} onChange={() => toggle(it.id)} />
                      {it.nome} <span className="text-[var(--t4)] font-mono" style={{ fontSize: 11 }}>{it.sigla}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end" style={{ gap: 10, paddingTop: 16 }}>
          <button onClick={onClose} className="btn btn-ghost" disabled={isPending}><X size={16} /> Cancelar</button>
          <button onClick={() => replicar()} className="btn btn-primary" disabled={isPending || sel.size === 0} style={{ opacity: (isPending || sel.size === 0) ? 0.5 : 1 }}>
            <Check size={16} /> {isPending ? 'Replicando...' : `Replicar (${sel.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Botão no `ModalidadeForm`**

Em `frontend/src/pages/modalidades/ModalidadeForm.tsx`:

(a) imports no topo:
```tsx
import { useState } from 'react'
import ReplicarMensagensModal from '../../components/ReplicarMensagensModal'
```
(observação: `useState` já é importado; apenas garanta o import do modal.)

(b) estado (junto dos outros `useState`, ex.: após `mensagens`):
```tsx
  const [replicarOpen, setReplicarOpen] = useState(false)
```

(c) trocar o bloco do botão "Adicionar mensagem" (que hoje é só esse botão) por um wrapper com os dois botões. Substituir:
```tsx
              <button type="button" onClick={addMensagem} className="btn btn-ghost btn-sm" style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Plus size={16} /> Adicionar mensagem
              </button>
```
por:
```tsx
              <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" onClick={addMensagem} className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={16} /> Adicionar mensagem
                </button>
                {isEdit && (
                  <button type="button" onClick={() => setReplicarOpen(true)} className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    Replicar para outras modalidades…
                  </button>
                )}
              </div>
```

(d) renderizar o modal logo antes do fechamento do `</form>` (ou ao final do componente, dentro do return). Inserir:
```tsx
          {isEdit && tipoSelecionado && (
            <ReplicarMensagensModal
              open={replicarOpen}
              onClose={() => setReplicarOpen(false)}
              tipo={tipoSelecionado.tipo}
              origemId={Number(id)}
              mensagens={mensagens.filter(m => m.mensagem.trim() !== '').map(m => ({ ...m, mensagem: m.mensagem.trim() }))}
            />
          )}
```
(`isEdit`, `id`, `tipoSelecionado`, `mensagens` já existem no componente.)

- [ ] **Step 3: Verificar tipos e build**

Run: `cd frontend && npx tsc --noEmit`  → sem erros novos.
Run: `cd frontend && npm run build`  → conclui sem erros.

- [ ] **Step 4: Verificação manual**

`cd frontend && npm run dev` (backend rodando): editar uma modalidade Grupo/Chaves com mensagens → "Replicar para outras modalidades…" abre o modal com as modalidades do mesmo tipo agrupadas por competição → selecionar algumas → Replicar → toast "Replicado para N modalidades"; abrir um alvo e confirmar que as mensagens foram substituídas. Botão não aparece em modalidade nova (sem `id`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ReplicarMensagensModal.tsx frontend/src/pages/modalidades/ModalidadeForm.tsx
git commit -m "feat(modalidades-fe): modal de replicar mensagens p/ outras modalidades"
```

---

## Self-review (cobertura da spec)

- Alvos mesmo tipo / qualquer competição, agrupados → Task 3 (helper) + Task 4 (modal) ✓
- Substituir (overwrite) → Task 1 (service `update` seta `mensagens_inscritos`) ✓
- Endpoint backend + validação → Tasks 1-2 ✓
- Mensagens atuais da tela → Task 4 (passa `mensagens` do form) ✓
- Só em edição (origem com `id`) / Grupo-Chaves → Task 4 (`isEdit` + card só grupos/chaves) ✓
- Testes: service (mesmo tipo/404) Task 1; helper puro Task 3; modal por build+manual Task 4.
