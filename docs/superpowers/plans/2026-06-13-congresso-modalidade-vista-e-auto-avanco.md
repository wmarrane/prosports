# Modo Congresso: modalidade vista + auto-avanço — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No Modo Congresso, marcar modalidades do tipo específico como "apresentada/vista" (check verde, persistido em localStorage por evento) e fazer a etapa de modalidade auto-posicionar na próxima ainda não concluída.

**Architecture:** Frontend-only. Um helper puro+IO gerencia o conjunto de "vistas" em localStorage por evento. `ModoCongresso` (máquina de estados) mantém o estado `vistas`, marca a modalidade específico ao concluir a apresentação, e passa `vistasIds` para `CongressoStepModalidade`, que usa `concluída = sorteada ∪ vista` para o check verde, o badge do detalhe, o contador e o auto-select.

**Tech Stack:** React 18, TypeScript, Vite, Vitest.

**Validação obrigatória:** além de `npm run test`, rodar `npm run build` (CI usa `tsc -b && vite build`). Comandos em `C:/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/frontend`.

**Spec:** `docs/superpowers/specs/2026-06-13-congresso-modalidade-vista-e-auto-avanco-design.md`

**Git:** identidade NÃO configurada — commitar com identidade inline (NÃO rodar `git config`): `git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit ...`. Não pular hooks.

---

## File Structure

- **Create** `frontend/src/lib/congresso-vistas.ts` — `addVista` (pura) + `loadVistas`/`saveVistas` (localStorage por evento).
- **Create** `frontend/src/lib/congresso-vistas.test.ts` — testes Vitest de `addVista`.
- **Modify** `frontend/src/pages/congresso/CongressoStepModalidade.tsx` — prop `vistasIds`, check/badge/contador/auto-select por "concluída", scrollIntoView.
- **Modify** `frontend/src/pages/congresso/ModoCongresso.tsx` — estado `vistas`, carregar, marcar específico, passar `vistasIds`.

Ordem das tasks garante build verde a cada passo (o receptor da prop antes do emissor).

---

## Task 1: Helper de "vistas" do congresso

**Files:**
- Create: `frontend/src/lib/congresso-vistas.ts`
- Test: `frontend/src/lib/congresso-vistas.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/congresso-vistas.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { addVista } from './congresso-vistas'

describe('addVista', () => {
  it('adiciona um id novo ao fim', () => {
    expect(addVista([1, 2], 3)).toEqual([1, 2, 3])
  })
  it('é idempotente (não duplica)', () => {
    expect(addVista([1, 2], 2)).toEqual([1, 2])
  })
  it('preserva a ordem existente', () => {
    expect(addVista([5, 1], 9)).toEqual([5, 1, 9])
  })
  it('parte de lista vazia', () => {
    expect(addVista([], 7)).toEqual([7])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- congresso-vistas`
Expected: FAIL (módulo `./congresso-vistas` não existe).

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/lib/congresso-vistas.ts`:

```ts
const KEY = (eventoId: number) => `prosports.congresso.vistas.${eventoId}`

export function addVista(ids: number[], modalidadeId: number): number[] {
  return ids.includes(modalidadeId) ? ids : [...ids, modalidadeId]
}

export function loadVistas(eventoId: number): number[] {
  try {
    const raw = localStorage.getItem(KEY(eventoId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : []
  } catch {
    return []
  }
}

export function saveVistas(eventoId: number, ids: number[]): void {
  try {
    localStorage.setItem(KEY(eventoId), JSON.stringify(ids))
  } catch {
    /* storage indisponível — ignora */
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- congresso-vistas`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/congresso-vistas.ts frontend/src/lib/congresso-vistas.test.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(congresso): helper de modalidades vistas (localStorage por evento)"
```

---

## Task 2: `CongressoStepModalidade` — concluída (sorteada ∪ vista) + auto-avanço

**Files:**
- Modify: `frontend/src/pages/congresso/CongressoStepModalidade.tsx`

Contexto: hoje o componente usa `sorteadasIds` para: o `useEffect` de auto-select (linhas ~45-50), o contador `restantes` (linha ~42), o check `cw-md-done` na lista (linha ~104-106) e o badge `b-success` "Sorteado" no detalhe (linha ~124-128). Vamos introduzir `vistasIds` (prop opcional) e tratar "concluída = sorteada OU vista".

- [ ] **Step 1: Atualizar imports e o tipo de Props**

No topo de `frontend/src/pages/congresso/CongressoStepModalidade.tsx`, garantir `useRef` no import do React. Trocar:
```ts
import { useEffect, useState } from 'react'
```
Por:
```ts
import { useEffect, useRef, useState } from 'react'
```

Trocar o tipo `Props`:
```ts
type Props = {
  eventoId: number
  onSelect: (modalidadeId: number) => void
}
```
Por:
```ts
const EMPTY_IDS: Set<number> = new Set()

type Props = {
  eventoId: number
  onSelect: (modalidadeId: number) => void
  vistasIds?: Set<number>
}
```

- [ ] **Step 2: Receber a prop e derivar "concluída"**

Trocar a assinatura do componente e o cálculo de `sorteadasIds`/`restantes`. De:
```tsx
export default function CongressoStepModalidade({ eventoId, onSelect }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
```
Para:
```tsx
export default function CongressoStepModalidade({ eventoId, onSelect, vistasIds = EMPTY_IDS }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
```

E logo após a linha `const sorteadasIds = new Set(sorteios.map(s => s.modalidade_id))`, trocar a linha do `restantes`. De:
```ts
  const sorteadasIds = new Set(sorteios.map(s => s.modalidade_id))
  const restantes = modalidades.filter(m => !sorteadasIds.has(m.id)).length
```
Para:
```ts
  const sorteadasIds = new Set(sorteios.map(s => s.modalidade_id))
  const isConcluida = (id: number) => sorteadasIds.has(id) || vistasIds.has(id)
  const restantes = modalidades.filter(m => !isConcluida(m.id)).length
```

- [ ] **Step 3: Auto-select da primeira NÃO concluída**

Trocar o `useEffect` de auto-select. De:
```ts
  // Auto-select primeira modalidade não sorteada (ou primeira da lista)
  useEffect(() => {
    if (selectedId == null && modalidades.length > 0) {
      const naoSorteada = modalidades.find(m => !sorteadasIds.has(m.id))
      setSelectedId((naoSorteada ?? modalidades[0]).id)
    }
  }, [modalidades, selectedId, sorteadasIds])
```
Para:
```ts
  // Auto-select primeira modalidade não concluída (não sorteada e não vista), ou a primeira
  useEffect(() => {
    if (selectedId == null && modalidades.length > 0) {
      const naoConcluida = modalidades.find(m => !isConcluida(m.id))
      setSelectedId((naoConcluida ?? modalidades[0]).id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalidades, selectedId, sorteios, vistasIds])
```

- [ ] **Step 4: Manter o item selecionado visível**

Logo após o `useEffect` do passo 3, adicionar um novo `useEffect`:
```ts
  // Garante que o item selecionado fique visível na lista
  useEffect(() => {
    if (selectedId == null || !listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(`[data-mid="${selectedId}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedId])
```

- [ ] **Step 5: Check verde na lista para concluída + data-mid**

Na lista esquerda, trocar o `<div className="cw-md-list">` para incluir o ref:
```tsx
        <div className="cw-md-list">
```
Por:
```tsx
        <div className="cw-md-list" ref={listRef}>
```

E dentro do `.map`, trocar:
```tsx
            const sorteada = sorteadasIds.has(m.id)
            return (
              <button
                key={m.id}
                className={`cw-md-item ${selectedId === m.id ? 'sel' : ''}`}
                onClick={() => setSelectedId(m.id)}
              >
                <ModalityBadge name={m.nome} size={40} showGender />
                <span className="cw-md-name">{m.nome}</span>
                {sorteada && (
                  <span className="cw-md-done"><Check size={15} /></span>
                )}
              </button>
            )
```
Por:
```tsx
            const concluida = isConcluida(m.id)
            return (
              <button
                key={m.id}
                data-mid={m.id}
                className={`cw-md-item ${selectedId === m.id ? 'sel' : ''}`}
                onClick={() => setSelectedId(m.id)}
              >
                <ModalityBadge name={m.nome} size={40} showGender />
                <span className="cw-md-name">{m.nome}</span>
                {concluida && (
                  <span className="cw-md-done"><Check size={15} /></span>
                )}
              </button>
            )
```

- [ ] **Step 6: Badge do detalhe — "Sorteado" vs "Apresentada"**

No painel de detalhe, trocar:
```tsx
              const tipo = selectedMod.tipo_modalidade?.tipo ?? 'especifico'
              const sorteada = sorteadasIds.has(selectedMod.id)
```
Por:
```tsx
              const tipo = selectedMod.tipo_modalidade?.tipo ?? 'especifico'
              const sorteada = sorteadasIds.has(selectedMod.id)
              const vista = !sorteada && vistasIds.has(selectedMod.id)
```

E trocar o badge:
```tsx
                      {sorteada && (
                        <span className="cw-badge b-success">
                          <Check size={14} /> Sorteado
                        </span>
                      )}
```
Por:
```tsx
                      {sorteada && (
                        <span className="cw-badge b-success">
                          <Check size={14} /> Sorteado
                        </span>
                      )}
                      {vista && (
                        <span className="cw-badge b-success">
                          <Check size={14} /> Apresentada
                        </span>
                      )}
```

- [ ] **Step 7: Build + testes**

Run: `npm run build`
Expected: PASS (`tsc -b && vite build`, sem erros). A prop `vistasIds` é opcional (default vazio), então o componente compila e se comporta como hoje sem o emissor.

Run: `npm run test`
Expected: PASS (suíte inteira).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/congresso/CongressoStepModalidade.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(congresso): sinalizar e auto-avancar modalidades concluidas (sorteada ou vista)"
```

---

## Task 3: `ModoCongresso` — estado de vistas, marcação e passagem da prop

**Files:**
- Modify: `frontend/src/pages/congresso/ModoCongresso.tsx`

Contexto: `ModoCongresso` mantém `step`/`eventoId`/`modalidadeId`. `nextAfterParticipantes` decide o próximo passo após participantes; o ramo `especifico` (ou `pularSorteio`) chama `voltarParaModalidade()`. Vamos marcar **apenas específico** como vista nesse ponto.

- [ ] **Step 1: Imports**

Trocar:
```ts
import { useState } from 'react'
```
Por:
```ts
import { useEffect, useMemo, useState } from 'react'
```

Adicionar, após a linha `import type { CongressoStep } from '../../types/congresso-step'`:
```ts
import { addVista, loadVistas, saveVistas } from '../../lib/congresso-vistas'
```

- [ ] **Step 2: Estado + carregamento por evento**

Logo após `const [modalidadeId, setModalidadeId] = useState<number | null>(null)`, adicionar:
```ts
  const [vistas, setVistas] = useState<number[]>([])

  useEffect(() => {
    if (eventoId != null) setVistas(loadVistas(eventoId))
    else setVistas([])
  }, [eventoId])

  const vistasIds = useMemo(() => new Set(vistas), [vistas])
```

- [ ] **Step 3: Marcar específico como vista**

Trocar `nextAfterParticipantes`. De:
```ts
  function nextAfterParticipantes(opts?: { pularSorteio?: boolean }) {
    if (opts?.pularSorteio || tipoAtual === 'especifico') {
      // Sem sorteio — volta direto pra próxima modalidade
      voltarParaModalidade()
    } else {
      // grupos / chaves / ordem_entrada — Sorteio (com campeões inline quando aplicável)
      setStep('sorteio')
    }
  }
```
Para:
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

- [ ] **Step 4: Passar `vistasIds` para a etapa de modalidade**

Trocar:
```tsx
      {step === 'modalidade' && eventoId != null && (
        <CongressoStepModalidade
          eventoId={eventoId}
          onSelect={(id) => { setModalidadeId(id); setStep('participantes') }}
        />
      )}
```
Por:
```tsx
      {step === 'modalidade' && eventoId != null && (
        <CongressoStepModalidade
          eventoId={eventoId}
          onSelect={(id) => { setModalidadeId(id); setStep('participantes') }}
          vistasIds={vistasIds}
        />
      )}
```

- [ ] **Step 5: Build + testes**

Run: `npm run build`
Expected: PASS (`tsc -b && vite build`, sem erros).

Run: `npm run test`
Expected: PASS (suíte inteira).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/congresso/ModoCongresso.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(congresso): marcar especifico como vista e auto-avancar para a proxima"
```

---

## Manual Test Checklist (após as 3 tasks)

`npm run dev` → Modo Congresso (`/congresso`):

- Escolher um evento que tenha pelo menos uma modalidade **específico** e uma **sorteável**.
- Selecionar uma específico → Iniciar → na etapa de participantes, clicar **Próximo**. Deve voltar para a lista de modalidades com: (a) a específico marcada com check verde; (b) badge "Apresentada" no detalhe ao selecioná-la; (c) a etapa já posicionada na **próxima** modalidade não concluída.
- Dar **refresh** na página e voltar ao mesmo evento no Modo Congresso → a específico continua marcada (localStorage).
- Sorteável: comportamento inalterado — após sortear, vira "Sorteado" e a lista avança como antes.
- Lista longa: ao auto-avançar, o item selecionado fica visível (scroll).

---

## Self-Review

**1. Spec coverage:**
- Helper `addVista` puro + `loadVistas`/`saveVistas` (localStorage por evento) → Task 1. ✓
- Marca apenas específico ao concluir apresentação (não sorteáveis/pularSorteio) → Task 3 step 3. ✓
- Check verde unificado na lista para concluída (sorteada ∪ vista) → Task 2 step 5. ✓
- Badge detalhe "Sorteado" vs "Apresentada" → Task 2 step 6. ✓
- Contador conta não concluídas → Task 2 step 2. ✓
- Auto-select da próxima não concluída + scrollIntoView → Task 2 steps 3-4. ✓
- Persistência por evento + carregar ao trocar evento → Task 3 step 2. ✓
- Tolerância a storage indisponível/JSON inválido → Task 1 (try/catch). ✓

**2. Placeholder scan:** Sem TBD/TODO; todo passo de código tem bloco completo. ✓

**3. Type consistency:** `addVista(ids: number[], modalidadeId: number): number[]`, `loadVistas(eventoId): number[]`, `saveVistas(eventoId, ids): void` consistentes entre Task 1 (def) e Task 3 (uso). Prop `vistasIds?: Set<number>` definida em Task 2 e passada como `Set` (de `vistasIds = new Set(vistas)`) em Task 3. `isConcluida(id: number): boolean` usado em contador, lista e auto-select. ✓
