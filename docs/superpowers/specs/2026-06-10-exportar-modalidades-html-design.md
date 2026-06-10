# Exportar modalidades em HTML — Design

**Data:** 2026-06-10
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

No cadastro de eventos (tela `EventoInscricoes`), oferecer uma opção para exportar **todas as modalidades do evento** em um único arquivo `.html`, no **mesmo formato visual do PDF** (componente `SorteioPrint`). Cada modalidade vira uma seção com inscritos, campeões do ano anterior e o sorteio (quando houver).

Motivação: o PDF atual (`window.print()`) cobre **uma** modalidade por vez e exige o diálogo de impressão. Um HTML único é mais fácil de compartilhar, abre em qualquer dispositivo e não depende do navegador gerar PDF.

## Escopo

- **Saída:** 1 arquivo `.html` autossuficiente (self-contained), baixado pelo navegador.
- **Modalidades incluídas:** apenas as que têm **≥ 1 inscrito** (evita seções vazias).
- **Conteúdo por modalidade:** cabeçalho do evento (nome, cidade sede, cidade/local/data) + nome/sigla da modalidade + seed + resultado do sorteio quando existir (Grupos/Chaves/Ordem) + campeões do ano anterior + lista de inscritos. Idêntico ao `SorteioPrint`.
- **Tema:** o documento exportado é fixado em **claro** (`data-theme="light"`), como o PDF.

## Abordagem técnica

O `SorteioPrint` reaproveita `SorteioGrupos/SorteioChaves/SorteioOrdem`, que dependem de **variáveis CSS** (`var(--t1)`, `var(--card-bg-2)`, `var(--brand-500)`…) e de **classes utilitárias Tailwind**. Um `.html` solto não teria esse CSS.

**Solução (HTML self-contained gerado no navegador):** ao clicar em "Exportar HTML":

1. **Serializar CSS:** percorrer `document.styleSheets` e concatenar o `cssText` de todas as regras same-origin (tokens, tema e Tailwind já compilados e carregados na página). Folhas cross-origin que lançam `SecurityError` ao ler `cssRules` são ignoradas (no projeto, todo o CSS é bundled same-origin).
2. **Montar dados:** os sorteios do evento já estão carregados (`sorteios`). Buscar, em paralelo (`Promise.all`), os inscritos e os campeões de cada modalidade com inscritos, usando `inscricoesService.listar` e `campeoesAnterioresService.listar`.
3. **Renderizar:** para cada modalidade, montar `participantesById`, `campeoesByParticipanteId`, lista de inscritos e campeões, e renderizar uma seção `SorteioPrintContent` via `renderToStaticMarkup` (de `react-dom/server`).
4. **Documento:** compor uma string HTML completa: `<html data-theme="light"><head><meta charset><title><style>{cssSerializado}</style></head><body class="sorteio-print-export">{seções}</body></html>`.
5. **Download:** criar um `Blob` `text/html` e disparar download como `evento-<slug-do-nome>.html`.

### Por que `SorteioPrintContent` (refatoração)

`SorteioPrint` hoje retorna `createPortal(content, document.body)` quando há `document`. Como o export roda **no navegador** (onde `document` existe), `renderToStaticMarkup` com portal não renderiza o conteúdo (portais são ignorados no SSR). Solução: extrair o JSX interno (`content`) para um componente exportado `SorteioPrintContent` (apenas o markup, sem portal). `SorteioPrint` passa a envelopar `SorteioPrintContent` com o portal (comportamento atual preservado para o botão "PDF"). O export usa `SorteioPrintContent` diretamente.

## Componentes / arquivos

- `frontend/src/pages/eventos/SorteioPrint.tsx` — extrair `SorteioPrintContent` (markup sem portal); `SorteioPrint` envelopa com portal. Props inalteradas.
- `frontend/src/lib/export-html.ts` (novo) — `serializeLoadedStyles(): string` e `downloadHtmlFile(filename: string, html: string): void`.
- `frontend/src/pages/eventos/EventoInscricoes.tsx` — botão "Exportar HTML" no banner do evento (ao lado de "Editar evento"); handler que busca dados, renderiza as seções, serializa CSS e baixa o arquivo. Estado de carregamento no botão; erros via `toast`.

## Layout entre seções

Cada modalidade é uma seção `.sorteio-print` separada. No arquivo exportado, separar com quebra de página para impressão futura (`page-break-after: always` entre seções, exceto a última) e margem entre blocos na visualização em tela.

## Tratamento de erros

- Nenhuma modalidade com inscritos → `toast` informativo ("Nenhuma modalidade com inscritos para exportar.") e nenhum download.
- Falha em alguma requisição do `Promise.all` → `toast.error` e aborta o export (não baixa arquivo parcial).

## Testes

O projeto não tem testing-library/jsdom; componentes são testados com `renderToStaticMarkup` (`react-dom/server`).

- **Unit (`export-html`/render):** teste que renderiza `SorteioPrintContent` com dados de exemplo via `renderToStaticMarkup` e verifica que o markup contém o nome do evento, o nome da modalidade e os inscritos. (A serialização de `document.styleSheets` depende do DOM e é validada manualmente.)
- **Validação:** `npm run build` (frontend: `tsc -b && vite build`) sem erros.
- **Manual:** na tela do evento, clicar "Exportar HTML"; abrir o `.html` baixado **offline** e conferir: layout igual ao PDF, todas as modalidades com inscritos presentes, sorteio renderizado onde existe, campeões e inscritos corretos, estilos aplicados sem o app rodando.

## Fora de escopo

- Backend / migration (nenhum).
- Exportar uma modalidade por arquivo ou `.zip`.
- Incluir modalidades sem inscritos.
- Alterar o botão "PDF" existente (`window.print()` permanece).
- Exportar em modo escuro.
