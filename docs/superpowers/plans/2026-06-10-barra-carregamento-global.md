# Barra de carregamento global — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Barra de progresso no topo, ligada ao react-query, que dá feedback de carregamento em todas as telas automaticamente.

**Architecture:** Componente `GlobalLoadingBar` usa `useIsFetching`+`useIsMutating`; com delay anti-flicker mostra uma barra fina animada (CSS). Montado uma vez no `App` (dentro do `QueryClientProvider` do `main`), cobrindo todas as rotas.

**Tech Stack:** React 18, @tanstack/react-query, CSS. Spec: `docs/superpowers/specs/2026-06-10-barra-carregamento-global-design.md`.

---

## File Structure

- `frontend/src/components/GlobalLoadingBar.tsx` — componente da barra.
- `frontend/src/styles/prosports-theme.css` — classe `.global-loading-bar` + keyframes.
- `frontend/src/App.tsx` — monta a barra uma vez.

---

## Task 1: Componente + estilos

**Files:**
- Create: `frontend/src/components/GlobalLoadingBar.tsx`
- Modify: `frontend/src/styles/prosports-theme.css`

- [ ] **Step 1: Criar o componente**

Criar `frontend/src/components/GlobalLoadingBar.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'

export default function GlobalLoadingBar() {
  const fetching = useIsFetching()
  const mutating = useIsMutating()
  const ativo = fetching + mutating > 0
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    if (ativo) {
      const t = setTimeout(() => setVisivel(true), 120)
      return () => clearTimeout(t)
    }
    setVisivel(false)
  }, [ativo])

  if (!visivel) return null

  return (
    <div className="global-loading-bar" role="progressbar" aria-label="Carregando" aria-busy="true">
      <div className="global-loading-bar-inner" />
    </div>
  )
}
```

- [ ] **Step 2: Adicionar os estilos**

Adicionar ao final de `frontend/src/styles/prosports-theme.css`:

```css
/* Barra de carregamento global (react-query useIsFetching/useIsMutating) */
.global-loading-bar {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 3px;
  z-index: 9999;
  overflow: hidden;
  pointer-events: none;
  background: transparent;
}
.global-loading-bar-inner {
  position: absolute;
  top: 0;
  height: 100%;
  width: 40%;
  background: var(--brand-500);
  box-shadow: 0 0 8px var(--brand-500);
  animation: glb-slide 1.1s ease-in-out infinite;
}
@keyframes glb-slide {
  0%   { left: -40%; }
  100% { left: 100%; }
}
```

- [ ] **Step 3: Verificar tipos e build**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros citando `GlobalLoadingBar`.

Run: `cd frontend && npm run build`
Expected: conclui sem erros.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/GlobalLoadingBar.tsx frontend/src/styles/prosports-theme.css
git commit -m "feat(ui): componente GlobalLoadingBar + estilos"
```

---

## Task 2: Montar no App

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Importar e montar**

Em `frontend/src/App.tsx`:

(a) adicionar o import (junto aos outros imports do topo):
```tsx
import GlobalLoadingBar from './components/GlobalLoadingBar'
```

(b) montar a barra logo após a abertura de `<ToastProvider>` e antes de `<Routes>`. Substituir:
```tsx
      <ToastProvider>
      <Routes>
```
por:
```tsx
      <ToastProvider>
      <GlobalLoadingBar />
      <Routes>
```

- [ ] **Step 2: Verificar tipos e build**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros novos.

Run: `cd frontend && npm run build`
Expected: conclui sem erros.

- [ ] **Step 3: Verificação manual**

`cd frontend && npm run dev` (backend rodando):
- Navegar entre telas e abrir um evento → a barra fina aparece no topo durante o carregamento e some ao terminar.
- Executar uma ação (salvar/sortear) → a barra aparece durante a mutation.
- Cargas instantâneas (dados cacheados) → a barra **não** pisca (delay de 120ms).
- Aparece também no Modo Congresso, telas mobile e login (qualquer fetch).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(ui): monta GlobalLoadingBar no App (feedback em todas as telas)"
```

---

## Self-review (cobertura da spec)

- Barra global via `useIsFetching`+`useIsMutating` → Task 1 ✓
- Delay anti-flicker (~120ms) → Task 1 (Step 1) ✓
- Animação indeterminada + cor `var(--brand-500)` (theme-aware) → Task 1 (Step 2) ✓
- Montagem única cobrindo todas as rotas → Task 2 ✓
- Sem backend/migration. Validação por build + manual (hook react-query; sem testing-library).
