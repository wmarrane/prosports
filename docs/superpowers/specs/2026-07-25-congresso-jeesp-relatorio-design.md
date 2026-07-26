# Congresso Técnico (Excel) — relatório JEESP — Design

**Data:** 2026-07-25
**Status:** Aprovado. **Substitui** `2026-07-23-congresso-jeesp-confirmacao-export-design.md`, que partiu de uma leitura incompleta do arquivo-modelo.

## Por que esta spec existe

A spec de 23/07 olhou **apenas a primeira aba** de `personaladmin/reports/congresso_jeesp.xlsx` (`Planilha1`) e concluiu que o relatório do JEESP era uma planilha plana com um `insert into confirmacao`, cujos valores legados seriam digitados num modal no momento do export.

O arquivo tem **8 abas**. A `Planilha1` é um **anexo de carga** do sistema legado; o relatório de fato são as **7 abas por esporte**. E, com o mapeamento confirmado pelo Wagner, **nenhum valor do relatório é digitado** — tudo sai do evento, das inscrições e do sorteio.

## Mapeamento (confirmado)

| Coluna do modelo | Fonte |
|---|---|
| Diretorias | `inscricao.participante.nome` |
| Unidades Escolares | `inscricao.subtitulo` (override por modalidade, escolar) |
| Municípios | `inscricao.municipio` (override por modalidade, escolar) |

Subtítulo e município são os overrides por modalidade do B2 — o `participanteEfetivo` já existente.

## Decisões aprovadas

- **`Planilha1` sai.** Junto com ela saem o modal do frontend e os query params do controller. Os códigos legados (`CodCompeticao`, `Divisão`, `CodMunicipioSede`) não existem no domínio e não têm fonte.
- **Uma aba por esporte**, com feminino e masculino no mesmo tab — é regra do JEESP, não coincidência do arquivo. Esporte = `esporteBase(modalidade.nome)` (`backend/src/lib/esporte.ts`).
- **Um bloco por modalidade**, empilhados na aba do esporte, no passo de **29 linhas** do modelo (linhas 1, 30, 59, 88…). Ex.: Basquetebol com 4 modalidades no evento → 4 blocos.
- **Modalidades desligadas não entram**: nem as inativas na competição (`Modalidade.ativa = false`) nem as excluídas do evento (`evento_modalidade_excluida`).
- **Grade de jogos: só a 1ª rodada**, como no modelo; as linhas restantes ficam em branco.
- **`LOCAL:` e `END.:` sempre em branco**, para preenchimento no congresso.
- **Gatilho inalterado:** competição com `subtitulo_municipio_por_modalidade = true`. Qualquer outra competição continua no `gerarCongressoXlsx` atual.

## Geometria de um bloco

`B` = linha inicial do bloco (1, 30, 59…). Colunas do modelo, verificadas célula a célula:

| Linha | Conteúdo |
|---|---|
| `B` | `C` = sigla da modalidade (BF, BM, HF…) |
| `B+1` | `B` = "Diretorias", `C` = "Unidades Escolares", `D` = "Municípios", `I..L` = "GRUPO A".."GRUPO D", `N`/`O` = "LOCAL:" |
| `B+2 … B+17` | `A` = 1..16, `B` = participante, `C` = escola, `D` = município |

**Inscritos:** ordenados por nome, com a linha do anfitrião (`Cidade Sede`) sempre por último — mesma regra já usada no service atual, inclusive quando o anfitrião está inscrito como participante.

**Grupos (`I..L`), a partir de `B+2`:** cada integrante ocupa **duas linhas** — escola em cima, município embaixo. Slot `i` (0-based) → escola em `B+2+2i`, município em `B+3+2i`. Slot vazio → escola em branco e município `-----`. Logo abaixo, a legenda: `B+11` = letras (A, B, C, D), `B+12 … B+15` = nome do participante de cada slot, com `----x-----` nos vazios.

**Jogos (`N..S`):** `N`/`O` em `B+1` = "LOCAL:", em `B+2` = "END.:". A partir de `B+3`, por grupo, os pares da 1ª rodada (`[1,4]` e `[2,3]`, os mesmos do `fillProgramacao` atual), cada jogo em **duas linhas**:

```
linha 1:  O = sigla   Q = escola do time 1    R = "X"   S = escola do time 2
linha 2:  O = sigla   Q = município do time 1 R = "X"   S = município do time 2  (ou "-----" se bye)
```

Confere com o modelo (GRUPO A = Capital, Sorocaba, Ribeirão Preto):

```
Colegio Campos Sales    X            ← par [1,4]: não há 4º integrante
Capital                 X   -----
Escola Portal Bilingue  X   Colegio Bassano Vaccarini   ← par [2,3]
Sorocaba                X   Ribeirão Preto
```

## Arquitetura

- **Novo** `backend/src/modules/relatorios/relatorio_congresso_jeesp.service.ts` — `gerarCongressoJeespXlsx(evento_id)` monta o workbook: agrupa as modalidades do evento por esporte, uma aba por esporte, um bloco por modalidade.
- **Removido** `relatorio_confirmacao_jeesp.service.ts` (+ teste): a `Planilha1` sai de escopo.
- **Controller** volta a não receber params; só troca o gerador quando a competição é escolar.
- **Frontend** perde o modal e os params; `RelatorioCongresso.tsx` volta ao fluxo de um clique.
- Reuso: `participanteEfetivo` (override escolar), `getModalidadeIdsExcluidas`, `esporteBase`, `sheetSafe` e os pares de rodada do `fillProgramacao`.

## Verificação

- Unit (mock de prisma): aba por esporte; blocos no passo de 29; sigla no topo; inscritos com escola/município do override e `Cidade Sede` por último; pares escola/município nos grupos; jogos da 1ª rodada com `-----` no bye; `LOCAL:`/`END.:` vazios; modalidade inativa e modalidade excluída fora; competição não-escolar inalterada.
- Ponta a ponta no stack local com o evento 5 (Jeesp Mirim Etapa I): 2 abas (Basquetebol com 4 blocos, Handebol com 2), conferidas contra o modelo.

## Fora de escopo

- `Planilha1` e o `insert into confirmacao`.
- O texto de etapa que aparece no modelo (`Etapa 2`, `Equipe`, em `D` da linha do bloco) — não há fonte no domínio; fica em branco.
- 2ª e 3ª rodadas da grade de jogos.
