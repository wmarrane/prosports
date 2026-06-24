# Modo Congresso: lista de modalidades recolhível + congelar só até o Seed no Sorteio — Design

**Data:** 2026-06-24
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Dois ajustes na tela "Modo Congresso" (app admin, React/Vite):
1. **Etapa Modalidade:** a lista de modalidades ganha ação de **expandir/recolher** (um botão único recolhe a lista inteira; sempre visível; inicia expandida).
2. **Etapa Sorteio:** congelar o cabeçalho **somente até o Seed** — o banner de **cabeças** deixa de ficar fixo e passa a **rolar** junto com o resultado.

## Contexto (código)

- **Modalidade:** `frontend/src/pages/congresso/CongressoStepModalidade.tsx`. O grid `<div className="cw-md">` tem 2 filhos: `<div className="cw-md-list" ref={listRef}>` (lista) e `<div className="cw-md-detail">` (card). CSS: `.cw-md { display: grid; grid-template-columns: 360px 1fr; ... }`; `.cw-md-list { display:flex; flex-direction:column; gap:8px; }`. Há media query `@media (max-width:1280px){ .cw-md{grid-template-columns:1fr} .cw-md-detail{order:-1; ...} }` (card no topo, lista abaixo).
- **Sorteio:** `frontend/src/pages/congresso/CongressoStepSorteio.tsx`. No render do resultado (estado "sorteado"), o container é flex-column `height:100%`; em ordem: (a) cabeçalho (badge + nome + `seed:` + botões PDF/Novo sorteio), (b) **banner "Cabeças"** (`{cabecasInscritas.length > 0 && (...)}`), (c) `<div style={{ flex:1, overflowY:'auto', minHeight:0 }}>` com `SorteioGrupos/Chaves/Ordem`. Hoje (a) e (b) ficam congelados; só (c) rola.

## Mudança 1 — Lista de modalidades recolhível

`CongressoStepModalidade.tsx`:
- Importar `ChevronUp, ChevronDown` de `lucide-react` (já importa `Check, ArrowRight, FileText`).
- Adicionar estado: `const [listaAberta, setListaAberta] = useState(true)`.
- Envolver o toggle + a lista num wrapper `.cw-md-listcol` (passa a ser o 1º filho do grid `.cw-md`, no lugar direto de `.cw-md-list`):
  ```tsx
  <div className="cw-md-listcol">
    <button
      type="button"
      className="cw-md-list-toggle"
      onClick={() => setListaAberta(v => !v)}
      aria-expanded={listaAberta}
    >
      <span>Modalidades <b>{modalidades.length}</b></span>
      {listaAberta ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
    </button>
    {listaAberta && (
      <div className="cw-md-list" ref={listRef}>
        {/* itens existentes, inalterados */}
      </div>
    )}
  </div>
  ```
- `.cw-md-detail` (card) permanece como 2º filho do grid — o empilhamento ≤1280 (`order:-1`) segue válido (card no topo, wrapper da lista abaixo).
- Observação: o `useEffect` de `scrollIntoView` no `listRef` só roda quando a lista está aberta (quando fechada, `listRef.current` é null e o efeito sai cedo — comportamento ok).

CSS novo em `frontend/src/styles/congresso-wizard.css`:
```css
.cw-md-listcol { display: flex; flex-direction: column; gap: 8px; }
.cw-md-list-toggle {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  width: 100%; padding: 12px 16px; border-radius: 15px; cursor: pointer;
  background: var(--cw-card); border: 1.5px solid var(--cw-card-bd); color: var(--cw-fg);
  font-size: 15px; font-weight: 700; letter-spacing: -0.01em;
}
.cw-md-list-toggle:hover { border-color: var(--cw-card-sel); }
.cw-md-list-toggle b { color: var(--cw-faint); font-weight: 700; margin-left: 4px; }
```

## Mudança 2 — Congelar só até o Seed (etapa Sorteio)

`CongressoStepSorteio.tsx`:
- **Mover** o bloco do banner de cabeças (`{cabecasInscritas.length > 0 && (<div ...>Cabeças...</div>)}`) da posição atual (entre o cabeçalho e o `<div flex:1>`) para **dentro** do `<div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>`, como **primeiro filho**, antes dos blocos `SorteioGrupos/Chaves/Ordem`.
- Nenhuma mudança na lógica/markup interno do banner — apenas reposicionamento. Resultado: o cabeçalho (modalidade + seed + botões) continua congelado; o banner de cabeças rola com o resultado.

## Testes / Verificação

- `npm run build` (frontend; `tsc -b && vite build`) sem erros.
- Verificação manual no Modo Congresso:
  - **Modalidade:** botão "Modalidades (N)" recolhe/expande a lista; inicia expandida; funciona em ≤1280 (card em cima, lista/recolher abaixo) e >1280 (2 colunas).
  - **Sorteio:** ao rolar o resultado, o cabeçalho até o `seed:` permanece fixo e o banner de cabeças **rola** junto com o conteúdo.
- Sem teste unitário dedicado (UI/CSS). Sem backend/migration.

## Fora de escopo

- Recolher por grupo/esporte (decisão: botão único para a lista toda).
- Outras etapas do congresso ou outras telas.
- Mudar a lógica de seleção automática de modalidade ou o conteúdo do banner de cabeças.
