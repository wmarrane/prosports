# Relatório "Congresso técnico" v2 — Design

**Data:** 2026-06-08
**Status:** Aprovado (6 pontos de esclarecimento confirmados) — aguardando revisão da spec

Reformulação do gerador `backend/src/modules/relatorios/relatorio_congresso.service.ts`
(ExcelJS). Uma aba por modalidade, nomeada pela **sigla**, com cabeçalho padrão e
layout específico por tipo. Brackets de chaves vêm do arquivo `CHAVES CT.xlsx`.

## Decisões confirmadas

1. **Ordem de entrada NÃO copia** do `CHAVES CT.xlsx` — é construída do zero (o item 8.1 do pedido era erro de cópia).
2. Em ordem de entrada: **E6 = "#"** e **F6 = nome da modalidade**.
3. O arquivo de brackets é `personaladmin/reports/CHAVES CT.xlsx` → vai para `backend/templates/CHAVES CT.xlsx` (e no Dockerfile).
4. Logo = `montana/simbolo.png` em **A1:B3** (mesclado, imagem embutida).
5. Grupos têm **no máximo 4** por grupo (F7:F10 = 1–4; linhas extras vazias se grupo de 3).
6. Lista de inscritos (B7+) em **ordem alfabética**.

## Abordagem técnica

- **Workbook novo do zero** (não usa mais `Congresso.xlsx`).
- `especifico`, `grupos`, `ordem_entrada`: abas criadas **programaticamente**.
- `chaves`: copia a aba `NN` (NN = nº de inscritos, 2 dígitos com zero à esquerda, ex. 16→"16", 8→"08") de `CHAVES CT.xlsx` via cópia cross-workbook (ExcelJS: itera células/estilos/merges/larguras — o bracket usa **bordas**, sem formas, então copia fiel). Renomeia para a sigla.
  - Se não existir aba para aquele nº de inscritos → cai no layout `especifico` (lista simples) e registra aviso. (fallback seguro)
- Cada aba recebe o **cabeçalho comum** (logo + Cidade Sede + Anfitrião + título Modalidade).
- A imagem do logo é adicionada uma vez por aba via `wb.addImage` + `sheet.addImage` no range `A1:B3`.

### Helper de formatação

Função utilitária `aplicarEstilo(cell, { bold, fontSize, fontName, fontColor, fill })`
para padronizar. Fonte padrão das células de dado: **"Aptos Narrow"**.
Cores: `#156082` (ARGB `FF156082`), preto `FF000000`, branco `FFFFFFFF`.

## Layout comum (todas as abas)

| Célula/Range | Conteúdo | Formato |
|---|---|---|
| `A1:B3` (merge) | Logo Montana (imagem) | — |
| `C2` | Título "Cidade Sede" | (padrão) |
| `D4` | Nome do anfitrião | **Negrito, fonte branca, fundo `#156082`** |
| `B5` | Título "Modalidade (Inscritos)" | (padrão) |

> `cidadeSede`/anfitrião: `evento.anfitriao?.nome` (host). Hoje o service já carrega `evento.anfitriao`.

## Por tipo de modalidade

### Específico (item 5)
- `B6` = nome da modalidade — CAIXA ALTA, negrito, fonte branca, **fundo preto**, **fonte 20**, "Aptos Narrow".
- `C6` = total de inscritos — fonte branca, **fundo `#156082`**, **fonte 12**, "Aptos Narrow".
- `B7..` = participantes (alfabético) — fonte preta, fundo branco, **fonte 11**, "Aptos Narrow".

### Grupos (item 6)
- `B6`, `C6`, `B7..` = idem Específico (nome / total / lista).
- `F5` = título "Grupos".
- `F6` = "#" — negrito, fonte branca, fundo preto, fonte 20, "Aptos Narrow".
- `F7:F10` = números 1, 2, 3, 4.
- Grupos **por coluna** a partir de `G`: `G6` = rótulo do Grupo A, `G7:G10` = membros do grupo A; `H6`/`H7:H10` = Grupo B; e assim por diante. Texto: fonte preta, fundo branco, fonte 11, "Aptos Narrow".
- Fonte dos dados: do `sorteio.resultado.grupos` (`{ letra, participantes: number[] }[]`), resolvendo `participante_id → nome` via inscritos.

### Chaves (item 7)
- Copia a aba `NN` de `CHAVES CT.xlsx` (NN = nº de inscritos) → renomeia para a sigla.
- `B6` = nome (CAIXA ALTA, negrito, branco, fundo preto, 20, "Aptos Narrow").
- `C6` = total de inscritos (branco, fundo `#156082`, 12, "Aptos Narrow").
- `B7..` = participantes (alfabético; preto, fundo branco, 11, "Aptos Narrow").
- **Preenchimento do bracket:** na aba copiada, a **coluna D** tem as posições (D7=1, D9=2, D11=3, …) e a **coluna E** recebe o participante. Para cada posição `p` (1..size) do sorteio (`resultado.slots[p-1]` → participante_id, pulando BYE/null), achar a linha `r` onde `D[r] == p` e gravar o nome em `E[r]`.
- Cabeçalho comum (logo/Cidade Sede/Anfitrião/B5) é aplicado por cima das células livres (A1:B3, C2, D4, B5 estão livres nas abas de bracket).

### Ordem de entrada (item 8) — construída do zero
- `B6` = nome (CAIXA ALTA, negrito, branco, fundo preto, 20, "Aptos Narrow").
- `C6` = total de inscritos (branco, fundo `#156082`, 12, "Aptos Narrow").
- `B7..` = participantes (alfabético; preto, fundo branco, 11, "Aptos Narrow").
- `E5` = "ORDEM DE ENTRADA" (CAIXA ALTA, branco, fundo `#156082`, 11, "Aptos Narrow").
- `E6` = "#" (CAIXA ALTA, branco, fundo `#156082`, 12, "Aptos Narrow").
- `F6` = nome da modalidade (CAIXA ALTA, branco, fundo `#156082`, 12, "Aptos Narrow").
- `E7..` = posição de entrada (1, 2, 3, …) — preto, fundo branco, 11, "Aptos Narrow".
- `F7..` = municípios/participantes sorteados na ordem (`resultado.ordem` → nome) — preto, fundo branco, 11, "Aptos Narrow".

## Dados (já disponíveis no service)

- `evento` (com `anfitriao`), `modalidades` (com `tipo_modalidade`, `sigla`, `nome`).
- inscritos por modalidade (alfabético), sorteios por modalidade (`resultado` por tipo).
- `Sorteio.resultado`: grupos `{grupos}`, chaves `{slots, size, byePositions}`, ordem `{ordem}`.

## Runtime / deploy

- Copiar `personaladmin/reports/CHAVES CT.xlsx` → `backend/templates/CHAVES CT.xlsx`.
- Garantir que o Dockerfile do backend copia `templates/` (já copia o `Congresso.xlsx`; o novo arquivo entra junto). Validar que o nome com espaço é preservado.
- O logo `montana/simbolo.png` precisa estar acessível ao backend → copiar para `backend/templates/montana-simbolo.png` (assets do backend), referenciado por caminho absoluto via `path.resolve(__dirname, ...)`.

## Casos de borda

- Modalidade sem sorteio: monta o cabeçalho + lista de inscritos; áreas de sorteio ficam vazias.
- Chaves sem aba correspondente em `CHAVES CT.xlsx` (nº fora de 2..77 ou ausente): fallback para layout específico (lista) + log.
- Grupo de 3: a 4ª linha (F10/coluna do grupo) fica vazia.
- Sigla ausente: usa `MOD<id>` (já existe).

## Testes

- Unit (Vitest) do gerador com fixtures (mock prisma): para cada tipo, gera o buffer e reabre com ExcelJS verificando células-chave (B6 nome em CAIXA ALTA, C6 = contagem, B7 = 1º inscrito alfabético; grupos em G; ordem em E/F; chaves: E na linha do D==posição).
- Teste da cópia cross-workbook: copiar a aba "08" de um fixture e conferir que merges/estilos/uma borda vieram.
- Verificação de formatação: B6 com fundo preto + fonte branca 20; C6 fundo `#156082`.

## Não-objetivos

- Não muda a rota/endpoint nem o front (`/relatorios/congresso` continua baixando o `.xlsx`).
- Não adiciona dependências (ExcelJS já presente).
