# F4c — Workspace UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Frontend-only: expandir `/eventos/:id/inscricoes` para incluir seção "Sorteio" por modalidade (consumindo endpoints F4b), indicador de progresso (X/Y sorteadas), selo ✓ em chips de modalidades sorteadas, e 3 componentes de visualização (`SorteioGrupos`, `SorteioChaves`, `SorteioOrdem`). Bump para `1.10.0`.

**Architecture:** Tipo `Sorteio` discriminado por `tipo` (mapeia 1-1 com `TipoDisputa`). Service `sorteiosService` consome `/sorteios`. Página existente ganha um `useQuery(['sorteios', eventoId])` no topo, deriva o sorteio da modalidade selecionada e renderiza seção condicional abaixo da seção de inscritos. 3 componentes pequenos para render visual de cada tipo de resultado, recebendo `participantesById: Map<number, Participante>` montado a partir das inscrições já carregadas.

**Tech Stack:** React 18 + TypeScript + Vite + React Query + Tailwind + tokens R2P.

**Spec:** `docs/superpowers/specs/2026-05-30-f4c-workspace-ui-design.md`

---

## File Structure

**Frontend — Create:**
- `frontend/src/types/sorteio.ts` — tipo `Sorteio` (union por `tipo`) + tipos auxiliares (`GruposResultado`, `ChavesResultado`, `OrdemResultado`).
- `frontend/src/services/sorteios.ts` — `sorteiosService.{listar, executar, remover}`.
- `frontend/src/components/sorteio-result/SorteioGrupos.tsx` — cards de grupo.
- `frontend/src/components/sorteio-result/SorteioChaves.tsx` — lista de slots numerada com BYEs.
- `frontend/src/components/sorteio-result/SorteioOrdem.tsx` — lista numerada com medalhas top 3.

**Frontend — Modify:**
- `frontend/src/pages/eventos/EventoInscricoes.tsx` — query `sorteios`, progresso no header, selo nas chips, seção "Sorteio".

**Release:**
- `package.json` (root): `1.9.0` → `1.10.0`.
- `CHANGELOG.md`: bloco novo `[1.10.0]`.

---

## Task 1: Type `Sorteio` (union discriminada)

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\types\sorteio.ts`

- [ ] **Step 1: Criar `types/sorteio.ts`**

Conteúdo exato:

```ts
export type GruposResultado = {
  regra_id: number
  classificados_por_grupo: number
  grupos: { letra: string; participantes: number[] }[]
}

export type ChavesResultado = {
  size: number
  slots: (number | null)[]
}

export type OrdemResultado = {
  ordem: number[]
}

type SorteioBase = {
  id: number
  evento_id: number
  modalidade_id: number
  seed: string
  gerado_em: string
  atualizado_em: string
}

export type Sorteio =
  | (SorteioBase & { tipo: 'grupos'; resultado: GruposResultado })
  | (SorteioBase & { tipo: 'chaves'; resultado: ChavesResultado })
  | (SorteioBase & { tipo: 'ordem_entrada'; resultado: OrdemResultado })
  | (SorteioBase & { tipo: 'especifico'; resultado: unknown })
```

- [ ] **Step 2: tsc**

De `frontend/`:
```
npx tsc --noEmit
```

Esperado: clean.

- [ ] **Step 3: Commit**

```
git add frontend/src/types/sorteio.ts
git commit -m "feat(frontend): add Sorteio type (union discriminada por tipo)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Service `sorteios`

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\services\sorteios.ts`

- [ ] **Step 1: Criar `services/sorteios.ts`**

Conteúdo exato:

```ts
import api from './api'
import type { Sorteio } from '../types/sorteio'

const BASE = '/sorteios'

type ExecutarPayload = {
  evento_id: number
  modalidade_id: number
}

export const sorteiosService = {
  listar: (params?: { evento_id?: number; modalidade_id?: number }) =>
    api.get<Sorteio[]>(BASE, { params }).then(r => r.data),
  executar: (data: ExecutarPayload) =>
    api.post<Sorteio>(`${BASE}/executar`, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
```

- [ ] **Step 2: tsc**

```
cd frontend && npx tsc --noEmit
```

Esperado: clean.

- [ ] **Step 3: Commit**

```
git add frontend/src/services/sorteios.ts
git commit -m "feat(frontend): add sorteios service" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Componente `SorteioGrupos`

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\components\sorteio-result\SorteioGrupos.tsx`

- [ ] **Step 1: Criar `SorteioGrupos.tsx`**

Conteúdo exato:

```tsx
import type { GruposResultado } from '../../types/sorteio'
import type { Participante } from '../../types/participante'

type Props = {
  resultado: GruposResultado
  participantesById: Map<number, Participante>
}

export default function SorteioGrupos({ resultado, participantesById }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
      {resultado.grupos.map(g => (
        <div
          key={g.letra}
          className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-xl p-4"
        >
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-base font-semibold text-[var(--t1)]">Grupo {g.letra}</h4>
            <span className="text-xs text-[var(--t3)]">{resultado.classificados_por_grupo} classificados</span>
          </div>
          <ul className="space-y-1.5">
            {g.participantes.map(pid => {
              const p = participantesById.get(pid)
              return (
                <li key={pid} className="text-sm text-[var(--t1)]">
                  {p ? p.nome : <span className="text-[var(--t4)]">—</span>}
                  {p?.subtitulo && <span className="text-xs text-[var(--t3)] ml-1">— {p.subtitulo}</span>}
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

- [ ] **Step 2: tsc**

```
cd frontend && npx tsc --noEmit
```

Esperado: clean.

- [ ] **Step 3: Commit**

```
git add frontend/src/components/sorteio-result/SorteioGrupos.tsx
git commit -m "feat(frontend): add SorteioGrupos visual component" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Componente `SorteioChaves`

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\components\sorteio-result\SorteioChaves.tsx`

- [ ] **Step 1: Criar `SorteioChaves.tsx`**

Conteúdo exato:

```tsx
import type { ChavesResultado } from '../../types/sorteio'
import type { Participante } from '../../types/participante'

type Props = {
  resultado: ChavesResultado
  participantesById: Map<number, Participante>
}

export default function SorteioChaves({ resultado, participantesById }: Props) {
  return (
    <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-xl p-4">
      <ul className="space-y-1.5">
        {resultado.slots.map((pid, idx) => (
          <li key={idx} className="flex items-center gap-3 text-sm">
            <span className="font-mono text-[var(--t3)] w-8">{String(idx + 1).padStart(2, '0')}</span>
            {pid == null ? (
              <span className="text-[var(--t4)] italic">BYE</span>
            ) : (
              (() => {
                const p = participantesById.get(pid)
                return p
                  ? <span className="text-[var(--t1)]">{p.nome}{p.subtitulo ? <span className="text-xs text-[var(--t3)] ml-1">— {p.subtitulo}</span> : null}</span>
                  : <span className="text-[var(--t4)]">—</span>
              })()
            )}
          </li>
        ))}
      </ul>
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
git add frontend/src/components/sorteio-result/SorteioChaves.tsx
git commit -m "feat(frontend): add SorteioChaves visual component" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Componente `SorteioOrdem`

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\components\sorteio-result\SorteioOrdem.tsx`

- [ ] **Step 1: Criar `SorteioOrdem.tsx`**

Conteúdo exato:

```tsx
import type { OrdemResultado } from '../../types/sorteio'
import type { Participante } from '../../types/participante'

type Props = {
  resultado: OrdemResultado
  participantesById: Map<number, Participante>
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function SorteioOrdem({ resultado, participantesById }: Props) {
  return (
    <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-xl p-4">
      <ol className="space-y-1.5">
        {resultado.ordem.map((pid, idx) => {
          const p = participantesById.get(pid)
          const prefix = idx < 3 ? MEDALS[idx] : <span className="font-mono text-[var(--t3)] w-8 inline-block">{String(idx + 1).padStart(2, '0')}</span>
          return (
            <li key={pid} className="flex items-center gap-3 text-sm text-[var(--t1)]">
              <span className="w-8 inline-flex items-center justify-center">{prefix}</span>
              {p
                ? <span>{p.nome}{p.subtitulo ? <span className="text-xs text-[var(--t3)] ml-1">— {p.subtitulo}</span> : null}</span>
                : <span className="text-[var(--t4)]">—</span>}
            </li>
          )
        })}
      </ol>
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
git add frontend/src/components/sorteio-result/SorteioOrdem.tsx
git commit -m "feat(frontend): add SorteioOrdem visual component" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `EventoInscricoes` — integrar seção Sorteio + progresso + selos

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\eventos\EventoInscricoes.tsx`

**Contexto:** O arquivo atual já tem queries de evento, modalidades, inscricoes e mutations criar/remover. Esta task substitui o arquivo inteiro pela versão expandida.

- [ ] **Step 1: Substituir o arquivo inteiro**

Substituir `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\eventos\EventoInscricoes.tsx` pelo conteúdo exato:

```tsx
import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import ParticipanteSelect from '../../components/ParticipanteSelect'
import SorteioGrupos from '../../components/sorteio-result/SorteioGrupos'
import SorteioChaves from '../../components/sorteio-result/SorteioChaves'
import SorteioOrdem from '../../components/sorteio-result/SorteioOrdem'
import { eventosService } from '../../services/eventos'
import { modalidadesService } from '../../services/modalidades'
import { inscricoesService } from '../../services/inscricoes'
import { sorteiosService } from '../../services/sorteios'
import type { Inscricao } from '../../types/inscricao'
import type { Participante } from '../../types/participante'

function formatDateBR(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
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
                    <SorteioGrupos resultado={sorteioDaModalidade.resultado} participantesById={participantesById} />
                  )}
                  {sorteioDaModalidade.tipo === 'chaves' && (
                    <SorteioChaves resultado={sorteioDaModalidade.resultado} participantesById={participantesById} />
                  )}
                  {sorteioDaModalidade.tipo === 'ordem_entrada' && (
                    <SorteioOrdem resultado={sorteioDaModalidade.resultado} participantesById={participantesById} />
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
    </div>
  )
}
```

- [ ] **Step 2: tsc + build**

De `frontend/`:
```
npx tsc --noEmit && npm run build
```

Esperado: tsc clean, vite build OK.

- [ ] **Step 3: Commit**

```
git add frontend/src/pages/eventos/EventoInscricoes.tsx
git commit -m "feat(frontend): add seção Sorteio + progresso + selo ✓ em chips no workspace" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Bump versão + CHANGELOG

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\package.json`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\CHANGELOG.md`

- [ ] **Step 1: Bump version**

Editar `package.json` (root). Mudar **somente** `"version": "1.9.0"` para `"version": "1.10.0"`.

- [ ] **Step 2: Adicionar bloco no `CHANGELOG.md`**

Inserir o bloco abaixo logo após o cabeçalho e **antes** do bloco `## [1.9.0]`:

```md
## [1.10.0] - 2026-05-30

### Added
- Workspace operacional em /eventos/:id/inscricoes: seção "Sorteio" por modalidade com botão Sortear / Re-sortear (confirm) / Apagar sorteio (confirm).
- Visualização do resultado por tipo: cards de grupo (grupos), lista numerada com BYEs (chaves), lista ordenada com medalhas top 3 (ordem de entrada).
- Indicador de progresso "X de Y modalidades sorteadas" + barra.
- Selo ✓ verde nas chips de modalidades que já foram sorteadas.

### Notes
- Aviso amigável quando modalidade é do tipo `especifico` (sem sorteio automático).
- Erros 400 do backend (sem regra de grupos, 0 inscritos) renderizados inline.
```

- [ ] **Step 3: Commit**

```
git add package.json CHANGELOG.md
git commit -m "chore(release): v1.10.0 — F4c Workspace UI" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Push + smoke (pós-deploy CI)

**Files:** (sem edição — verificação)

- [ ] **Step 1: Push**

```
git push origin develop
```

CI reconstrói só o frontend (não há mudança no schema/migrations). ~4-5min.

- [ ] **Step 2: Verificar deploy**

```
curl -s -o /dev/null -w "/health: %{http_code}\n" http://192.168.56.113:3000/health
curl -s -o /dev/null -w "frontend: %{http_code}\n" http://192.168.56.113:8080/
```

Esperado: ambos 200.

- [ ] **Step 3: Smoke no browser**

Abrir http://192.168.56.113:8080, login `admin@prosports.com` / `admin123`:

1. /eventos → click "Inscrições" em algum evento existente.
2. Header mostra barra de progresso "X de Y modalidades sorteadas". Inicial = 0 de N.
3. Selecionar modalidade tipo `grupos` com regra cadastrada e ≥1 inscrito. Seção "Sorteio" aparece com botão "Sortear esta modalidade".
4. Click "Sortear" → cards de grupo aparecem (Grupo A, B, ...) com nomes dos participantes. Header da seção mostra seed em mono + data, botões "Re-sortear" / "Apagar sorteio".
5. Chip da modalidade ganha ✓. Progresso atualiza para "1 de Y".
6. Click "Re-sortear" → confirm → nova seed, possivelmente nova distribuição.
7. Click "Apagar sorteio" → confirm → seção volta para botão "Sortear". Chip perde ✓.
8. Selecionar modalidade `chaves` (criar se não existir) com >=1 inscrito → sortear → lista numerada de slots aparece com BYEs se não for potência de 2.
9. Selecionar modalidade `ordem_entrada` → sortear → lista numerada com 🥇🥈🥉 nos 3 primeiros.
10. Selecionar modalidade `especifico` → aviso "Esta modalidade não possui sorteio automático." aparece, sem botão.
11. Selecionar modalidade `grupos` com N que NÃO tem regra cadastrada na competição → click Sortear → mensagem 400 inline "Não há regra de composição de grupos para X equipes..." abaixo do botão.
12. Selecionar modalidade sem inscritos → botão Sortear disabled, texto "Adicione participantes antes de sortear."
13. Rodapé sidebar mostra `v1.10.0`.

- [ ] **Step 4: Reportar**

Se passou, F4c fechada. Conclui o sub-projeto F4 (a, b, c).

---

## Self-review

Cobertura do spec:

| Spec | Coberto por |
|---|---|
| Tipo `Sorteio` discriminado por `tipo` | Task 1 |
| Service frontend `sorteiosService` (listar, executar, remover) | Task 2 |
| Componente `SorteioGrupos` (cards de grupo) | Task 3 |
| Componente `SorteioChaves` (lista numerada com BYEs) | Task 4 |
| Componente `SorteioOrdem` (lista com medalhas top 3) | Task 5 |
| Query `sorteios` no topo da página + derivações (sorteioDaModalidade, modalidadesSorteadasIds, participantesById) | Task 6 |
| Indicador de progresso no header | Task 6 |
| Selo ✓ em chips sorteadas | Task 6 |
| Seção "Sorteio" condicional (aviso especifico / botão / resultado) | Task 6 |
| Botão "Sortear" desabilitado quando 0 inscritos com texto auxiliar | Task 6 |
| Mutation executar/apagar com invalidate + confirm para re-sortear/apagar | Task 6 |
| Error states inline (erroSorteio) | Task 6 |
| Bump 1.10.0 + CHANGELOG | Task 7 |
| Smoke pós-deploy | Task 8 |

Riscos endereçados:
- **tipo_modalidade populado no backend**: já confirmado no spec (include default existe).
- **Nome de participante não encontrado no map**: cada componente trata `p` undefined com `<span>—</span>`.
- **excludeIds em chip ativa branco vs sorteada** (selo ✓ deve aparecer mesmo quando chip está ativa): usado `text-white` para selo dentro da chip ativa (background brand-500), e `text-[var(--success)]` na inativa.
- **Re-sortear com confirm sempre**: handler `handleResortear` usa `confirm()` antes de chamar mutation.
- **Apagar sorteio com confirm**: `handleApagarSorteio` mesmo padrão.
- **Page sem mudança de schema**: deploy é só frontend (vite build).
