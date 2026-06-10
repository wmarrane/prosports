# Card de evento: "X/Y sorteadas" por modalidades sorteáveis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No card do evento (lista), o "X/Y sorteadas" passa a usar Y = nº de modalidades sorteáveis do evento (computado no backend), em vez do total da competição.

**Architecture:** Helper puro `isSorteavel`/`matchMensagem` no backend; `eventos.service.listar` agrega contagens de inscritos por modalidade e sorteios por evento e devolve `modalidades_sorteaveis`. O card usa esse campo no denominador.

**Tech Stack:** Backend Node/Prisma/Vitest; Frontend React 18/Vite/Vitest. Spec: `docs/superpowers/specs/2026-06-10-card-evento-sorteaveis-design.md`.

---

## File Structure

- `backend/src/lib/sorteaveis.ts` — `matchMensagem` + `isSorteavel` (puro).
- `backend/src/lib/sorteaveis.test.ts` — testes.
- `backend/src/modules/eventos/eventos.service.ts` — `LIST_INCLUDE` + agregação em `listar`.
- `backend/src/modules/eventos/eventos.service.test.ts` — atualizar `LIST_INCLUDE` esperado + novo teste.
- `frontend/src/types/evento.ts` — `modalidades_sorteaveis?`.
- `frontend/src/pages/eventos/EventosList.tsx` — denominador do indicador.

---

## Task 1: Backend — helper `isSorteavel`/`matchMensagem`

**Files:**
- Create: `backend/src/lib/sorteaveis.ts`
- Test: `backend/src/lib/sorteaveis.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Criar `backend/src/lib/sorteaveis.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isSorteavel, matchMensagem } from './sorteaveis'

describe('matchMensagem', () => {
  it('primeira regra que casa; max nulo; inclusivo; sem match', () => {
    const r = [{ min: 1, max: 5, mensagem: 'A', pular_sorteio: false }, { min: 3, max: 5, mensagem: 'B', pular_sorteio: false }]
    expect(matchMensagem(r, 4)?.mensagem).toBe('A')
    expect(matchMensagem([{ min: 6, max: null, mensagem: 'C', pular_sorteio: false }], 9)?.mensagem).toBe('C')
    expect(matchMensagem([{ min: 3, max: 5, mensagem: 'D', pular_sorteio: false }], 5)?.mensagem).toBe('D')
    expect(matchMensagem([], 2)).toBeNull()
  })
})

describe('isSorteavel', () => {
  it('especifico nunca', () => {
    expect(isSorteavel({ tipo: 'especifico' }, 10)).toBe(false)
  })
  it('sem inscritos nunca', () => {
    expect(isSorteavel({ tipo: 'grupos' }, 0)).toBe(false)
  })
  it('regra pular_sorteio que casa torna não sorteável', () => {
    expect(isSorteavel({ tipo: 'chaves', mensagens_inscritos: [{ min: 2, max: 2, mensagem: 'x', pular_sorteio: true }] }, 2)).toBe(false)
  })
  it('grupos/chaves com inscritos e sem pular é sorteável', () => {
    expect(isSorteavel({ tipo: 'grupos' }, 8)).toBe(true)
    expect(isSorteavel({ tipo: 'chaves', mensagens_inscritos: [{ min: 2, max: 2, mensagem: 'x', pular_sorteio: false }] }, 2)).toBe(true)
  })
  it('mensagens_inscritos não-array é tratado como vazio', () => {
    expect(isSorteavel({ tipo: 'grupos', mensagens_inscritos: null }, 4)).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd backend && npx vitest run src/lib/sorteaveis.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Criar `backend/src/lib/sorteaveis.ts`:

```ts
type Regra = { min: number; max: number | null; mensagem: string; pular_sorteio: boolean }

export function matchMensagem(regras: Regra[], n: number): Regra | null {
  for (const r of regras) {
    if (n >= r.min && (r.max == null || n <= r.max)) return r
  }
  return null
}

export function isSorteavel(m: { tipo: string; mensagens_inscritos?: unknown }, inscritos: number): boolean {
  if (m.tipo === 'especifico') return false
  if (inscritos <= 0) return false
  const regras = Array.isArray(m.mensagens_inscritos) ? (m.mensagens_inscritos as Regra[]) : []
  const regra = matchMensagem(regras, inscritos)
  if (regra?.pular_sorteio) return false
  return true
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && npx vitest run src/lib/sorteaveis.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/sorteaveis.ts backend/src/lib/sorteaveis.test.ts
git commit -m "feat(backend): helper isSorteavel/matchMensagem"
```

---

## Task 2: Backend — `listar` computa `modalidades_sorteaveis`

**Files:**
- Modify: `backend/src/modules/eventos/eventos.service.ts`
- Test: `backend/src/modules/eventos/eventos.service.test.ts`

- [ ] **Step 1: Atualizar `LIST_INCLUDE` e `listar`**

Em `backend/src/modules/eventos/eventos.service.ts`:

(a) adicionar import no topo: `import { isSorteavel } from '../../lib/sorteaveis'`

(b) no `LIST_INCLUDE`, no `select` das modalidades, adicionar `mensagens_inscritos: true`:
```ts
      modalidades: {
        select: {
          id: true,
          mensagens_inscritos: true,
          tipo_modalidade: { select: { tipo: true } },
        },
      },
```

(c) substituir a função `listar` por:
```ts
export async function listar(competicao_id?: number) {
  const eventos = await prisma.evento.findMany({
    where: competicao_id ? { competicao_id } : undefined,
    orderBy: { data_hora: 'desc' },
    include: LIST_INCLUDE,
  })
  if (eventos.length === 0) return eventos

  const eventIds = eventos.map(e => e.id)
  const grouped = await prisma.inscricao.groupBy({
    by: ['evento_id', 'modalidade_id'],
    where: { evento_id: { in: eventIds } },
    _count: { _all: true },
  })
  const countsByEvento: Record<number, Record<number, number>> = {}
  for (const g of grouped) {
    ;(countsByEvento[g.evento_id] ??= {})[g.modalidade_id] = g._count._all
  }

  const sorteios = await prisma.sorteio.findMany({
    where: { evento_id: { in: eventIds } },
    select: { evento_id: true, modalidade_id: true },
  })
  const sorteadasByEvento: Record<number, Set<number>> = {}
  for (const s of sorteios) {
    ;(sorteadasByEvento[s.evento_id] ??= new Set()).add(s.modalidade_id)
  }

  return eventos.map(e => {
    const counts = countsByEvento[e.id] ?? {}
    const ids = new Set<number>(sorteadasByEvento[e.id] ?? [])
    for (const m of (e as any).competicao?.modalidades ?? []) {
      if (isSorteavel({ tipo: m.tipo_modalidade.tipo, mensagens_inscritos: m.mensagens_inscritos }, counts[m.id] ?? 0)) {
        ids.add(m.id)
      }
    }
    return { ...e, modalidades_sorteaveis: ids.size }
  })
}
```

- [ ] **Step 2: Atualizar o mock e o teste existente**

Em `backend/src/modules/eventos/eventos.service.test.ts`:

(a) no `vi.mock('../../lib/prisma', ...)`, dentro de `default`, adicionar as entidades usadas:
```ts
    inscricao: { groupBy: vi.fn() },
    sorteio: { findMany: vi.fn() },
```

(b) atualizar a constante `LIST_INCLUDE` do teste para refletir o novo select (com `mensagens_inscritos: true`):
```ts
const LIST_INCLUDE = {
  competicao: {
    include: {
      modalidades: {
        select: {
          id: true,
          mensagens_inscritos: true,
          tipo_modalidade: { select: { tipo: true } },
        },
      },
    },
  },
  municipio: true,
  _count: { select: { inscricoes: true, sorteios: true } },
}
```
(Os testes `listar sem filtro` e `listar filtra por competicao_id` retornam `[]` → `listar` faz early-return e não chama groupBy/sorteio; só a asserção do `include` muda.)

- [ ] **Step 3: Adicionar o novo teste de agregação**

Adicionar dentro do `describe('eventos.service', ...)`:

```ts
  it('listar computa modalidades_sorteaveis por evento (ignora especifico/sem-inscritos/pular; inclui sorteadas)', async () => {
    mockPrisma.evento.findMany.mockResolvedValue([
      {
        id: 1,
        competicao: { modalidades: [
          { id: 10, tipo_modalidade: { tipo: 'grupos' }, mensagens_inscritos: [] },
          { id: 11, tipo_modalidade: { tipo: 'especifico' }, mensagens_inscritos: [] },
          { id: 12, tipo_modalidade: { tipo: 'chaves' }, mensagens_inscritos: [{ min: 2, max: 2, mensagem: 'x', pular_sorteio: true }] },
        ] },
        _count: { inscricoes: 0, sorteios: 1 },
      },
    ])
    mockPrisma.inscricao.groupBy.mockResolvedValue([
      { evento_id: 1, modalidade_id: 10, _count: { _all: 8 } },
      { evento_id: 1, modalidade_id: 11, _count: { _all: 5 } },
      { evento_id: 1, modalidade_id: 12, _count: { _all: 2 } },
    ])
    mockPrisma.sorteio.findMany.mockResolvedValue([{ evento_id: 1, modalidade_id: 10 }])

    const out = await service.listar()
    expect(out[0].modalidades_sorteaveis).toBe(1)
  })
```

- [ ] **Step 4: Rodar os testes do módulo**

Run: `cd backend && npx vitest run src/modules/eventos/eventos.service.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Build do backend**

Run: `cd backend && npm run build`
Expected: `tsc` sem erros.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/eventos/eventos.service.ts backend/src/modules/eventos/eventos.service.test.ts
git commit -m "feat(eventos): listar devolve modalidades_sorteaveis por evento"
```

---

## Task 3: Frontend — card usa `modalidades_sorteaveis`

**Files:**
- Modify: `frontend/src/types/evento.ts`
- Modify: `frontend/src/pages/eventos/EventosList.tsx`

- [ ] **Step 1: Tipo**

Em `frontend/src/types/evento.ts`, no tipo `Evento`, adicionar (ex.: após `_count?`):
```ts
  modalidades_sorteaveis?: number
```

- [ ] **Step 2: Card**

Em `frontend/src/pages/eventos/EventosList.tsx`:

(a) onde estão `totalModalidades`/`inscritos`/`sorteadas` (após `const sorteadas = ev._count?.sorteios ?? 0`), adicionar:
```ts
              const sorteaveis = ev.modalidades_sorteaveis ?? totalModalidades
```

(b) trocar a linha do indicador de sorteio:
```tsx
                    <Meta icon={Dices} label={`${sorteadas}/${totalModalidades}`} sub="sorteadas" />
```
por:
```tsx
                    <Meta icon={Dices} label={`${sorteadas}/${sorteaveis}`} sub="sorteadas" />
```
(O `<Meta icon={Layers} label={String(totalModalidades)} sub="modalidades" />` permanece inalterado.)

- [ ] **Step 3: Verificar tipos e build**

Run: `cd frontend && npx tsc --noEmit`  → sem erros novos.
Run: `cd frontend && npm run build`  → conclui sem erros.

- [ ] **Step 4: Verificação manual**

Backend+frontend rodando, num evento cuja competição tenha modalidades específico/sem-inscritos/"pular sorteio": o card mostra "X/Y sorteadas" com Y = sorteáveis (ex.: 1/12), e "MODALIDADES" segue o total da competição.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/evento.ts frontend/src/pages/eventos/EventosList.tsx
git commit -m "feat(eventos-fe): card usa modalidades_sorteaveis no indicador de sorteio"
```

---

## Self-review (cobertura da spec)

- Backend computa `modalidades_sorteaveis` (sorteáveis ∪ sorteadas) → Task 2 ✓
- Helper puro espelhando o frontend → Task 1 ✓
- `LIST_INCLUDE` traz `mensagens_inscritos` → Task 2 ✓
- Card usa o campo só no "X/Y sorteadas"; "MODALIDADES" inalterado → Task 3 ✓
- Testes: helper (Task 1) + agregação do `listar` (Task 2); card por build/manual.
- Sem migration → promoção a prod não exige ligar a Cloud SQL.
