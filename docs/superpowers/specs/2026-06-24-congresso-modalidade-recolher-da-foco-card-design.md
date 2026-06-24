# Modo Congresso — recolher a lista dá foco no card (largura total) — Design

**Data:** 2026-06-24
**Status:** Aprovado (aguardando revisão da spec)

## Problema

Na etapa Modalidade, ao recolher a lista (toggle "Modalidades (N)"), os itens somem, mas a **coluna de 360px continua reservada** no grid `.cw-md` (`grid-template-columns: 360px 1fr`). Resultado: o card **não** ganha espaço — sobra uma coluna quase vazia. O ideal é que recolher **libere o espaço horizontal** e o card ocupe a **largura toda** (dar foco no card).

## Contexto

- `frontend/src/pages/congresso/CongressoStepModalidade.tsx`: grid `<div className="cw-md">` com 2 filhos: `<div className="cw-md-listcol">` (toggle + `.cw-md-list` condicional ao estado `listaAberta`) e `<div className="cw-md-detail">` (card). Estado `const [listaAberta, setListaAberta] = useState(true)` já existe.
- `frontend/src/styles/congresso-wizard.css`: `.cw-md { display: grid; grid-template-columns: 360px 1fr; gap: 24px; align-items: start; }`; media query `@media (max-width:1280px){ .cw-md{grid-template-columns:1fr} .cw-md-detail{order:-1; ...} }`.

## Decisão

Quando recolhida, o grid vira **coluna única** (`grid-template-columns: 1fr`), via classe condicional. A barra do toggle (único conteúdo de `.cw-md-listcol` quando recolhido) fica no topo e o card ocupa 100% da largura.

## Mudança

`CongressoStepModalidade.tsx`:
- Trocar `<div className="cw-md">` por:
  ```tsx
  <div className={`cw-md${listaAberta ? '' : ' cw-md--recolhido'}`}>
  ```

`frontend/src/styles/congresso-wizard.css` (adicionar perto de `.cw-md`):
```css
.cw-md--recolhido { grid-template-columns: 1fr; }
```

## Comportamento por tamanho

- **>1280, expandido:** 2 colunas (lista | card) — inalterado.
- **>1280, recolhido:** 1 coluna → toggle no topo, **card full width** (foco no card).
- **≤1280:** já é 1 coluna (card no topo via `order:-1`); recolher mantém 1 coluna e só esconde os itens — consistente. (A classe `cw-md--recolhido` define o mesmo `1fr`; sem conflito.)

## Testes / Verificação

- `npm run build` (frontend) sem erros.
- Manual: na etapa Modalidade (>1280), recolher → o card passa a ocupar a largura toda com a barra do toggle acima; expandir → volta a 2 colunas. Em ≤1280, recolher/expandir só mostra/esconde os itens, card sempre full width.
- Sem teste unitário (CSS/render). Sem backend/migration.

## Fora de escopo

- Animação de transição do recolher.
- Mudar o conteúdo do toggle ou a lógica de seleção.
