# Modo Congresso: lista recolhível + congelar só até o Seed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Etapa Modalidade: lista de modalidades com botão único de recolher/expandir (inicia expandida). (2) Etapa Sorteio: congelar o cabeçalho só até o Seed, deixando o banner de cabeças rolar com o resultado.

**Architecture:** Mudanças de frontend (app admin React/Vite). Item 1: estado `listaAberta` + wrapper `.cw-md-listcol` em `CongressoStepModalidade.tsx` e CSS novo. Item 2: reposicionar o bloco do banner de cabeças para dentro da área rolável em `CongressoStepSorteio.tsx`. Sem backend/migration.

**Tech Stack:** React 18 + TS + lucide-react; CSS `congresso-wizard.css`; build `tsc -b && vite build`.

**Spec:** `docs/superpowers/specs/2026-06-24-modo-congresso-lista-recolhivel-e-header-sorteio-design.md`

## Global Constraints

- Só frontend (app admin). Sem mudar lógica de seleção de modalidade nem o conteúdo do banner de cabeças.
- Git identity não configurada → commit com `-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`; caminhos absolutos com `git -C`. Windows host; ler arquivos antes de editar.

---

### Task 1: Lista de modalidades recolhível (etapa Modalidade)

**Files:**
- Modify: `frontend/src/pages/congresso/CongressoStepModalidade.tsx`
- Modify: `frontend/src/styles/congresso-wizard.css`

- [ ] **Step 1: Imports e estado**

Em `frontend/src/pages/congresso/CongressoStepModalidade.tsx`:
- Trocar o import de ícones (hoje `import { Check, ArrowRight, FileText } from 'lucide-react'`) por:
  ```ts
  import { Check, ArrowRight, FileText, ChevronUp, ChevronDown } from 'lucide-react'
  ```
- No corpo do componente, junto dos outros `useState` (após `const [selectedId, setSelectedId] = useState<number | null>(null)`), adicionar:
  ```ts
  const [listaAberta, setListaAberta] = useState(true)
  ```

- [ ] **Step 2: Envolver toggle + lista no wrapper `.cw-md-listcol`**

No JSX, o bloco atual é:
```tsx
        {/* Lista esquerda */}
        <div className="cw-md-list" ref={listRef}>
          {modalidades.map(m => {
            ...itens...
          })}
        </div>
```
Trocar por (toggle + lista dentro de um wrapper):
```tsx
        {/* Lista esquerda (recolhível) */}
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
              {modalidades.map(m => {
                ...itens... (manter exatamente o conteúdo atual do .map)
              })}
            </div>
          )}
        </div>
```
(Manter o conteúdo interno do `.map` idêntico ao atual — apenas envolver.)

- [ ] **Step 3: CSS do wrapper e do toggle**

Em `frontend/src/styles/congresso-wizard.css`, adicionar (perto das regras `.cw-md-*`, ex.: após `.cw-md-list { ... }`):
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

- [ ] **Step 4: Build**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros.

- [ ] **Step 5: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/pages/congresso/CongressoStepModalidade.tsx frontend/src/styles/congresso-wizard.css
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(congresso): lista de modalidades recolhivel (expandir/recolher)"
```

---

### Task 2: Congelar só até o Seed na etapa Sorteio

**Files:**
- Modify: `frontend/src/pages/congresso/CongressoStepSorteio.tsx`

Contexto: no render do resultado, a ordem dos filhos do container flex-column é: (a) cabeçalho (badge/nome/`seed:`/botões), (b) bloco do banner de cabeças `{cabecasInscritas.length > 0 && (<div ...>... Cabeças ...</div>)}`, (c) `<div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>` com `SorteioGrupos/Chaves/Ordem`. Hoje (a) e (b) ficam congelados; só (c) rola.

- [ ] **Step 1: Mover o banner de cabeças para dentro da área rolável**

Recortar TODO o bloco `{cabecasInscritas.length > 0 && ( ... )}` da posição atual (entre o cabeçalho e o `<div flex:1>`) e colá-lo como **primeiro filho** dentro do `<div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>`, imediatamente antes do `{sorteio.tipo === 'grupos' && (<SorteioGrupos .../>)}`. Não alterar o conteúdo interno do bloco.

Estrutura resultante (resumo):
```tsx
      {/* cabeçalho: badge + nome + seed + botões (continua congelado) */}
      <div style={{ marginBottom: 20, display: 'flex', ... }}> ... seed ... </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {cabecasInscritas.length > 0 && (
          <div ...> ...Cabeças... </div>
        )}
        {sorteio.tipo === 'grupos' && (<SorteioGrupos ... />)}
        {sorteio.tipo === 'chaves' && (<SorteioChaves ... />)}
        {sorteio.tipo === 'ordem_entrada' && (<SorteioOrdem ... />)}
        {erro && <p ...>{erro}</p>}
      </div>
```

- [ ] **Step 2: Build**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros.

- [ ] **Step 3: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/pages/congresso/CongressoStepSorteio.tsx
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(congresso): sorteio congela so ate o seed; cabecas rolam com o resultado"
```

---

### Task 3: Verificação manual (UI)

**Files:** nenhum.

- [ ] **Step 1: Conferir no Modo Congresso**

`cd frontend && npm run dev`; abrir Modo Congresso:
- **Modalidade:** o botão "Modalidades (N)" recolhe/expande a lista inteira; inicia expandida; funciona em >1280 (2 colunas) e ≤1280 (card no topo, controle+lista abaixo).
- **Sorteio:** ao rolar o resultado de uma modalidade sorteada (grupos/chaves), o cabeçalho até `seed:` permanece fixo e o **banner de cabeças rola** junto com o conteúdo.
(Se não for possível rodar a UI, declarar explicitamente; os builds das Tasks 1-2 já garantem a compilação.)

---

## Notas finais

- Sem backend/migration. Só frontend (app admin).
- Promoção `develop` → `main` só com confirmação do Wagner.
