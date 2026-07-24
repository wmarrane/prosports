# Export HTML do evento: subtítulo em grupos e inscritos — Design

**Data:** 2026-07-23
**Status:** Aprovado (design). Extensão do B2 escolar (exibição por modalidade) para o export HTML — superfície que o B2 não cobriu.

## Objetivo

No export HTML do evento, apresentar o subtítulo/município **efetivo** — override por modalidade quando a competição é **escolar**; global quando **não‑escolar** — em duas seções:
1. **Grupos / chaves / ordem de entrada:** hoje já mostram uma linha de subtítulo, mas no escolar mostram o valor **global (placeholder)** em vez do override por modalidade.
2. **Inscritos:** hoje mostra **apenas o nome**; passa a mostrar o subtítulo numa **segunda linha discreta**, sempre que houver.

Competições **não‑escolar sem `subtitulo_campos`**: export idêntico ao atual (regressão zero).

## Contexto (codebase)

- O export HTML é **100% frontend**, disparado por `handleExportarHtml()` em `frontend/src/pages/eventos/EventoInscricoes.tsx` (linhas ~328‑410), que renderiza `SorteioPrintContent` por modalidade via `renderToStaticMarkup` e baixa um `.html`.
- `frontend/src/pages/eventos/SorteioPrint.tsx` é o componente imprimível. A seção **Inscritos** (linhas 80‑85) renderiza só `{i.nome}`. As seções de sorteio delegam a `SorteioGrupos`/`SorteioChaves`/`SorteioOrdem`, que já chamam `subtituloLine(p)` por participante.
- `handleExportarHtml` monta `pById` (participantesById) a partir de `i.participante` **cru** (linha 358) e passa `inscritos` como `{ id, nome }` (linha 386). O `subtituloLine` (linha 194) é `composeSubtituloLine(p, camposSubtitulo)`.
- Já existem no arquivo: `participanteEfetivo` (de `../../lib/compose-subtitulo`), `subMunPorMod = evento?.competicao?.subtitulo_municipio_por_modalidade === true`, `camposSubtitulo`, `subtituloLine`.
- O `inscricoesService.listar` usado no export já retorna `inscricao.subtitulo` e `inscricao.municipio` (override), então `participanteEfetivo(i, subMunPorMod)` funciona sem alteração de backend/endpoint.

## Arquitetura / Mudanças (frontend apenas)

### 1. `EventoInscricoes.tsx` → `handleExportarHtml`
- Montar `pById` com `participanteEfetivo(i, subMunPorMod)` em vez de `i.participante` (linha 358). Corrige grupos/chaves/ordem no escolar (passam a usar o override); não‑escolar devolve o próprio participante (idêntico).
- Passar o subtítulo por inscrito: `inscritos` (linha 386) vira `{ id, nome, subtitulo }`, com
  `subtitulo = subtituloLine(participanteEfetivo(i, subMunPorMod))`.

### 2. `SorteioPrint.tsx`
- Tipo `inscritos`: `{ id: number; nome: string; subtitulo?: string | null }[]`.
- Na lista de inscritos, cada `<li>` empilha o nome e, se `subtitulo`, uma **segunda linha** com fonte menor e cor acinzentada (`#64748b`), mesmo espírito visual dos grupos. Adicionar `break-inside: avoid` no `<li>` para não quebrar entre as 2 colunas do `<ul style={{ columns: 2 }}>`.

## Regressão zero (não‑escolar)

- `participanteEfetivo(i, false)` devolve `i.participante` → grupos/chaves/ordem idênticos.
- Inscritos: sem `subtitulo_campos` configurado → `subtituloLine(...)` retorna `null` → sem segunda linha → igual a hoje. A segunda linha só aparece quando há campos configurados (comportamento pedido).

## Decisões aprovadas

- **Escopo dos inscritos:** subtítulo aparece **sempre que houver** (qualquer competição com `subtitulo_campos`), não só escolar — consistente com o que os grupos já fazem.
- **Formato nos inscritos:** **segunda linha discreta** abaixo do nome (não inline), para casar com o visual dos grupos.

## Testes / Verificação

- `cd frontend && npm run build` verde (o CI usa `tsc -b && vite build`).
- Verificação **manual** do export (é visual):
  - **Escolar** ("Jeesp Mirim Etapa I"): cada modalidade mostra, nos grupos e nos inscritos, o subtítulo (escola) + município do **override** por SREL.
  - **Não‑escolar com `subtitulo_campos`:** subtítulo aparece nos inscritos (2ª linha) e nos grupos como antes.
  - **Não‑escolar sem campos:** export idêntico ao atual (só nomes).

## Fora de escopo

- Alterar as demais seções do export (campeões, cabeças) — permanecem só com o nome.
- Qualquer mudança no backend ou nos endpoints de inscrição.
- Mudar o layout/tema geral do documento exportado.
