# Navegação mobile da página de evento (B2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar navegação de esportes mobile (pills + bottom-sheet + filtro de situação, um esporte por vez) à página pública de detalhe do evento, sem alterar o desktop.

**Architecture:** Approach A — marcação compartilhada. Os cards de modalidade já existentes (`<details class="mod-acc">`) continuam sendo a fonte única; um novo componente apresentacional (`EventoEsportesNav`) renderiza o "cromo" mobile, e um `<script>` inline seta atributos `data-*`. Todas as regras de visibilidade vivem dentro de `@media (max-width:767px)`, então o desktop é intocado por construção.

**Tech Stack:** React 18 + TypeScript (SSG via `renderToStaticMarkup`), Vitest, CSS puro em `site.css`. Sem React no cliente — interatividade via `<script dangerouslySetInnerHTML>`.

## Global Constraints

- Host Windows; ler antes de editar; caminhos absolutos.
- Git identity inline: `git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit ...`.
- Nunca `git add -A` — adicionar só os arquivos de cada task.
- Validar com `cd frontend && npm run build:site` (sem erros) e `npx vitest run src/site-publico` (verde).
- Reusar tokens/classes; **sem cores novas**; classes do bloco mobile sempre `.em-*`.
- O `<script>` inline não interpola dados de usuário (só seletores + `data-*`).
- Breakpoint mobile: `@media (max-width: 767px)`. Esconder o cromo no desktop via `@media (min-width: 768px)`.
- Demo (screenshots) antes do merge na develop; promoção a prod só com confirmação do Wagner.

---

### Task 1: Componente `EventoEsportesNav`

**Files:**
- Create: `frontend/src/site-publico/components/EventoEsportesNav.tsx`
- Test: `frontend/src/site-publico/components/EventoEsportesNav.test.tsx`

**Interfaces:**
- Consumes: `TIPO_INFO`, `TipoSorteio` de `../lib/evento-stats`.
- Produces: `default export EventoEsportesNav({ secoes }: { secoes: SecaoNav[] })` e `export type SecaoNav = { key: string; count: number; tipo: TipoSorteio; sorteadas: number }`. Renderiza `.em-catbar` (com `.em-pill[data-sport][data-on]`, `.em-grid-btn[data-sheet-open]`, `.seg button[data-sf][data-on]`), `.em-scrim[data-open][data-sheet-close]` e `.em-sheet[data-open]` (com `.em-sheet-item[data-sport]`).

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/site-publico/components/EventoEsportesNav.test.tsx`:
```tsx
import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoEsportesNav, { type SecaoNav } from './EventoEsportesNav'

const secoes: SecaoNav[] = [
  { key: 'Futsal', count: 3, tipo: 'grupos', sorteadas: 1 },
  { key: 'Judô', count: 2, tipo: 'chaves', sorteadas: 2 },
]

it('renderiza uma pill por seção com data-sport e contagem; primeira data-on', () => {
  const html = renderToStaticMarkup(<EventoEsportesNav secoes={secoes} />)
  expect(html).toContain('data-sport="Futsal" data-on="true"')
  expect(html).toContain('data-sport="Judô" data-on="false"')
  expect(html).toContain('class="pc">3<')
})

it('renderiza a régua de filtro com 3 botões (Todas data-on)', () => {
  const html = renderToStaticMarkup(<EventoEsportesNav secoes={secoes} />)
  expect(html).toContain('data-sf="all" data-on="true"')
  expect(html).toContain('data-sf="aberto"')
  expect(html).toContain('data-sf="sorteado"')
})

it('renderiza itens do sheet com mini-barra sorteadas/total', () => {
  const html = renderToStaticMarkup(<EventoEsportesNav secoes={secoes} />)
  expect(html).toContain('class="em-sheet-item"')
  expect(html).toContain('>2/2<')
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd frontend && npx vitest run src/site-publico/components/EventoEsportesNav.test.tsx`
Expected: FAIL (módulo `./EventoEsportesNav` não existe).

- [ ] **Step 3: Implementar o componente**

Criar `frontend/src/site-publico/components/EventoEsportesNav.tsx`:
```tsx
import { Grid2x2, X } from 'lucide-react'
import { TIPO_INFO, type TipoSorteio } from '../lib/evento-stats'

export type SecaoNav = { key: string; count: number; tipo: TipoSorteio; sorteadas: number }

export default function EventoEsportesNav({ secoes }: { secoes: SecaoNav[] }) {
  return (
    <>
      <div className="em-catbar">
        <div className="em-pills">
          {secoes.map((s, i) => (
            <button type="button" className="em-pill" key={s.key} data-sport={s.key} data-on={i === 0 ? 'true' : 'false'}>
              <span className="d" style={{ background: TIPO_INFO[s.tipo].grad }} />
              {s.key}<span className="pc">{s.count}</span>
            </button>
          ))}
          <button type="button" className="em-grid-btn" data-sheet-open aria-label="Todos os esportes"><Grid2x2 size={18} /></button>
        </div>
        <div className="seg">
          <button type="button" data-sf="all" data-on="true">Todas</button>
          <button type="button" data-sf="aberto">Abertas</button>
          <button type="button" data-sf="sorteado">Sorteado</button>
        </div>
      </div>
      <div className="em-scrim" data-open="false" data-sheet-close />
      <div className="em-sheet" data-open="false">
        <div className="em-sheet-grip" />
        <div className="em-sheet-h"><b>Esportes</b><button type="button" className="em-iconbtn" data-sheet-close aria-label="Fechar"><X size={20} /></button></div>
        <div className="em-sheet-list">
          {secoes.map((s) => (
            <button type="button" className="em-sheet-item" key={s.key} data-sport={s.key}>
              <span className="em-sheet-dot" style={{ background: TIPO_INFO[s.tipo].grad }}><Grid2x2 size={16} /></span>
              <span className="em-sheet-tx"><b>{s.key}</b><span>{s.count} modalidades</span></span>
              <span className="em-sheet-mini"><span className="mb"><i style={{ width: `${s.count ? Math.round((s.sorteadas / s.count) * 100) : 0}%` }} /></span><span className="mn">{s.sorteadas}/{s.count}</span></span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd frontend && npx vitest run src/site-publico/components/EventoEsportesNav.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**
```bash
git add frontend/src/site-publico/components/EventoEsportesNav.tsx frontend/src/site-publico/components/EventoEsportesNav.test.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): EventoEsportesNav (pills + bottom-sheet + filtro, B2)"
```

---

### Task 2: Integração na `EventoPage` (atributos `data-*` + nav + script)

**Files:**
- Modify: `frontend/src/site-publico/pages/EventoPage.tsx`
- Test: `frontend/src/site-publico/pages/EventoPage.test.tsx`

**Interfaces:**
- Consumes: `EventoEsportesNav`, `SecaoNav` (Task 1); `TipoSorteio` de `../lib/evento-stats`.
- Produces: `<main class="evento-page" data-status-filter="all">`; `.cat-section[data-sport][data-on]`; `.mod-acc[data-mstatus]`; um `<script>` inline de navegação.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao final de `frontend/src/site-publico/pages/EventoPage.test.tsx`:
```tsx
import type { SnapEvento as _SnapEvento } from '../snapshot-types'

const multi = {
  id: 9, nome: 'Multi 2026', competicao: 'Liga', status: 'pronto', cidade: 'X', local: 'L',
  data: '2026-07-01T00:00:00.000Z', organizador: null, publicadoEm: '', dataInicio: null, dataFim: null,
  boletins: [], modalidades: [
    { id: 1, nome: 'Futsal Masculino', grupo: null, tipo: 'grupos', status: 'sorteado', seed: null, anfitriaoId: null, cabecasPids: [], campeoes: [], participantes: [{ id: 1, nome: 'A', subtitulo: null }], mensagens_inscritos: [], resultado: null },
    { id: 2, nome: 'Judô Feminino', grupo: null, tipo: 'chaves', status: 'inscricoes', seed: null, anfitriaoId: null, cabecasPids: [], campeoes: [], participantes: [{ id: 2, nome: 'B', subtitulo: null }], mensagens_inscritos: [], resultado: null },
  ],
} as unknown as _SnapEvento

it('mobile nav: cat-section com data-sport e a 1ª data-on=true', () => {
  const html = renderToStaticMarkup(<EventoPage evento={multi} />)
  expect(html).toContain('cat-section" data-sport="Futsal" data-on="true"')
  expect(html).toContain('data-sport="Judô" data-on="false"')
})

it('mobile nav: mod-acc com data-mstatus coerente e main com data-status-filter', () => {
  const html = renderToStaticMarkup(<EventoPage evento={multi} />)
  expect(html).toContain('data-status-filter="all"')
  expect(html).toContain('data-mstatus="sorteado"')
  expect(html).toContain('data-mstatus="aberto"')
})

it('mobile nav: renderiza EventoEsportesNav e o script de navegação', () => {
  const html = renderToStaticMarkup(<EventoPage evento={multi} />)
  expect(html).toContain('class="em-catbar"')
  expect(html).toContain('setSport')
})

it('não quebra hero/boletins: botão compartilhar continua', () => {
  const html = renderToStaticMarkup(<EventoPage evento={multi} />)
  expect(html).toContain('Compartilhar evento')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/site-publico/pages/EventoPage.test.tsx`
Expected: FAIL (atributos/nav/script ausentes).

- [ ] **Step 3: Editar a `EventoPage.tsx`**

3a) Adicionar imports (junto aos demais no topo):
```tsx
import EventoEsportesNav, { type SecaoNav } from '../components/EventoEsportesNav'
```
(`TipoSorteio` já é importado de `../lib/evento-stats`.)

3b) Dentro do componente, após `const boletins = evento.boletins ?? []`, montar as seções a partir do `Map cats` existente:
```tsx
  const secoes: SecaoNav[] = [...cats.entries()].map(([key, mods]) => ({
    key,
    count: mods.length,
    tipo: (mods[0]?.tipo ?? 'chaves') as TipoSorteio,
    sorteadas: mods.filter((m) => m.status === 'sorteado').length,
  }))
```

3c) Trocar a abertura do `<main>`:
```tsx
      <main className="evento-page" data-status-filter="all">
```
e logo como **primeiro filho** do `<main>`, antes do `{[...cats.entries()]...}`:
```tsx
        <EventoEsportesNav secoes={secoes} />
```

3d) Adicionar índice e `data-*` ao map das seções. Trocar:
```tsx
        {[...cats.entries()].map(([cat, mods]) => (
          <section className="cat-section" key={cat}>
```
por:
```tsx
        {[...cats.entries()].map(([cat, mods], i) => (
          <section className="cat-section" key={cat} data-sport={cat} data-on={i === 0 ? 'true' : 'false'}>
```

3e) Adicionar `data-mstatus` ao `<details>`. Trocar:
```tsx
              <details className="mod-acc" open={abrir} key={m.id} id={`mod-${m.id}`}>
```
por:
```tsx
              <details className="mod-acc" open={abrir} key={m.id} id={`mod-${m.id}`} data-mstatus={m.status === 'sorteado' ? 'sorteado' : 'aberto'}>
```

3f) Adicionar o `<script>` de navegação como **último filho** do `<main>` (após a seção de boletins, ao lado do script do B1):
```tsx
        <script dangerouslySetInnerHTML={{ __html:
          "(function(){var main=document.querySelector('main.evento-page');if(!main)return;" +
          "function setSport(k){document.querySelectorAll('.cat-section[data-sport]').forEach(function(s){s.setAttribute('data-on',String(s.getAttribute('data-sport')===k))});document.querySelectorAll('.em-pill[data-sport]').forEach(function(p){p.setAttribute('data-on',String(p.getAttribute('data-sport')===k))})}" +
          "function closeSheet(){document.querySelectorAll('.em-sheet,.em-scrim').forEach(function(e){e.setAttribute('data-open','false')})}" +
          "function openSheet(){document.querySelectorAll('.em-sheet,.em-scrim').forEach(function(e){e.setAttribute('data-open','true')})}" +
          "document.querySelectorAll('.em-pill[data-sport],.em-sheet-item[data-sport]').forEach(function(b){b.addEventListener('click',function(){setSport(b.getAttribute('data-sport'));closeSheet()})});" +
          "document.querySelectorAll('[data-sheet-open]').forEach(function(b){b.addEventListener('click',openSheet)});" +
          "document.querySelectorAll('[data-sheet-close]').forEach(function(b){b.addEventListener('click',closeSheet)});" +
          "document.querySelectorAll('.seg button[data-sf]').forEach(function(b){b.addEventListener('click',function(){main.setAttribute('data-status-filter',b.getAttribute('data-sf'));document.querySelectorAll('.seg button[data-sf]').forEach(function(x){x.setAttribute('data-on',String(x===b))})})});" +
          "})();"
        }} />
```

- [ ] **Step 4: Rodar testes + build**

Run: `cd frontend && npx vitest run src/site-publico && npm run build:site`
Expected: PASS (todos); build sem erros.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/site-publico/pages/EventoPage.tsx frontend/src/site-publico/pages/EventoPage.test.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): navegacao de esportes mobile na EventoPage (data-* + script, B2)"
```

---

### Task 3: CSS do bloco mobile (`site.css`)

**Files:**
- Modify: `frontend/src/site-publico/site.css` (acrescentar ao final do arquivo)

**Interfaces:**
- Consumes: classes/atributos de Task 1 e 2 (`.em-catbar`, `.em-pill[data-on]`, `.em-grid-btn`, `.seg button[data-sf][data-on]`, `.em-scrim[data-open]`, `.em-sheet[data-open]`, `.em-sheet-item`, `.cat-section[data-on]`, `main.evento-page[data-status-filter]`, `.mod-acc[data-mstatus]`).
- Produces: estilos visuais. Sem teste unitário (CSS) — verificado por build + demo.

- [ ] **Step 1: Acrescentar o bloco CSS ao final de `frontend/src/site-publico/site.css`**

```css
/* ───────── B2: navegação mobile da página de evento ───────── */
@media (min-width: 768px) {
  .em-catbar, .em-sheet, .em-scrim { display: none !important; }
}
@media (max-width: 767px) {
  .em-catbar {
    display: block; position: sticky; top: 70px; z-index: 40;
    margin: 0 -16px 14px; padding: 8px 12px;
    background: color-mix(in srgb, var(--card-bg) 92%, transparent);
    backdrop-filter: saturate(1.4) blur(12px);
    border-bottom: 1px solid var(--hairline);
  }
  .em-pills { display: flex; align-items: center; gap: 8px; overflow-x: auto; scrollbar-width: none; }
  .em-pills::-webkit-scrollbar { display: none; }
  .em-pill {
    flex: 0 0 auto; display: inline-flex; align-items: center; gap: 7px; white-space: nowrap;
    padding: 7px 12px; border-radius: 9999px; border: 1px solid var(--card-border);
    background: var(--card-bg); color: var(--t2); font: 600 13px var(--font-sans); cursor: pointer;
  }
  .em-pill .d { width: 8px; height: 8px; border-radius: 9999px; }
  .em-pill .pc { font: 700 11px var(--font-mono); color: var(--t4); }
  .em-pill[data-on="true"] { background: var(--brand-50); border-color: var(--brand-300); color: var(--brand-700); }
  .em-pill[data-on="true"] .pc { color: var(--brand-600); }
  .em-grid-btn {
    flex: 0 0 auto; display: inline-grid; place-items: center; width: 36px; height: 36px;
    border-radius: 10px; border: 1px solid var(--card-border); background: var(--card-bg); color: var(--t3); cursor: pointer;
  }
  .seg { display: flex; gap: 4px; margin-top: 8px; padding: 3px; border-radius: 10px; background: var(--card-bg-2); }
  .seg button {
    flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 5px;
    padding: 6px 8px; border: 0; border-radius: 8px; background: transparent; color: var(--t3);
    font: 600 12px var(--font-sans); cursor: pointer;
  }
  .seg button[data-on="true"] { background: var(--card-bg); color: var(--t1); box-shadow: var(--shadow-e1); }

  .cat-section[data-on="false"] { display: none; }
  main.evento-page[data-status-filter="sorteado"] .mod-acc[data-mstatus="aberto"] { display: none; }
  main.evento-page[data-status-filter="aberto"] .mod-acc[data-mstatus="sorteado"] { display: none; }

  .em-scrim {
    position: fixed; inset: 0; z-index: 150; background: rgba(0,0,0,.42);
    opacity: 0; pointer-events: none; transition: opacity .2s var(--ease-out);
  }
  .em-scrim[data-open="true"] { opacity: 1; pointer-events: auto; }
  .em-sheet {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 151; max-height: 72vh; overflow-y: auto;
    padding: 10px 16px calc(16px + env(safe-area-inset-bottom)); background: var(--card-bg);
    border-top: 1px solid var(--card-border); border-radius: 18px 18px 0 0;
    transform: translateY(100%); transition: transform .25s var(--ease-out);
  }
  .em-sheet[data-open="true"] { transform: translateY(0); }
  .em-sheet-grip { width: 40px; height: 4px; border-radius: 9999px; background: var(--card-border); margin: 2px auto 10px; }
  .em-sheet-h { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .em-sheet-h b { font: 700 15px var(--font-display); color: var(--t1); }
  .em-iconbtn { display: inline-grid; place-items: center; width: 34px; height: 34px; border: 0; background: transparent; color: var(--t3); cursor: pointer; }
  .em-sheet-list { display: flex; flex-direction: column; gap: 4px; }
  .em-sheet-item {
    display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
    padding: 10px; border: 0; border-radius: 12px; background: transparent; cursor: pointer;
  }
  .em-sheet-dot { flex: 0 0 auto; display: inline-grid; place-items: center; width: 38px; height: 38px; border-radius: 11px; color: #fff; }
  .em-sheet-tx { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .em-sheet-tx b { font: 600 14px var(--font-sans); color: var(--t1); }
  .em-sheet-tx span { font: 500 12px var(--font-sans); color: var(--t4); }
  .em-sheet-mini { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .em-sheet-mini .mb { width: 56px; height: 5px; border-radius: 9999px; background: var(--card-bg-2); overflow: hidden; }
  .em-sheet-mini .mb i { display: block; height: 100%; background: var(--brand-500); }
  .em-sheet-mini .mn { font: 700 10px var(--font-mono); color: var(--t4); }
}
```

- [ ] **Step 2: Rodar build do site**

Run: `cd frontend && npm run build:site`
Expected: build sem erros (o aviso pré-existente de `@import` do Google Fonts é esperado).

- [ ] **Step 3: Rodar a suíte do site**

Run: `cd frontend && npx vitest run src/site-publico`
Expected: PASS (todos os testes verdes).

- [ ] **Step 4: Commit**
```bash
git add frontend/src/site-publico/site.css
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): css .em da navegacao mobile de evento (B2)"
```

---

## Verificação final (após as 3 tasks)

- [ ] `cd frontend && npx vitest run src/site-publico && npm run build:site` verdes.
- [ ] **Demo (screenshots) antes do merge na develop**, usando um evento multiesportivo real do snapshot (`dist-site/evento-*.html`):
  - **402px:** trocar de esporte pelas pills; abrir o bottom-sheet pelo botão grade e trocar por ele; filtrar Abertas / Sorteado / Todas.
  - **1280px:** confirmar que o desktop está inalterado — `.em-catbar`/sheet ausentes (escondidos), todas as seções de esporte visíveis.
- [ ] Após aprovação: `git fetch origin && git checkout develop && git merge --ff-only origin/develop`, depois `git merge --no-ff feat/<branch>`, push, monitorar deploy.

## Self-Review (cobertura da spec)
- Approach A (marcação compartilhada, JS seta `data-*`, CSS sob media query): Tasks 2 e 3 ✓.
- `EventoEsportesNav` (pills + grade + seg + sheet): Task 1 ✓.
- Contrato `data-*` (esporte ativo, filtro, sheet): Tasks 2 (markup/JS) e 3 (CSS) ✓.
- Degradação sem JS (1ª seção `data-on=true`, `data-status-filter=all` no servidor): Task 2 ✓.
- Desktop intocado (`@media (min-width:768px)` esconde o cromo; regras de visibilidade só em max-width): Task 3 ✓.
- Sem cores novas (ponto = `TIPO_INFO.grad`; tokens existentes): Tasks 1 e 3 ✓.
- Reuso dos cards atuais (`.mod-acc`, sem segundo card): por construção ✓.
- `.cat-head` mantido (título do esporte ativo): inalterado na EventoPage ✓.
