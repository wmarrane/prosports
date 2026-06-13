# Reset de vistas + pular_sorteio vista + contagem de participantes distintos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) No Modo Congresso, resetar as "vistas" ao apagar todos os sorteios de um evento e marcar como vista também as modalidades cujo sorteio é pulado; (2) corrigir o contador do card do evento para participantes distintos.

**Architecture:** Frontend para o item 1 (helper localStorage + dois pontos de chamada). Backend+frontend para o item 2: o `listar` calcula participantes distintos via `groupBy(['evento_id','participante_id'])` e anexa `total_participantes`; o card passa a ler esse campo.

**Tech Stack:** React 18, TS, Vite, Vitest (frontend); Node/Express/Prisma, Vitest com mock de prisma (backend).

**Validação obrigatória:** `npm run test` + `npm run build` (frontend: `tsc -b && vite build`; backend: `npm run build` = `tsc`). Frontend em `C:/Users/.../prosports_v2/frontend`; backend em `C:/Users/.../prosports_v2/backend`.

**Spec:** `docs/superpowers/specs/2026-06-13-congresso-reset-vistas-e-contagem-participantes-design.md`

**Git:** identidade NÃO configurada — commitar inline (NÃO rodar `git config`): `git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit ...`. Não pular hooks.

---

## File Structure

- **Modify** `frontend/src/lib/congresso-vistas.ts` (+test) — novo `clearVistas`.
- **Modify** `frontend/src/pages/eventos/EventoInscricoes.tsx` — `clearVistas(eventoId)` ao apagar todos os sorteios.
- **Modify** `frontend/src/pages/congresso/ModoCongresso.tsx` — marcar vista também em `pular_sorteio`.
- **Modify** `backend/src/modules/eventos/eventos.service.ts` (+test) — `total_participantes` no `listar`.
- **Modify** `frontend/src/types/evento.ts` + `frontend/src/pages/eventos/EventosList.tsx` — card lê `total_participantes`.

---

## Task 1: `clearVistas` no helper de congresso

**Files:**
- Modify: `frontend/src/lib/congresso-vistas.ts`
- Modify: `frontend/src/lib/congresso-vistas.test.ts`

- [ ] **Step 1: Write the failing test**

Em `frontend/src/lib/congresso-vistas.test.ts`, adicionar (ao final, antes do fechamento do arquivo) este novo bloco e garantir os imports de `vi`/`beforeEach`/`afterEach`:

Trocar a primeira linha do arquivo:
```ts
import { describe, it, expect } from 'vitest'
import { addVista } from './congresso-vistas'
```
Por:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { addVista, clearVistas } from './congresso-vistas'
```

E adicionar, após o `describe('addVista', ...)` existente:
```ts
describe('clearVistas', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('remove a chave do localStorage do evento', () => {
    const removeItem = vi.fn()
    vi.stubGlobal('localStorage', { removeItem, getItem: vi.fn(), setItem: vi.fn() })
    clearVistas(5)
    expect(removeItem).toHaveBeenCalledWith('prosports.congresso.vistas.5')
  })

  it('tolera localStorage indisponível (não lança)', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(() => clearVistas(9)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run test -- congresso-vistas`
Expected: FAIL (`clearVistas` não existe / não exportado).

- [ ] **Step 3: Write minimal implementation**

Em `frontend/src/lib/congresso-vistas.ts`, adicionar a função (após `saveVistas`):
```ts
export function clearVistas(eventoId: number): void {
  try {
    localStorage.removeItem(KEY(eventoId))
  } catch {
    /* storage indisponível — ignora */
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run test -- congresso-vistas`
Expected: PASS (addVista + clearVistas).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/congresso-vistas.ts frontend/src/lib/congresso-vistas.test.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(congresso): clearVistas para resetar apresentadas por evento"
```

---

## Task 2: Resetar vistas ao apagar todos os sorteios

**Files:**
- Modify: `frontend/src/pages/eventos/EventoInscricoes.tsx`

Contexto: existe a mutation `apagarTodosSorteios` (linhas ~239-246) cujo `onSuccess` faz `setApagarTodosResumo(r)` e `queryClient.invalidateQueries({ queryKey: ['sorteios', eventoId] })`.

- [ ] **Step 1: Importar clearVistas**

Adicionar o import (junto aos demais imports de libs/serviços no topo do arquivo):
```ts
import { clearVistas } from '../../lib/congresso-vistas'
```

- [ ] **Step 2: Chamar clearVistas no sucesso do apagar-todos**

Trocar o `onSuccess` da mutation `apagarTodosSorteios`. De:
```ts
    onSuccess: r => {
      setApagarTodosResumo(r)
      queryClient.invalidateQueries({ queryKey: ['sorteios', eventoId] })
    },
```
Para:
```ts
    onSuccess: r => {
      setApagarTodosResumo(r)
      clearVistas(eventoId)
      queryClient.invalidateQueries({ queryKey: ['sorteios', eventoId] })
    },
```

- [ ] **Step 3: Build + testes**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run build`
Expected: PASS (`tsc -b && vite build`).

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run test`
Expected: PASS (suíte inteira).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/eventos/EventoInscricoes.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(congresso): apagar todos os sorteios reseta as apresentadas (vistas)"
```

---

## Task 3: Marcar vista também quando o sorteio é pulado

**Files:**
- Modify: `frontend/src/pages/congresso/ModoCongresso.tsx`

Contexto: `nextAfterParticipantes` hoje marca vista só para `especifico`. Passar a marcar para todo o ramo "sem sorteio" (específico OU `pularSorteio`).

- [ ] **Step 1: Atualizar nextAfterParticipantes**

Trocar:
```ts
  function nextAfterParticipantes(opts?: { pularSorteio?: boolean }) {
    if (opts?.pularSorteio || tipoAtual === 'especifico') {
      // Específico: a apresentação termina aqui — marca como vista (persistido).
      if (tipoAtual === 'especifico' && eventoId != null && modalidadeId != null) {
        const next = addVista(vistas, modalidadeId)
        setVistas(next)
        saveVistas(eventoId, next)
      }
      // Sem sorteio — volta direto pra próxima modalidade
      voltarParaModalidade()
    } else {
      // grupos / chaves / ordem_entrada — Sorteio (com campeões inline quando aplicável)
      setStep('sorteio')
    }
  }
```
Por:
```ts
  function nextAfterParticipantes(opts?: { pularSorteio?: boolean }) {
    if (opts?.pularSorteio || tipoAtual === 'especifico') {
      // Sem sorteio (específico ou sorteio pulado por inscritos insuficientes):
      // a apresentação termina aqui — marca como vista (persistido).
      if (eventoId != null && modalidadeId != null) {
        const next = addVista(vistas, modalidadeId)
        setVistas(next)
        saveVistas(eventoId, next)
      }
      // Volta direto pra próxima modalidade
      voltarParaModalidade()
    } else {
      // grupos / chaves / ordem_entrada — Sorteio (com campeões inline quando aplicável)
      setStep('sorteio')
    }
  }
```

- [ ] **Step 2: Build + testes**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run build`
Expected: PASS.

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/congresso/ModoCongresso.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(congresso): marcar vista tambem quando o sorteio e pulado"
```

---

## Task 4: Backend — `total_participantes` (participantes distintos) no `listar`

**Files:**
- Modify: `backend/src/modules/eventos/eventos.service.ts`
- Modify: `backend/src/modules/eventos/eventos.service.test.ts`

Contexto (`listar`, linhas ~64-119): após `prisma.evento.findMany` e o `groupBy` por modalidade (linhas 72-80), há os fetches de sorteios/exclusões; o `return eventos.map(...)` (linhas 100-119) anexa `modalidades_sorteaveis`/`modalidades_pendentes`.

- [ ] **Step 1: Write the failing test**

Em `backend/src/modules/eventos/eventos.service.test.ts`, adicionar este teste dentro do `describe('eventos.service', ...)` (após o teste de exclusões):
```ts
  it('listar conta participantes distintos em total_participantes', async () => {
    mockPrisma.evento.findMany.mockResolvedValue([
      { id: 1, competicao: { modalidades: [] }, _count: { inscricoes: 0, sorteios: 0 } },
    ])
    // 1ª chamada: groupBy por modalidade (vazio); 2ª chamada: groupBy por participante
    mockPrisma.inscricao.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { evento_id: 1, participante_id: 100 },
        { evento_id: 1, participante_id: 200 },
        { evento_id: 1, participante_id: 300 },
      ])
    mockPrisma.sorteio.findMany.mockResolvedValue([])
    mockPrisma.eventoModalidadeExcluida.findMany.mockResolvedValue([])

    const [e] = await service.listar() as any[]
    expect(e.total_participantes).toBe(3)
  })
```

(Nota: o `groupBy` por `[evento_id, participante_id]` já retorna um par único por participante — o mesmo participante em N modalidades vira UMA linha. O teste verifica nossa agregação por evento.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run test -- eventos.service`
Expected: FAIL (`total_participantes` é `undefined`).

- [ ] **Step 3: Implement**

Em `backend/src/modules/eventos/eventos.service.ts`, no `listar`, logo após o bloco do `groupBy` por modalidade (a linha `for (const g of grouped) { ...countsByEvento... }`, termina ~linha 80), adicionar:
```ts
  const participantesGrouped = await prisma.inscricao.groupBy({
    by: ['evento_id', 'participante_id'],
    where: { evento_id: { in: eventIds } },
  })
  const totalParticipantesPorEvento: Record<number, number> = {}
  for (const g of participantesGrouped) {
    totalParticipantesPorEvento[g.evento_id] = (totalParticipantesPorEvento[g.evento_id] ?? 0) + 1
  }
```

E no `return eventos.map(e => { ... })`, trocar a linha de return final. De:
```ts
    return { ...e, modalidades_sorteaveis: sorteaveisIds.size, modalidades_pendentes: pendentes }
```
Para:
```ts
    return {
      ...e,
      modalidades_sorteaveis: sorteaveisIds.size,
      modalidades_pendentes: pendentes,
      total_participantes: totalParticipantesPorEvento[e.id] ?? 0,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run test -- eventos.service`
Expected: PASS (incluindo o novo teste e os existentes — os testes antigos usam `mockResolvedValue` persistente, então a 2ª chamada de `groupBy` recebe os mesmos dados e não afeta as asserções deles).

- [ ] **Step 5: Build (backend)**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend" && npm run build`
Expected: PASS (`tsc`, sem erros).

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/eventos/eventos.service.ts backend/src/modules/eventos/eventos.service.test.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(eventos): listar retorna total_participantes (participantes distintos)"
```

---

## Task 5: Frontend — card usa `total_participantes`

**Files:**
- Modify: `frontend/src/types/evento.ts`
- Modify: `frontend/src/pages/eventos/EventosList.tsx`

- [ ] **Step 1: Tipo `Evento` ganha o campo**

Em `frontend/src/types/evento.ts`, trocar:
```ts
  modalidades_sorteaveis?: number
  modalidades_pendentes?: number
  comissao?: { usuario: { id: number; nome: string } }[]
```
Por:
```ts
  modalidades_sorteaveis?: number
  modalidades_pendentes?: number
  total_participantes?: number
  comissao?: { usuario: { id: number; nome: string } }[]
```

- [ ] **Step 2: Card lê `total_participantes`**

Em `frontend/src/pages/eventos/EventosList.tsx`, trocar:
```tsx
                    const inscritos = ev._count?.inscricoes ?? 0
```
Por:
```tsx
                    const inscritos = ev.total_participantes ?? 0
```
(O rótulo "inscritos" no `<Meta ... sub="inscritos" />` permanece inalterado.)

- [ ] **Step 3: Build + testes**

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run build`
Expected: PASS (`tsc -b && vite build`).

Run: `cd "C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend" && npm run test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/evento.ts frontend/src/pages/eventos/EventosList.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "fix(eventos): card conta participantes distintos (total_participantes)"
```

---

## Manual Test Checklist (após as 5 tasks)

- **Contador:** abrir a lista de eventos; o card de "Jogos Regionais de Penápolis" mostra agora o nº de participantes distintos (não a soma por modalidade). Um participante em N modalidades conta 1.
- **Reset de vistas:** em um evento, apresentar algumas modalidades no Modo Congresso (check verde). Em `EventoInscricoes`, "Apagar sorteios" (apagar todos). Voltar ao Modo Congresso do mesmo evento → as marcas de apresentada sumiram (recomeço).
- **pular_sorteio vira vista:** no Modo Congresso, uma modalidade de grupos/chaves com inscritos insuficientes (que pula o sorteio) ao concluir a etapa de participantes recebe o check verde e a etapa avança para a próxima.

---

## Self-Review

**1. Spec coverage:**
- 1a reset de vistas ao apagar todos os sorteios → Task 1 (clearVistas) + Task 2 (chamada no onSuccess). ✓
- 1b marcar vista em qualquer pular_sorteio → Task 3. ✓
- 2 total_participantes (distintos) no backend → Task 4; card consome → Task 5. ✓
- Rótulo permanece "inscritos" → Task 5 step 2 (sub inalterado). ✓
- Apagar sorteio único não reseta → só o `apagarTodosSorteios` chama clearVistas. ✓
- Tolerância a storage → clearVistas try/catch (Task 1). ✓

**2. Placeholder scan:** Sem TBD/TODO; todo passo de código tem bloco completo. ✓

**3. Type consistency:** `clearVistas(eventoId: number): void` definido (Task 1) e usado (Task 2). `total_participantes` anexado no backend (Task 4) e declarado opcional no tipo `Evento` + lido no card (Task 5). O 2º `inscricao.groupBy` não quebra os testes existentes (mockResolvedValue persistente; campo novo não asserido por eles). ✓
