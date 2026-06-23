# Modo Congresso — Etapa Modalidade: empilhar lista abaixo do card (≤1280px) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Em ≤1280px de largura, a etapa de Modalidade do Modo Congresso passa a exibir o card no topo e a lista de modalidades abaixo (coluna única), em vez de 2 colunas.

**Architecture:** Mudança exclusivamente de CSS no app admin (React/Vite, media queries em runtime). Empilha via `grid-template-columns: 1fr` e inverte a ordem visual com `order: -1` no card. Sem mudança de JSX/TSX, sem backend.

**Tech Stack:** CSS (`congresso-wizard.css`); build `tsc -b && vite build`.

**Spec:** `docs/superpowers/specs/2026-06-17-congresso-modalidade-stack-1280-design.md`

## Global Constraints

- Breakpoint: **`max-width: 1280px`** (apenas largura).
- Só CSS (`frontend/src/styles/congresso-wizard.css`); sem alterar o `.tsx`.
- Git identity não configurada → commit com `-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`; caminhos absolutos com `git -C`. Windows host; ler o arquivo antes de editar.

---

### Task 1: Empilhar etapa Modalidade em ≤1280px (CSS)

**Files:**
- Modify: `frontend/src/styles/congresso-wizard.css`

Estado atual relevante:
- `.cw-md { display: grid; grid-template-columns: 360px 1fr; gap: 24px; align-items: start; }`
- `.cw-md-detail { ...; position: sticky; top: 0; align-self: start; max-height: calc(100vh - 200px); overflow-y: auto; }`
- Bloco existente:
  ```css
  @media (max-width: 1024px) {
    .cw-step-label { display: none; }
    .cw-brand-sub { display: none; }
    .cw-md { grid-template-columns: 1fr; }
  }
  ```

- [ ] **Step 1: Remover a regra redundante de coluna única do bloco de 1024px**

No bloco `@media (max-width: 1024px)`, **remover apenas** a linha:
```css
  .cw-md { grid-template-columns: 1fr; }
```
O bloco deve ficar:
```css
@media (max-width: 1024px) {
  .cw-step-label { display: none; }
  .cw-brand-sub { display: none; }
}
```

- [ ] **Step 2: Adicionar o bloco de 1280px**

Inserir, **imediatamente antes** do `@media (max-width: 1024px)`:
```css
@media (max-width: 1280px) {
  .cw-md { grid-template-columns: 1fr; }
  .cw-md-detail { order: -1; position: static; max-height: none; overflow: visible; }
}
```

- [ ] **Step 3: Build do frontend**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros.

- [ ] **Step 4: Verificação manual (rápida)**

`cd frontend && npm run dev`; abrir Modo Congresso → etapa "Modalidades do evento":
- Largura **> 1280px**: 2 colunas (lista à esquerda, card à direita) — inalterado.
- Largura **≤ 1280px** (ex.: 1280, 1024, 768): **card no topo** e **lista de modalidades abaixo**; o card flui naturalmente (sem barra de rolagem interna).
(Se não for possível rodar a UI, declarar explicitamente; o build do Step 3 já garante a compilação.)

- [ ] **Step 5: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/styles/congresso-wizard.css
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(congresso): etapa modalidade empilha lista abaixo do card em <=1280px"
```

---

## Notas finais

- Sem backend/migration. Só CSS do app admin.
- Promoção `develop` → `main` só com confirmação do Wagner.
