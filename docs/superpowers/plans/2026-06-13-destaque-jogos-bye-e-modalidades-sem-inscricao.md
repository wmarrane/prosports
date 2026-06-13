# Destaque de jogos com bye + modalidades sem inscrição — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Destacar com âmbar suave os jogos com bye em todas as visualizações de chaves (admin + site público) e sinalizar (cor de linha + selo) as modalidades sem inscrição na lista lateral do evento.

**Architecture:** Frontend-only. Uma função pura testável detecta bye a partir das refs de slot do bracket; os três renderizadores de chaves (`BracketTree`, `MatchCard` legado e a lista vertical, todos em `SorteioChaves.tsx`/`BracketTree.tsx`) aplicam o realce. O site público reusa esses componentes, então herda o efeito (após republicar). A lista de modalidades em `EventoInscricoes.tsx` ganha realce condicional quando a contagem de inscritos é zero.

**Tech Stack:** React 18, TypeScript, Vite, Vitest. Tokens de cor `--warn-soft`/`--warn`/`--warn-700` (admin) e `--warn-soft` (site; este plano adiciona `--warn` ao tema do site).

**Validação obrigatória:** além de `npm run test`, rodar `npm run build` (CI usa `tsc -b && vite build`). Comandos rodam em `C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend`.

**Spec:** `docs/superpowers/specs/2026-06-13-destaque-jogos-bye-e-modalidades-sem-inscricao-design.md`

**Git:** identidade NÃO configurada — commitar com identidade inline (NÃO rodar `git config`): `git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit ...`. Não pular hooks.

---

## File Structure

- **Create** `frontend/src/lib/bye-chaves.ts` — funções puras `isByeRef`, `matchIsBye`. Única responsabilidade: detectar bye a partir de refs de slot.
- **Create** `frontend/src/lib/bye-chaves.test.ts` — testes Vitest das funções puras.
- **Modify** `frontend/src/components/sorteio-result/BracketTree.tsx` — realce âmbar nos cards de jogo com bye.
- **Modify** `frontend/src/components/sorteio-result/SorteioChaves.tsx` — realce no `MatchCard` legado (rodada 0) e nas linhas de bye da lista vertical.
- **Modify** `frontend/src/site-publico/theme-vars.css` — adicionar token `--warn` (para a borda âmbar funcionar no site público).
- **Modify** `frontend/src/pages/eventos/EventoInscricoes.tsx` — realce + selo nas modalidades sem inscrição.

---

## Task 1: Helper puro de detecção de bye

**Files:**
- Create: `frontend/src/lib/bye-chaves.ts`
- Test: `frontend/src/lib/bye-chaves.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/bye-chaves.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isByeRef, matchIsBye } from './bye-chaves'

describe('isByeRef', () => {
  const slots = [10, null, 30] // P1=10, P2=vazio, P3=30

  it('ref literal BYE é bye', () => {
    expect(isByeRef('BYE', slots)).toBe(true)
  })
  it('P{n} apontando para slot nulo é bye', () => {
    expect(isByeRef('P2', slots)).toBe(true)
  })
  it('P{n} apontando para slot preenchido não é bye', () => {
    expect(isByeRef('P1', slots)).toBe(false)
    expect(isByeRef('P3', slots)).toBe(false)
  })
  it('refs de vencedor/perdedor não são bye', () => {
    expect(isByeRef('V:J1', slots)).toBe(false)
    expect(isByeRef('L:J2', slots)).toBe(false)
  })
  it('P{n} fora do range é bye (slot inexistente = nulo)', () => {
    expect(isByeRef('P9', slots)).toBe(true)
  })
})

describe('matchIsBye', () => {
  const slots = [10, null, 30, 40]

  it('bye no top', () => {
    expect(matchIsBye({ top: 'P2', bottom: 'P1' }, slots)).toBe(true)
  })
  it('bye no bottom (BYE literal)', () => {
    expect(matchIsBye({ top: 'P1', bottom: 'BYE' }, slots)).toBe(true)
  })
  it('sem bye', () => {
    expect(matchIsBye({ top: 'P1', bottom: 'P3' }, slots)).toBe(false)
  })
  it('match entre vencedores não é bye', () => {
    expect(matchIsBye({ top: 'V:J1', bottom: 'V:J2' }, slots)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- bye-chaves`
Expected: FAIL (módulo `./bye-chaves` não existe).

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/lib/bye-chaves.ts`:

```ts
export function isByeRef(ref: string, slots: (number | null)[]): boolean {
  if (ref === 'BYE') return true
  if (ref.startsWith('P')) {
    const pos = parseInt(ref.slice(1), 10)
    if (!Number.isFinite(pos)) return false
    return (slots[pos - 1] ?? null) === null
  }
  return false
}

export function matchIsBye(
  match: { top: string; bottom: string },
  slots: (number | null)[],
): boolean {
  return isByeRef(match.top, slots) || isByeRef(match.bottom, slots)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- bye-chaves`
Expected: PASS (todos os casos das duas suítes).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/bye-chaves.ts frontend/src/lib/bye-chaves.test.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(chaves): helper puro de deteccao de jogo com bye"
```

---

## Task 2: Realce dos jogos com bye nas três visualizações de chaves

**Files:**
- Modify: `frontend/src/components/sorteio-result/BracketTree.tsx`
- Modify: `frontend/src/components/sorteio-result/SorteioChaves.tsx`
- Modify: `frontend/src/site-publico/theme-vars.css`

Contexto: `SorteioChaves.tsx` escolhe entre `BracketTree` (matchesGraph), `MatchCard` legado (sem `byePositions`) e a lista vertical (com `byePositions`). O site público usa `SorteioChaves` → herda. Token `--warn-soft` já existe no admin (`tokens.css`) e no site (`theme-vars.css`); `--warn` existe só no admin — por isso adicionamos `--warn` ao site.

- [ ] **Step 1: Add `--warn` ao tema do site público**

Em `frontend/src/site-publico/theme-vars.css`, logo após a linha `  --warn-soft:   rgba(245,158,11,0.16);` (linha 84), adicionar:

```css
  --warn:        #f59e0b;
```

(Necessário para a borda âmbar dos cards de bye renderizar no site público; o admin já define `--warn` em `tokens.css`.)

- [ ] **Step 2: BracketTree — realçar cards de bye**

Em `frontend/src/components/sorteio-result/BracketTree.tsx`:

Adicionar o import (após a linha `import AnfitriaoBadge from '../AnfitriaoBadge'`):
```ts
import { matchIsBye } from '../../lib/bye-chaves'
```

No `layout.matches.map(m => (...))` (começa na linha ~275), substituir o `<div>` do card. Trocar:
```tsx
        {layout.matches.map(m => (
          <div
            key={m.id}
            className={`bg-[var(--card-bg-2)] rounded-lg ${m.isFinal ? 'border-amber-500' : ''}`}
            onClick={onMatchClick ? () => onMatchClick(m.id) : undefined}
            title={onMatchClick ? 'Clique para expandir' : undefined}
            style={{
              position: 'absolute',
              left: m.x,
              top: m.y - CARD_HEIGHT / 2,
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              padding: 6,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              border: m.isFinal ? '2px solid #f59e0b' : '1.5px solid var(--t2)',
              cursor: onMatchClick ? 'pointer' : 'default',
            }}
          >
```
Por:
```tsx
        {layout.matches.map(m => {
          const bye = matchIsBye(m, slots)
          return (
          <div
            key={m.id}
            className={`bg-[var(--card-bg-2)] rounded-lg ${m.isFinal ? 'border-amber-500' : ''}`}
            onClick={onMatchClick ? () => onMatchClick(m.id) : undefined}
            title={onMatchClick ? 'Clique para expandir' : undefined}
            style={{
              position: 'absolute',
              left: m.x,
              top: m.y - CARD_HEIGHT / 2,
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              padding: 6,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              background: bye ? 'var(--warn-soft)' : undefined,
              border: m.isFinal ? '2px solid #f59e0b' : bye ? '1.5px solid var(--warn)' : '1.5px solid var(--t2)',
              cursor: onMatchClick ? 'pointer' : 'default',
            }}
          >
```

E, no fim desse bloco do `.map`, fechar a função de seta com `)`. Trocar:
```tsx
            {!m.id.startsWith('B') && (
              <div style={{ position: 'absolute', top: 2, right: 4, fontSize: '0.65rem', color: 'var(--t4)' }}>{m.id}</div>
            )}
          </div>
        ))}
```
Por:
```tsx
            {!m.id.startsWith('B') && (
              <div style={{ position: 'absolute', top: 2, right: 4, fontSize: '0.65rem', color: 'var(--t4)' }}>{m.id}</div>
            )}
          </div>
          )
        })}
```

(Nota: `background: bye ? 'var(--warn-soft)' : undefined` — quando não-bye, `undefined` deixa a classe `bg-[var(--card-bg-2)]` valer. Card que é Final E bye mantém a borda âmbar da Final, mas com fundo âmbar-soft.)

- [ ] **Step 3: SorteioChaves — realçar `MatchCard` legado (rodada 0)**

Em `frontend/src/components/sorteio-result/SorteioChaves.tsx`:

(a) No tipo `MatchCardProps` (linha ~100), adicionar o campo `isBye`:
```ts
type MatchCardProps = {
  match: Match
  large: boolean
  participantesById: Map<number, Participante>
  campeoesByParticipanteId?: Map<number, number>
  anfitriaoPid?: number | null
  topFallback?: string
  bottomFallback?: string
  subtituloLine?: (p: Participante) => string | null
  isBye?: boolean
}
```

(b) Na assinatura e no `<div>` raiz do `MatchCard` (linha ~111), passar a usar `isBye`. Trocar:
```tsx
function MatchCard({ match, large, participantesById, campeoesByParticipanteId, anfitriaoPid, topFallback, bottomFallback, subtituloLine }: MatchCardProps) {
  return (
    <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg" style={{ padding: large ? 12 : 8 }}>
```
Por:
```tsx
function MatchCard({ match, large, participantesById, campeoesByParticipanteId, anfitriaoPid, topFallback, bottomFallback, subtituloLine, isBye }: MatchCardProps) {
  return (
    <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg" style={{ padding: large ? 12 : 8, background: isBye ? 'var(--warn-soft)' : undefined, borderColor: isBye ? 'var(--warn)' : undefined }}>
```

(c) Na chamada do `MatchCard` dentro do fallback legado (linha ~166-173), passar `isBye`. Trocar:
```tsx
              <MatchCard key={match.id} match={match} large={large}
                participantesById={participantesById} campeoesByParticipanteId={campeoesByParticipanteId}
                anfitriaoPid={anfitriaoPid}
                topFallback={r === 0 ? 'BYE' : `Vencedor M${match.index * 2 + 1}`}
                bottomFallback={r === 0 ? 'BYE' : `Vencedor M${match.index * 2 + 2}`}
                subtituloLine={subtituloLine}
              />
```
Por:
```tsx
              <MatchCard key={match.id} match={match} large={large}
                participantesById={participantesById} campeoesByParticipanteId={campeoesByParticipanteId}
                anfitriaoPid={anfitriaoPid}
                topFallback={r === 0 ? 'BYE' : `Vencedor M${match.index * 2 + 1}`}
                bottomFallback={r === 0 ? 'BYE' : `Vencedor M${match.index * 2 + 2}`}
                subtituloLine={subtituloLine}
                isBye={r === 0 && ((match.top === null) !== (match.bottom === null))}
              />
```

(XOR: exatamente um lado nulo na rodada 0 = jogo com bye.)

- [ ] **Step 4: SorteioChaves — realçar linhas de bye na lista vertical**

Em `frontend/src/components/sorteio-result/SorteioChaves.tsx`, no render da lista vertical (v1.18.1), o `<li>` (linha ~204). Trocar:
```tsx
          return (
            <li key={pos} className="flex items-center gap-3">
```
Por:
```tsx
          return (
            <li
              key={pos}
              className="flex items-center gap-3"
              style={isBye ? { background: 'var(--warn-soft)', border: '1px solid var(--warn)', borderRadius: 8, padding: '2px 8px' } : undefined}
            >
```

(`isBye` já é calculado na linha ~199: `const isBye = byeSet.has(pos)`.)

- [ ] **Step 5: Build + testes (regressão)**

Run: `npm run build`
Expected: PASS (`tsc -b && vite build`, sem erros de tipo).

Run: `npm run test`
Expected: PASS (suíte inteira, incluindo `bye-chaves`).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/sorteio-result/BracketTree.tsx frontend/src/components/sorteio-result/SorteioChaves.tsx frontend/src/site-publico/theme-vars.css
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(chaves): destacar jogos com bye em ambar (bracket, legado, lista, site)"
```

---

## Task 3: Sinalizar modalidades sem inscrição na lista do evento

**Files:**
- Modify: `frontend/src/pages/eventos/EventoInscricoes.tsx`

Contexto: a lista lateral de modalidades renderiza um `<button>` por modalidade (linhas ~514-584). `active = m.id === modalidadeId`; a contagem vem de `countsByModalidade[m.id] ?? 0`. Hoje o fundo é `active ? 'var(--brand-50)' : 'transparent'`, com hover trocando para `var(--card-bg-2)` quando não-ativo, e um badge de contagem neutro.

- [ ] **Step 1: Substituir o bloco do `<button>` da modalidade**

Em `frontend/src/pages/eventos/EventoInscricoes.tsx`, trocar exatamente este bloco (linhas ~514-584):

```tsx
                  return (
                    <button
                      key={m.id}
                      onClick={() => { setModalidadeId(m.id); setErroSorteio('') }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-lg)',
                        background: active ? 'var(--brand-50)' : 'transparent',
                        border: `1px solid ${active ? 'var(--brand-500)' : 'transparent'}`,
                        color: 'var(--t1)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 120ms ease',
                        width: '100%',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--card-bg-2)' }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                    >
                      <span
                        style={{
                          width: 32, height: 32, borderRadius: 9,
                          background: grad, color: '#fff',
                          display: 'grid', placeItems: 'center', flexShrink: 0,
                        }}
                      >
                        <Icon size={16} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{m.nome}</div>
                        <div
                          className="text-[var(--t4)] mt-0.5"
                          style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}
                        >
                          {m.sigla}
                        </div>
                      </div>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-pill)',
                          background: 'var(--card-bg-2)',
                          color: 'var(--t2)',
                          fontSize: 11,
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                        title={`${countsByModalidade[m.id] ?? 0} inscrito(s)`}
                      >
                        <Users size={11} /> {countsByModalidade[m.id] ?? 0}
                      </span>
                      {sorteada && (
                        <span
                          style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: 'var(--success)', color: '#fff',
                            display: 'grid', placeItems: 'center', flexShrink: 0,
                          }}
                          title="Sorteada"
                        >
                          <Check size={13} />
                        </span>
                      )}
                    </button>
                  )
```

Por:

```tsx
                  const semInscricao = (countsByModalidade[m.id] ?? 0) === 0
                  return (
                    <button
                      key={m.id}
                      onClick={() => { setModalidadeId(m.id); setErroSorteio('') }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-lg)',
                        background: active ? 'var(--brand-50)' : semInscricao ? 'var(--warn-soft)' : 'transparent',
                        border: `1px solid ${active ? 'var(--brand-500)' : semInscricao ? 'var(--warn)' : 'transparent'}`,
                        color: 'var(--t1)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 120ms ease',
                        width: '100%',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--card-bg-2)' }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = semInscricao ? 'var(--warn-soft)' : 'transparent' }}
                    >
                      <span
                        style={{
                          width: 32, height: 32, borderRadius: 9,
                          background: grad, color: '#fff',
                          display: 'grid', placeItems: 'center', flexShrink: 0,
                        }}
                      >
                        <Icon size={16} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{m.nome}</div>
                        <div
                          className="text-[var(--t4)] mt-0.5"
                          style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}
                        >
                          {m.sigla}
                        </div>
                        {semInscricao && (
                          <span
                            style={{
                              display: 'inline-block', marginTop: 4, padding: '2px 6px',
                              borderRadius: 'var(--radius-pill)',
                              background: 'var(--warn-soft)', color: 'var(--warn-700)',
                              border: '1px solid var(--warn)', fontSize: 10, fontWeight: 700,
                            }}
                          >Sem inscritos</span>
                        )}
                      </div>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-pill)',
                          background: semInscricao ? 'var(--warn-soft)' : 'var(--card-bg-2)',
                          color: semInscricao ? 'var(--warn-700)' : 'var(--t2)',
                          fontSize: 11,
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                        title={`${countsByModalidade[m.id] ?? 0} inscrito(s)`}
                      >
                        <Users size={11} /> {countsByModalidade[m.id] ?? 0}
                      </span>
                      {sorteada && (
                        <span
                          style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: 'var(--success)', color: '#fff',
                            display: 'grid', placeItems: 'center', flexShrink: 0,
                          }}
                          title="Sorteada"
                        >
                          <Check size={13} />
                        </span>
                      )}
                    </button>
                  )
```

- [ ] **Step 2: Build + testes (regressão)**

Run: `npm run build`
Expected: PASS (`tsc -b && vite build`, sem erros).

Run: `npm run test`
Expected: PASS (suíte inteira).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/eventos/EventoInscricoes.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(eventos): sinalizar modalidades sem inscricao na lista do evento"
```

---

## Manual Test Checklist (após as 3 tasks)

`npm run dev` e validar:

- **Chaves (admin):** abrir um evento sorteado de tipo chaves com bye. No bracket gráfico (BracketTree), o(s) card(s) de jogo com bye aparecem com fundo âmbar e borda âmbar; os demais jogos, inalterados; a Final (se também for bye) mantém a borda amber. Verificar também um sorteio legado (sem `byePositions`, render em colunas) e um sorteio v1.18.1 (lista vertical) — as linhas/cards de bye ficam âmbar.
- **Site público:** publicar um evento sorteado com bye e conferir o card de bye âmbar no site.
- **Modalidades sem inscrição:** abrir um evento com pelo menos uma modalidade sem inscritos. Na lista lateral, ela aparece com fundo/borda âmbar, selo "Sem inscritos" e contador "0" em alerta. Selecioná-la mantém o destaque azul de seleção, mas o selo e o contador em alerta continuam. Modalidades com inscritos permanecem neutras.

---

## Self-Review

**1. Spec coverage:**
- Helper puro de detecção de bye (isByeRef/matchIsBye) → Task 1. ✓
- Realce âmbar em BracketTree, MatchCard legado, lista vertical → Task 2 (steps 2-4). ✓
- Token `--warn` no site público para a borda → Task 2 step 1. ✓ (`--warn-soft` já existe em ambos.)
- Modalidades sem inscrição: fundo/borda âmbar + selo "Sem inscritos" + contador em alerta; seleção mantém azul → Task 3. ✓
- Casos: sem bye → nada realçado (background undefined deixa estilo atual); ref V:/L: → matchIsBye false (testado). ✓

**2. Placeholder scan:** Sem TBD/TODO; todo passo de código tem bloco completo. ✓

**3. Type consistency:** `isByeRef(ref: string, slots: (number|null)[])` e `matchIsBye(match: {top:string;bottom:string}, slots)` consistentes entre Task 1 (def) e Task 2 (uso: `matchIsBye(m, slots)` — `m` tem `top`/`bottom: string` no tipo `MatchLayout`; `slots` é `(number|null)[]` na prop de BracketTree). `MatchCardProps.isBye?: boolean` definido e passado. `semInscricao: boolean` local. ✓
