# Congresso Técnico (Excel) — formato de confirmação JEESP — Design

**Data:** 2026-07-23
**Status:** Aprovado (design). Modelo **exclusivo** para eventos cuja competição é escolar/JEESP.

## Objetivo

Para eventos cuja competição tem o toggle escolar ligado (`competicao.subtitulo_municipio_por_modalidade === true`), o relatório **"Congresso Técnico (Excel)"** passa a gerar uma **planilha plana de confirmação** (formato do arquivo-modelo `personaladmin/reports/congresso_jeesp.xlsx`), no lugar do relatório visual atual (grupos/chaves). Eventos de outras competições permanecem **inalterados**.

O modelo é um export de dados: uma linha por (participante × modalidade), com uma coluna final contendo uma **fórmula do Excel** que monta um `insert into confirmacao (...)` para alimentar o sistema JEESP legado.

## Formato do modelo (analisado do anexo)

Aba `Planilha1`, **dados a partir da linha 3** (linhas 1‑2 em branco), colunas A–J:

| Col | Conteúdo | Origem |
|-----|----------|--------|
| A | Código sequencial (cosmético — **não** entra no SQL da col J) | gerado (1,2,3…) |
| B | Municipio = nome do participante (DREL/SREL) | `inscricao.participante.nome` |
| C | CodModalidade | form (default `0`) |
| D | Modalidade | `modalidade.nome` (como cadastrado) |
| E | CodCompeticao | form |
| F | Competicao (ex.: `Jogos Escolares`) | form (default `Jogos Escolares`) |
| G | Divisao (ex.: `2ª Divisão`) | form |
| H | CodMunicipioSede | form (um único valor p/ o arquivo) |
| I | MunicipioSede (ex.: `Praia Grande`) | form (default = município do evento) |
| J | Fórmula Excel: `="insert into confirmacao (Municipio, CodModalidade, Modalidade, CodCompeticao, Competicao, Divisao, CodMunicipioSede, MunicipioSede)\nvalues ('"&B3&"',"&$C3&",'"&$D3&"',"&$E3&",'"&$F3&"','"&$G3&"',"&$H3&",'"&$I3&"')"` (referencia as células da própria linha) | gerado |

Observação: no modelo, cada modalidade tem 15 DRELs + 1 linha literal **"Cidade Sede"** (16 linhas/modalidade). O `CodMunicipioSede` aparece com 879/880 no modelo (dois lotes) — **fora de escopo**: usaremos um único valor do form.

## Decisões aprovadas

- **Gatilho:** substituir o relatório só para eventos escolares (detecção pelo toggle `subtitulo_municipio_por_modalidade`). Não‑escolar: `gerarCongressoXlsx` atual inalterado.
- **Valores legados:** coletados num **form (modal) no momento do export** (não persistem). Prefill: Competicao=`Jogos Escolares`, MunicipioSede = município do evento, CodModalidade=`0`.
- **Coluna A:** sequencial gerado (1,2,3…); cosmético (não referenciado no SQL).
- **Coluna H (CodMunicipioSede):** um único valor do form para o arquivo inteiro.
- **Linha "Cidade Sede":** injetada **uma por modalidade** (B = texto literal `Cidade Sede`), além das inscrições reais.
- **Coluna D / C:** `modalidade.nome` como está; `CodModalidade` do form (default `0`).
- **Coluna J:** emitida como **fórmula do Excel** (recalculável), idêntica ao modelo.

## Arquitetura

- **Backend — novo `backend/src/modules/relatorios/relatorio_confirmacao_jeesp.service.ts`**
  - `gerarConfirmacaoJeespXlsx(evento_id: number, params: ConfirmacaoJeespParams): Promise<Buffer>`
  - `type ConfirmacaoJeespParams = { codCompeticao: number; competicao: string; divisao: string; codMunicipioSede: number; municipioSede: string; codModalidade: number }`
  - Carrega evento + modalidades ativas (excluindo as ocultas) e as inscrições por modalidade (participante.nome), reusando os helpers de `relatorio_congresso.service.ts` (`getModalidadeIdsExcluidas`) ou consultas próprias.
  - Monta a aba `Planilha1` (dados a partir da linha 3): para cada modalidade, uma linha por inscrição + uma linha `Cidade Sede`; preenche A–I e escreve a fórmula em J (`{ formula: "..." }` do ExcelJS, referenciando as células da linha).
- **Backend — endpoint** `GET /relatorios/eventos/:eventoId/congresso` passa a aceitar query params opcionais dos valores do form. No controller: se `evento.competicao.subtitulo_municipio_por_modalidade === true`, delega para `gerarConfirmacaoJeespXlsx(eventoId, params)`; senão mantém `gerarCongressoXlsx(eventoId)`. Auth atual (`requireAuth` + `requireAcessoEvento`) preservada. Nome do arquivo: `Confirmacao_{slug}.xlsx`.
- **Frontend — `RelatorioCongresso.tsx`**: quando o evento selecionado é escolar, o botão "Baixar Excel" abre um **modal** com os campos do form; ao confirmar, chama `relatoriosService.congresso(eventoId, params)` com os params na query. Evento não‑escolar: fluxo atual (sem modal).
- **Frontend — `relatorios.ts`**: `congresso(eventoId, params?)` inclui os params como query string quando presentes.

## Testes / Verificação

- **Backend (novo service):** unit com ExcelJS lendo o buffer — dado um evento escolar com 2 modalidades e N inscrições + params do form:
  - dados começam na linha 3; colunas A–J presentes;
  - B = nome do participante; D = nome da modalidade; C/E/F/G/H/I = valores do form em todas as linhas;
  - existe **uma** linha `Cidade Sede` por modalidade;
  - J é uma fórmula que contém `insert into confirmacao` e referencia `B{n}`/`$C{n}` etc. da própria linha.
- **Backend regressão:** evento não‑escolar → controller ainda chama `gerarCongressoXlsx` (formato atual).
- `cd backend && npx tsc --noEmit && npx vitest run src/modules/relatorios`.
- **Frontend:** `cd frontend && npm run build`; teste manual do modal (evento escolar mostra modal e baixa; não‑escolar baixa direto).

## Fora de escopo

- Variação de `CodMunicipioSede` por modalidade/gênero (879/880 do modelo) — usa valor único do form.
- Persistir os valores legados no evento/competição (optou‑se por form no export).
- Alterar o relatório de eventos não‑escolar.
- Importar/rodar o SQL gerado — o arquivo apenas produz as instruções `insert`.
