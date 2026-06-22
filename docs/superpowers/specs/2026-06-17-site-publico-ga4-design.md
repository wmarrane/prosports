# Site público: medição de acessos com GA4 — Design

**Data:** 2026-06-17
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Medir o volume de acessos ao site público (Firebase Hosting, target `publico`) adicionando o Google Analytics 4 (gtag.js), Measurement ID **`G-RE4Q0N8XKS`**, em todas as páginas.

## Contexto

- O site público é HTML **estático** gerado por `frontend/scripts/build-site-publico.tsx`, que monta cada página com `htmlShell()` de `frontend/src/site-publico/html-shell.ts`. Todas as páginas (`index.html`, `eventos.html`, `sobre.html`, `evento-*.html`) passam por essa função.
- Estado atual do `<head>` em `html-shell.ts`: charset, viewport, `<title>`, `<link rel="icon">`, `<link rel="stylesheet">`.

## Decisão

Injetar o snippet padrão do gtag.js no `<head>` dentro de `htmlShell()` — ponto único que cobre **todas** as páginas. O Measurement ID é um identificador **público** (client-side), então fica **hardcoded** (sem env var/segredo).

## Mudança (somente `frontend/src/site-publico/html-shell.ts`)

No `<head>`, após o `<link rel="stylesheet" ...>` e antes de `</head>`, adicionar:
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
O conteúdo é estático (não depende de `opts`), então entra como literal na template string da função.

## Escopo / limites

- Vale para o **site público** apenas (todas as páginas, via `htmlShell`). O app **admin** (Vite) está fora de escopo.
- Medição padrão do GA4 (page_view automático, usuários, sessões). **Sem eventos customizados.**
- **Sem banner de consentimento de cookies** nesta entrega (o GA4 grava cookies; um aviso LGPD pode ser um follow-up, não é o pedido atual).
- Medição é client-side: não conta visitantes com JS desativado/bloqueador. Para requisições brutas, usar o painel de Uso do Hosting (complementar, fora desta mudança).

## Testes / Verificação

- `npm run build:site` (frontend): o HTML gerado (`dist-site/index.html`, `eventos.html`, `evento-*.html`) deve conter `gtag/js?id=G-RE4Q0N8XKS`.
- Após deploy/re-publicação: GA4 → **Tempo real** mostra acessos ao abrir o site.
- Sem teste unitário (template estática). Sem backend/migration.

## Efeito do snapshot/deploy

Site é estático: a tag só passa a coletar depois de **rebuildar/re-publicar** o site (o build:site regenera o HTML). Não afeta sorteios/dados.

## Fora de escopo

- Banner/consentimento de cookies (LGPD) — follow-up se desejado.
- Eventos customizados do GA4 (cliques, navegação específica).
- Analytics no app admin.
- Export para BigQuery.
