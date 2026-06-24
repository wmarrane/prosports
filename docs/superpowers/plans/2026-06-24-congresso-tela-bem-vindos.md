# Modo Congresso — tela "Bem-vindos" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar a etapa "Bem-vindos" (logo+nome, big numbers de esportes distintos e inscritos, lista de participantes) entre selecionar evento e a etapa de Modalidades.

**Architecture:** Frontend (app admin React/Vite). Novo componente `CongressoStepBemvindos.tsx` (agrega dados via services existentes) + fiação no motor de etapas (`congresso-step.ts`, `CongressoShell.tsx`, `ModoCongresso.tsx`). Sem backend.

**Tech Stack:** React 18 + TS + react-query + lucide-react; CSS wizard existente; build `tsc -b && vite build`.

**Spec:** `docs/superpowers/specs/2026-06-24-congresso-tela-bem-vindos-design.md`

## Global Constraints

- Só frontend. Modalidades = **esportes distintos** (`esporteBase`); inscritos = **participantes distintos** do evento; lista alfabética + subtítulo.
- Git identity não configurada → commit com `-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`; caminhos absolutos com `git -C`. Windows host; ler arquivos antes de editar.

---

### Task 1: Componente `CongressoStepBemvindos.tsx`

**Files:**
- Create: `frontend/src/pages/congresso/CongressoStepBemvindos.tsx`

**Interfaces:**
- Produces: `export default function CongressoStepBemvindos(props: { eventoId: number; onIniciar: () => void })`.
- Consumes: `eventosService.buscar`, `eventosService.getModalidadesDoEvento`, `inscricoesService.listar`, `competicoesService.buscar`; `esporteBase` (`../../site-publico/lib/esporte`); `composeSubtituloLine` (`../../lib/compose-subtitulo`).

- [ ] **Step 1: Criar o componente**

Criar `frontend/src/pages/congresso/CongressoStepBemvindos.tsx` com:
```tsx
import { useQuery } from '@tanstack/react-query'
import { eventosService } from '../../services/eventos'
import { inscricoesService } from '../../services/inscricoes'
import { competicoesService } from '../../services/competicoes'
import { composeSubtituloLine } from '../../lib/compose-subtitulo'
import { esporteBase } from '../../site-publico/lib/esporte'
import { ArrowRight } from 'lucide-react'

type Props = {
  eventoId: number
  onIniciar: () => void
}

const FG = 'var(--cw-fg)'
const DIM = 'var(--cw-dim)'

export default function CongressoStepBemvindos({ eventoId, onIniciar }: Props) {
  const { data: evento } = useQuery({
    queryKey: ['eventos', eventoId],
    queryFn: () => eventosService.buscar(eventoId),
  })

  const { data: modalidades = [] } = useQuery({
    queryKey: ['evento-modalidades', eventoId],
    queryFn: () => eventosService.getModalidadesDoEvento(eventoId),
  })

  const { data: inscricoes = [], isLoading } = useQuery({
    queryKey: ['inscricoes', eventoId],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId }),
  })

  const { data: competicao } = useQuery({
    queryKey: ['competicoes', evento?.competicao_id],
    queryFn: () => competicoesService.buscar(evento!.competicao_id),
    enabled: evento?.competicao_id != null,
  })
  const camposSubtitulo = competicao?.subtitulo_campos ?? []

  const nModalidades = new Set(modalidades.map(m => esporteBase(m.nome))).size

  const participantes = [...new Map(inscricoes.map((i: any) => [i.participante_id, i.participante])).values()]
    .sort((a: any, b: any) => (a?.nome ?? '').localeCompare(b?.nome ?? '', 'pt-BR', { sensitivity: 'base' }))
  const nInscritos = participantes.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Bloco 1: logo + nome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 20 }}>
        {evento?.logo_url && (
          <div style={{
            width: 96, height: 96, flexShrink: 0,
            display: 'grid', placeItems: 'center',
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--cw-card-bd)',
            borderRadius: 'var(--radius-lg)', padding: 8, overflow: 'hidden',
          }}>
            <img src={evento.logo_url} alt={`Logo ${evento.nome}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <h1 className="cw-h1" style={{ margin: 0 }}>Bem-vindos</h1>
          <p className="cw-sub" style={{ margin: '6px 0 0' }}>{evento?.nome ?? ''}</p>
        </div>
      </div>

      {/* Bloco 2: big numbers */}
      <div className="cw-md-card-stats" style={{ marginBottom: 28 }}>
        <div className="cw-md-stat"><b>{nModalidades}</b><span>Modalidades</span></div>
        <div className="cw-md-stat"><b>{nInscritos}</b><span>Inscritos</span></div>
      </div>

      {/* Bloco 3: participantes do evento */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <h2 className="cw-h2" style={{ fontSize: 'clamp(20px, 2vw, 26px)', marginBottom: 14 }}>
          Participantes <span style={{ color: DIM }}>({nInscritos})</span>
        </h2>
        {isLoading ? (
          <p className="cw-sub">Carregando participantes...</p>
        ) : participantes.length === 0 ? (
          <p className="cw-sub">Nenhum participante inscrito neste evento.</p>
        ) : (
          <div className="cw-plist">
            {participantes.map((p: any, idx: number) => {
              const nome = p?.nome ?? '—'
              const sub = p ? composeSubtituloLine(p, camposSubtitulo) : null
              return (
                <div className="cw-prow" key={p?.id ?? idx}>
                  <span className="cw-prow-n">{String(idx + 1).padStart(2, '0')}</span>
                  <div className="cw-prow-main">
                    <span className="cw-prow-name" style={{ color: FG }}>{nome}</span>
                    {sub && <span className="cw-prow-club">{sub}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 20 }}>
        <button onClick={onIniciar} className="cw-btn cw-btn-primary cw-btn-xl">
          Iniciar <ArrowRight size={22} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build (o componente sozinho ainda não é referenciado; só compila)**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros. (Se `npm run build` reclamar de import não usado/efeito de tree-shaking, ignorar — a referência vem na Task 2. O build deve passar mesmo com o componente não importado.)

- [ ] **Step 3: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/pages/congresso/CongressoStepBemvindos.tsx
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(congresso): componente tela de bem-vindos"
```

---

### Task 2: Fiar a etapa no motor do congresso

**Files:**
- Modify: `frontend/src/types/congresso-step.ts`
- Modify: `frontend/src/pages/congresso/CongressoShell.tsx`
- Modify: `frontend/src/pages/congresso/ModoCongresso.tsx`

**Interfaces:**
- Consumes: `CongressoStepBemvindos` (Task 1), prop `{ eventoId, onIniciar }`.

- [ ] **Step 1: Tipo do step**

Em `frontend/src/types/congresso-step.ts`, trocar a linha do tipo por:
```ts
export type CongressoStep = 'evento' | 'bemvindos' | 'modalidade' | 'participantes' | 'campeoes' | 'sorteio'
```

- [ ] **Step 2: STEPS e STEP_INDEX no Shell**

Em `frontend/src/pages/congresso/CongressoShell.tsx`, substituir o `STEPS` atual por:
```ts
const STEPS: Array<{ key: CongressoStep; label: string }> = [
  { key: 'evento', label: 'Evento' },
  { key: 'bemvindos', label: 'Bem-vindos' },
  { key: 'modalidade', label: 'Modalidade' },
  { key: 'participantes', label: 'Participantes' },
  { key: 'sorteio', label: 'Sorteio' },
]
```
e o `STEP_INDEX` por:
```ts
const STEP_INDEX: Record<CongressoStep, number> = {
  evento: 0,
  bemvindos: 1,
  modalidade: 2,
  participantes: 3,
  campeoes: 4,
  sorteio: 4,
}
```

- [ ] **Step 3: ModoCongresso — import, render, transições**

Em `frontend/src/pages/congresso/ModoCongresso.tsx`:
- Adicionar o import (junto dos outros step imports):
```ts
import CongressoStepBemvindos from './CongressoStepBemvindos'
```
- No `CongressoStepEvento`, trocar o `onSelect`:
```tsx
        <CongressoStepEvento
          onSelect={(id) => { setEventoId(id); setStep('bemvindos') }}
        />
```
- Adicionar o render do novo step **logo após** o bloco `{step === 'evento' && (...)}`:
```tsx
      {step === 'bemvindos' && eventoId != null && (
        <CongressoStepBemvindos
          eventoId={eventoId}
          onIniciar={() => setStep('modalidade')}
        />
      )}
```
- No `handleBack`, adicionar o ramo de `bemvindos` (o ramo `modalidade` permanece inalterado):
```ts
  function handleBack() {
    if (step === 'sorteio') setStep('participantes')
    else if (step === 'participantes') voltarParaModalidade()
    else if (step === 'modalidade') { setStep('evento'); setEventoId(null) }
    else if (step === 'bemvindos') { setStep('evento'); setEventoId(null) }
  }
```

- [ ] **Step 4: Build**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros.

- [ ] **Step 5: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/types/congresso-step.ts frontend/src/pages/congresso/CongressoShell.tsx frontend/src/pages/congresso/ModoCongresso.tsx
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(congresso): etapa bem-vindos no fluxo (evento -> bem-vindos -> modalidade)"
```

---

### Task 3: Verificação manual (UI)

**Files:** nenhum.

- [ ] **Step 1: Conferir no Modo Congresso**

`cd frontend && npm run dev`; abrir Modo Congresso → selecionar um evento:
- aparece "Bem-vindos" com logo (se cadastrado) + nome; big numbers de **Modalidades** (esportes distintos) e **Inscritos** (participantes distintos); lista de participantes alfabética com subtítulo.
- "Iniciar" → vai para a etapa Modalidade (fluxo seguinte inalterado).
- "Voltar" (cabeçalho) na etapa Bem-vindos → volta para a seleção de evento.
(Se não for possível rodar a UI, declarar; os builds das Tasks 1-2 garantem a compilação.)

---

## Notas finais
- Sem backend/migration. Promoção `develop` → `main` só com confirmação do Wagner.
