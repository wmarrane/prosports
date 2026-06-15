# Site público mobile: grupos e chaves legíveis e roláveis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No celular, a página de evento do site público deve mostrar grupos sem corte (reflow) e chaves compactas e legíveis, com rolagem horizontal para as grandes.

**Architecture:** Site público é HTML estático (sem JS no cliente), então a responsividade é só CSS. Grupos: trocar a coluna fixa por `minmax(min(Npx,100%),1fr)` (reflow). Chaves: dar `className` ao `BracketTree` e, numa media query mobile do `site.css`, aplicar escala uniforme (`zoom`) mantendo `overflow-x: auto`. Sem testes unitários (CSS/render estático); verificação por build + browser em viewport mobile.

**Tech Stack:** React 18 + Vite + TS (build `tsc -b && vite build`); SSG `frontend/scripts/build-site-publico.tsx`; verificação com Playwright.

**Spec:** `docs/superpowers/specs/2026-06-15-site-publico-mobile-grupos-chaves-design.md`

**Nota geral:** São mudanças visuais sem teste unitário. A "prova" de cada task é `npm run build` limpo + inspeção. A verificação visual de ponta a ponta acontece na Task 4. Git identity não está configurada: commitar sempre com `-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"` e usar caminhos absolutos com `git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2"`.

---

### Task 1: Grupos — reflow responsivo (corrige o corte)

**Files:**
- Modify: `frontend/src/components/sorteio-result/SorteioGrupos.tsx` (linha ~31)

- [ ] **Step 1: Trocar a definição da coluna do grid**

Em `frontend/src/components/sorteio-result/SorteioGrupos.tsx`, localizar o `div` do grid (logo após `return (`):
```tsx
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minCol}px, 1fr))`, gap }}>
```
Substituir por:
```tsx
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(min(${minCol}px, 100%), 1fr))`, gap }}>
```
Não mudar mais nada no arquivo (`minCol` continua 360 em `large`, 240 caso contrário).

- [ ] **Step 2: Build do frontend**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros.

- [ ] **Step 3: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/components/sorteio-result/SorteioGrupos.tsx
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "fix(sorteio): grupos reflowam no mobile em vez de cortar"
```

---

### Task 2: Chaves — ganchos de classe no BracketTree

**Files:**
- Modify: `frontend/src/components/sorteio-result/BracketTree.tsx` (linhas ~257-259)

- [ ] **Step 1: Adicionar className ao wrapper externo e ao canvas**

Em `frontend/src/components/sorteio-result/BracketTree.tsx`, no `return` do componente `BracketTree`, o trecho atual é:
```tsx
  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', padding: 16, position: 'relative' }}>
      <div style={{ position: 'relative', width: layout.width, height: layout.height, minWidth: '100%' }}>
```
Substituir por (adicionando apenas os `className`, mantendo todos os estilos inline):
```tsx
  return (
    <div className="bracket-scroll" style={{ overflowX: 'auto', overflowY: 'auto', padding: 16, position: 'relative' }}>
      <div className="bracket-canvas" style={{ position: 'relative', width: layout.width, height: layout.height, minWidth: '100%' }}>
```
Nenhuma outra mudança (sem alterar medidas, SVG ou lógica).

- [ ] **Step 2: Build do frontend**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros.

- [ ] **Step 3: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/components/sorteio-result/BracketTree.tsx
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(sorteio): classes no BracketTree p/ ajuste responsivo do site publico"
```

---

### Task 3: CSS mobile do site público

**Files:**
- Modify: `frontend/src/site-publico/site.css` (linha ~309 para as listas; novo bloco mobile no fim do arquivo)

- [ ] **Step 1: Listas de inscritos/campeões com reflow**

Em `frontend/src/site-publico/site.css`, localizar (linha ~306-310):
```css
.inscritos ul,
.campeoes ul {
  list-style: none; padding: 0; margin: 0;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 4px 18px;
}
```
Trocar a linha do grid por:
```css
  display: grid; grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr)); gap: 4px 18px;
```

- [ ] **Step 2: Adicionar rolagem por toque no wrapper de chaves**

Ainda em `site.css`, adicionar (pode ser logo após o bloco `.mod-body { ... }`, por volta da linha 299):
```css
.bracket-scroll { -webkit-overflow-scrolling: touch; }
```

- [ ] **Step 3: Adicionar bloco mobile (compactar chaves + padding do card)**

No fim de `frontend/src/site-publico/site.css`, adicionar:
```css
/* ─────────────────────────── mobile: grupos/chaves ─────────────────────────── */
@media (max-width: 720px) {
  .mod-body { padding: 14px; gap: 16px; }
  /* Compacta a árvore de chaves para caber/ficar legível; grandes ainda rolam
     no .bracket-scroll. zoom reflowa o box (scrollWidth acompanha a escala). */
  .bracket-canvas { zoom: 0.72; }
}
```

- [ ] **Step 4: Build do frontend**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros.

- [ ] **Step 5: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/site-publico/site.css
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): CSS mobile - compacta chaves e ajusta grades"
```

---

### Task 4: Verificação visual no mobile + calibrar a escala

**Files:**
- Possível ajuste fino: `frontend/src/site-publico/site.css` (valor do `zoom` na media query)

Objetivo: gerar o site estático localmente, abrir `evento-9.html` em viewport mobile e confirmar os 3 comportamentos; ajustar o fator de `zoom` se necessário.

- [ ] **Step 1: Gerar o site estático local**

O build do site (`build:site`) lê snapshots de `frontend/public-site-snapshots/`. O diretório está vazio no working tree, mas o snapshot do evento 9 (que tem grupos e chaves) existe no histórico (commit `ac464bc`). Restaurá-lo para a verificação:
```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" show ac464bc:frontend/public-site-snapshots/evento-9.json > "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\public-site-snapshots\evento-9.json"
```
Esse arquivo é temporário e **não deve ser commitado** (é removido no Step 6). Rodar o build do site:
```
cd frontend && npm run build:site
```
Servir o estático em background (porta 4178):
```
cd frontend/dist-site && python -m http.server 4178
```
Expected: `evento-9.html` gerado em `frontend/dist-site` e servido em `http://localhost:4178/evento-9.html`.

- [ ] **Step 2: Inspecionar grupos no viewport mobile**

Com Playwright: `browser_resize` 390×844, `browser_navigate` para `http://localhost:4178/evento-<id>.html`. Rodar via `browser_evaluate`:
```js
() => {
  const vw = document.documentElement.clientWidth;
  const grids = [...document.querySelectorAll('.mod-body div')]
    .filter(el => getComputedStyle(el).display === 'grid' && el.textContent.includes('Grupo'))
    .map(el => ({ cols: getComputedStyle(el).gridTemplateColumns, rectW: Math.round(el.getBoundingClientRect().width), scrollW: el.scrollWidth }));
  return { vw, sample: grids.slice(0,4) };
}
```
Expected: cada grade de grupo com `scrollW <= rectW` (sem transbordo). Antes da correção era `scrollW 360 > rectW 289`.

- [ ] **Step 3: Inspecionar chaves no viewport mobile**

Via `browser_evaluate`:
```js
() => {
  const vw = document.documentElement.clientWidth;
  const wraps = [...document.querySelectorAll('.bracket-scroll')].map(el => ({
    clientW: el.clientWidth, scrollW: el.scrollWidth,
    canvasW: Math.round(el.firstElementChild.getBoundingClientRect().width),
    scrollable: el.scrollWidth > el.clientWidth + 1
  }));
  return { vw, wraps: wraps.slice(0,6) };
}
```
Expected: `canvasW` das chaves pequenas ≤ `clientW` (cabem, não roláveis); chaves grandes com `scrollable: true`. Tirar um screenshot (`browser_take_screenshot`) de uma modalidade de chaves aberta para conferir legibilidade dos nomes.

- [ ] **Step 4: Calibrar o fator de zoom (se necessário)**

Se os nomes ficarem pequenos demais (ilegíveis) ou ainda grandes demais (rolagem excessiva nas pequenas), ajustar o valor `zoom: 0.72` em `site.css` (faixa razoável 0.65–0.85) e repetir Steps 1–3. Critério: nomes legíveis e a maioria das chaves de 1–2 rodadas cabendo sem rolar.

- [ ] **Step 5: Conferir o desktop (não-regressão)**

`browser_resize` 1280×900, navegar de novo e confirmar via screenshot que grupos voltam a múltiplas colunas (360px) e as chaves aparecem em tamanho normal (sem o zoom). O `zoom` só vale em `max-width: 720px`.

- [ ] **Step 6: Encerrar o servidor e o browser**

Parar o `http.server` (encerrar o processo em background) e `browser_close`. Remover o snapshot baixado se ele não fizer parte do repositório (`git status` deve ficar limpo, exceto eventual ajuste do `zoom`).

- [ ] **Step 7: Commit do ajuste de calibração (se houve mudança no zoom)**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/site-publico/site.css
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "fix(site-publico): calibra escala das chaves no mobile"
```
(Se não houve ajuste, pular este commit.)

---

## Notas finais

- O site é estático: para o efeito aparecer no ar é preciso **re-publicar o evento** (ou re-disparar o build do site), o que regenera o `site-bundle.css`.
- Promoção para produção (merge `develop` → `main`) só com confirmação do Wagner.
- Fallback documentado na spec: se `zoom` falhar em algum navegador alvo, trocar por `transform: scale(...)` com wrapper dimensionado — não implementar a menos que a verificação mostre problema.
