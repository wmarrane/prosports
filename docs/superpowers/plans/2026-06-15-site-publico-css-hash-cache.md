# Site público: bundle CSS com hash (cache-busting) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar o CSS do site público com nome contendo hash (`site-bundle.<hash>.css`) e referenciá-lo nos HTMLs, para que mudanças de CSS apareçam imediatamente (sem cache imutável servindo versão antiga).

**Architecture:** O `npm run build:site` roda o Tailwind (gera `dist-site/site-bundle.css`) e depois `scripts/build-site-publico.tsx`. Esse script passa a: ler o CSS gerado, calcular um hash de conteúdo, renomear para `site-bundle.<hash>.css` e injetar `/<arquivo>` como `cssHref` em todos os HTMLs. `firebase.json` não muda (a regra `immutable` para `*.css` fica correta com o hash).

**Tech Stack:** Node/TS (tsx), `node:crypto`, `node:fs`; deploy Firebase Hosting (target `publico`).

**Spec:** `docs/superpowers/specs/2026-06-15-site-publico-css-hash-cache-design.md`

**Notas:** Git identity não configurada — commitar com `-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`. Caminhos absolutos com `git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2"`. Windows host (Bash tool). Sem teste unitário (script de build; verificação por inspeção do output).

---

### Task 1: Hash no bundle CSS do site público

**Files:**
- Modify: `frontend/scripts/build-site-publico.tsx`

Estado atual relevante do arquivo:
```ts
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync, cpSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import IndexPage from '../src/site-publico/pages/IndexPage'
import EventosPage from '../src/site-publico/pages/EventosPage'
import SobrePage from '../src/site-publico/pages/SobrePage'
import EventoPage from '../src/site-publico/pages/EventoPage'
import { htmlShell } from '../src/site-publico/html-shell'
import type { SnapEvento } from '../src/site-publico/snapshot-types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SNAP_DIR = join(ROOT, 'public-site-snapshots')
const STATIC_DIR = join(ROOT, 'public-site-static')
const OUT = join(ROOT, 'dist-site')
const CSS_HREF = '/site-bundle.css'

function loadSnapshots(): SnapEvento[] { /* ... inalterado ... */ }

function emit(name: string, title: string, el: React.ReactElement) {
  const body = renderToStaticMarkup(el)
  writeFileSync(join(OUT, name), htmlShell({ title, body, cssHref: CSS_HREF }), 'utf8')
}

function main() {
  const eventos = loadSnapshots()
  mkdirSync(OUT, { recursive: true })
  if (existsSync(STATIC_DIR)) cpSync(STATIC_DIR, OUT, { recursive: true })
  emit('index.html', 'Montana Eventos', React.createElement(IndexPage, { eventos }))
  emit('eventos.html', 'Eventos · Montana', React.createElement(EventosPage, { eventos }))
  emit('sobre.html', 'Sobre · Montana', React.createElement(SobrePage))
  for (const ev of eventos) {
    emit(`evento-${ev.id}.html`, `${ev.nome} · Montana`, React.createElement(EventoPage, { evento: ev }))
  }
  console.log(`Gerados ${eventos.length} eventos + 3 páginas em ${OUT}`)
}
main()
```

- [ ] **Step 1: Atualizar imports**

Trocar a primeira linha de import de `node:fs` para incluir `renameSync`, e adicionar o import de `createHash`:
```ts
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync, cpSync, renameSync } from 'node:fs'
import { createHash } from 'node:crypto'
```
(Os demais imports permanecem.)

- [ ] **Step 2: Remover a const fixa `CSS_HREF`**

Remover a linha:
```ts
const CSS_HREF = '/site-bundle.css'
```

- [ ] **Step 3: `emit` recebe `cssHref` por parâmetro**

Trocar:
```ts
function emit(name: string, title: string, el: React.ReactElement) {
  const body = renderToStaticMarkup(el)
  writeFileSync(join(OUT, name), htmlShell({ title, body, cssHref: CSS_HREF }), 'utf8')
}
```
por:
```ts
function emit(name: string, title: string, el: React.ReactElement, cssHref: string) {
  const body = renderToStaticMarkup(el)
  writeFileSync(join(OUT, name), htmlShell({ title, body, cssHref }), 'utf8')
}
```

- [ ] **Step 4: Calcular o hash, renomear o CSS e passar o href**

Trocar o corpo de `main()` por:
```ts
function main() {
  const eventos = loadSnapshots()
  mkdirSync(OUT, { recursive: true })
  // Copia assets estáticos (logos, captura da plataforma) para o output.
  if (existsSync(STATIC_DIR)) cpSync(STATIC_DIR, OUT, { recursive: true })

  // O Tailwind (passo anterior do build:site) gerou dist-site/site-bundle.css.
  // Renomeia para um nome com hash de conteúdo, para o cache `immutable` do
  // Firebase Hosting ser correto e mudanças de CSS aparecerem na hora.
  const cssPath = join(OUT, 'site-bundle.css')
  if (!existsSync(cssPath)) {
    throw new Error('site-bundle.css não encontrado em dist-site — rode o build do Tailwind antes')
  }
  const hash = createHash('sha256').update(readFileSync(cssPath)).digest('hex').slice(0, 8)
  const cssFile = `site-bundle.${hash}.css`
  renameSync(cssPath, join(OUT, cssFile))
  const cssHref = `/${cssFile}`

  emit('index.html', 'Montana Eventos', React.createElement(IndexPage, { eventos }), cssHref)
  emit('eventos.html', 'Eventos · Montana', React.createElement(EventosPage, { eventos }), cssHref)
  emit('sobre.html', 'Sobre · Montana', React.createElement(SobrePage), cssHref)
  for (const ev of eventos) {
    emit(`evento-${ev.id}.html`, `${ev.nome} · Montana`, React.createElement(EventoPage, { evento: ev }), cssHref)
  }
  console.log(`Gerados ${eventos.length} eventos + 3 páginas em ${OUT} (css: ${cssFile})`)
}
```

- [ ] **Step 5: Rodar o build do site e inspecionar o output**

Run: `cd frontend && npm run build:site`
Expected: termina sem erro; log mostra `(css: site-bundle.<hash>.css)`.

Conferir o output:
Run: `ls frontend/dist-site/site-bundle*.css`
Expected: existe `site-bundle.<hash>.css` e **não** existe `site-bundle.css`.

Run: `grep -o "site-bundle[^\"]*\.css" frontend/dist-site/index.html frontend/dist-site/eventos.html`
Expected: cada HTML referencia `site-bundle.<hash>.css` (o mesmo hash).

- [ ] **Step 6: Conferir determinismo e cache-busting**

Rodar o build de novo sem alterar nada:
Run: `cd frontend && npm run build:site && ls frontend/dist-site/site-bundle*.css`
Expected: **mesmo** nome de hash (conteúdo igual → hash igual). Não deve haver dois bundles diferentes.
(Observação: se rodadas locais acumularem bundles antigos de execuções anteriores, removê-los manualmente; no CI o checkout é limpo. Para garantir limpeza local: `rm -f frontend/dist-site/site-bundle*.css` antes de um build de verificação.)

- [ ] **Step 7: Build geral do frontend (não-regressão)**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros (garante que o tsx alterado compila no contexto do projeto).

- [ ] **Step 8: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/scripts/build-site-publico.tsx
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): bundle CSS com hash para cache-busting"
```

---

## Notas finais

- `firebase.json` permanece inalterado: a regra `*.css → immutable` agora é correta (nome com hash).
- Esta correção só passa a valer no próximo build/deploy do site (re-publicação de evento ou `workflow_dispatch` do "Build Site Público").
- Promoção `develop` → `main` só com confirmação do Wagner (este ajuste afeta apenas o build do site público, que faz checkout da `develop`).
