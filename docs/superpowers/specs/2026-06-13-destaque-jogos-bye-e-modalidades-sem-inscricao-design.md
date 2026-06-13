# Destaque de jogos com bye + modalidades sem inscrição — Design

**Data:** 2026-06-13
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Duas sinalizações visuais pequenas e independentes, **somente frontend**:

1. **Chaves:** destacar os **jogos com bye** com fundo âmbar suave (diferente dos demais jogos), em todas as visualizações de chaves (admin + site público).
2. **Lista de modalidades do evento:** sinalizar com cor de alerta + selo as modalidades **sem inscrição**.

## Contexto atual

- O bracket de chaves é desenhado por `frontend/src/components/sorteio-result/SorteioChaves.tsx`, que tem **três caminhos de render**:
  - `BracketTree.tsx` (preferido, v1.19.0): bracket gráfico; cada match é um card (`layout.matches.map`).
  - `MatchCard` legado (sorteios pré-v1.18.0, sem `byePositions`): colunas de rodadas.
  - Lista vertical (v1.18.1): lista de slots 1→N com label "BYE — avança direto" nas posições de bye.
- O **site público** (`frontend/src/site-publico/components/ModalidadeSorteio.tsx`) reutiliza `SorteioChaves`, então herda as mudanças (reflete após republicar — snapshot estático).
- A lista lateral de modalidades por evento está em `frontend/src/pages/eventos/EventoInscricoes.tsx` (botões da sidebar). O número de inscritos vem de `countsByModalidade[m.id] ?? 0` (query `['inscricoes-counts', eventoId]`).

## Feature 1 — Jogos com bye em chaves

Um **jogo com bye** é um confronto em que um dos lados é BYE (o outro participante avança direto). Destaque: **fundo âmbar suave** (`var(--warn-soft)`) com **borda âmbar** (`var(--warn)`), aplicado ao card/linha do jogo. Os demais jogos permanecem com o estilo atual.

### Detecção (helper puro)

Criar `frontend/src/lib/bye-chaves.ts` com uma função pura testável:

```ts
export function isByeRef(ref: string, slots: (number | null)[]): boolean {
  if (ref === 'BYE') return true
  if (ref.startsWith('P')) {
    const pos = parseInt(ref.slice(1), 10)
    return Number.isFinite(pos) && (slots[pos - 1] ?? null) === null
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

Isso cobre V1 (slot nulo num `P{n}`) e V2 (stub de bye `B…`, cujo `bottom` é `'BYE'`). O caso `V:B{k}` resolve para um nome de jogador (não é bye) — corretamente não marcado.

### Aplicação

- **`BracketTree.tsx`** — para cada `m` em `layout.matches`, calcular `bye = matchIsBye(m, slots)`. No `<div>` do card (hoje `bg-[var(--card-bg-2)]` + `border: m.isFinal ? '2px solid #f59e0b' : '1.5px solid var(--t2)'`):
  - quando `bye`: `background: var(--warn-soft)` e `border: 1.5px solid var(--warn)` (a borda da Final, `2px solid #f59e0b`, tem precedência se `m.isFinal` — um match Final que também é bye mantém a borda da Final, só o fundo fica âmbar).
  - quando não-bye: mantém o atual.
- **`SorteioChaves.tsx` legado (`MatchCard`)** — só a rodada 0 tem bye real. No `map` do fallback legado, computar `isBye = r === 0 && ((match.top === null) !== (match.bottom === null))` (XOR: exatamente um lado nulo) e passar como prop `isBye` ao `MatchCard`. No `MatchCard`, quando `isBye`, o `<div>` raiz usa `background: var(--warn-soft)` + `border-color: var(--warn)` no lugar de `bg-[var(--card-bg-2)] border-[var(--card-border)]`.
- **`SorteioChaves.tsx` lista vertical (v1.18.1)** — o `<li>` cujo `isBye` (já calculado, `byeSet.has(pos)`) é true recebe `background: var(--warn-soft)` (com leve padding/borda-radius para o realce ficar contido).

### Token de cor no site público

`var(--warn-soft)`/`var(--warn)` precisam existir no tema do **site público** (bundle próprio do `build:site`). Antes de implementar, verificar se esses tokens estão definidos no CSS do site (`frontend/src/site-publico/site-entry.css` ou equivalente). Se **não** estiverem, definir uma cor âmbar literal de fallback usada apenas nos componentes de chaves (ex.: fundo `#fef3c7`, borda `#f59e0b`), de modo que admin e site fiquem consistentes. (O admin já tem `--warn-soft`/`--warn`.)

## Feature 2 — Modalidades sem inscrição

Em `frontend/src/pages/eventos/EventoInscricoes.tsx`, na lista lateral de modalidades (botões `modalidades.map`):

- Calcular `semInscricao = (countsByModalidade[m.id] ?? 0) === 0`.
- **Fundo da linha:** se a modalidade está **selecionada** (`active`), mantém o destaque azul atual (brand) — sem mudança. Se **não** selecionada e `semInscricao`, o fundo passa a âmbar suave (`var(--warn-soft)`) em vez de `transparent`. O hover continua funcionando (não sobrescreve permanentemente).
- **Selo:** quando `semInscricao`, exibir um selo pequeno "Sem inscritos" (cor de alerta, ex.: texto `var(--warn-700)` sobre `var(--warn-soft)` com borda `var(--warn)`), junto ao nome da modalidade.
- **Contador:** o badge de contagem, quando `0`, fica em cor de alerta (texto/borda warn) em vez do estilo neutro atual.

Modalidades selecionada + sem inscrição: mantém o fundo azul de seleção, mas o selo "Sem inscritos" e o contador em alerta continuam visíveis.

## Tratamento de erros / casos

- Sorteio sem nenhum bye: nenhum card/linha destacado (comportamento idêntico ao atual).
- `matchIsBye` com `ref` inesperado (ex.: `V:`/`L:`): retorna false (não destaca).
- Lista de modalidades vazia: nada a sinalizar.
- Site público é snapshot: o destaque de bye só aparece após **republicar** o evento.

## Testes

- **Frontend (Vitest, funções puras):** `isByeRef` (BYE; `P{n}` nulo → true; `P{n}` preenchido → false; `V:`/`L:` → false) e `matchIsBye` (bye no top, no bottom, em nenhum).
- **Build + manual:** `npm run build`; manual no admin (bye âmbar nos três renders de chaves; demais jogos inalterados); lista do evento (modalidade sem inscrito com fundo âmbar + selo "Sem inscritos" + contador 0 em alerta; selecionada mantém azul); site público após publicar um evento sorteado com bye.
- Sem backend/migration.

## Fora de escopo

- Mudar o **layout/seeding** do bracket (apenas realce cosmético; não depende de `chave_versao`).
- Destacar byes em relatórios PDF/HTML exportados (só telas de chaves e site público).
- Filtrar/ordenar modalidades por "sem inscrição" (apenas sinalização visual).
