# Modo Congresso: melhorias de apresentação (Confirmados + Sorteio) — Design

**Data:** 2026-06-16
**Status:** Aprovado (aguardando revisão da spec)

## Problema

Melhorias de apresentação no Modo Congresso (somente frontend, sem mudança de regra/sorteio):

1. **Etapa "Participantes confirmados"** (`CongressoStepParticipantes.tsx`):
   - 1.1 O título "Participantes confirmados" sobressai na leitura; o nome da modalidade deveria ser o destaque. Inverter:
     - Hoje: `h1` = "Participantes confirmados"; subtítulo = "{Modalidade} · N confirmados".
     - Desejado: `h1` = "{Modalidade}"; subtítulo = "Participantes confirmados · N confirmados".
   - 1.2 A fonte da lista de participantes confirmados está pequena; aumentar.
2. **Etapa "Sorteio"** (`CongressoStepSorteio.tsx`): no banner "Cabeças", o anfitrião aparece **no fim** da lista (campeões por posição + anfitrião acrescentado), fora da sequência dos grupos. Quando houver anfitrião, ele deve aparecer **na sequência dos grupos** (na posição do grupo dele). **Apenas apresentação** — a regra de cabeças/anfitrião e o sorteio **não mudam**.

## Contexto (código)

- `frontend/src/pages/congresso/CongressoStepParticipantes.tsx:87-97` — cabeçalho com `ModalityBadge` + `<h1 className="cw-h1">Participantes confirmados</h1>` e `<p className="cw-sub">{modalidade?.nome} · <b>{N}</b> confirmados</p>`.
- Lista: `.cw-prow` (linha 124-148), classes em `frontend/src/styles/congresso-wizard.css`:
  - `.cw-prow-name { font-size: clamp(17px, 1.4vw, 21px); font-weight: 700; ... }` (linha 119)
  - `.cw-prow-club { font-size: 13.5px; ... }` (linha 120)
  - `.cw-prow-n { font-size: 15px; ... }` (linha 117)
- `frontend/src/pages/congresso/CongressoStepSorteio.tsx:148-203` — `cabecasComGrupo` (useMemo): monta `items` = campeões (`cabecasInscritas`, por posição) + anfitrião sintético no fim; calcula `slotLabel` ("Grupo X" para grupos; "Nª cabeça" para chaves) só para quem é cabeça por regra. Render do banner em `:429` itera `cabecasComGrupo.map(...)` na ordem do array.

## Mudanças

### Item 1.1 — Inverter cabeçalho (`CongressoStepParticipantes.tsx`)
Trocar o bloco (linhas ~93-96):
```tsx
<h1 className="cw-h1" style={{ marginBottom: 6 }}>Participantes confirmados</h1>
<p className="cw-sub" style={{ margin: 0 }}>
  {modalidade?.nome} · <b style={{ color: FG }}>{inscricoes.length}</b> {inscricoes.length === 1 ? 'confirmado' : 'confirmados'}
</p>
```
Por:
```tsx
<h1 className="cw-h1" style={{ marginBottom: 6 }}>{modalidade?.nome ?? 'Modalidade'}</h1>
<p className="cw-sub" style={{ margin: 0 }}>
  Participantes confirmados · <b style={{ color: FG }}>{inscricoes.length}</b> {inscricoes.length === 1 ? 'confirmado' : 'confirmados'}
</p>
```

### Item 1.2 — Aumentar fonte da lista (`congresso-wizard.css`)
- `.cw-prow-name`: `clamp(17px, 1.4vw, 21px)` → `clamp(20px, 1.8vw, 26px)`.
- `.cw-prow-club`: `13.5px` → `15px`.
- `.cw-prow-n`: `15px` → `17px`.
(Apenas tamanhos; sem mudar peso/cor/layout.)

### Item 2 — Anfitrião na sequência dos grupos (apresentação) (`CongressoStepSorteio.tsx`)
No `useMemo` `cabecasComGrupo`, além de `slotLabel`, registrar uma ordem numérica `slotOrder` e **retornar os itens ordenados** por essa sequência (itens com grupo/cabeça primeiro, na ordem do slot; itens sem slot depois, mantendo a ordem atual). Assim o anfitrião aparece na posição do grupo dele.

- Adicionar `slotOrder: number | null` ao tipo `Item` (default `null`).
- Em grupos: ao casar `g = grupos.find(...participantes[0]===pid)`, definir `it.slotOrder = grupos.indexOf(g)` (índice do grupo: A=0, B=1, …) junto de `it.slotLabel`.
- Em chaves: ao achar `idx = cabecasFinais.indexOf(pid)`, definir `it.slotOrder = idx` junto de `it.slotLabel`.
- Antes do `return items`, ordenar de forma estável:
```ts
return [...items].sort((a, b) => (a.slotOrder ?? Infinity) - (b.slotOrder ?? Infinity))
```
(`Array.prototype.sort` é estável em engines modernos; itens sem slot preservam a ordem relativa.)

Render do banner (`:429`) permanece igual (já itera na ordem do array).

## Testes / Verificação

- `npm run build` (frontend; `tsc -b && vite build`).
- Verificação manual no Modo Congresso:
  - Confirmados: título = nome da modalidade; subtítulo "Participantes confirmados · N confirmados"; lista com fonte maior e legível.
  - Sorteio: com anfitrião considerado (ex.: 3 grupos), o banner mostra as cabeças em sequência A, B, C com o anfitrião em "Grupo C" (não mais no fim); o sorteio em si inalterado.
- Sem teste unitário dedicado (apresentação); a lógica de `slotOrder` é trivial. Sem backend/migration.

## Fora de escopo

- Alterar a regra do anfitrião/cabeças ou o engine de sorteio (explicitamente **não** muda).
- Outras etapas do congresso (Campeões, Modalidade, Evento).
- Banner de cabeças em outras telas (ex.: relatório) — esta mudança é só na etapa Sorteio do congresso.
