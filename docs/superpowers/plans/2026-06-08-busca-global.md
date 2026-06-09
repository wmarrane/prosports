# Busca Global (⌘K) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar funcionalidade ao campo de busca do Topbar: um command palette (⌘K) que filtra e navega por Eventos, Modalidades e Competições (client-side).

**Architecture:** Função pura de filtro (`frontend/src/lib/command-palette.ts`) testável; componente `CommandPalette` (overlay modal) consome `eventos/modalidades/competicoes` via react-query (já cacheados), filtra com a função pura e navega no Enter/clique. O Topbar abre o palette pelo campo de busca e por atalho global ⌘K/Ctrl+K.

**Tech Stack:** React 18, react-query, react-router, Vitest. Spec: `docs/superpowers/specs/2026-06-08-busca-global-design.md`.

---

## File Structure

- `frontend/src/lib/command-palette.ts` — `normalize`, `filterEntities`, tipos `PaletteItem`/`PaletteResults` (puro).
- `frontend/src/lib/command-palette.test.ts` — testes Vitest.
- `frontend/src/components/CommandPalette.tsx` — overlay + input + resultados + teclado + navegação.
- `frontend/src/components/Topbar.tsx` — campo de busca abre o palette; listener global ⌘K/Ctrl+K.

---

## Task 1: `filterEntities` + `normalize` (lógica pura)

**Files:**
- Create: `frontend/src/lib/command-palette.ts`
- Test: `frontend/src/lib/command-palette.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/src/lib/command-palette.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { normalize, filterEntities } from './command-palette'

const data = {
  eventos: [{ id: 1, nome: 'Jogos Regionais de Campinas' }, { id: 2, nome: 'Copa São Paulo' }],
  modalidades: [
    { id: 10, nome: 'Judô Feminino Livre', sigla: 'JFL' },
    { id: 11, nome: 'Futsal Masculino', sigla: 'FUT' },
  ],
  competicoes: [{ id: 20, nome: 'Jogos Regionais' }],
}

describe('normalize', () => {
  it('remove acento e caixa', () => {
    expect(normalize('São Judô')).toBe('sao judo')
  })
})

describe('filterEntities', () => {
  it('query vazia retorna grupos vazios', () => {
    expect(filterEntities('  ', data)).toEqual({ eventos: [], modalidades: [], competicoes: [] })
  })

  it('casa evento por nome (acento-insensitive) e monta rota', () => {
    const r = filterEntities('sao paulo', data)
    expect(r.eventos).toEqual([{ id: 2, label: 'Copa São Paulo', to: '/eventos/2/inscricoes' }])
  })

  it('casa modalidade por nome e por sigla', () => {
    expect(filterEntities('judo', data).modalidades.map(m => m.id)).toEqual([10])
    const porSigla = filterEntities('jfl', data).modalidades
    expect(porSigla).toEqual([{ id: 10, label: 'Judô Feminino Livre', sublabel: 'JFL', to: '/modalidades/10/editar' }])
  })

  it('casa competição por nome e monta rota de editar', () => {
    expect(filterEntities('regionais', data).competicoes).toEqual([
      { id: 20, label: 'Jogos Regionais', to: '/competicoes/20/editar' },
    ])
  })

  it('limita a 6 por grupo', () => {
    const many = { eventos: Array.from({ length: 9 }, (_, i) => ({ id: i, nome: `Evento ${i}` })), modalidades: [], competicoes: [] }
    expect(filterEntities('evento', many).eventos).toHaveLength(6)
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd frontend && npx vitest run src/lib/command-palette.test.ts`
Expected: FAIL — `normalize`/`filterEntities` não existem.

- [ ] **Step 3: Implementar**

Criar `frontend/src/lib/command-palette.ts`:

```ts
export type PaletteItem = { id: number; label: string; sublabel?: string; to: string }
export type PaletteResults = { eventos: PaletteItem[]; modalidades: PaletteItem[]; competicoes: PaletteItem[] }

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

const LIMIT = 6

type EventoLite = { id: number; nome: string }
type ModalidadeLite = { id: number; nome: string; sigla: string }
type CompeticaoLite = { id: number; nome: string }

export function filterEntities(
  query: string,
  data: { eventos: EventoLite[]; modalidades: ModalidadeLite[]; competicoes: CompeticaoLite[] },
): PaletteResults {
  const q = normalize(query)
  if (!q) return { eventos: [], modalidades: [], competicoes: [] }

  const eventos = data.eventos
    .filter(e => normalize(e.nome).includes(q))
    .slice(0, LIMIT)
    .map(e => ({ id: e.id, label: e.nome, to: `/eventos/${e.id}/inscricoes` }))

  const modalidades = data.modalidades
    .filter(m => normalize(m.nome).includes(q) || normalize(m.sigla).includes(q))
    .slice(0, LIMIT)
    .map(m => ({ id: m.id, label: m.nome, sublabel: m.sigla, to: `/modalidades/${m.id}/editar` }))

  const competicoes = data.competicoes
    .filter(c => normalize(c.nome).includes(q))
    .slice(0, LIMIT)
    .map(c => ({ id: c.id, label: c.nome, to: `/competicoes/${c.id}/editar` }))

  return { eventos, modalidades, competicoes }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/lib/command-palette.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/command-palette.ts frontend/src/lib/command-palette.test.ts
git commit -m "feat(busca): filterEntities + normalize (command palette)"
```

---

## Task 2: Componente `CommandPalette` + integração no Topbar

**Files:**
- Create: `frontend/src/components/CommandPalette.tsx`
- Modify: `frontend/src/components/Topbar.tsx:71-75` (campo de busca) + listener ⌘K

- [ ] **Step 1: Criar o componente**

Criar `frontend/src/components/CommandPalette.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search } from '../lib/icons'
import { eventosService } from '../services/eventos'
import { modalidadesService } from '../services/modalidades'
import { competicoesService } from '../services/competicoes'
import { filterEntities, type PaletteItem } from '../lib/command-palette'

type Props = { open: boolean; onClose: () => void }

const GROUP_LABEL: Record<string, string> = { eventos: 'Eventos', modalidades: 'Modalidades', competicoes: 'Competições' }

export default function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: eventos = [] } = useQuery({ queryKey: ['eventos'], queryFn: () => eventosService.listar(), enabled: open })
  const { data: modalidades = [] } = useQuery({ queryKey: ['modalidades'], queryFn: () => modalidadesService.listar(), enabled: open })
  const { data: competicoes = [] } = useQuery({ queryKey: ['competicoes'], queryFn: () => competicoesService.listar(), enabled: open })

  const results = useMemo(
    () => filterEntities(q, {
      eventos: eventos.map(e => ({ id: e.id, nome: e.nome })),
      modalidades: modalidades.map(m => ({ id: m.id, nome: m.nome, sigla: m.sigla })),
      competicoes: competicoes.map(c => ({ id: c.id, nome: c.nome })),
    }),
    [q, eventos, modalidades, competicoes],
  )

  // Lista achatada para navegação por teclado (preserva ordem dos grupos)
  const flat = useMemo<Array<{ group: keyof typeof results; item: PaletteItem }>>(() => [
    ...results.eventos.map(item => ({ group: 'eventos' as const, item })),
    ...results.modalidades.map(item => ({ group: 'modalidades' as const, item })),
    ...results.competicoes.map(item => ({ group: 'competicoes' as const, item })),
  ], [results])

  useEffect(() => { setSel(0) }, [q])
  useEffect(() => { if (open) { setQ(''); setSel(0); setTimeout(() => inputRef.current?.focus(), 0) } }, [open])

  if (!open) return null

  function go(item: PaletteItem) { onClose(); navigate(item.to) }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, Math.max(flat.length - 1, 0))); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); return }
    if (e.key === 'Enter') { e.preventDefault(); const f = flat[sel]; if (f) go(f.item); return }
  }

  let runningIndex = -1

  return (
    <div
      role="dialog"
      aria-label="Busca global"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 80, paddingTop: '12vh',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        onKeyDown={onKeyDown}
        style={{
          width: 'min(620px, 92vw)', background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-card)', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--card-border)' }}>
          <Search size={18} style={{ color: 'var(--t3)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar eventos, modalidades, competições..."
            aria-label="Busca global"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--t1)', fontSize: 15 }}
          />
        </div>

        <div style={{ maxHeight: 420, overflowY: 'auto', padding: 8 }}>
          {q.trim() === '' ? (
            <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--t3)' }}>Digite para buscar eventos, modalidades, competições…</div>
          ) : flat.length === 0 ? (
            <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--t3)' }}>Nenhum resultado para "{q}".</div>
          ) : (
            (['eventos', 'modalidades', 'competicoes'] as const).map(group => (
              results[group].length === 0 ? null : (
                <div key={group}>
                  <div style={{ padding: '8px 10px 4px', fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {GROUP_LABEL[group]}
                  </div>
                  {results[group].map(item => {
                    runningIndex += 1
                    const active = runningIndex === sel
                    return (
                      <button
                        key={`${group}-${item.id}`}
                        onClick={() => go(item)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                          padding: '8px 10px', borderRadius: 'var(--radius-md)', color: 'var(--t1)',
                          background: active ? 'var(--card-bg-2)' : 'transparent',
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</span>
                        {item.sublabel && <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>{item.sublabel}</span>}
                      </button>
                    )
                  })}
                </div>
              )
            ))
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Integrar no Topbar**

Em `frontend/src/components/Topbar.tsx`:

(a) imports (topo): adicionar
```tsx
import { useState, useEffect } from 'react'
import CommandPalette from './CommandPalette'
```
(observação: se já houver outros imports de `react`, apenas garanta `useState`/`useEffect` disponíveis.)

(b) dentro do componente `Topbar`, adicionar estado e o listener global ⌘K/Ctrl+K:
```tsx
  const [paletteOpen, setPaletteOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
```

(c) transformar o campo de busca (linhas 71-75) num gatilho que abre o palette:
```tsx
      <button type="button" className="search" onClick={() => setPaletteOpen(true)} title="Buscar (Ctrl+K)" style={{ cursor: 'pointer' }}>
        <Search size={15} />
        <span style={{ flex: 1, textAlign: 'left', color: 'var(--t4)' }}>Buscar eventos, modalidades, competições...</span>
        <span className="kbd">⌘K</span>
      </button>
```

(d) renderizar o palette antes do fechamento do `</div>` raiz do Topbar:
```tsx
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
```

(observação: o `.search` é estilizado como container flex; usá-lo num `<button>` mantém o visual. Se algum estilo do CSS `.search input` for necessário, manter o `<span>` com a classe não é preciso — o placeholder textual já cobre.)

- [ ] **Step 3: Verificar tipos e build**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros novos citando `CommandPalette.tsx` / `Topbar.tsx`.

Run: `cd frontend && npm run build`
Expected: build conclui sem erros.

- [ ] **Step 4: Verificação manual no navegador**

- `Ctrl+K` (ou clicar no campo de busca) abre o overlay com foco no input.
- Digitar filtra Eventos/Modalidades/Competições (acento-insensitive; modalidade casa por sigla).
- `↑/↓` movem a seleção, `Enter` navega para o item; clicar também navega; `Esc`/clicar fora fecham.
- Query vazia mostra a dica; sem resultado mostra "Nenhum resultado".

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CommandPalette.tsx frontend/src/components/Topbar.tsx
git commit -m "feat(topbar): command palette de busca global (Ctrl+K)"
```

---

## Notas de ordenação

- Os dois planos (este e o de Alertas no Sino) modificam `Topbar.tsx` em regiões diferentes (campo de busca vs botão do Sino). Se ambos forem executados, aplicar um, depois o outro — os trechos não colidem.

## Self-review (cobertura da spec)

- Entidades eventos/modalidades/competições → Task 1 ✓ · filtro acento/caixa-insensitive + sigla só modalidade → Task 1 ✓ · limite 6 → Task 1 ✓ · rotas de navegação → Task 1 ✓ · ⌘K/Ctrl+K + clique no campo → Task 2 ✓ · teclado ↑/↓/Enter/Esc + clicar fora → Task 2 ✓ · estados vazio/sem-resultado → Task 2 ✓.
- `CommandPalette` usa react-query → não testado via `renderToStaticMarkup`; validação por testes da função pura + tsc/build + verificação manual.
