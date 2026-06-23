# Modo Congresso — Etapa Modalidade: empilhar lista abaixo do card em ≤1280px — Design

**Data:** 2026-06-17
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Na tela "Modo Congresso", etapa de Modalidade (`CongressoStepModalidade`), quando a largura da tela for **≤ 1280px**, exibir a **lista de modalidades abaixo do card** da modalidade (card no topo), em vez do layout de duas colunas (lista à esquerda, card à direita).

## Contexto

- Componente: `frontend/src/pages/congresso/CongressoStepModalidade.tsx`. Estrutura:
  - `<div className="cw-md">` contém, **nesta ordem no código**, `<div className="cw-md-list">` (lista) e `<div className="cw-md-detail">` (card/detalhe).
- CSS: `frontend/src/styles/congresso-wizard.css`:
  - `.cw-md { display: grid; grid-template-columns: 360px 1fr; gap: 24px; align-items: start; }` (linha ~200) → 2 colunas: lista | card.
  - `.cw-md-detail { ...; position: sticky; top: 0; align-self: start; max-height: calc(100vh - 200px); overflow-y: auto; }` (linha ~209).
  - Já existe `@media (max-width: 1024px) { ...; .cw-md { grid-template-columns: 1fr; } }` (linha ~314-318) — empilha, mas com a **lista em cima** (ordem do código) e esconde `.cw-step-label`/`.cw-brand-sub`.
- App admin é React/Vite (client-side) → media queries funcionam em runtime.

## Decisão

Empilhar a partir de **`max-width: 1280px`** (apenas largura), com o **card (`.cw-md-detail`) no topo** via `order: -1` (a ordem do código é lista→card; o `order` inverte só visualmente). Soltar o `sticky`/scroll interno do card quando empilhado. Remover a regra redundante de coluna única do bloco de 1024px (o bloco de 1280 já cobre ≤1024 com a ordem correta).

## Mudança (somente `frontend/src/styles/congresso-wizard.css`)

1. **Remover** do bloco `@media (max-width: 1024px)` apenas a linha:
   ```css
   .cw-md { grid-template-columns: 1fr; }
   ```
   (Manter as demais regras desse bloco: `.cw-step-label { display: none; }` e `.cw-brand-sub { display: none; }`.)

2. **Adicionar** um novo bloco (pode ser logo antes do `@media (max-width: 1024px)`, para ordenação por largura decrescente):
   ```css
   @media (max-width: 1280px) {
     .cw-md { grid-template-columns: 1fr; }
     .cw-md-detail { order: -1; position: static; max-height: none; overflow: visible; }
   }
   ```

Resultado:
- **> 1280px:** inalterado (2 colunas; lista à esquerda, card à direita; card sticky com scroll).
- **≤ 1280px:** coluna única; **card no topo**, **lista abaixo**; card flui naturalmente (sem sticky/scroll interno).

## Testes / Verificação

- `npm run build` (frontend; `tsc -b && vite build`) sem erros.
- Verificação manual no Modo Congresso → etapa Modalidade:
  - Em largura > 1280px: 2 colunas como hoje.
  - Em largura ≤ 1280px (ex.: 1280, 1024, 768): o card aparece em cima e a lista de modalidades abaixo dele.
- Sem teste unitário (mudança de CSS). Sem backend/migration.

## Fora de escopo

- Mudar a estrutura/JSX do componente (a inversão é só via CSS `order`).
- Outras etapas do congresso ou outras telas.
- Constrangimento por altura do viewport (decisão: só largura ≤ 1280px).
