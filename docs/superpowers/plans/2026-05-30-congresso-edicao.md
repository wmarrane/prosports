# Modo Congresso — Edição Inline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Frontend-only: habilitar adicionar/remover inscritos e campeões dentro do Modo Congresso via modais. Extrair `CampeaoSlot` para componente reutilizável. Bump para `1.16.1`.

**Architecture:** Refactor primeiro (extrai `CampeaoSlot` de `EventoInscricoes.tsx` para `frontend/src/components/CampeaoSlot.tsx`). Depois adiciona mutations + modais em `CongressoStepParticipantes.tsx` e `CongressoStepCampeoes.tsx`. Modais com z-index 40 e fundo dark para integrar com shell do Congresso. Reusa endpoints e `ParticipanteSelect` existentes.

**Tech Stack:** React 18 + TypeScript + React Query + tokens R2P. Sem backend, sem deps novas.

**Spec:** `docs/superpowers/specs/2026-05-30-congresso-edicao-design.md`

---

## File Structure

**Frontend — Create:**
- `frontend/src/components/CampeaoSlot.tsx` — componente extraído.

**Frontend — Modify:**
- `frontend/src/pages/eventos/EventoInscricoes.tsx` — remove sub-componente local, importa do novo módulo.
- `frontend/src/pages/congresso/CongressoStepParticipantes.tsx` — +mutations, +botão "+ Inscrever", +botão "×" por linha, +modal.
- `frontend/src/pages/congresso/CongressoStepCampeoes.tsx` — +mutations, +botão "Editar campeões", +modal com 12 slots.

**Release:**
- `package.json` (root): `1.16.0` → `1.16.1`.
- `CHANGELOG.md`: bloco `[1.16.1]`.

---

## Task 1: Extrair `CampeaoSlot` para componente

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\components\CampeaoSlot.tsx`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\eventos\EventoInscricoes.tsx`

- [ ] **Step 1: Criar `frontend/src/components/CampeaoSlot.tsx`**

Conteúdo exato:

```tsx
import { useState } from 'react'
import ParticipanteSelect from './ParticipanteSelect'
import CampeaoBadge from './CampeaoBadge'
import type { CampeaoAnterior } from '../types/campeao-anterior'

function posicaoLabel(n: number): string { return `${n}º lugar` }

type Props = {
  posicao: number
  campeao: CampeaoAnterior | null
  excludeIds: number[]
  onCriar: (participante_id: number) => void
  onRemover: (id: number) => void
  salvando: boolean
}

export default function CampeaoSlot({ posicao, campeao, excludeIds, onCriar, onRemover, salvando }: Props) {
  const [pickedId, setPickedId] = useState<number | null>(null)

  if (campeao) {
    return (
      <div className="border border-[var(--card-border)] rounded-lg p-3 bg-[var(--card-bg-2)]">
        <div className="flex items-center gap-2 mb-2">
          <CampeaoBadge posicao={posicao} />
          <span className="text-xs text-[var(--t3)]">{posicaoLabel(posicao)}</span>
        </div>
        <div className="text-sm text-[var(--t1)]">{campeao.participante.nome}</div>
        {campeao.participante.subtitulo && (
          <div className="text-xs text-[var(--t3)] mt-0.5">{campeao.participante.subtitulo}</div>
        )}
        <button
          onClick={() => { if (confirm(`Remover ${posicaoLabel(posicao)}?`)) onRemover(campeao.id) }}
          className="mt-2 text-xs text-[var(--danger)] hover:text-[var(--danger-700)]"
        >Remover</button>
      </div>
    )
  }

  return (
    <div className="border border-[var(--card-border)] rounded-lg p-3 bg-[var(--card-bg-2)] space-y-2">
      <div className="flex items-center gap-2">
        <CampeaoBadge posicao={posicao} />
        <span className="text-xs text-[var(--t3)]">{posicaoLabel(posicao)}</span>
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
```

- [ ] **Step 2: Editar `EventoInscricoes.tsx` — remover declaração local e importar**

Em `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\eventos\EventoInscricoes.tsx`:

(a) Adicionar import junto aos demais (após `import CampeaoBadge from '../../components/CampeaoBadge'`):

```tsx
import CampeaoSlot from '../../components/CampeaoSlot'
```

(b) **Remover** do arquivo o bloco INTEIRO entre a constante `POSICOES` e o início da `export default function EventoInscricoes`:

Remover:
```tsx
function posicaoLabel(n: number): string { return `${n}º lugar` }

type CampeaoSlotProps = {
  posicao: number
  campeao: CampeaoAnterior | null
  excludeIds: number[]
  onCriar: (participante_id: number) => void
  onRemover: (id: number) => void
  salvando: boolean
}

function CampeaoSlot({ posicao, campeao, excludeIds, onCriar, onRemover, salvando }: CampeaoSlotProps) {
  const [pickedId, setPickedId] = useState<number | null>(null)
  // ... resto da função ...
}
```

Deixar apenas:
```tsx
const NUM_POSICOES = 12
const POSICOES = Array.from({ length: NUM_POSICOES }, (_, i) => i + 1)

export default function EventoInscricoes() {
```

(c) Como `posicaoLabel` foi removido, verificar se ainda é usado em algum lugar do arquivo. Se não, OK. Se sim, remover usos.

(d) Como `CampeaoAnterior` type pode não ser mais usado diretamente no arquivo (só via prop do componente extraído), pode remover o import se não houver mais referências:
```tsx
import type { CampeaoAnterior } from '../../types/campeao-anterior'
```
**Cuidado**: o tipo ainda pode ser usado no `useQuery` se houver. Verificar antes de remover.

- [ ] **Step 3: tsc + build**

De `frontend/`:
```
npx tsc --noEmit && npm run build
```

Esperado: tsc clean, vite build OK. Tela `/eventos/:id/inscricoes` continua renderizando idêntica (visual e funcional).

- [ ] **Step 4: Commit**

```
git add frontend/src/components/CampeaoSlot.tsx frontend/src/pages/eventos/EventoInscricoes.tsx
git commit -m "refactor(frontend): extract CampeaoSlot to reusable component" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `CongressoStepParticipantes` — edição inline com modal

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\congresso\CongressoStepParticipantes.tsx`

**Contexto:** Arquivo atual é read-only. Vamos adicionar:
1. `useMutation` para criar/remover inscrição.
2. Botão "+ Inscrever" no header da seção.
3. Botão "×" em cada `<li>` da lista de inscritos.
4. Modal de inscrever (z-index 40, fundo dark, ParticipanteSelect + Confirmar/Cancelar).

- [ ] **Step 1: Substituir o arquivo inteiro**

Conteúdo exato:

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inscricoesService } from '../../services/inscricoes'
import { modalidadesService } from '../../services/modalidades'
import ParticipanteSelect from '../../components/ParticipanteSelect'

type Props = {
  eventoId: number
  modalidadeId: number
  competicaoId: number | undefined
  onNext: () => void
}

const FG = '#f1f5fb'
const DIM = '#94a3b8'
const LINE = 'rgba(255,255,255,.08)'
const DANGER = '#ef4444'
const MODAL_BG = '#0f1623'
const MODAL_BORDER = 'rgba(255,255,255,0.1)'
const BTN_PRIMARY = {
  background: '#1061d8',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '12px 24px',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
} as const
const BTN_PRIMARY_SM = {
  background: '#1061d8',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
} as const
const BTN_GHOST = {
  background: 'transparent',
  color: DIM,
  border: 'none',
  padding: '12px 20px',
  fontSize: 14,
  cursor: 'pointer',
} as const

export default function CongressoStepParticipantes({ eventoId, modalidadeId, competicaoId, onNext }: Props) {
  const queryClient = useQueryClient()
  const [inscreverOpen, setInscreverOpen] = useState(false)
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [erroModal, setErroModal] = useState('')

  const { data: inscricoes = [], isLoading } = useQuery({
    queryKey: ['inscricoes', eventoId, modalidadeId],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId, modalidade_id: modalidadeId }),
  })

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades', competicaoId],
    queryFn: () => modalidadesService.listar({ competicao_id: competicaoId! }),
    enabled: !!competicaoId,
  })

  const modalidade = modalidades.find(m => m.id === modalidadeId)

  const { mutate: criar, isPending: salvando } = useMutation({
    mutationFn: () => inscricoesService.criar({
      evento_id: eventoId,
      modalidade_id: modalidadeId,
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

  const { mutate: remover } = useMutation({
    mutationFn: (id: number) => inscricoesService.remover(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inscricoes', eventoId, modalidadeId] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const excludeIds = inscricoes.map(i => i.participante_id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {modalidade && (
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, color: DIM, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Modalidade
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: FG, marginTop: 4 }}>
              {modalidade.nome} ({modalidade.sigla})
            </h2>
            <div style={{ fontSize: 16, color: DIM, marginTop: 4 }}>
              {inscricoes.length} {inscricoes.length === 1 ? 'inscrito' : 'inscritos'}
            </div>
          </div>
          <button
            onClick={() => { setInscreverOpen(true); setPickedId(null); setErroModal('') }}
            style={BTN_PRIMARY_SM}
          >+ Inscrever</button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, marginBottom: 16 }}>
        {isLoading ? (
          <p style={{ color: DIM, fontSize: 18 }}>Carregando inscritos...</p>
        ) : inscricoes.length === 0 ? (
          <p style={{ color: DIM, fontSize: 18 }}>Nenhum inscrito nesta modalidade.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {inscricoes.map(i => (
              <li
                key={i.id}
                style={{
                  borderBottom: `1px solid ${LINE}`,
                  padding: '12px 8px',
                  fontSize: 22,
                  color: FG,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span style={{ flex: 1 }}>
                  {i.participante.nome}
                  {i.participante.subtitulo && (
                    <span style={{ fontSize: 16, color: DIM, marginLeft: 12 }}>
                      — {i.participante.subtitulo}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => { if (confirm(`Remover inscrição de "${i.participante.nome}"?`)) remover(i.id) }}
                  style={{
                    color: DIM,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 22,
                    padding: '4px 10px',
                    lineHeight: 1,
                  }}
                  title="Remover inscrição"
                >×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12 }}>
        <button onClick={onNext} style={BTN_PRIMARY}>Próximo →</button>
      </div>

      {inscreverOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40,
          }}
          onClick={() => setInscreverOpen(false)}
        >
          <div
            style={{
              background: MODAL_BG, border: `1px solid ${MODAL_BORDER}`,
              borderRadius: 16, padding: 24, maxWidth: 480, width: '100%', margin: '0 16px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 20, fontWeight: 600, color: FG, marginBottom: 16 }}>
              Inscrever participante
            </h3>
            <ParticipanteSelect value={pickedId} onChange={(id) => setPickedId(id)} excludeIds={excludeIds} />
            {erroModal && <p style={{ color: DANGER, fontSize: 14, marginTop: 12 }}>{erroModal}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => setInscreverOpen(false)} style={BTN_GHOST}>Cancelar</button>
              <button
                onClick={() => criar()}
                disabled={!pickedId || salvando}
                style={{ ...BTN_PRIMARY_SM, opacity: (!pickedId || salvando) ? 0.5 : 1 }}
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
git add frontend/src/pages/congresso/CongressoStepParticipantes.tsx
git commit -m "feat(congresso): add inscricoes edit (+ Inscrever modal + x per row) on Participantes step" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `CongressoStepCampeoes` — edição com modal de 12 slots

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\congresso\CongressoStepCampeoes.tsx`

**Contexto:** Arquivo atual é read-only. Vamos adicionar mutations + botão "Editar campeões" + modal com 12 slots (usando `CampeaoSlot` extraído na Task 1).

- [ ] **Step 1: Substituir o arquivo inteiro**

Conteúdo exato:

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { campeoesAnterioresService } from '../../services/campeoes-anteriores'
import { inscricoesService } from '../../services/inscricoes'
import { modalidadesService } from '../../services/modalidades'
import CampeaoBadge from '../../components/CampeaoBadge'
import CampeaoSlot from '../../components/CampeaoSlot'

type Props = {
  eventoId: number
  modalidadeId: number
  competicaoId: number | undefined
  onNext: () => void
}

const FG = '#f1f5fb'
const DIM = '#94a3b8'
const SUCCESS = '#14b88a'
const CARD_BG = 'rgba(255,255,255,.04)'
const CARD_BORDER = 'rgba(255,255,255,.1)'
const MODAL_BG = '#0f1623'
const MODAL_BORDER = 'rgba(255,255,255,0.1)'
const BTN_PRIMARY = {
  background: '#1061d8',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '12px 24px',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
} as const
const BTN_GHOST_OUTLINE = {
  background: 'transparent',
  color: '#1061d8',
  border: '1px solid #1061d8',
  borderRadius: 10,
  padding: '12px 24px',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
} as const

const POSICOES = Array.from({ length: 12 }, (_, i) => i + 1)

export default function CongressoStepCampeoes({ eventoId, modalidadeId, competicaoId, onNext }: Props) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)

  const { data: campeoes = [], isLoading } = useQuery({
    queryKey: ['campeoes-anteriores', eventoId, modalidadeId],
    queryFn: () => campeoesAnterioresService.listar({ evento_id: eventoId, modalidade_id: modalidadeId }),
  })

  const { data: inscricoes = [] } = useQuery({
    queryKey: ['inscricoes', eventoId, modalidadeId],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId, modalidade_id: modalidadeId }),
  })

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades', competicaoId],
    queryFn: () => modalidadesService.listar({ competicao_id: competicaoId! }),
    enabled: !!competicaoId,
  })

  const modalidade = modalidades.find(m => m.id === modalidadeId)
  const inscritosSet = new Set(inscricoes.map(i => i.participante_id))
  const ordenados = [...campeoes].sort((a, b) => a.posicao - b.posicao)

  const { mutate: criarCampeao, isPending: salvandoCampeao } = useMutation({
    mutationFn: (data: { participante_id: number; posicao: number }) =>
      campeoesAnterioresService.criar({
        evento_id: eventoId,
        modalidade_id: modalidadeId,
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

  const excludeCampeoesIds = campeoes.map(c => c.participante_id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {modalidade && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, color: DIM, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Modalidade
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: FG, marginTop: 4 }}>
            {modalidade.nome} ({modalidade.sigla})
          </h2>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, marginBottom: 16 }}>
        {isLoading ? (
          <p style={{ color: DIM, fontSize: 18 }}>Carregando campeões...</p>
        ) : ordenados.length === 0 ? (
          <p style={{ color: DIM, fontSize: 18 }}>Nenhum campeão cadastrado para esta modalidade.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ordenados.map(c => {
              const inscrito = inscritosSet.has(c.participante_id)
              return (
                <li
                  key={c.id}
                  style={{
                    background: CARD_BG,
                    border: `1px solid ${CARD_BORDER}`,
                    borderRadius: 12,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <CampeaoBadge posicao={c.posicao} large />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 22, color: FG, fontWeight: 600 }}>{c.participante.nome}</div>
                    {c.participante.subtitulo && (
                      <div style={{ fontSize: 14, color: DIM, marginTop: 4 }}>{c.participante.subtitulo}</div>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      padding: '6px 14px',
                      borderRadius: 999,
                      background: inscrito ? 'rgba(20, 184, 138, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                      color: inscrito ? SUCCESS : DIM,
                      border: `1px solid ${inscrito ? SUCCESS : DIM}`,
                    }}
                  >
                    {inscrito ? '✓ Inscrito neste evento' : 'Não inscrito'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, gap: 12 }}>
        <button onClick={() => setEditOpen(true)} style={BTN_GHOST_OUTLINE}>Editar campeões</button>
        <button onClick={onNext} style={BTN_PRIMARY}>Próximo →</button>
      </div>

      {editOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40,
          }}
          onClick={() => setEditOpen(false)}
        >
          <div
            style={{
              background: MODAL_BG, border: `1px solid ${MODAL_BORDER}`,
              borderRadius: 16, padding: 24, maxWidth: 960, width: '100%', margin: '0 16px',
              maxHeight: '85vh', overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 20, fontWeight: 600, color: FG, marginBottom: 4 }}>
              Editar campeões do ano anterior
            </h3>
            <p style={{ fontSize: 13, color: DIM, marginBottom: 16 }}>
              Cadastre até 12 colocados. Quem se inscrever neste evento recebe o badge correspondente.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {POSICOES.map(pos => {
                const c = ordenados.find(x => x.posicao === pos) ?? null
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setEditOpen(false)} style={BTN_PRIMARY}>Fechar</button>
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
git add frontend/src/pages/congresso/CongressoStepCampeoes.tsx
git commit -m "feat(congresso): add 'Editar campeoes' modal with 12 slots on Campeoes step" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Bump versão + CHANGELOG

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\package.json`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\CHANGELOG.md`

- [ ] **Step 1: Bump version**

Editar `package.json` (root). Mudar **somente** `"version": "1.16.0"` para `"version": "1.16.1"`.

- [ ] **Step 2: Adicionar bloco no `CHANGELOG.md`**

Inserir o bloco abaixo logo após o cabeçalho e **antes** do bloco `## [1.16.0]`:

```md
## [1.16.1] - 2026-05-30

### Added
- Modo Congresso: passo "Participantes" agora permite adicionar inscritos (botão "+ Inscrever" abre modal com autocomplete) e remover (botão "×" por linha, com confirmação).
- Modo Congresso: passo "Campeões do Ano Anterior" agora tem botão "Editar campeões" que abre modal com 12 slots para cadastrar/remover.

### Changed
- `CampeaoSlot` extraído de `EventoInscricoes.tsx` para componente reutilizável (`frontend/src/components/CampeaoSlot.tsx`). Comportamento idêntico nas duas telas.
```

- [ ] **Step 3: Commit**

```
git add package.json CHANGELOG.md
git commit -m "chore(release): v1.16.1 — edicao inline de inscritos e campeoes no Modo Congresso" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Push + smoke (pós-deploy CI)

**Files:** (sem edição — verificação)

- [ ] **Step 1: Push**

```
git push origin develop
```

CI reconstrói só frontend (sem migrations). ~3-4min.

- [ ] **Step 2: Verificar deploy**

```
curl -s -o /dev/null -w "/health: %{http_code}\n" http://192.168.56.113:3000/health
curl -s -o /dev/null -w "frontend: %{http_code}\n" http://192.168.56.113:8080/
```

Esperado: ambos 200.

- [ ] **Step 3: Smoke no browser**

Abrir http://192.168.56.113:8080, login `admin@prosports.com` / `admin123`:

**Refactor (Task 1):**
1. /eventos → Inscrições em algum evento → modalidade selecionada → seção "Campeões do ano anterior" continua renderizando idêntica. Cadastrar/remover ainda funciona.

**Congresso Participantes (Task 2):**
2. Topbar → Modo Congresso → entrar evento+modalidade.
3. Passo 3 (Participantes): header da seção mostra botão "+ Inscrever" à direita do contador.
4. Click "+ Inscrever" → modal escuro abre com `ParticipanteSelect`. Digitar nome → escolher → Confirmar → modal fecha, novo item aparece na lista.
5. Click "×" em uma linha existente → confirm → linha some.
6. Tentar inscrever participante já inscrito (via API curl, se acessível) → erro 409 amigável no modal.

**Congresso Campeões (Task 3):**
7. Passo 4 (Campeões): botão "Editar campeões" à esquerda do "Próximo →".
8. Click "Editar campeões" → modal grande abre com 12 slots em grid 4 colunas.
9. Slot vazio: autocomplete → Salvar → vira card preenchido com badge.
10. Slot preenchido: Remover → confirm → volta para input.
11. Fechar modal → lista principal do passo Campeões atualiza com os mudados (ou vazia se removeu todos).

**Versão:**
12. Rodapé sidebar: `v1.16.1`.

- [ ] **Step 4: Reportar**

Se passou, feature fechada.

---

## Self-review

Cobertura do spec:

| Spec | Coberto por |
|---|---|
| `CampeaoSlot` extraído para componente reutilizável | Task 1 |
| `CongressoStepParticipantes`: botão + modal Inscrever + botão × por linha | Task 2 |
| `CongressoStepCampeoes`: botão "Editar campeões" + modal com 12 slots | Task 3 |
| Modais com z-index 40 + fundo dark | Tasks 2 e 3 (zIndex: 40, MODAL_BG=#0f1623) |
| Reuso de `ParticipanteSelect` | Tasks 2 e 3 (via CampeaoSlot) |
| Reuso de endpoints existentes | Tasks 2 e 3 (mutations) |
| Bump 1.16.1 + CHANGELOG | Task 4 |
| Smoke pós-deploy | Task 5 |

Riscos endereçados:
- **Refactor primeiro**: Task 1 isola a mudança. EventoInscricoes valida que extração não quebrou.
- **Modal close on outside click**: ambos modais têm `onClick` no overlay.
- **stopPropagation no card**: previne fechar acidentalmente.
- **Mutations error handling**: 409 (duplicata) no modal Inscrever vai pra `erroModal` inline; alerts em erros de remover/campeão (consistente com EventoInscricoes).
- **Sem testes vitest**: padrão do projeto para mudanças puramente UI/integração. Smoke manual cobre.
