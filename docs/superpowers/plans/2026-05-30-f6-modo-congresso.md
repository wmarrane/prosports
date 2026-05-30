# F6 — Modo Congresso (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Frontend-only: tela fullscreen `/congresso` (fora do Layout) com wizard 4 passos (Evento → Modalidade → Participantes → Sorteio) reutilizando endpoints existentes. Adicionar prop `large?` aos 3 componentes de resultado de sorteio. Botão "Modo Congresso" da topbar deixa de ser placeholder. Bump para `1.12.0`.

**Architecture:** Página `ModoCongresso` faz state machine local (`step`, `eventoId`, `modalidadeId`). Renderiza shell próprio (header dark fixo + área de conteúdo) e switch dos 4 componentes step. Cada step é um componente isolado com sua própria query. Sem mudanças no backend. Os 3 componentes de resultado do F4c (`SorteioGrupos`, `SorteioChaves`, `SorteioOrdem`) ganham prop `large?: boolean` que aumenta tipografia/padding/grid.

**Tech Stack:** React 18 + TypeScript + React Query + tokens R2P + Fullscreen API nativa.

**Spec:** `docs/superpowers/specs/2026-05-30-f6-modo-congresso-design.md`

---

## File Structure

**Frontend — Create:**
- `frontend/src/types/congresso-step.ts` — tipo `CongressoStep`.
- `frontend/src/pages/congresso/ModoCongresso.tsx` — página principal com state machine + shell.
- `frontend/src/pages/congresso/CongressoShell.tsx` — header + wrapper visual (dark fixo).
- `frontend/src/pages/congresso/CongressoStepEvento.tsx` — passo 0.
- `frontend/src/pages/congresso/CongressoStepModalidade.tsx` — passo 1.
- `frontend/src/pages/congresso/CongressoStepParticipantes.tsx` — passo 2.
- `frontend/src/pages/congresso/CongressoStepSorteio.tsx` — passo 3.

**Frontend — Modify:**
- `frontend/src/App.tsx` — adicionar rota `/congresso` fora do `<Layout>` mas dentro do `<ProtectedRoute>`.
- `frontend/src/components/Topbar.tsx` — trocar `handleCongresso` (remove alert, faz fullscreen + navigate).
- `frontend/src/components/sorteio-result/SorteioGrupos.tsx` — adicionar prop `large?: boolean`.
- `frontend/src/components/sorteio-result/SorteioChaves.tsx` — idem.
- `frontend/src/components/sorteio-result/SorteioOrdem.tsx` — idem.

**Release:**
- `package.json` (root): `1.11.0` → `1.12.0`.
- `CHANGELOG.md`: bloco novo `[1.12.0]`.

---

## Task 1: Tipo `CongressoStep`

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\types\congresso-step.ts`

- [ ] **Step 1: Criar tipo**

Conteúdo exato:

```ts
export type CongressoStep = 'evento' | 'modalidade' | 'participantes' | 'sorteio'
```

- [ ] **Step 2: tsc**

De `frontend/`:
```
npx tsc --noEmit
```

Esperado: clean.

- [ ] **Step 3: Commit**

```
git add frontend/src/types/congresso-step.ts
git commit -m "feat(congresso): add CongressoStep type" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Adicionar prop `large` aos componentes de resultado

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\components\sorteio-result\SorteioGrupos.tsx`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\components\sorteio-result\SorteioChaves.tsx`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\components\sorteio-result\SorteioOrdem.tsx`

**Contexto:** Os 3 componentes hoje são puros (`{ resultado, participantesById }`). Vamos adicionar `large?: boolean` (default `false`). Quando `true`, classes dinâmicas aumentam tipografia, padding e (no Grupos) o `minmax` do grid.

- [ ] **Step 1: Substituir `SorteioGrupos.tsx` inteiro**

Conteúdo exato:

```tsx
import type { GruposResultado } from '../../types/sorteio'
import type { Participante } from '../../types/participante'

type Props = {
  resultado: GruposResultado
  participantesById: Map<number, Participante>
  large?: boolean
}

export default function SorteioGrupos({ resultado, participantesById, large = false }: Props) {
  const minCol = large ? 360 : 240
  const gap = large ? 24 : 16
  const cardPad = large ? 'p-6' : 'p-4'
  const titleClass = large ? 'text-2xl font-bold text-[var(--t1)]' : 'text-base font-semibold text-[var(--t1)]'
  const subClass = large ? 'text-sm text-[var(--t3)]' : 'text-xs text-[var(--t3)]'
  const itemClass = large ? 'text-xl text-[var(--t1)]' : 'text-sm text-[var(--t1)]'
  const subItemClass = large ? 'text-base text-[var(--t3)] ml-2' : 'text-xs text-[var(--t3)] ml-1'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minCol}px, 1fr))`, gap }}>
      {resultado.grupos.map(g => (
        <div
          key={g.letra}
          className={`bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-xl ${cardPad}`}
        >
          <div className={`flex justify-between items-center ${large ? 'mb-4' : 'mb-3'}`}>
            <h4 className={titleClass}>Grupo {g.letra}</h4>
            <span className={subClass}>{resultado.classificados_por_grupo} classificados</span>
          </div>
          <ul className={large ? 'space-y-3' : 'space-y-1.5'}>
            {g.participantes.map(pid => {
              const p = participantesById.get(pid)
              return (
                <li key={pid} className={itemClass}>
                  {p ? p.nome : <span className="text-[var(--t4)]">—</span>}
                  {p?.subtitulo && <span className={subItemClass}>— {p.subtitulo}</span>}
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

- [ ] **Step 2: Substituir `SorteioChaves.tsx` inteiro**

Conteúdo exato:

```tsx
import type { ChavesResultado } from '../../types/sorteio'
import type { Participante } from '../../types/participante'

type Props = {
  resultado: ChavesResultado
  participantesById: Map<number, Participante>
  large?: boolean
}

export default function SorteioChaves({ resultado, participantesById, large = false }: Props) {
  const cardPad = large ? 'p-6' : 'p-4'
  const itemSpacing = large ? 'space-y-3' : 'space-y-1.5'
  const indexClass = large ? 'font-mono text-base text-[var(--t3)] w-12' : 'font-mono text-[var(--t3)] w-8'
  const nameClass = large ? 'text-xl text-[var(--t1)]' : 'text-sm text-[var(--t1)]'
  const subClass = large ? 'text-base text-[var(--t3)] ml-2' : 'text-xs text-[var(--t3)] ml-1'
  const byeClass = large ? 'text-xl text-[var(--t4)] italic' : 'text-sm text-[var(--t4)] italic'

  return (
    <div className={`bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-xl ${cardPad}`}>
      <ul className={itemSpacing}>
        {resultado.slots.map((pid, idx) => (
          <li key={idx} className="flex items-center gap-3">
            <span className={indexClass}>{String(idx + 1).padStart(2, '0')}</span>
            {pid == null ? (
              <span className={byeClass}>BYE</span>
            ) : (
              (() => {
                const p = participantesById.get(pid)
                return p
                  ? <span className={nameClass}>{p.nome}{p.subtitulo ? <span className={subClass}>— {p.subtitulo}</span> : null}</span>
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

- [ ] **Step 3: Substituir `SorteioOrdem.tsx` inteiro**

Conteúdo exato:

```tsx
import type { OrdemResultado } from '../../types/sorteio'
import type { Participante } from '../../types/participante'

type Props = {
  resultado: OrdemResultado
  participantesById: Map<number, Participante>
  large?: boolean
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function SorteioOrdem({ resultado, participantesById, large = false }: Props) {
  const cardPad = large ? 'p-6' : 'p-4'
  const itemSpacing = large ? 'space-y-3' : 'space-y-1.5'
  const itemClass = large ? 'text-xl text-[var(--t1)]' : 'text-sm text-[var(--t1)]'
  const medalSize = large ? 'text-3xl' : 'text-base'
  const indexClass = large ? 'font-mono text-base text-[var(--t3)] w-12 inline-block' : 'font-mono text-[var(--t3)] w-8 inline-block'
  const subClass = large ? 'text-base text-[var(--t3)] ml-2' : 'text-xs text-[var(--t3)] ml-1'

  return (
    <div className={`bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-xl ${cardPad}`}>
      <ol className={itemSpacing}>
        {resultado.ordem.map((pid, idx) => {
          const p = participantesById.get(pid)
          const prefix = idx < 3
            ? <span className={medalSize}>{MEDALS[idx]}</span>
            : <span className={indexClass}>{String(idx + 1).padStart(2, '0')}</span>
          return (
            <li key={pid} className={`flex items-center gap-3 ${itemClass}`}>
              <span className="w-12 inline-flex items-center justify-center">{prefix}</span>
              {p
                ? <span>{p.nome}{p.subtitulo ? <span className={subClass}>— {p.subtitulo}</span> : null}</span>
                : <span className="text-[var(--t4)]">—</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
```

- [ ] **Step 4: tsc + build**

De `frontend/`:
```
npx tsc --noEmit && npm run build
```

Esperado: tsc clean, vite build OK. Página `/eventos/:id/inscricoes` continua funcionando (large default false).

- [ ] **Step 5: Commit**

```
git add frontend/src/components/sorteio-result
git commit -m "feat(frontend): add large prop to sorteio-result components" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `CongressoShell` — header dark + wrapper

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\congresso\CongressoShell.tsx`

**Contexto:** Wrapper visual com fundo escuro fixo (invariante ao tema), header com marca, indicador de passo (não clicável), botão fullscreen toggle, botão "Sair" (sai fullscreen + navega para /eventos), e — se `step > 0` — botão "← Voltar". Recebe children pra renderizar o step atual.

- [ ] **Step 1: Criar `CongressoShell.tsx`**

Conteúdo exato:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CongressoStep } from '../../types/congresso-step'
import { Maximize, Minimize, X, Trophy } from '../../lib/icons'

const STEP_LABELS: Record<CongressoStep, string> = {
  evento: 'Selecione o Evento',
  modalidade: 'Selecione a Modalidade',
  participantes: 'Participantes Confirmados',
  sorteio: 'Sorteio',
}

const STEP_INDEX: Record<CongressoStep, number> = {
  evento: 1,
  modalidade: 2,
  participantes: 3,
  sorteio: 4,
}

type Props = {
  step: CongressoStep
  onBack?: () => void
  children: React.ReactNode
}

const SHELL_BG = '#0a0e16'
const SHELL_FG = '#f1f5fb'
const SHELL_DIM = '#94a3b8'
const SHELL_LINE = 'rgba(255,255,255,.1)'

export default function CongressoShell({ step, onBack, children }: Props) {
  const navigate = useNavigate()
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement)

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      // negado pelo browser
    }
  }

  async function handleSair() {
    try { if (document.fullscreenElement) await document.exitFullscreen() } catch {}
    navigate('/eventos')
  }

  return (
    <div
      className="congresso-shell"
      style={{ background: SHELL_BG, color: SHELL_FG, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <header
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 24px',
          borderBottom: `1px solid ${SHELL_LINE}`,
          flex: '0 0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Trophy size={22} />
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.02em' }}>Congresso</span>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            style={{ marginLeft: 16, color: SHELL_DIM, fontSize: 14, background: 'transparent', border: 'none', cursor: 'pointer' }}
          >← Voltar</button>
        )}
        <div style={{ flex: 1, textAlign: 'center', color: SHELL_DIM, fontSize: 14 }}>
          Passo {STEP_INDEX[step]} de 4 · {STEP_LABELS[step]}
        </div>
        <button
          onClick={toggleFullscreen}
          style={{ color: SHELL_FG, background: 'transparent', border: 'none', cursor: 'pointer', padding: 6 }}
          title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
        >
          {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>
        <button
          onClick={handleSair}
          style={{ color: SHELL_FG, background: 'transparent', border: `1px solid ${SHELL_LINE}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <X size={16} /> Sair
        </button>
      </header>
      <main style={{ flex: 1, overflow: 'auto', padding: 32 }}>
        {children}
      </main>
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
git add frontend/src/pages/congresso/CongressoShell.tsx
git commit -m "feat(congresso): add CongressoShell (dark header + fullscreen toggle)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Step `CongressoStepEvento`

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\congresso\CongressoStepEvento.tsx`

**Contexto:** Grid de cards grandes dos eventos ativos (status ≠ 'rascunho'). Cada card click seleciona evento e avança via callback.

- [ ] **Step 1: Criar `CongressoStepEvento.tsx`**

Conteúdo exato:

```tsx
import { useQuery } from '@tanstack/react-query'
import { eventosService } from '../../services/eventos'

function formatDateBR(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

type Props = {
  onSelect: (eventoId: number) => void
}

const CARD_BG = 'rgba(255,255,255,.04)'
const CARD_BORDER = 'rgba(255,255,255,.1)'
const FG = '#f1f5fb'
const DIM = '#94a3b8'

export default function CongressoStepEvento({ onSelect }: Props) {
  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ['eventos'],
    queryFn: () => eventosService.listar(),
  })

  const ativos = eventos.filter(e => e.status !== 'rascunho')

  if (isLoading) {
    return <p style={{ color: DIM, fontSize: 18 }}>Carregando eventos...</p>
  }

  if (ativos.length === 0) {
    return (
      <p style={{ color: DIM, fontSize: 18 }}>
        Nenhum evento ativo. Crie um evento e mude status para "Inscrições" no painel administrativo.
      </p>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
      {ativos.map(e => (
        <button
          key={e.id}
          onClick={() => onSelect(e.id)}
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 16,
            padding: 24,
            textAlign: 'left',
            cursor: 'pointer',
            color: FG,
            transition: 'border-color 150ms ease',
          }}
          onMouseEnter={e2 => (e2.currentTarget.style.borderColor = '#1061d8')}
          onMouseLeave={e2 => (e2.currentTarget.style.borderColor = CARD_BORDER)}
        >
          <div style={{ fontSize: 12, color: DIM, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            #{e.id} · {e.municipio.nome} — {e.municipio.uf}
          </div>
          <h3 style={{ fontSize: 26, fontWeight: 700, marginTop: 8, marginBottom: 12, lineHeight: 1.2 }}>
            {e.nome}
          </h3>
          <div style={{ fontSize: 14, color: DIM, marginBottom: 4 }}>
            🏆 {e.competicao.nome}
          </div>
          <div style={{ fontSize: 14, color: DIM }}>
            📅 {formatDateBR(e.data_hora)} · {e.local}
          </div>
        </button>
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
git add frontend/src/pages/congresso/CongressoStepEvento.tsx
git commit -m "feat(congresso): add step 1 (Evento) — grid de cards grandes" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Step `CongressoStepModalidade`

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\congresso\CongressoStepModalidade.tsx`

**Contexto:** Lista vertical de cards de modalidade. Header mostra nome do evento + competição. Carrega sorteios para mostrar selo ✓.

- [ ] **Step 1: Criar `CongressoStepModalidade.tsx`**

Conteúdo exato:

```tsx
import { useQuery } from '@tanstack/react-query'
import { eventosService } from '../../services/eventos'
import { modalidadesService } from '../../services/modalidades'
import { sorteiosService } from '../../services/sorteios'
import { TIPO_DISPUTA_LABEL } from '../../lib/tipo-disputa'

type Props = {
  eventoId: number
  onSelect: (modalidadeId: number) => void
}

const CARD_BG = 'rgba(255,255,255,.04)'
const CARD_BORDER = 'rgba(255,255,255,.1)'
const FG = '#f1f5fb'
const DIM = '#94a3b8'
const SUCCESS = '#14b88a'

export default function CongressoStepModalidade({ eventoId, onSelect }: Props) {
  const { data: evento } = useQuery({
    queryKey: ['eventos', eventoId],
    queryFn: () => eventosService.buscar(eventoId),
  })

  const { data: modalidades = [], isLoading } = useQuery({
    queryKey: ['modalidades', evento?.competicao_id],
    queryFn: () => modalidadesService.listar({ competicao_id: evento!.competicao_id }),
    enabled: !!evento,
  })

  const { data: sorteios = [] } = useQuery({
    queryKey: ['sorteios', eventoId],
    queryFn: () => sorteiosService.listar({ evento_id: eventoId }),
  })

  const sorteadasIds = new Set(sorteios.map(s => s.modalidade_id))

  if (isLoading) {
    return <p style={{ color: DIM, fontSize: 18 }}>Carregando modalidades...</p>
  }

  return (
    <div>
      {evento && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, color: DIM, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Evento
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: FG, marginTop: 4 }}>{evento.nome}</h2>
          <div style={{ fontSize: 16, color: DIM, marginTop: 4 }}>{evento.competicao.nome}</div>
        </div>
      )}

      {modalidades.length === 0 ? (
        <p style={{ color: DIM, fontSize: 18 }}>Nenhuma modalidade cadastrada nesta competição.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {modalidades.map(m => {
            const sorteada = sorteadasIds.has(m.id)
            return (
              <button
                key={m.id}
                onClick={() => onSelect(m.id)}
                style={{
                  background: CARD_BG,
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: 12,
                  padding: 20,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: FG,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#1061d8')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = CARD_BORDER)}
              >
                <div>
                  <div style={{ fontSize: 22, fontWeight: 600 }}>{m.nome} ({m.sigla})</div>
                  <div style={{ fontSize: 14, color: DIM, marginTop: 4 }}>
                    {m.tipo_modalidade ? TIPO_DISPUTA_LABEL[m.tipo_modalidade.tipo] : '—'}
                  </div>
                </div>
                {sorteada && (
                  <span style={{ color: SUCCESS, fontSize: 16, fontWeight: 600 }}>
                    ✓ Sorteado
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
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
git add frontend/src/pages/congresso/CongressoStepModalidade.tsx
git commit -m "feat(congresso): add step 2 (Modalidade) — lista com selo de sorteadas" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Step `CongressoStepParticipantes`

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\congresso\CongressoStepParticipantes.tsx`

**Contexto:** Lista read-only de inscritos da modalidade. Header com nome da modalidade. Footer com botão "Próximo →".

- [ ] **Step 1: Criar `CongressoStepParticipantes.tsx`**

Conteúdo exato:

```tsx
import { useQuery } from '@tanstack/react-query'
import { inscricoesService } from '../../services/inscricoes'
import { modalidadesService } from '../../services/modalidades'

type Props = {
  eventoId: number
  modalidadeId: number
  competicaoId: number | undefined
  onNext: () => void
}

const FG = '#f1f5fb'
const DIM = '#94a3b8'
const LINE = 'rgba(255,255,255,.08)'

export default function CongressoStepParticipantes({ eventoId, modalidadeId, competicaoId, onNext }: Props) {
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
          <div style={{ fontSize: 16, color: DIM, marginTop: 4 }}>
            {inscricoes.length} {inscricoes.length === 1 ? 'inscrito' : 'inscritos'}
          </div>
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
                }}
              >
                {i.participante.nome}
                {i.participante.subtitulo && (
                  <span style={{ fontSize: 16, color: DIM, marginLeft: 12 }}>
                    — {i.participante.subtitulo}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12 }}>
        <button
          onClick={onNext}
          style={{
            background: '#1061d8',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '12px 24px',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >Próximo →</button>
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
git add frontend/src/pages/congresso/CongressoStepParticipantes.tsx
git commit -m "feat(congresso): add step 3 (Participantes) — lista read-only" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Step `CongressoStepSorteio`

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\congresso\CongressoStepSorteio.tsx`

**Contexto:** O coração do modo congresso. Se sorteio existe → mostra resultado (com prop `large`). Senão → botão grande "Realizar sorteio". Tipo `especifico` → mensagem + "Próxima modalidade". Sempre rodapé com "Próxima modalidade →" quando há resultado/aviso.

- [ ] **Step 1: Criar `CongressoStepSorteio.tsx`**

Conteúdo exato:

```tsx
import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inscricoesService } from '../../services/inscricoes'
import { modalidadesService } from '../../services/modalidades'
import { sorteiosService } from '../../services/sorteios'
import SorteioGrupos from '../../components/sorteio-result/SorteioGrupos'
import SorteioChaves from '../../components/sorteio-result/SorteioChaves'
import SorteioOrdem from '../../components/sorteio-result/SorteioOrdem'
import type { Participante } from '../../types/participante'

type Props = {
  eventoId: number
  modalidadeId: number
  competicaoId: number | undefined
  onProxima: () => void
}

const FG = '#f1f5fb'
const DIM = '#94a3b8'
const DANGER = '#ef4444'

export default function CongressoStepSorteio({ eventoId, modalidadeId, competicaoId, onProxima }: Props) {
  const queryClient = useQueryClient()
  const [erro, setErro] = useState('')

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades', competicaoId],
    queryFn: () => modalidadesService.listar({ competicao_id: competicaoId! }),
    enabled: !!competicaoId,
  })
  const modalidade = modalidades.find(m => m.id === modalidadeId)
  const tipo = modalidade?.tipo_modalidade?.tipo

  const { data: sorteios = [] } = useQuery({
    queryKey: ['sorteios', eventoId],
    queryFn: () => sorteiosService.listar({ evento_id: eventoId }),
  })
  const sorteio = sorteios.find(s => s.modalidade_id === modalidadeId) ?? null

  const { data: inscricoes = [] } = useQuery({
    queryKey: ['inscricoes', eventoId, modalidadeId],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId, modalidade_id: modalidadeId }),
  })

  const participantesById = useMemo(() => {
    const m = new Map<number, Participante>()
    for (const i of inscricoes) m.set(i.participante_id, i.participante)
    return m
  }, [inscricoes])

  const { mutate: executar, isPending: executando } = useMutation({
    mutationFn: () => sorteiosService.executar({ evento_id: eventoId, modalidade_id: modalidadeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sorteios', eventoId] })
      setErro('')
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao sortear.'),
  })

  function handleSortear() {
    setErro('')
    executar()
  }

  function handleNovoSorteio() {
    if (confirm('Realizar novo sorteio? Isso vai sobrescrever o resultado atual com uma nova seed.')) {
      setErro('')
      executar()
    }
  }

  function formatDateBR(iso: string): string {
    try { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) }
    catch { return iso }
  }

  const proximaBtn = (
    <button
      onClick={onProxima}
      style={{
        background: '#1061d8',
        color: '#fff',
        border: 'none',
        borderRadius: 10,
        padding: '12px 24px',
        fontSize: 16,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >Próxima modalidade →</button>
  )

  // Aviso especifico
  if (tipo === 'especifico') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', gap: 16 }}>
          <div style={{ fontSize: 48 }}>📋</div>
          <h2 style={{ fontSize: 32, color: FG, fontWeight: 700 }}>{modalidade?.nome}</h2>
          <p style={{ fontSize: 20, color: DIM, maxWidth: 600 }}>
            Esta modalidade é do tipo "Específico" — sem sorteio automático.
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12 }}>{proximaBtn}</div>
      </div>
    )
  }

  // Sem sorteio: botão grande
  if (!sorteio) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', gap: 24 }}>
          <h2 style={{ fontSize: 36, color: FG, fontWeight: 700 }}>{modalidade?.nome}</h2>
          <p style={{ fontSize: 18, color: DIM }}>
            {inscricoes.length} {inscricoes.length === 1 ? 'inscrito' : 'inscritos'}
          </p>
          <button
            onClick={handleSortear}
            disabled={executando || inscricoes.length === 0}
            style={{
              background: '#1061d8',
              color: '#fff',
              border: 'none',
              borderRadius: 14,
              padding: '20px 48px',
              fontSize: 22,
              fontWeight: 700,
              cursor: 'pointer',
              opacity: (executando || inscricoes.length === 0) ? 0.5 : 1,
            }}
          >{executando ? '🎲 Sorteando...' : '🎲 Realizar sorteio'}</button>
          {inscricoes.length === 0 && (
            <p style={{ color: DIM, fontSize: 14 }}>Adicione participantes antes de sortear.</p>
          )}
          {erro && <p style={{ color: DANGER, fontSize: 16 }}>{erro}</p>}
        </div>
      </div>
    )
  }

  // Com sorteio: resultado em destaque
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 28, color: FG, fontWeight: 700 }}>{modalidade?.nome}</h2>
          <div style={{ fontSize: 13, color: DIM, marginTop: 4 }}>
            seed: <span style={{ fontFamily: 'monospace' }}>{sorteio.seed}</span> · gerado em {formatDateBR(sorteio.gerado_em)}
          </div>
        </div>
        <button
          onClick={handleNovoSorteio}
          disabled={executando}
          style={{
            background: 'transparent',
            color: '#1061d8',
            border: '1px solid #1061d8',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            opacity: executando ? 0.5 : 1,
          }}
        >{executando ? 'Sorteando...' : 'Novo sorteio'}</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {sorteio.tipo === 'grupos' && (
          <SorteioGrupos resultado={sorteio.resultado} participantesById={participantesById} large />
        )}
        {sorteio.tipo === 'chaves' && (
          <SorteioChaves resultado={sorteio.resultado} participantesById={participantesById} large />
        )}
        {sorteio.tipo === 'ordem_entrada' && (
          <SorteioOrdem resultado={sorteio.resultado} participantesById={participantesById} large />
        )}
        {erro && <p style={{ color: DANGER, fontSize: 16, marginTop: 12 }}>{erro}</p>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16 }}>{proximaBtn}</div>
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
git add frontend/src/pages/congresso/CongressoStepSorteio.tsx
git commit -m "feat(congresso): add step 4 (Sorteio) com renders large e novo sorteio" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `ModoCongresso` — página principal

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\congresso\ModoCongresso.tsx`

**Contexto:** State machine que orquestra os 4 steps. Recebe controle do `onBack` (volta step anterior) e do switch de conteúdo.

- [ ] **Step 1: Criar `ModoCongresso.tsx`**

Conteúdo exato:

```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import CongressoShell from './CongressoShell'
import CongressoStepEvento from './CongressoStepEvento'
import CongressoStepModalidade from './CongressoStepModalidade'
import CongressoStepParticipantes from './CongressoStepParticipantes'
import CongressoStepSorteio from './CongressoStepSorteio'
import { eventosService } from '../../services/eventos'
import type { CongressoStep } from '../../types/congresso-step'

export default function ModoCongresso() {
  const [step, setStep] = useState<CongressoStep>('evento')
  const [eventoId, setEventoId] = useState<number | null>(null)
  const [modalidadeId, setModalidadeId] = useState<number | null>(null)

  // Carrega evento (usado em participantes/sorteio para pegar competicao_id)
  const { data: evento } = useQuery({
    queryKey: ['eventos', eventoId],
    queryFn: () => eventosService.buscar(eventoId!),
    enabled: eventoId != null,
  })
  const competicaoId = evento?.competicao_id

  function handleBack() {
    if (step === 'sorteio') setStep('participantes')
    else if (step === 'participantes') setStep('modalidade')
    else if (step === 'modalidade') { setStep('evento'); setEventoId(null) }
  }

  const onBack = step !== 'evento' ? handleBack : undefined

  return (
    <CongressoShell step={step} onBack={onBack}>
      {step === 'evento' && (
        <CongressoStepEvento
          onSelect={(id) => { setEventoId(id); setStep('modalidade') }}
        />
      )}
      {step === 'modalidade' && eventoId != null && (
        <CongressoStepModalidade
          eventoId={eventoId}
          onSelect={(id) => { setModalidadeId(id); setStep('participantes') }}
        />
      )}
      {step === 'participantes' && eventoId != null && modalidadeId != null && (
        <CongressoStepParticipantes
          eventoId={eventoId}
          modalidadeId={modalidadeId}
          competicaoId={competicaoId}
          onNext={() => setStep('sorteio')}
        />
      )}
      {step === 'sorteio' && eventoId != null && modalidadeId != null && (
        <CongressoStepSorteio
          eventoId={eventoId}
          modalidadeId={modalidadeId}
          competicaoId={competicaoId}
          onProxima={() => { setModalidadeId(null); setStep('modalidade') }}
        />
      )}
    </CongressoShell>
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
git add frontend/src/pages/congresso/ModoCongresso.tsx
git commit -m "feat(congresso): add ModoCongresso page (state machine 4 steps)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Wire rota + trigger na Topbar

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\App.tsx`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\components\Topbar.tsx`

- [ ] **Step 1: Editar `App.tsx` — adicionar import**

Localizar o bloco de imports e adicionar após `import Admin from './pages/Admin'`:

```tsx
import ModoCongresso from './pages/congresso/ModoCongresso'
```

- [ ] **Step 2: Editar `App.tsx` — adicionar rota fora do Layout**

Localizar o bloco:

```tsx
<Route element={<ProtectedRoute />}>
  <Route element={<Layout />}>
```

Substituir por:

```tsx
<Route element={<ProtectedRoute />}>
  <Route path="/congresso" element={<ModoCongresso />} />
  <Route element={<Layout />}>
```

(Apenas insere a linha `<Route path="/congresso" element={<ModoCongresso />} />` entre `ProtectedRoute` e `Layout`.)

- [ ] **Step 3: Editar `Topbar.tsx` — substituir handler do botão**

Localizar a função `handleCongresso`:

```ts
  function handleCongresso() {
    alert('Modo Congresso — em construção (fase F6)')
  }
```

Substituir por:

```ts
  async function handleCongresso() {
    try {
      await document.documentElement.requestFullscreen()
    } catch {
      // permissão negada ou contexto inseguro — segue sem fullscreen
    }
    navigate('/congresso')
  }
```

- [ ] **Step 4: tsc + build**

De `frontend/`:
```
npx tsc --noEmit && npm run build
```

Esperado: tsc clean, vite build OK.

- [ ] **Step 5: Commit**

```
git add frontend/src/App.tsx frontend/src/components/Topbar.tsx
git commit -m "feat(congresso): wire /congresso route + Topbar trigger (fullscreen + navigate)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Bump versão + CHANGELOG

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\package.json`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\CHANGELOG.md`

- [ ] **Step 1: Bump version**

Editar `package.json` (root). Mudar **somente** `"version": "1.11.0"` para `"version": "1.12.0"`.

- [ ] **Step 2: Adicionar bloco no `CHANGELOG.md`**

Inserir o bloco abaixo logo após o cabeçalho e **antes** do bloco `## [1.11.0]`:

```md
## [1.12.0] - 2026-05-30

### Added
- Modo Congresso (MVP): rota `/congresso` fullscreen dedicada à apresentação em Datashow. Wizard 4 passos: Evento → Modalidade → Participantes → Sorteio. Tipografia grande, cromo mínimo, header dark fixo (invariante ao tema).
- Botão "Modo Congresso" na topbar agora abre a tela (com requestFullscreen + navigate).
- Componentes `SorteioGrupos`/`SorteioChaves`/`SorteioOrdem` ganham prop `large?: boolean` para renderização ampliada (fonte ~1.5x, padding maior, grid mais largo).

### Notes
- Sem novos endpoints ou migrations — reutiliza /eventos, /modalidades, /inscricoes, /sorteios.
- Estado da sessão (passo, evento, modalidade) não persiste — refresh volta para o passo 1.
- Modais de incluir/log/expandir, paginação dinâmica, print PDF, theme próprio e animações ficam para iteração futura (F6b).
```

- [ ] **Step 3: Commit**

```
git add package.json CHANGELOG.md
git commit -m "chore(release): v1.12.0 — F6 Modo Congresso MVP" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Push + smoke (pós-deploy CI)

**Files:** (sem edição — verificação)

- [ ] **Step 1: Push**

```
git push origin develop
```

CI reconstrói só o frontend (sem migrations). ~3-4min.

- [ ] **Step 2: Verificar deploy**

```
curl -s -o /dev/null -w "/health: %{http_code}\n" http://192.168.56.113:3000/health
curl -s -o /dev/null -w "frontend: %{http_code}\n" http://192.168.56.113:8080/
```

Esperado: ambos 200.

- [ ] **Step 3: Smoke no browser**

Abrir http://192.168.56.113:8080, login `admin@prosports.com` / `admin123`:

1. Topbar → click "Modo Congresso". Browser pede permissão de fullscreen (primeira vez por sessão). Aprovar → entra em fullscreen + navega para `/congresso`.
2. Header dark aparece com "Congresso" + "Passo 1 de 4 · Selecione o Evento" + botões fullscreen toggle e Sair.
3. Passo 1: cards grandes de eventos com status ≠ rascunho. Clicar em um.
4. Passo 2: lista de modalidades da competição. Modalidades já sorteadas têm "✓ Sorteado". Clicar em uma sem sorteio.
5. Passo 3: lista grande dos inscritos com botão "Próximo →" no rodapé.
6. Passo 4 (tipo grupos): botão grande "🎲 Realizar sorteio" → renderiza cards de grupo com fonte ampliada. Header mostra seed em mono. Botão "Próxima modalidade →" no rodapé.
7. Click "Próxima modalidade" → volta para passo 2 (Modalidade). Modalidade anterior agora tem selo ✓.
8. Selecionar outra modalidade tipo `especifico` → step 4 mostra mensagem "Sem sorteio automático" + botão "Próxima modalidade".
9. Selecionar outra modalidade tipo `chaves` ou `ordem_entrada` → sortear → resultado renderiza com fonte ampliada (BYE em itálico se chaves, medalhas grandes se ordem).
10. Botão fullscreen toggle (canto sup. dir.) — alterna fullscreen sem sair da página.
11. Botão "Sair" — sai do fullscreen + navega para `/eventos`.
12. Botão "← Voltar" — volta um step preservando estado.
13. Rodapé sidebar (após sair): `v1.12.0`.

- [ ] **Step 4: Reportar**

Se passou, F6 fechada.

---

## Self-review

Cobertura do spec:

| Spec | Coberto por |
|---|---|
| Tipo `CongressoStep` | Task 1 |
| Prop `large` nos 3 componentes de resultado | Task 2 |
| `CongressoShell` — header dark fixo + indicador de passo + fullscreen toggle + Sair | Task 3 |
| Step 0 Evento (cards grandes, filtro status ≠ rascunho) | Task 4 |
| Step 1 Modalidade (lista com selo de sorteadas + cabeçalho do evento) | Task 5 |
| Step 2 Participantes (read-only + botão Próximo) | Task 6 |
| Step 3 Sorteio (botão grande / resultado large / aviso especifico / Próxima modalidade) | Task 7 |
| `ModoCongresso` orquestrando state machine | Task 8 |
| Rota /congresso fora do Layout + trigger na Topbar (fullscreen + navigate) | Task 9 |
| Bump 1.12.0 + CHANGELOG | Task 10 |
| Smoke pós-deploy | Task 11 |

Riscos endereçados:
- **Fullscreen negado** — handler tem `try/catch` em todos os pontos (Topbar, toggle, sair).
- **Reuse dos componentes large=false default** — Task 2 mantém retro-compatibilidade com F4c.
- **Sessão perdida em refresh** — documentado no spec, sem solução nesta sub-fase.
- **competicaoId só disponível após query evento** — Task 8 carrega evento na page principal e propaga para steps 2-3.
- **`AltAlready em fullscreen quando navega** — o user gesture do click satisfaz API; subsequente toggle dentro de /congresso também.
- **Modalidade.tipo_modalidade pode ser undefined no carregamento inicial** — Tasks 5 e 7 usam `?.` para evitar crash; mostra "—" como fallback até resolver.
