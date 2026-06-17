# Exportar HTML: listar todos os cabeças (grupo só nos de grupo) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No relatório (Exportar HTML e Imprimir) de modalidades de grupos, mostrar uma seção "Cabeças" com **todos os cabeças** (campeões do ano anterior + anfitrião quando a regra aplica) e o rótulo "- Grupo X" **somente nos que encabeçam grupo**.

**Architecture:** Helper puro `cabecas-grupo.ts` deriva a lista (e o grupo de cada cabeça de grupo) reusando `applyAnfitriaoRuleFront`. `SorteioPrintContent` passa a receber `cabecas` por prop e só renderiza. `EventoInscricoes` monta `cabecas` nos dois call sites (Exportar HTML + Imprimir).

**Tech Stack:** React 18 + TS; Vitest; build `tsc -b && vite build`.

**Spec:** `docs/superpowers/specs/2026-06-16-exportar-html-cabecas-grupo-design.md`

## Global Constraints

- Git identity não configurada → commit com `-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`.
- Caminhos absolutos com `git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2"`. Windows host (Bash tool). Ler arquivos antes de editar.
- Substitui a 1ª versão (commit `7882d12`), que listava só os cabeças de grupo.

---

### Task 1: Helper `cabecasComGrupo` + teste

**Files:**
- Create: `frontend/src/lib/cabecas-grupo.ts`
- Test: `frontend/src/lib/cabecas-grupo.test.ts`

**Interfaces:**
- Consumes: `applyAnfitriaoRuleFront` de `frontend/src/lib/anfitriao-rule.ts` (assinatura: `(campeoesPidsInscritos: number[], anfitriaoPid: number|null, anfitriaoInscrito: boolean, consideraAnfitriao: boolean, tipo: 'chaves'|'grupos', quantidadeGrupos?: number) => number[]`).
- Produces: `export type CabecaCampeao = { participante_id: number; posicao: number; nome: string }` e `export function cabecasComGrupo(args): { nome: string; grupo: string | null }[]` (args descritos abaixo).

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/lib/cabecas-grupo.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { cabecasComGrupo } from './cabecas-grupo'

const g = (letra: string, participantes: number[]) => ({ letra, participantes })

describe('cabecasComGrupo', () => {
  it('3 campeões inscritos, 3 grupos, sem anfitrião → A/B/C na ordem', () => {
    const out = cabecasComGrupo({
      campeoes: [
        { participante_id: 10, posicao: 1, nome: 'Um' },
        { participante_id: 20, posicao: 2, nome: 'Dois' },
        { participante_id: 30, posicao: 3, nome: 'Três' },
      ],
      inscritosIds: new Set([10, 20, 30]),
      anfitriaoPid: null, anfitriaoNome: null, consideraAnfitriao: false,
      grupos: [g('A', [10]), g('B', [20]), g('C', [30])],
    })
    expect(out).toEqual([
      { nome: 'Um', grupo: 'Grupo A' },
      { nome: 'Dois', grupo: 'Grupo B' },
      { nome: 'Três', grupo: 'Grupo C' },
    ])
  })

  it('anfitrião considerado (não-campeão), 3 grupos → anfitrião sintético no fim, Grupo C', () => {
    const out = cabecasComGrupo({
      campeoes: [
        { participante_id: 10, posicao: 1, nome: 'Um' },
        { participante_id: 20, posicao: 2, nome: 'Dois' },
      ],
      inscritosIds: new Set([10, 20, 99]),
      anfitriaoPid: 99, anfitriaoNome: 'Anfitriao', consideraAnfitriao: true,
      grupos: [g('A', [10]), g('B', [20]), g('C', [99])],
    })
    expect(out).toEqual([
      { nome: 'Um', grupo: 'Grupo A' },
      { nome: 'Dois', grupo: 'Grupo B' },
      { nome: 'Anfitriao', grupo: 'Grupo C' },
    ])
  })

  it('4 campeões, 3 grupos → o 4º fica sem grupo', () => {
    const out = cabecasComGrupo({
      campeoes: [
        { participante_id: 10, posicao: 1, nome: 'Um' },
        { participante_id: 20, posicao: 2, nome: 'Dois' },
        { participante_id: 30, posicao: 3, nome: 'Três' },
        { participante_id: 40, posicao: 4, nome: 'Quatro' },
      ],
      inscritosIds: new Set([10, 20, 30, 40]),
      anfitriaoPid: null, anfitriaoNome: null, consideraAnfitriao: false,
      grupos: [g('A', [10]), g('B', [20]), g('C', [30])],
    })
    expect(out[3]).toEqual({ nome: 'Quatro', grupo: null })
  })

  it('campeão não inscrito → listado sem grupo', () => {
    const out = cabecasComGrupo({
      campeoes: [
        { participante_id: 10, posicao: 1, nome: 'Um' },
        { participante_id: 20, posicao: 2, nome: 'Fora' },
      ],
      inscritosIds: new Set([10]),
      anfitriaoPid: null, anfitriaoNome: null, consideraAnfitriao: false,
      grupos: [g('A', [10])],
    })
    expect(out).toEqual([
      { nome: 'Um', grupo: 'Grupo A' },
      { nome: 'Fora', grupo: null },
    ])
  })

  it('grupos null → todos sem grupo', () => {
    const out = cabecasComGrupo({
      campeoes: [{ participante_id: 10, posicao: 1, nome: 'Um' }],
      inscritosIds: new Set([10]),
      anfitriaoPid: null, anfitriaoNome: null, consideraAnfitriao: false,
      grupos: null,
    })
    expect(out).toEqual([{ nome: 'Um', grupo: null }])
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd frontend && npx vitest run src/lib/cabecas-grupo.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar o helper**

Criar `frontend/src/lib/cabecas-grupo.ts`:
```ts
import { applyAnfitriaoRuleFront } from './anfitriao-rule'

export type CabecaCampeao = { participante_id: number; posicao: number; nome: string }

export function cabecasComGrupo(args: {
  campeoes: CabecaCampeao[]
  inscritosIds: Set<number>
  anfitriaoPid: number | null
  anfitriaoNome: string | null
  consideraAnfitriao: boolean
  grupos: { letra: string; participantes: number[] }[] | null
}): { nome: string; grupo: string | null }[] {
  const { campeoes, inscritosIds, anfitriaoPid, anfitriaoNome, consideraAnfitriao, grupos } = args
  const ordenados = [...campeoes].sort((a, b) => a.posicao - b.posicao)
  const anfitriaoInscrito = anfitriaoPid != null && inscritosIds.has(anfitriaoPid)
  const anfitriaoEhCampeao = anfitriaoPid != null && ordenados.some(c => c.participante_id === anfitriaoPid)

  const itens: { pid: number; nome: string }[] = ordenados.map(c => ({ pid: c.participante_id, nome: c.nome }))
  if (consideraAnfitriao && anfitriaoInscrito && anfitriaoPid != null && !anfitriaoEhCampeao) {
    itens.push({ pid: anfitriaoPid, nome: anfitriaoNome ?? '—' })
  }

  const headMap = new Map<number, string>()
  if (grupos && grupos.length > 0) {
    const campeoesInscritosPids = ordenados
      .filter(c => inscritosIds.has(c.participante_id))
      .map(c => c.participante_id)
    const cabecaList = applyAnfitriaoRuleFront(
      campeoesInscritosPids, anfitriaoPid, anfitriaoInscrito, consideraAnfitriao, 'grupos', grupos.length,
    )
    const n = Math.min(cabecaList.length, grupos.length)
    for (let i = 0; i < n; i++) headMap.set(cabecaList[i], grupos[i].letra)
  }

  return itens.map(it => ({ nome: it.nome, grupo: headMap.has(it.pid) ? `Grupo ${headMap.get(it.pid)}` : null }))
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd frontend && npx vitest run src/lib/cabecas-grupo.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/lib/cabecas-grupo.ts frontend/src/lib/cabecas-grupo.test.ts
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(eventos): helper cabecasComGrupo (todos os cabecas + grupo dos cabecas de grupo)"
```

---

### Task 2: Render no relatório + fiação nos dois call sites

**Files:**
- Modify: `frontend/src/pages/eventos/SorteioPrint.tsx`
- Modify: `frontend/src/pages/eventos/EventoInscricoes.tsx`

**Interfaces:**
- Consumes: `cabecasComGrupo` e `CabecaCampeao` da Task 1.
- Produces: prop `cabecas?: { nome: string; grupo: string | null }[]` em `Props` de `SorteioPrint`/`SorteioPrintContent`.

- [ ] **Step 1: Remover a derivação errada e adicionar a prop+render em SorteioPrint.tsx**

Em `frontend/src/pages/eventos/SorteioPrint.tsx`:

(a) No `type Props`, adicionar:
```ts
  cabecas?: { nome: string; grupo: string | null }[]
```

(b) Em `SorteioPrintContent`, **remover** o bloco atual que computa `const cabecas = ...` (derivação por `participantes[0]`) introduzido no commit `7882d12`.

(c) **Remover** também o bloco de render atual `{cabecas.length > 0 && (...)}` e substituí-lo por um que usa a prop, imediatamente **antes** do bloco `{p.modalidadeTipo === 'grupos' && p.resultado && (<SorteioGrupos ... />)}`:
```tsx
      {p.cabecas && p.cabecas.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Cabeças</div>
          <ol style={{ margin: 0, paddingLeft: 18, color: '#1e293b', fontSize: 12 }}>
            {p.cabecas.map((c, i) => <li key={i}>{c.nome}{c.grupo ? ` - ${c.grupo}` : ''}</li>)}
          </ol>
        </div>
      )}
```

- [ ] **Step 2: Import do helper em EventoInscricoes.tsx**

No topo de `frontend/src/pages/eventos/EventoInscricoes.tsx`, adicionar:
```ts
import { cabecasComGrupo } from '../../lib/cabecas-grupo'
```

- [ ] **Step 3: Montar `cabecas` no loop do Exportar HTML**

No `secoes = dados.map(({ modalidade: m, inscricoes: insc, campeoes: camps }) => { ... })`, antes do `return renderToStaticMarkup(`, adicionar:
```ts
        const grupos = tipo === 'grupos' && sorteio?.resultado ? ((sorteio.resultado as any).grupos ?? null) : null
        const cabecas = grupos ? cabecasComGrupo({
          campeoes: camps.map(c => ({ participante_id: c.participante_id, posicao: c.posicao, nome: c.participante?.nome ?? '—' })),
          inscritosIds: new Set(insc.map(i => i.participante_id)),
          anfitriaoPid: evento.anfitriao_id ?? null,
          anfitriaoNome: evento.anfitriao?.nome ?? null,
          consideraAnfitriao: evento.competicao?.considerar_anfitriao ?? false,
          grupos,
        }) : undefined
```
E no JSX `<SorteioPrintContent ... />` adicionar a prop `cabecas={cabecas}`.

- [ ] **Step 4: Montar `cabecas` no Imprimir da tela**

No bloco `{sorteioDaModalidade && tipoDaModalidade !== 'especifico' && modalidadeAtual && (<SorteioPrint ... />)}` (~linha 1057), calcular antes do return desse JSX (ou inline numa IIFE/variável no corpo do componente) e passar a prop. Como esse trecho está no render, criar a variável logo acima do `return` do componente não é prático; em vez disso, computar inline na prop:
```tsx
                    cabecas={tipoDaModalidade === 'grupos' && sorteioDaModalidade?.resultado
                      ? cabecasComGrupo({
                          campeoes: campeoes.map((c: any) => ({ participante_id: c.participante_id, posicao: c.posicao, nome: c.participante?.nome ?? '—' })),
                          inscritosIds: new Set(inscricoes.map((i: any) => i.participante_id)),
                          anfitriaoPid: evento?.anfitriao_id ?? null,
                          anfitriaoNome: evento?.anfitriao?.nome ?? null,
                          consideraAnfitriao: evento?.competicao?.considerar_anfitriao ?? false,
                          grupos: (sorteioDaModalidade.resultado as any).grupos ?? null,
                        })
                      : undefined}
```
(Os identificadores `campeoes`, `inscricoes`, `evento`, `sorteioDaModalidade`, `tipoDaModalidade` já existem nesse escopo — confirmar ao editar.)

- [ ] **Step 5: Build**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros.

- [ ] **Step 6: Verificação manual (rápida)**

Exportar HTML (e/ou Imprimir) de um evento com modalidade de grupos sorteada:
- a seção "Cabeças" lista **todos** os campeões (+ anfitrião quando aplica);
- só os cabeças de grupo têm "- Grupo X"; os demais aparecem só com o nome;
- ordem por posição, anfitrião sintético ao final;
- chaves/ordem não mostram a seção.
(Se não for possível rodar a UI, declarar explicitamente.)

- [ ] **Step 7: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/pages/eventos/SorteioPrint.tsx frontend/src/pages/eventos/EventoInscricoes.tsx
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(eventos): relatorio lista todos os cabecas e o grupo dos cabecas de grupo"
```

---

## Notas finais

- Sem backend/migration. Só frontend.
- A seção aparece no Exportar HTML e no Imprimir (mesmo `SorteioPrintContent`).
- Promoção `develop` → `main` só com confirmação do Wagner.
