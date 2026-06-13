# Melhorias: sino com mensagens lidas + bloco "Sorteados" recolhível — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir marcar alertas do sino como lidos (aba Novas/Lidas, badge só conta não lidas, últimas 10 lidas persistidas) e transformar a seção "Sorteados" da lista de eventos em um bloco recolhível (recolhido por padrão).

**Architecture:** Frontend-only. Os alertas continuam derivados em tempo de render; as "lidas" viram snapshots persistidos em `localStorage` via um helper puro testável (`aplicarLida`). O `NotificationBell` filtra novas vs lidas por id. Em `EventosList`, a seção "Sorteados" ganha cabeçalho clicável com estado persistido em `sessionStorage`.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, lucide-react (ChevronDown).

**Validação obrigatória:** além de `npm run test`, rodar `npm run build` (o CI usa `tsc -b && vite build`; `tsc --noEmit` pode passar e o build falhar). Todos os comandos rodam em `C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend`.

**Spec:** `docs/superpowers/specs/2026-06-13-melhorias-sino-lidas-e-sorteados-recolhivel-design.md`

---

## File Structure

- **Create** `frontend/src/lib/alertas-lidas.ts` — tipo `AlertaLido` + funções puras `aplicarLida`, `carregarLidas`, `salvarLidas`. Única responsabilidade: regra e persistência das lidas.
- **Create** `frontend/src/lib/alertas-lidas.test.ts` — testes da função pura `aplicarLida`.
- **Modify** `frontend/src/components/NotificationBell.tsx` — abas Novas/Lidas, badge só de não lidas, marcar como lida, marcar todas.
- **Modify** `frontend/src/pages/eventos/EventosList.tsx` — bloco "Sorteados" recolhível com estado em `sessionStorage`.

---

## Task 1: Helper puro de mensagens lidas (`alertas-lidas.ts`)

**Files:**
- Create: `frontend/src/lib/alertas-lidas.ts`
- Test: `frontend/src/lib/alertas-lidas.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/alertas-lidas.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { aplicarLida } from './alertas-lidas'
import type { Alerta } from './alertas'

const alerta = (id: string, titulo = 'T'): Alerta => ({
  id,
  tipo: 'pronto',
  titulo,
  descricao: 'desc',
  to: `/x/${id}`,
})

describe('aplicarLida', () => {
  it('adiciona a lida no topo com lidaEm preenchido', () => {
    const agora = new Date('2026-06-13T10:00:00.000Z')
    const out = aplicarLida([], alerta('a'), agora)
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('a')
    expect(out[0].lidaEm).toBe('2026-06-13T10:00:00.000Z')
    expect(out[0].to).toBe('/x/a')
  })

  it('dedupe por id: re-marcar move ao topo sem duplicar', () => {
    const t1 = new Date('2026-06-13T10:00:00.000Z')
    const t2 = new Date('2026-06-13T11:00:00.000Z')
    let lidas = aplicarLida([], alerta('a'), t1)
    lidas = aplicarLida(lidas, alerta('b'), t1)
    lidas = aplicarLida(lidas, alerta('a', 'novo titulo'), t2)
    expect(lidas.map(l => l.id)).toEqual(['a', 'b'])
    expect(lidas[0].titulo).toBe('novo titulo')
    expect(lidas[0].lidaEm).toBe('2026-06-13T11:00:00.000Z')
  })

  it('cap em 10: o 11o empurra o mais antigo para fora', () => {
    let lidas: ReturnType<typeof aplicarLida> = []
    for (let i = 1; i <= 11; i++) {
      lidas = aplicarLida(lidas, alerta(`id${i}`), new Date(`2026-06-13T10:${String(i).padStart(2, '0')}:00.000Z`))
    }
    expect(lidas).toHaveLength(10)
    expect(lidas[0].id).toBe('id11')
    expect(lidas.find(l => l.id === 'id1')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- alertas-lidas`
Expected: FAIL (não consegue importar `aplicarLida` — módulo não existe).

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/lib/alertas-lidas.ts`:

```ts
import type { Alerta } from './alertas'

export type AlertaLido = Alerta & { lidaEm: string }

const KEY = 'prosports.notif.lidas'
const CAP = 10

export function aplicarLida(lidas: AlertaLido[], alerta: Alerta, agora?: Date): AlertaLido[] {
  const lidaEm = (agora ?? new Date()).toISOString()
  const semDuplicata = lidas.filter(l => l.id !== alerta.id)
  return [{ ...alerta, lidaEm }, ...semDuplicata].slice(0, CAP)
}

export function carregarLidas(): AlertaLido[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (l): l is AlertaLido =>
        l && typeof l.id === 'string' && typeof l.to === 'string' && typeof l.lidaEm === 'string',
    )
  } catch {
    return []
  }
}

export function salvarLidas(lidas: AlertaLido[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(lidas))
  } catch {
    /* storage indisponível — ignora */
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- alertas-lidas`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/alertas-lidas.ts frontend/src/lib/alertas-lidas.test.ts
git commit -m "feat(notif): helper puro de mensagens lidas (aplicarLida + persistencia)"
```

---

## Task 2: NotificationBell com abas Novas/Lidas

**Files:**
- Modify: `frontend/src/components/NotificationBell.tsx`

Contexto do arquivo atual: os alertas vêm de `alertas` (useMemo, linha ~53). O badge usa `alertas.length` (linha ~94/101). O dropdown tem um título "Alertas (N)" e renderiza `alertas.map(...)` como botões que chamam `goTo(a.to)`. Vamos: (a) introduzir estado `lidas`; (b) derivar `novas`; (c) badge = `novas.length`; (d) duas abas; (e) marcar como lida ao clicar numa nova + botão "marcar todas".

- [ ] **Step 1: Add imports and state**

Em `frontend/src/components/NotificationBell.tsx`, o import do React (linha 1) já traz `useEffect, useMemo, useRef, useState` — não precisa mudar. Adicionar o import do helper logo após a linha `import { deriveEventoAlerts, deriveSemRegraAlerts } from '../lib/alertas'`:
```ts
import { aplicarLida, carregarLidas, salvarLidas, type AlertaLido } from '../lib/alertas-lidas'
```

Dentro do componente, logo após `const [open, setOpen] = useState(false)` (linha ~16), adicionar:
```ts
  const [aba, setAba] = useState<'novas' | 'lidas'>('novas')
  const [lidas, setLidas] = useState<AlertaLido[]>(() => carregarLidas())
```

- [ ] **Step 2: Derive novas e helpers de leitura**

Logo após o `useMemo` que calcula `alertas` (termina na linha ~72, `}, [eventos, ...])`), adicionar:

```ts
  const lidasIds = useMemo(() => new Set(lidas.map(l => l.id)), [lidas])
  const novas = useMemo(() => alertas.filter(a => !lidasIds.has(a.id)), [alertas, lidasIds])

  function marcarLida(a: { id: string; tipo: any; titulo: string; descricao: string; to: string }) {
    setLidas(prev => { const next = aplicarLida(prev, a); salvarLidas(next); return next })
  }
  function marcarTodas() {
    setLidas(prev => {
      let next = prev
      for (const a of novas) next = aplicarLida(next, a)
      salvarLidas(next)
      return next
    })
  }
```

- [ ] **Step 3: Update badge to count only novas**

Trocar (linhas ~94-102):
```tsx
        {alertas.length > 0 && (
          <span
            style={{
              position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, padding: '0 4px',
              borderRadius: 9999, background: 'var(--danger)', color: '#fff',
              fontSize: 10, fontWeight: 700, lineHeight: '16px', textAlign: 'center',
            }}
          >{alertas.length}</span>
        )}
```
Por:
```tsx
        {novas.length > 0 && (
          <span
            style={{
              position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, padding: '0 4px',
              borderRadius: 9999, background: 'var(--danger)', color: '#fff',
              fontSize: 10, fontWeight: 700, lineHeight: '16px', textAlign: 'center',
            }}
          >{novas.length}</span>
        )}
```

- [ ] **Step 4: Replace dropdown content with tabs**

Trocar todo o bloco interno do dropdown — do `<div style={{ padding: '6px 10px', ...`  (linha ~115) até o fechamento do `)` antes de `</div>` que fecha o `role="dialog"` (linha ~136) — por:

```tsx
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px 8px' }}>
            <button
              onClick={() => setAba('novas')}
              style={{
                flex: 1, padding: '6px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                border: 'none', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                background: aba === 'novas' ? 'var(--brand-500)' : 'transparent',
                color: aba === 'novas' ? '#fff' : 'var(--t3)',
              }}
            >Novas {novas.length > 0 ? `(${novas.length})` : ''}</button>
            <button
              onClick={() => setAba('lidas')}
              style={{
                flex: 1, padding: '6px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                border: 'none', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                background: aba === 'lidas' ? 'var(--brand-500)' : 'transparent',
                color: aba === 'lidas' ? '#fff' : 'var(--t3)',
              }}
            >Lidas</button>
          </div>

          {aba === 'novas' ? (
            novas.length === 0 ? (
              <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--t3)' }}>Nenhuma mensagem nova.</div>
            ) : (
              <>
                <div style={{ padding: '2px 6px 6px', textAlign: 'right' }}>
                  <button
                    onClick={marcarTodas}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--brand-500)' }}
                  >Marcar todas como lidas</button>
                </div>
                {novas.map(a => (
                  <button
                    key={a.id}
                    onClick={() => { marcarLida(a); goTo(a.to) }}
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
                ))}
              </>
            )
          ) : lidas.length === 0 ? (
            <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--t3)' }}>Nenhuma mensagem lida.</div>
          ) : (
            lidas.map(l => (
              <button
                key={l.id}
                onClick={() => goTo(l.to)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                  padding: '8px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--t1)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-bg-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{l.titulo}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>{l.descricao}</div>
              </button>
            ))
          )}
```

- [ ] **Step 5: Run build to verify it compiles**

Run: `npm run build`
Expected: PASS (`tsc -b && vite build` sem erros). Se acusar `aba` ou `lidas` não usados, conferir que os passos anteriores foram aplicados.

- [ ] **Step 6: Run tests (regressão)**

Run: `npm run test`
Expected: PASS (suíte inteira, incluindo `alertas-lidas` e `alertas`).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/NotificationBell.tsx
git commit -m "feat(notif): abas Novas/Lidas no sino com marcar como lida"
```

---

## Task 3: Bloco "Sorteados" recolhível em EventosList

**Files:**
- Modify: `frontend/src/pages/eventos/EventosList.tsx`

Contexto: hoje a seção "Sorteados" (linhas ~457-462) renderiza sempre aberta com um eyebrow "Sorteados" + `renderGrupos(gruposSorteados)`. `ChevronDown` já está importado (linha 14) e já existe padrão de chevron rotacionado nas seções por competição (`renderGrupos`). O estado de recolhimento por competição usa `useState<Set<number>>`; aqui usaremos um booleano próprio persistido em `sessionStorage`, **recolhido por padrão**.

- [ ] **Step 1: Add collapse state initialized from sessionStorage**

Em `frontend/src/pages/eventos/EventosList.tsx`, logo após a linha `const [recolhidas, setRecolhidas] = useState<Set<number>>(new Set())` (linha ~69), adicionar:

```ts
  const [sorteadosAberto, setSorteadosAberto] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('prosports.eventos.sorteadosAberto') === '1'
    } catch {
      return false
    }
  })
  function toggleSorteados() {
    setSorteadosAberto(prev => {
      const next = !prev
      try { sessionStorage.setItem('prosports.eventos.sorteadosAberto', next ? '1' : '0') } catch { /* ignora */ }
      return next
    })
  }
```

(Default recolhido: `getItem` ausente → `=== '1'` é `false`.)

- [ ] **Step 2: Replace the "Sorteados" section with a collapsible header**

Trocar (linhas ~457-462):
```tsx
            {sorteados.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <div className="eyebrow" style={{ marginBottom: 12 }}>Sorteados</div>
                {renderGrupos(gruposSorteados)}
              </div>
            )}
```
Por:
```tsx
            {sorteados.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <button
                  type="button"
                  onClick={toggleSorteados}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: '4px 2px', marginBottom: 12, color: 'var(--t1)',
                    borderBottom: '1px solid var(--card-border)',
                  }}
                >
                  <ChevronDown
                    size={18}
                    style={{ transition: 'transform 140ms ease', transform: sorteadosAberto ? 'none' : 'rotate(-90deg)', color: 'var(--t3)' }}
                  />
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Sorteados</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--t3)' }}>{sorteados.length}</span>
                </button>
                {sorteadosAberto && renderGrupos(gruposSorteados)}
              </div>
            )}
```

- [ ] **Step 3: Run build to verify it compiles**

Run: `npm run build`
Expected: PASS (`tsc -b && vite build` sem erros).

- [ ] **Step 4: Run tests (regressão)**

Run: `npm run test`
Expected: PASS (suíte inteira).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/eventos/EventosList.tsx
git commit -m "feat(eventos): bloco Sorteados recolhivel (recolhido por padrao)"
```

---

## Manual Test Checklist (após as 3 tasks)

Rodar `npm run dev` e validar no navegador:

- Sino: com eventos em status `inscricoes`/`pronto`/`parcial`, o badge mostra a contagem; abrir → aba "Novas" lista os alertas.
- Clicar numa mensagem nova → navega para o evento e, ao reabrir o sino, ela some de "Novas" e aparece em "Lidas"; o badge diminui.
- "Marcar todas como lidas" → "Novas" fica vazia, badge some, todas em "Lidas".
- Aba "Lidas" mostra no máximo 10 (marcar 11 → a mais antiga sai).
- Reload da página preserva as lidas (localStorage).
- Lista de eventos: havendo eventos `sorteado`, a seção "Sorteados (N)" aparece **recolhida**; clicar no cabeçalho expande/recolhe; a preferência persiste ao navegar e voltar na mesma aba do navegador (sessionStorage).
- Sem eventos sorteados → a seção não aparece (sem cabeçalho órfão).

---

## Self-Review

**1. Spec coverage:**
- Helper puro `aplicarLida` (dedupe + cap 10) → Task 1. ✓
- Persistência localStorage (`carregarLidas`/`salvarLidas`) → Task 1. ✓
- Abas Novas/Lidas, badge só não lidas, marcar lida ao clicar, "marcar todas", clicar lida só navega, estados vazios → Task 2. ✓
- Bloco "Sorteados" recolhível, recolhido por padrão, sessionStorage, não renderiza quando vazio → Task 3. ✓
- Tolerância a storage indisponível/JSON corrompido → try/catch em Task 1 e Task 3. ✓
- Snapshot mantém lida que deixou de ser derivada → garantido porque `lidas` guarda o objeto inteiro e a aba "Lidas" renderiza `lidas` diretamente (não filtra contra `alertas`). ✓

**2. Placeholder scan:** Nenhum TBD/TODO; todo passo de código tem bloco completo. ✓

**3. Type consistency:** `AlertaLido = Alerta & { lidaEm: string }`; `aplicarLida(lidas, alerta, agora?)` consistente entre Task 1 (def) e Task 2 (uso); `carregarLidas`/`salvarLidas` idem. `ChevronDown` já importado, reutilizado em Task 3 com a mesma convenção de rotação. ✓
