# Site público: GA4 (medição de acessos) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar o Google Analytics 4 (gtag.js, ID `G-RE4Q0N8XKS`) a todas as páginas do site público, injetando o snippet no `htmlShell()`.

**Architecture:** Site público é HTML estático; todas as páginas (institucionais e de evento publicado) são geradas via `htmlShell()`. Injetar a tag nesse ponto único cobre o site inteiro. Sem backend/migration.

**Tech Stack:** TS (build SSG `build-site-publico.tsx`/`html-shell.ts`); build `tsc -b && vite build` + `build:site`.

**Spec:** `docs/superpowers/specs/2026-06-17-site-publico-ga4-design.md`

## Global Constraints

- Measurement ID **`G-RE4Q0N8XKS`** (identificador público; hardcoded, sem env var/segredo).
- Apenas o site público (todas as páginas via `htmlShell`); app admin fora de escopo.
- Sem banner de consentimento e sem eventos customizados nesta entrega.
- Git identity não configurada → commit com `-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`; caminhos absolutos com `git -C`. Windows host; ler o arquivo antes de editar.

---

### Task 1: Injetar gtag.js no html-shell

**Files:**
- Modify: `frontend/src/site-publico/html-shell.ts`

Estado atual da função (referência):
```ts
export function htmlShell(opts: { title: string; body: string; cssHref: string }): string {
  return `<!doctype html>
<html lang="pt-BR" data-theme="light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(opts.title)}</title>
<link rel="icon" href="/montana/simbolo.png" />
<link rel="stylesheet" href="${opts.cssHref}" />
</head>
<body>${opts.body}</body>
</html>`
}
```

- [ ] **Step 1: Adicionar o snippet do gtag no `<head>`**

Em `frontend/src/site-publico/html-shell.ts`, na template string retornada por `htmlShell`, inserir o bloco abaixo **logo após** a linha `<link rel="stylesheet" href="${opts.cssHref}" />` e **antes** de `</head>`:
```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-RE4Q0N8XKS"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-RE4Q0N8XKS');
</script>
```
É conteúdo estático (não usa `opts`), então entra literal na template string. Não alterar mais nada na função.

- [ ] **Step 2: Build de tipos do frontend**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros.

- [ ] **Step 3: Gerar o site e conferir a tag em todas as páginas**

Run:
```
cd frontend && npm run build:site
```
Depois verificar que o snippet está em páginas institucionais E de evento:
```
grep -l "gtag/js?id=G-RE4Q0N8XKS" frontend/dist-site/index.html frontend/dist-site/eventos.html frontend/dist-site/sobre.html
ls frontend/dist-site/evento-*.html 2>/dev/null | head -1 | xargs grep -c "gtag/js?id=G-RE4Q0N8XKS"
```
Expected: as três páginas institucionais listadas (todas contêm a tag) e a contagem `>= 1` na página de evento. (Se não houver `evento-*.html` no `dist-site` local — sem snapshots —, basta confirmar nas institucionais; o `evento-*.html` usa o mesmo `htmlShell`.)

- [ ] **Step 4: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/site-publico/html-shell.ts
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): adiciona GA4 (gtag) em todas as paginas"
```

---

## Notas finais

- Sem backend/migration. Só frontend (geração do HTML estático).
- Passa a coletar após **rebuild/re-publicação** do site. Verificação ao vivo: GA4 → Tempo real ao abrir o site.
- Promoção `develop` → `main` só com confirmação do Wagner.
