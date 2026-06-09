# Alertas no ícone Sino — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o ícone Sino do Topbar num popover de alertas operacionais client-side (eventos prontos/parciais/com inscrições + modalidades sem regra).

**Architecture:** Lógica em funções puras testáveis (`frontend/src/lib/alertas.ts`); um componente `NotificationBell` consome os dados via react-query (`eventos`, `modalidades`, e — para "sem regra" — `counts` por evento ativo e regras por competição com `useQueries`), monta os alertas e renderiza um popover. O Topbar troca o botão estático do Sino por `<NotificationBell />`.

**Tech Stack:** React 18, react-query, react-router, Vitest. Spec: `docs/superpowers/specs/2026-06-08-alertas-sino-design.md`.

---

## File Structure

- `frontend/src/lib/alertas.ts` — tipos `Alerta`/`AlertaTipo` + `deriveEventoAlerts` + `deriveSemRegraAlerts` (puro, sem React).
- `frontend/src/lib/alertas.test.ts` — testes Vitest das funções puras.
- `frontend/src/components/NotificationBell.tsx` — botão+badge+popover; faz as queries e usa as funções puras.
- `frontend/src/components/Topbar.tsx` — substitui o `<button>` do Sino por `<NotificationBell />`.

---

## Task 1: `deriveEventoAlerts` (alertas por status do evento)

**Files:**
- Create: `frontend/src/lib/alertas.ts`
- Test: `frontend/src/lib/alertas.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/lib/alertas.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { deriveEventoAlerts } from './alertas'

const ev = (id: number, nome: string, status: string) => ({ id, nome, status: status as any })

describe('deriveEventoAlerts', () => {
  it('classifica pronto/parcial/inscricoes e ignora rascunho/sorteado', () => {
    const out = deriveEventoAlerts([
      ev(1, 'Jogos A', 'pronto'),
      ev(2, 'Jogos B', 'parcial'),
      ev(3, 'Jogos C', 'inscricoes'),
      ev(4, 'Jogos D', 'rascunho'),
      ev(5, 'Jogos E', 'sorteado'),
    ])
    expect(out.map(a => a.tipo)).toEqual(['pronto', 'parcial', 'inscricoes'])
  })

  it('gera id, titulo, descricao e rota corretos', () => {
    const [a] = deriveEventoAlerts([ev(7, 'Copa X', 'pronto')])
    expect(a).toEqual({
      id: 'evt-7-pronto',
      tipo: 'pronto',
      titulo: 'Pronto para sortear',
      descricao: 'Copa X',
      to: '/eventos/7/inscricoes',
    })
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd frontend && npx vitest run src/lib/alertas.test.ts`
Expected: FAIL — `deriveEventoAlerts` não existe.

- [ ] **Step 3: Implementar**

Criar `frontend/src/lib/alertas.ts`:

```ts
import type { Evento, EventoStatus } from '../types/evento'

export type AlertaTipo = 'pronto' | 'parcial' | 'inscricoes' | 'sem_regra'

export type Alerta = {
  id: string
  tipo: AlertaTipo
  titulo: string
  descricao: string
  to: string
}

const STATUS_TITULO: Partial<Record<EventoStatus, string>> = {
  pronto: 'Pronto para sortear',
  parcial: 'Sorteio incompleto',
  inscricoes: 'Inscrições abertas',
}

export function deriveEventoAlerts(
  eventos: Array<Pick<Evento, 'id' | 'nome' | 'status'>>,
): Alerta[] {
  const out: Alerta[] = []
  for (const e of eventos) {
    const titulo = STATUS_TITULO[e.status]
    if (!titulo) continue
    out.push({
      id: `evt-${e.id}-${e.status}`,
      tipo: e.status as AlertaTipo,
      titulo,
      descricao: e.nome,
      to: `/eventos/${e.id}/inscricoes`,
    })
  }
  return out
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/lib/alertas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/alertas.ts frontend/src/lib/alertas.test.ts
git commit -m "feat(alertas): deriveEventoAlerts (alertas por status do evento)"
```

---

## Task 2: `deriveSemRegraAlerts` (modalidades sem regra)

**Files:**
- Modify: `frontend/src/lib/alertas.ts`
- Test: `frontend/src/lib/alertas.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `frontend/src/lib/alertas.test.ts` (e incluir `deriveSemRegraAlerts` no import existente de `./alertas`):

```ts
import { deriveSemRegraAlerts } from './alertas'

describe('deriveSemRegraAlerts', () => {
  const base = {
    eventosAtivos: [{ id: 1, nome: 'Jogos A', competicao_id: 10 }],
    modalidadesById: {
      100: { id: 100, nome: 'Judô', tipo: 'chaves' as const },
      200: { id: 200, nome: 'Futsal', tipo: 'grupos' as const },
      300: { id: 300, nome: 'Xadrez', tipo: 'especifico' as const },
    },
    countsByEvento: { 1: { 100: 22, 200: 6, 300: 4 } },
    rulesByCompeticao: { 10: { grupos: [6], chaves: [16] } },
  }

  it('chaves com N sem regra vira alerta; grupos com regra não', () => {
    const out = deriveSemRegraAlerts(base)
    // chaves N=22 não está em chaves:[16] -> alerta; grupos N=6 está em grupos:[6] -> sem alerta
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({
      id: 'semregra-1-100',
      tipo: 'sem_regra',
      titulo: 'Modalidade sem regra',
      descricao: 'Jogos A · Judô (22)',
      to: '/eventos/1/inscricoes',
    })
  })

  it('ignora tipo especifico/ordem_entrada e N=0', () => {
    const out = deriveSemRegraAlerts({
      ...base,
      countsByEvento: { 1: { 300: 10, 100: 0 } },
      rulesByCompeticao: { 10: { grupos: [], chaves: [] } },
    })
    expect(out).toEqual([])
  })

  it('modalidade ausente em modalidadesById é ignorada', () => {
    const out = deriveSemRegraAlerts({
      ...base,
      countsByEvento: { 1: { 999: 8 } },
      rulesByCompeticao: { 10: { grupos: [], chaves: [] } },
    })
    expect(out).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd frontend && npx vitest run src/lib/alertas.test.ts`
Expected: FAIL — `deriveSemRegraAlerts` não existe.

- [ ] **Step 3: Implementar**

Adicionar a `frontend/src/lib/alertas.ts`:

```ts
type ModInfo = { id: number; nome: string; tipo: 'grupos' | 'chaves' | 'especifico' | 'ordem_entrada' }

export type SemRegraInput = {
  eventosAtivos: Array<{ id: number; nome: string; competicao_id: number }>
  modalidadesById: Record<number, ModInfo>
  countsByEvento: Record<number, Record<number, number>>
  rulesByCompeticao: Record<number, { grupos: number[]; chaves: number[] }>
}

export function deriveSemRegraAlerts(input: SemRegraInput): Alerta[] {
  const { eventosAtivos, modalidadesById, countsByEvento, rulesByCompeticao } = input
  const out: Alerta[] = []
  for (const ev of eventosAtivos) {
    const counts = countsByEvento[ev.id] ?? {}
    const rules = rulesByCompeticao[ev.competicao_id] ?? { grupos: [], chaves: [] }
    for (const [modIdStr, n] of Object.entries(counts)) {
      if (!n || n <= 0) continue
      const mod = modalidadesById[Number(modIdStr)]
      if (!mod) continue
      if (mod.tipo !== 'grupos' && mod.tipo !== 'chaves') continue
      const temRegra = mod.tipo === 'grupos' ? rules.grupos.includes(n) : rules.chaves.includes(n)
      if (temRegra) continue
      out.push({
        id: `semregra-${ev.id}-${mod.id}`,
        tipo: 'sem_regra',
        titulo: 'Modalidade sem regra',
        descricao: `${ev.nome} · ${mod.nome} (${n})`,
        to: `/eventos/${ev.id}/inscricoes`,
      })
    }
  }
  return out
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/lib/alertas.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/alertas.ts frontend/src/lib/alertas.test.ts
git commit -m "feat(alertas): deriveSemRegraAlerts (modalidades sem regra)"
```

---

## Task 3: Componente `NotificationBell` + integração no Topbar

**Files:**
- Create: `frontend/src/components/NotificationBell.tsx`
- Modify: `frontend/src/components/Topbar.tsx:83-86` (botão do Sino)

- [ ] **Step 1: Criar o componente**

Criar `frontend/src/components/NotificationBell.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueries } from '@tanstack/react-query'
import { Bell } from '../lib/icons'
import { eventosService } from '../services/eventos'
import { modalidadesService } from '../services/modalidades'
import { inscricoesService } from '../services/inscricoes'
import { sistemasDisputaService } from '../services/sistemas-disputa'
import { deriveEventoAlerts, deriveSemRegraAlerts } from '../lib/alertas'

const ATIVOS = new Set(['inscricoes', 'pronto', 'parcial'])
const STALE = 60_000

export default function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: eventos = [] } = useQuery({ queryKey: ['eventos'], queryFn: () => eventosService.listar() })
  const { data: modalidades = [] } = useQuery({ queryKey: ['modalidades'], queryFn: () => modalidadesService.listar() })

  const eventosAtivos = useMemo(
    () => eventos.filter(e => ATIVOS.has(e.status)).map(e => ({ id: e.id, nome: e.nome, competicao_id: e.competicao_id })),
    [eventos],
  )
  const competicoesAtivas = useMemo(
    () => Array.from(new Set(eventosAtivos.map(e => e.competicao_id))),
    [eventosAtivos],
  )

  const countsQueries = useQueries({
    queries: eventosAtivos.map(e => ({
      queryKey: ['inscricoes-counts', e.id],
      queryFn: () => inscricoesService.counts(e.id),
      staleTime: STALE,
    })),
  })
  const gruposQueries = useQueries({
    queries: competicoesAtivas.map(cid => ({
      queryKey: ['sistemas-grupos', cid],
      queryFn: () => sistemasDisputaService.grupos.listar(cid),
      staleTime: STALE,
    })),
  })
  const chavesQueries = useQueries({
    queries: competicoesAtivas.map(cid => ({
      queryKey: ['sistemas-chaves', cid],
      queryFn: () => sistemasDisputaService.chaves.listar(cid),
      staleTime: STALE,
    })),
  })

  const alertas = useMemo(() => {
    const status = deriveEventoAlerts(eventos)

    const modalidadesById: Record<number, { id: number; nome: string; tipo: any }> = {}
    for (const m of modalidades) modalidadesById[m.id] = { id: m.id, nome: m.nome, tipo: m.tipo_modalidade.tipo }

    const countsByEvento: Record<number, Record<number, number>> = {}
    eventosAtivos.forEach((e, i) => { countsByEvento[e.id] = countsQueries[i]?.data ?? {} })

    const rulesByCompeticao: Record<number, { grupos: number[]; chaves: number[] }> = {}
    competicoesAtivas.forEach((cid, i) => {
      rulesByCompeticao[cid] = {
        grupos: (gruposQueries[i]?.data ?? []).map(r => r.quantidade_equipes),
        chaves: (chavesQueries[i]?.data ?? []).map(r => r.numero_inscrito),
      }
    })

    const semRegra = deriveSemRegraAlerts({ eventosAtivos, modalidadesById, countsByEvento, rulesByCompeticao })
    return [...status, ...semRegra]
  }, [eventos, modalidades, eventosAtivos, competicoesAtivas, countsQueries, gruposQueries, chavesQueries])

  // Fechar ao clicar fora / Esc
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  function goTo(to: string) { setOpen(false); navigate(to) }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="icon-btn"
        style={{ position: 'relative' }}
        title="Alertas"
        onClick={() => setOpen(o => !o)}
      >
        <Bell size={19} />
        {alertas.length > 0 && (
          <span
            style={{
              position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, padding: '0 4px',
              borderRadius: 9999, background: 'var(--danger)', color: '#fff',
              fontSize: 10, fontWeight: 700, lineHeight: '16px', textAlign: 'center',
            }}
          >{alertas.length}</span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Alertas"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 360, maxHeight: 420, overflowY: 'auto',
            background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-card)', zIndex: 60, padding: 8,
          }}
        >
          <div style={{ padding: '6px 10px', fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Alertas {alertas.length > 0 ? `(${alertas.length})` : ''}
          </div>
          {alertas.length === 0 ? (
            <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--t3)' }}>Nenhum alerta no momento.</div>
          ) : (
            alertas.map(a => (
              <button
                key={a.id}
                onClick={() => goTo(a.to)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                  padding: '8px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--t1)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-bg-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{a.titulo}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>{a.descricao}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Integrar no Topbar**

Em `frontend/src/components/Topbar.tsx`:

(a) adicionar o import (junto aos imports do topo):
```tsx
import NotificationBell from './NotificationBell'
```

(b) substituir o botão estático do Sino (linhas 83-86):
```tsx
      <button className="icon-btn" style={{ position: 'relative' }} title="Notificações">
        <Bell size={19} />
        <span className="notif-dot" />
      </button>
```
por:
```tsx
      <NotificationBell />
```

(c) remover `Bell` do import de `'../lib/icons'` (linha 5) se não for mais usado no arquivo (passa a ser usado só no NotificationBell).

- [ ] **Step 3: Verificar tipos e build**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros novos citando `NotificationBell.tsx` / `Topbar.tsx`.

Run: `cd frontend && npm run build`
Expected: build conclui sem erros (igual ao CI `tsc -b && vite build`).

- [ ] **Step 4: Verificação manual no navegador**

Com backend+frontend rodando e dados de teste:
- O Sino mostra um badge com a contagem quando há eventos em `pronto`/`parcial`/`inscricoes` e/ou modalidades sem regra.
- Clicar abre o popover com os itens; clicar num item navega para `/eventos/:id/inscricoes` e fecha.
- Clicar fora / Esc fecham o popover.
- Sem alertas → badge some e popover mostra "Nenhum alerta no momento".

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/NotificationBell.tsx frontend/src/components/Topbar.tsx
git commit -m "feat(topbar): popover de alertas no icone Sino"
```

---

## Self-review (cobertura da spec)

- 3 alertas de status → Task 1 ✓ · Modalidades sem regra → Task 2 ✓ · Popover/badge/navegação/fechar → Task 3 ✓ · `useQueries` + staleTime → Task 3 ✓ · funções puras testadas → Tasks 1-2 ✓.
- `NotificationBell` usa hooks de react-query, então não é testado via `renderToStaticMarkup` (precisaria de QueryClientProvider) — validação por testes das funções puras + tsc/build + verificação manual.
