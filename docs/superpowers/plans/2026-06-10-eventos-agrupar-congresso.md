# Agrupar eventos por competição + filtro pronto/parcial no Congresso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agrupar os cards de eventos por competição (seções colapsáveis, ordenadas por data) na EventosList; e no Modo Congresso listar só eventos `pronto`/`parcial`.

**Architecture:** Função pura `agruparEventosPorCompeticao` (grupos ordenados pela data do evento mais recente; eventos por data desc). `EventosList` agrupa o resultado já filtrado por tipo e renderiza seções colapsáveis (estado local). `CongressoStepEvento` troca o filtro de status.

**Tech Stack:** Frontend React 18/Vite/Vitest. Spec: `docs/superpowers/specs/2026-06-10-eventos-agrupar-congresso-design.md`.

---

## File Structure

- `frontend/src/lib/agrupar-eventos.ts` — `agruparEventosPorCompeticao` (puro) + tipo.
- `frontend/src/lib/agrupar-eventos.test.ts` — testes.
- `frontend/src/pages/eventos/EventosList.tsx` — agrupamento + seções colapsáveis.
- `frontend/src/pages/congresso/CongressoStepEvento.tsx` — filtro de status + textos.

---

## Task 1: Helper `agruparEventosPorCompeticao`

**Files:**
- Create: `frontend/src/lib/agrupar-eventos.ts`
- Test: `frontend/src/lib/agrupar-eventos.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Criar `frontend/src/lib/agrupar-eventos.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { agruparEventosPorCompeticao } from './agrupar-eventos'

const ev = (id: number, cid: number, nome: string, data: string) =>
  ({ id, competicao_id: cid, competicao: { nome }, data_hora: data }) as any

describe('agruparEventosPorCompeticao', () => {
  it('agrupa por competição; grupos por data mais recente desc; eventos por data desc', () => {
    const out = agruparEventosPorCompeticao([
      ev(1, 10, 'Copa A', '2026-01-10'),
      ev(2, 20, 'Copa B', '2026-03-01'),
      ev(3, 10, 'Copa A', '2026-02-20'),
    ])
    expect(out.map(g => g.competicaoId)).toEqual([20, 10])
    expect(out[1].eventos.map(e => e.id)).toEqual([3, 1])
  })

  it('empate de data desempata por nome (pt-BR)', () => {
    const out = agruparEventosPorCompeticao([
      ev(1, 10, 'Zeta', '2026-05-01'),
      ev(2, 20, 'Alfa', '2026-05-01'),
    ])
    expect(out.map(g => g.competicaoNome)).toEqual(['Alfa', 'Zeta'])
  })

  it('lista vazia → []', () => {
    expect(agruparEventosPorCompeticao([])).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd frontend && npx vitest run src/lib/agrupar-eventos.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Criar `frontend/src/lib/agrupar-eventos.ts`:

```ts
import type { Evento } from '../types/evento'

export type GrupoEventos = { competicaoId: number; competicaoNome: string; eventos: Evento[] }

export function agruparEventosPorCompeticao(eventos: Evento[]): GrupoEventos[] {
  const byComp = new Map<number, GrupoEventos>()
  for (const e of eventos) {
    let g = byComp.get(e.competicao_id)
    if (!g) {
      g = { competicaoId: e.competicao_id, competicaoNome: e.competicao?.nome ?? '—', eventos: [] }
      byComp.set(e.competicao_id, g)
    }
    g.eventos.push(e)
  }
  const dataMax = (g: GrupoEventos) =>
    Math.max(...g.eventos.map(e => new Date(e.data_hora).getTime()))
  for (const g of byComp.values()) {
    g.eventos.sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())
  }
  return Array.from(byComp.values()).sort((a, b) => {
    const d = dataMax(b) - dataMax(a)
    return d !== 0 ? d : a.competicaoNome.localeCompare(b.competicaoNome, 'pt-BR')
  })
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/lib/agrupar-eventos.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/agrupar-eventos.ts frontend/src/lib/agrupar-eventos.test.ts
git commit -m "feat(eventos-fe): helper agruparEventosPorCompeticao"
```

---

## Task 2: EventosList — seções colapsáveis por competição

**Files:**
- Modify: `frontend/src/pages/eventos/EventosList.tsx`

- [ ] **Step 1: Imports e estado**

Em `frontend/src/pages/eventos/EventosList.tsx`:
(a) adicionar import: `import { agruparEventosPorCompeticao } from '../../lib/agrupar-eventos'`
(b) no import de `lucide-react` (que já traz `Brackets, Group, ListOrdered, FileText, Layers, MapPin, Users, Dices`), acrescentar `ChevronDown`.
(c) `useState`/`useMemo` já são importados. Adicionar o estado de recolhidas junto aos outros `useState` (perto de `const [alvo, setAlvo] = ...`):
```tsx
  const [recolhidas, setRecolhidas] = useState<Set<number>>(new Set())
  function toggleGrupo(id: number) {
    setRecolhidas(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
```
(d) após o `const lista = useMemo(...)` existente, adicionar:
```tsx
  const grupos = useMemo(() => agruparEventosPorCompeticao(lista), [lista])
```

- [ ] **Step 2: Trocar o grid único por seções colapsáveis**

Substituir o bloco do grid (o trecho que hoje é):
```tsx
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 16,
            }}
          >
            {lista.map((ev, i) => {
```
... (todo o corpo do `.map`) ...
```tsx
            })}
          </div>
```
por uma estrutura agrupada. **Mantenha o corpo do `.map` EXATAMENTE como está** (todo o JSX do card, de `const tipos = eventoTipos(ev)` até o `)` de fechamento do card), apenas trocando a fonte de `lista.map` para `g.eventos.map` e envolvendo em seções. O resultado deve ficar:

```tsx
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {grupos.map(g => {
              const recolhido = recolhidas.has(g.competicaoId)
              return (
                <section key={g.competicaoId}>
                  <button
                    type="button"
                    onClick={() => toggleGrupo(g.competicaoId)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      padding: '4px 2px', marginBottom: 12, color: 'var(--t1)',
                      borderBottom: '1px solid var(--card-border)',
                    }}
                  >
                    <ChevronDown
                      size={18}
                      style={{ transition: 'transform 140ms ease', transform: recolhido ? 'rotate(-90deg)' : 'none', color: 'var(--t3)' }}
                    />
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{g.competicaoNome}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--t3)' }}>
                      {g.eventos.length}
                    </span>
                  </button>
                  {!recolhido && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: 16,
                      }}
                    >
                      {g.eventos.map((ev, i) => {
                        // === CORPO DO CARD: idêntico ao atual (const tipos = ... até o fechamento do card) ===
                      })}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
```

> Importante: NÃO reescrever o conteúdo do card — apenas mover o corpo do `.map` atual para dentro do `g.eventos.map((ev, i) => { ... })`. O `i` continua sendo o índice dentro do grupo.

- [ ] **Step 3: Verificar tipos e build**

Run: `cd frontend && npx tsc --noEmit`  → sem erros novos citando `EventosList.tsx`.
Run: `cd frontend && npm run build`  → conclui sem erros.

- [ ] **Step 4: Verificação manual**

`cd frontend && npm run dev`: a lista de eventos aparece agrupada por competição (cabeçalho com nome + contagem), grupos ordenados pela data do evento mais recente; clicar no cabeçalho recolhe/expande; o filtro por tipo continua funcionando; estados vazios inalterados.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/eventos/EventosList.tsx
git commit -m "feat(eventos-fe): agrupa cards por competição em seções colapsáveis"
```

---

## Task 3: Modo Congresso — só eventos pronto/parcial

**Files:**
- Modify: `frontend/src/pages/congresso/CongressoStepEvento.tsx`

- [ ] **Step 1: Trocar o filtro de status**

Em `frontend/src/pages/congresso/CongressoStepEvento.tsx`, substituir:
```tsx
  const ativos = eventos.filter(e => e.status !== 'rascunho')
```
por:
```tsx
  const ativos = eventos.filter(e => e.status === 'pronto' || e.status === 'parcial')
```

- [ ] **Step 2: Ajustar textos**

(a) Mensagem de vazio — substituir:
```tsx
        <p className="cw-sub">
          Nenhum evento ativo. Crie um evento e mude o status para "Inscrições" no painel administrativo.
        </p>
```
por:
```tsx
        <p className="cw-sub">
          Nenhum evento pronto para sorteio. Mude o status de um evento para "Pronto p/ sorteio" no painel administrativo.
        </p>
```

(b) Linha de contagem — substituir:
```tsx
      <p className="cw-sub">
        {ativos.length} {ativos.length === 1 ? 'evento ativo' : 'eventos ativos'}. O congresso inicia ao selecionar um evento.
      </p>
```
por:
```tsx
      <p className="cw-sub">
        {ativos.length} {ativos.length === 1 ? 'evento pronto para sorteio' : 'eventos prontos para sorteio'}. O congresso inicia ao selecionar um evento.
      </p>
```

- [ ] **Step 3: Verificar tipos e build**

Run: `cd frontend && npx tsc --noEmit`  → sem erros novos.
Run: `cd frontend && npm run build`  → conclui sem erros.

- [ ] **Step 4: Verificação manual**

No Modo Congresso → seleção de evento: aparecem apenas eventos com status "Pronto p/ sorteio" ou "Parcial"; eventos em "Inscrições"/"Sorteado"/"Rascunho" não aparecem.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/congresso/CongressoStepEvento.tsx
git commit -m "feat(congresso): selecao de evento lista apenas pronto/parcial"
```

---

## Self-review (cobertura da spec)

- Agrupar por competição, grupos por data mais recente, eventos por data desc → Task 1 (helper) + Task 2 (uso) ✓
- Seções colapsáveis (default expandidas) com cabeçalho (nome + contagem) → Task 2 ✓
- Filtro por tipo continua aplicando antes do agrupamento → Task 2 (`grupos` derivado de `lista`) ✓
- Modo Congresso só `pronto`/`parcial` + textos → Task 3 ✓
- Testes: helper puro (Task 1); telas por build + manual. Sem migration.
