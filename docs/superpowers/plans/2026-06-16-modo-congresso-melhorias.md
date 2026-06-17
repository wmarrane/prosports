# Modo Congresso: melhorias de apresentação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na etapa "Participantes confirmados", destacar o nome da modalidade e aumentar a fonte da lista; na etapa "Sorteio", exibir as cabeças do banner na sequência dos grupos (anfitrião no grupo dele) — só apresentação.

**Architecture:** Mudanças exclusivamente de frontend. Item 1: inverter `h1`/subtítulo em `CongressoStepParticipantes.tsx` e aumentar tamanhos em `congresso-wizard.css`. Item 2: no `useMemo` `cabecasComGrupo` de `CongressoStepSorteio.tsx`, registrar `slotOrder` e retornar os itens ordenados pela sequência do grupo/cabeça (sem mexer na regra/engine).

**Tech Stack:** React 18 + TS; build `tsc -b && vite build`. Sem testes unitários (mudança de apresentação).

**Spec:** `docs/superpowers/specs/2026-06-16-modo-congresso-melhorias-design.md`

## Global Constraints

- Sem mudança de regra do anfitrião/cabeças nem do engine de sorteio. Item 2 é só ordem de exibição.
- Git identity não configurada → commitar com `-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`; caminhos absolutos com `git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2"`. Windows host; ler arquivos antes de editar.

---

### Task 1: Etapa Confirmados — cabeçalho invertido + fonte maior

**Files:**
- Modify: `frontend/src/pages/congresso/CongressoStepParticipantes.tsx`
- Modify: `frontend/src/styles/congresso-wizard.css`

- [ ] **Step 1: Inverter o cabeçalho**

Em `frontend/src/pages/congresso/CongressoStepParticipantes.tsx`, o bloco atual:
```tsx
            <h1 className="cw-h1" style={{ marginBottom: 6 }}>Participantes confirmados</h1>
            <p className="cw-sub" style={{ margin: 0 }}>
              {modalidade?.nome} · <b style={{ color: FG }}>{inscricoes.length}</b> {inscricoes.length === 1 ? 'confirmado' : 'confirmados'}
            </p>
```
Substituir por:
```tsx
            <h1 className="cw-h1" style={{ marginBottom: 6 }}>{modalidade?.nome ?? 'Modalidade'}</h1>
            <p className="cw-sub" style={{ margin: 0 }}>
              Participantes confirmados · <b style={{ color: FG }}>{inscricoes.length}</b> {inscricoes.length === 1 ? 'confirmado' : 'confirmados'}
            </p>
```

- [ ] **Step 2: Aumentar a fonte da lista**

Em `frontend/src/styles/congresso-wizard.css`:
- Linha `.cw-prow-n { font-size: 15px; ... }` → trocar `font-size: 15px` por `font-size: 17px` (manter o resto da regra).
- Linha `.cw-prow-name { font-size: clamp(17px, 1.4vw, 21px); ... }` → trocar o `clamp(...)` por `clamp(20px, 1.8vw, 26px)` (manter `font-weight`/`line-height`/`overflow-wrap`).
- Linha `.cw-prow-club { font-size: 13.5px; ... }` → trocar `font-size: 13.5px` por `font-size: 15px` (manter o resto).

- [ ] **Step 3: Build**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros.

- [ ] **Step 4: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/pages/congresso/CongressoStepParticipantes.tsx frontend/src/styles/congresso-wizard.css
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(congresso): confirmados destaca modalidade e aumenta fonte da lista"
```

---

### Task 2: Etapa Sorteio — banner de cabeças na sequência dos grupos

**Files:**
- Modify: `frontend/src/pages/congresso/CongressoStepSorteio.tsx`

Contexto — o `useMemo` `cabecasComGrupo` (≈ linhas 148-203) monta `items` (campeões por posição + anfitrião sintético no fim), define `slotLabel` para cabeças, e retorna `items`. O tipo local `Item` tem: `key, participante_id, participante, posicao, inscrito, slotLabel`.

- [ ] **Step 1: Adicionar `slotOrder` ao tipo `Item` e nas entradas iniciais**

No `type Item = { ... }` dentro do memo, adicionar o campo:
```ts
      slotOrder: number | null
```
E nas duas criações de item (o `.map(c => ({...}))` dos campeões e o `items.push({...})` do anfitrião), adicionar `slotOrder: null,` (junto de `slotLabel: null,`).

- [ ] **Step 2: Definir `slotOrder` ao calcular `slotLabel` (grupos e chaves)**

No ramo de grupos, onde hoje está:
```ts
      for (const it of items) {
        if (!cabecasPids.has(it.participante_id)) continue
        const g = grupos.find((g: any) => g.participantes?.[0] === it.participante_id)
        if (g) it.slotLabel = `Grupo ${g.letra}`
      }
```
Trocar por (registrando também a ordem do grupo):
```ts
      for (const it of items) {
        if (!cabecasPids.has(it.participante_id)) continue
        const gi = grupos.findIndex((g: any) => g.participantes?.[0] === it.participante_id)
        if (gi >= 0) { it.slotLabel = `Grupo ${grupos[gi].letra}`; it.slotOrder = gi }
      }
```

No ramo de chaves, onde hoje está:
```ts
      for (const it of items) {
        const idx = cabecasFinais.indexOf(it.participante_id)
        if (idx !== -1) it.slotLabel = `${idx + 1}ª cabeça`
      }
```
Trocar por:
```ts
      for (const it of items) {
        const idx = cabecasFinais.indexOf(it.participante_id)
        if (idx !== -1) { it.slotLabel = `${idx + 1}ª cabeça`; it.slotOrder = idx }
      }
```

- [ ] **Step 3: Retornar os itens ordenados pela sequência do slot**

A linha final do memo `return items` (após o cálculo de slotLabel/slotOrder; NÃO a do early-return `if (!sorteio) return items`) → trocar por:
```ts
    return [...items].sort((a, b) => (a.slotOrder ?? Infinity) - (b.slotOrder ?? Infinity))
```
(Ordenação estável: cabeças aparecem na ordem dos grupos/cabeças; entradas sem slot, como campeões excedentes, ficam ao final preservando a ordem.)

- [ ] **Step 4: Build**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros.

- [ ] **Step 5: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/pages/congresso/CongressoStepSorteio.tsx
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(congresso): banner de cabecas na sequencia dos grupos (anfitriao no grupo dele)"
```

---

### Task 3: Verificação manual (UI)

**Files:** nenhum.

- [ ] **Step 1: Conferir no Modo Congresso**

Subir o dev (`cd frontend && npm run dev`) e abrir o Modo Congresso:
- **Confirmados:** título = nome da modalidade; subtítulo "Participantes confirmados · N confirmados"; lista com fonte visivelmente maior e legível.
- **Sorteio:** numa modalidade de grupos com anfitrião considerado (ex.: 3 grupos), o banner "Cabeças" mostra A, B, C em sequência com o anfitrião em "Grupo C" (não mais no fim). O resultado do sorteio em si permanece igual.
(Se não for possível rodar a UI, declarar explicitamente; os builds das Tasks 1-2 já garantem a compilação.)

---

## Notas finais

- Sem backend/migration. Só frontend.
- Promoção `develop` → `main` só com confirmação do Wagner.
