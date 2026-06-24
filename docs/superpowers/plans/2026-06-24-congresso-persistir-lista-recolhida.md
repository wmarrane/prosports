# Modo Congresso — persistir estado recolhido da lista — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O estado recolhido/expandido da lista de modalidades persiste (localStorage global), sobrevivendo a remontagens da etapa e a reload.

**Architecture:** Frontend (app admin). `listaAberta` passa a iniciar a partir do localStorage e a gravar a cada toggle. Chave global. Sem backend.

**Tech Stack:** React + TS; localStorage; build `tsc -b && vite build`.

**Spec:** `docs/superpowers/specs/2026-06-24-congresso-persistir-lista-recolhida-design.md`

## Global Constraints

- Chave global `prosports.congresso.lista-aberta`; default expandida (só `'false'` recolhe).
- Só frontend (`CongressoStepModalidade.tsx`). Git identity não configurada → commit com `-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`; caminhos absolutos com `git -C`. Windows host; ler o arquivo antes de editar.

---

### Task 1: Persistir `listaAberta` em localStorage

**Files:**
- Modify: `frontend/src/pages/congresso/CongressoStepModalidade.tsx`

- [ ] **Step 1: Definir a chave**

No topo do módulo `frontend/src/pages/congresso/CongressoStepModalidade.tsx`, junto da const existente `const EMPTY_IDS: Set<number> = new Set()`, adicionar:
```ts
const LISTA_KEY = 'prosports.congresso.lista-aberta'
```

- [ ] **Step 2: Init lazy do estado a partir do localStorage**

Trocar:
```ts
  const [listaAberta, setListaAberta] = useState(true)
```
por:
```ts
  const [listaAberta, setListaAberta] = useState<boolean>(() => {
    try { return localStorage.getItem(LISTA_KEY) !== 'false' } catch { return true }
  })
```

- [ ] **Step 3: Gravar no toggle**

No botão `.cw-md-list-toggle`, trocar o `onClick` atual:
```tsx
            onClick={() => setListaAberta(v => !v)}
```
por:
```tsx
            onClick={() => setListaAberta(v => {
              const nv = !v
              try { localStorage.setItem(LISTA_KEY, String(nv)) } catch { /* storage indisponível */ }
              return nv
            })}
```

- [ ] **Step 4: Build**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros.

- [ ] **Step 5: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/pages/congresso/CongressoStepModalidade.tsx
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(congresso): persiste estado recolhido da lista (localStorage global)"
```

- [ ] **Step 6: Verificação manual (rápida)**

`cd frontend && npm run dev`; etapa Modalidade: recolher a lista → navegar para outra modalidade e voltar → continua **recolhida**; clicar no toggle → expande; recarregar a página → mantém a última preferência. (Se não der pra rodar a UI, declarar; o build do Step 4 garante a compilação.)

---

## Notas finais
- Sem backend/migration. Promoção `develop` → `main` só com confirmação do Wagner.
