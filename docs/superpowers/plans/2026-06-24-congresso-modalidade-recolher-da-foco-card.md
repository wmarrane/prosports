# Modo Congresso — recolher a lista dá foco no card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao recolher a lista de modalidades, o card passa a ocupar a largura toda (grid vira coluna única).

**Architecture:** Frontend (app admin). Classe condicional `cw-md--recolhido` no grid `.cw-md` quando `listaAberta === false`, + 1 regra CSS que define `grid-template-columns: 1fr`. Sem backend.

**Tech Stack:** React + TS; CSS `congresso-wizard.css`; build `tsc -b && vite build`.

**Spec:** `docs/superpowers/specs/2026-06-24-congresso-modalidade-recolher-da-foco-card-design.md`

## Global Constraints

- Só frontend. Git identity não configurada → commit com `-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`; caminhos absolutos com `git -C`. Windows host; ler arquivos antes de editar.

---

### Task 1: Card full width ao recolher

**Files:**
- Modify: `frontend/src/pages/congresso/CongressoStepModalidade.tsx`
- Modify: `frontend/src/styles/congresso-wizard.css`

- [ ] **Step 1: Classe condicional no grid**

Em `frontend/src/pages/congresso/CongressoStepModalidade.tsx`, localizar a abertura do grid:
```tsx
      <div className="cw-md">
```
Trocar por:
```tsx
      <div className={`cw-md${listaAberta ? '' : ' cw-md--recolhido'}`}>
```
(O `listaAberta` já existe no componente. Nada mais muda no JSX.)

- [ ] **Step 2: Regra CSS**

Em `frontend/src/styles/congresso-wizard.css`, adicionar logo após a regra base `.cw-md { ... }`:
```css
.cw-md--recolhido { grid-template-columns: 1fr; }
```

- [ ] **Step 3: Build**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros.

- [ ] **Step 4: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/pages/congresso/CongressoStepModalidade.tsx frontend/src/styles/congresso-wizard.css
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(congresso): recolher a lista da foco no card (largura total)"
```

- [ ] **Step 5: Verificação manual (rápida)**

`cd frontend && npm run dev`; etapa Modalidade (>1280px): recolher → o card ocupa a largura toda, com a barra do toggle no topo; expandir → volta a 2 colunas. Em ≤1280px: recolher/expandir só mostra/esconde os itens (card sempre full width). (Se não der pra rodar a UI, declarar; o build do Step 3 garante a compilação.)

---

## Notas finais
- Sem backend/migration. Promoção `develop` → `main` só com confirmação do Wagner.
