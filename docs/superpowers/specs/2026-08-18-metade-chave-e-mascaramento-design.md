# Metade da chave por inscrição + mascaramento de nome

**Data:** 2026-08-18
**Competição motivadora:** Jogos Escolares de Praia Grande

## Objetivo

Duas regras novas, independentes entre si, ligadas por parâmetro na modalidade:

1. **Metade da chave** — uma inscrição pode exigir que o participante caia na
   parte de cima ou na parte de baixo do bracket. Sem exigência, ele sorteia em
   qualquer lugar, como hoje.
2. **Mascaramento de nome** — em modalidades marcadas, o nome do participante
   aparece parcialmente oculto no Modo Congresso e no site público.

## O que foi descartado

A proposta original tinha uma **regra 01**: tornar a inscrição uma chave
composta `participante + subtítulo`, permitindo o mesmo participante inscrito
mais de uma vez na mesma modalidade com subtítulos diferentes. **Descartada.**
A inscrição continua única por `(evento, modalidade, participante)` — a
constraint `@@unique([evento_id, modalidade_id, participante_id])` não muda.

## O que já existe hoje

| Regra | Onde vive |
|---|---|
| Cabeças de chave (campeões do ano anterior) | `SistemaDisputasChaves.posicao_{primeiro..quarto}_cabeca` por competição+N |
| Anfitrião como 4º cabeça | `sorteios.service.applyAnfitriaoRule` |
| BYEs | `bracket_chaves_byes.posicoes_bye` por N |
| Desenho do bracket | `bracket_chaves_matches.matches_graph` por N (76 tamanhos cadastrados) |
| V1/V2 do bracket | `Modalidade.chave_versao` + `engine.liftByesToFirstRoundV2` |
| Override escolar de subtítulo/município | `Inscricao.subtitulo`/`municipio_id` + `participanteEfetivo` |

O sorteio de chaves hoje: coloca as cabeças nas posições fixas, embaralha o
resto com `shuffleSeeded(seed)` e preenche as vagas na ordem das posições.

## Decisão-chave: as metades saem do desenho da chave

A definição "ímpar arredonda para cima" **não corresponde** ao desenho real das
chaves. Verificação sobre os 76 grafos cadastrados: em 33 dos 38 tamanhos
ímpares o participante extra fica na metade **de baixo**.

| N | metade real (cima/baixo) | ⌈N/2⌉ pediria |
|---|---|---|
| 3 | 1 / 2 | 2 / 1 |
| 5 | 3 / 2 ✅ | 3 / 2 |
| 7 | 3 / 4 | 4 / 3 |
| 19 | 9 / 10 | 10 / 9 |
| 77 | 38 / 39 | 39 / 38 |

Coincidem apenas N = 5, 9, 17, 51 e 53. Nos 76 tamanhos as duas metades são
**sempre faixas contíguas** de posições.

Portanto: **a metade de cima é o conjunto de posições que chega à final por um
lado do grafo**, obtido caminhando de `matchesGraph.final` para trás. É o que
garante a promessa da regra — quem está numa metade só encontra a outra na
final. `⌈N/2⌉` não é usado em lugar nenhum.

A metade que contém a posição 1 é a "de cima".

## Dados

```prisma
model Modalidade {
  usa_metade_chave  Boolean @default(false)
  mascarar_nome     Boolean @default(false)
}

model Inscricao {
  metade_chave  String?   // 'cima' | 'baixo' | null
}
```

Os valores gravados são exatamente as strings `cima` e `baixo`; qualquer outro
valor é rejeitado na API. Desligar `usa_metade_chave` não apaga o que já foi
marcado nas inscrições — os valores ficam guardados e passam a ser ignorados.

Migração aditiva, tudo com default. Nenhuma competição existente muda de
comportamento. Os dois parâmetros da modalidade são independentes: dá para
mascarar sem usar metade e vice-versa.

## Sorteio

Ordem de preenchimento em `engine.drawBracket`, para modalidade com
`usa_metade_chave`:

1. **Cabeças primeiro**, nas posições fixas — exatamente como hoje.
2. **Metades calculadas** a partir do grafo.
3. **Vagas livres separadas** em livres-de-cima e livres-de-baixo.
4. **Balde "cima"** distribuído nas livres-de-cima; **balde "baixo"** nas
   livres-de-baixo; **balde "sem preferência"** no que sobrar.

Tudo com o mesmo `shuffleSeeded(seed)` de hoje: mesma seed, mesmo resultado.

**Precedência:** quem é cabeça (campeão anterior ou anfitrião) vai para a
posição de cabeça e tem a `metade_chave` **ignorada** naquele sorteio. O
resultado do sorteio registra os descartes para a tela poder informá-los.

**Sem grafo cadastrado:** se `usa_metade_chave` está ligado e não existe
`matches_graph` para aquele N, o sorteio **recusa** com mensagem explícita. Não
há fallback adivinhado.

**Tipos não afetados:** `grupos` e `ordem_entrada` ignoram `metade_chave`. O
campo não aparece na tela dessas modalidades.

**V1/V2:** `liftByesToFirstRoundV2` reescreve o grafo depois do sorteio e não
altera o conjunto de posições de cada metade — as duas versões convivem sem
tratamento especial.

**BYEs:** posições de bye continuam vindo de `bracket_chaves_byes` e estão
distribuídas nas duas metades. Um inscrito preso a uma metade pode receber bye;
isso é aceito.

## Viabilidade

Se um balde não cabe na sua metade, não existe sorteio válido. Duas defesas:

1. **Aviso antes** — a tela de inscrições mostra, por modalidade que usa a
   regra, um contador ao vivo (`cima 6/4 · baixo 1/4`) e destaca o estouro.
2. **Recusa no sorteio** — se ninguém corrigir, o sorteio falha com a conta na
   mensagem: *"6 inscritos pedem a parte de cima, que tem 4 vagas."*

**Como a conta é feita no sorteio (autoritativa):** cabeças saem da conta dos
dois lados — eles já têm posição fixa e a metade deles é ignorada. Sobra, para
cada metade, o número de vagas livres contra o número de inscritos não-cabeça
que pediram aquela metade.

**Como a conta é feita na tela (aviso antecipado):** a tela não sabe quem será
cabeça no momento do sorteio, então compara simplesmente os pedidos de cada
metade contra o tamanho total daquela metade. É um alerta, não um veredito — a
recusa autoritativa é a do sorteio.

## Mascaramento

**Formato:** primeiro nome + dez asteriscos, fixos.
`"Wagner Rosa Marrane"` → `"Wagner **********"`.
`"Rodrigo Moreira"` → `"Rodrigo **********"`.
Nome de uma palavra só fica como está (não há sobrenome a esconder).
A contagem fixa não revela o tamanho do sobrenome.

**Helper gêmeo** `mascararNome(nome: string): string` no backend e no frontend,
seguindo o padrão já existente de `compose-subtitulo.ts`.

**Onde se aplica** (`Modalidade.mascarar_nome` ligado):

- **Site público** — dentro de `montaSnapshot`, no mapeamento de
  `SnapParticipante.nome`. O JSON publicado já sai mascarado: o nome completo
  nunca chega à internet.
- **Modo Congresso** — nos mapas de nome das telas (`CongressoStepSorteio`,
  `CongressoStepParticipantes`, `CongressoStepCampeoes`, `CampeoesPanel`).

**Onde NÃO se aplica:** telas de cadastro e inscrição, acesso por chave/mobile,
impressão do sorteio e relatórios Excel continuam com o nome completo — são uso
interno e servem para conferir quem é quem.

**Implementação:** o mascaramento entra no **mapeamento de dados**, nunca dentro
dos componentes de `components/sorteio-result/*`, que são compartilhados entre
admin e site público.

**Composição com o override escolar:** `participanteEfetivo` continua
responsável por subtítulo e município; o mascaramento altera só o nome. O
colégio (subtítulo) permanece visível.

**Consequência aceita:** como o parâmetro é por modalidade, o mesmo aluno pode
aparecer mascarado numa modalidade e aberto em outra do mesmo evento.

## Entrada de dados

- **Tela de inscrições do evento:** seletor por linha — cima / baixo / sem
  preferência — visível apenas em modalidade com `usa_metade_chave`.
- **CSV de importação:** coluna opcional `metade`, aceitando `cima` e `baixo`;
  vazio ou ausente significa sem preferência. Valor inválido rejeita a linha com
  mensagem, como as demais validações do importador.
- **Editor de modalidade:** os dois checkboxes novos.

## Testes

**Engine (unitário, sem banco):**
- `metadesDoGrafo` devolve faixas contíguas e complementares nos 76 tamanhos
  cadastrados, com a tabela acima como caso fixo (N=3, 5, 7, 19, 77).
- Cabeça prevalece: campeão marcado como "cima" com posição de cabeça embaixo
  fica na posição de cabeça, e o descarte é registrado.
- Excesso: balde maior que a metade rejeita antes de sortear.
- "Sem preferência" pode cair nas duas metades.
- Mesma seed, mesmo resultado.

**Mascaramento:**
- Formato exato para nome com 2, 3 e 1 palavras.
- `montaSnapshot` mascara apenas quando o parâmetro está ligado.
- Subtítulo não é afetado.

**Regressão (a mais importante):**
- Modalidade sem os dois parâmetros produz sorteio idêntico ao de hoje para a
  mesma seed, incluindo cabeças, anfitrião e byes.

## Fora de escopo

- Chave composta `participante + subtítulo` (regra 01, descartada).
- Mascaramento em relatórios Excel, impressão e acesso por chave/mobile.
- Separar participantes do mesmo colégio em metades diferentes
  automaticamente — a metade é sempre informada, nunca inferida.
- Replicar os parâmetros em massa entre modalidades.
