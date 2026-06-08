# Versionamento de Chaves (V1/V2) — Design

**Data:** 2026-06-08
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Permitir que cada modalidade do tipo `chaves` escolha a **versão do desenho do bracket**:

- **V1** — modelo atual: o jogador com BYE entra direto na **2ª rodada** (não tem linha na 1ª rodada).
- **V2** — o jogador com BYE ocupa uma **linha na 1ª rodada** com "vs BYE" e avança para a 2ª rodada.

O seeding, os confrontos e as posições dos participantes são **idênticos** entre V1 e V2 — a única diferença é **onde o BYE é desenhado**.

A partir deste versionamento, **qualquer ajuste no desenho das chaves deve perguntar a qual versão se aplica**.

## Decisões (do brainstorming)

1. **V2 é derivado do V1** por uma transformação determinística — sem nova planilha `CHAVES CT.xlsx`, sem nova seed. Herda a correção do V1 em todo N.
2. **A transformação é aplicada no sorteio** (congelada em `Sorteio.resultado.matchesGraph`). Sorteios antigos não mudam; trocar a versão da modalidade só passa a valer **após re-sortear**.
3. **Escopo de saída:** tela do resultado + PDF do sorteio (ambos leem `matchesGraph`, então herdam o V2). O **relatório Congresso não muda** (preenche por posição/`slots`, que é igual em V1 e V2).
4. **Campo de versão na Modalidade** (`chave_versao`), relevante só para tipo `chaves`.
5. **Padrão:** modalidades existentes = `V1` (pelo default da coluna); modalidades **novas** = `V2` (default do formulário).

## Modelo de dados

Nova coluna em `Modalidade`:

```prisma
model Modalidade {
  // ...
  chave_versao String @default("V1") // 'V1' | 'V2' — só relevante p/ tipo 'chaves'
}
```

- Default `'V1'` garante que linhas existentes permaneçam V1 sem backfill.
- Migration: `ALTER TABLE "Modalidade" ADD COLUMN "chave_versao" TEXT NOT NULL DEFAULT 'V1';`
- Validação aceita apenas `'V1'` ou `'V2'`.

## A transformação V1 → V2 (backend, pura)

### Estrutura do grafo (referência)

`MatchesGraph` (em `backend/src/modules/sorteios/engine.ts`):

```ts
type MatchesGraph = {
  matches: Array<{ id: string; round: number; top: MatchRef; bottom: MatchRef }>
  final: string
  thirdPlace: string | null
}
// MatchRef = 'P{n}' (posição) | 'V:J{x}' (vencedor) | 'L:J{x}' (perdedor)
```

**Identificação dos BYEs:** no grafo V1, jogos de 1ª rodada têm `P{n}` como confrontos reais; jogos de **rodada ≥ 2** que contêm um `P{n}` direto são **BYEs** (o jogador pulou a 1ª rodada). O 3º lugar usa só `L:J*` e não é tocado.

Validado contra os dados reais:
- N=5 (byes `{1}`): único `P{n}` em rodada ≥2 é `P1` em J2.
- N=22 (byes `{1,6,11,12,17,22}`): `P1`(J7), `P6`(J9), `P11`(J10), `P12`(J11), `P17`(J13), `P22`(J14) — todos em rodada 2.

### Algoritmo `liftByesToFirstRoundV2(graph): MatchesGraph`

Função pura, não muta o argumento. Passos:

1. Copia o grafo.
2. Para cada match `M` com `round ≥ 2`, e para cada slot (`top`, `bottom`) cujo ref seja `P{n}`:
   - Gera um novo id de stub: `B{k}` (k = contador incremental, começando em 1).
   - Adiciona um novo match `{ id: "B{k}", round: 1, top: "P{n}", bottom: "BYE" }`.
   - Substitui o ref em `M` por `V:B{k}`.
3. `final` e `thirdPlace` permanecem inalterados (são jogos reais J*).
4. Retorna o novo grafo.

**Invariantes preservadas:** numeração dos jogos reais (`J1..Jn`), `final`, `thirdPlace`, `slots`, `byePositions`. Os stubs `B*` **não** são jogos numerados.

### Onde plugar

Em `backend/src/modules/sorteios/sorteios.service.ts`, ao montar o sorteio de chaves: após carregar `matchesGraph` de `BracketChavesMatches`, se `modalidade.chave_versao === 'V2'` **e** houver grafo, aplicar `liftByesToFirstRoundV2(matchesGraph)` antes de passar a `drawBracket`. (`drawBracket` apenas repassa o `matchesGraph` para `BracketResultado`.)

- N **sem grafo** no V1 (render legado) continuam legado — sem transformação, V1-like. Comportamento consistente e aceitável.

### Validação (testes)

Para um conjunto de N (incl. 5, 6, 22 e um N grande com grafo, ex. 26):
- nº de stubs `B*` criados == nº de `byePositions` (= nº de `P{n}` em rodada ≥2).
- nº de jogos reais `J*` inalterado (== N−1).
- nenhum `P{n}` resta em rodada ≥2.
- todo `V:B{k}` referenciado existe; nenhum órfão.
- `final`/`thirdPlace` inalterados.

## Render (frontend)

`frontend/src/components/sorteio-result/BracketTree.tsx`:

- `renderSlot`: tratar o ref literal `"BYE"` → renderiza rótulo "BYE" (mesmo estilo do BYE atual).
- Ocultar o número de jogo (canto do card, hoje `m.id`) quando o id começar com `B` (stub de BYE não é jogo).
- `computeLayout` trata os stubs `B*` como matches normais de 1ª rodada (espaçamento igual); os conectores `V:B{k}` já são desenhados pela lógica existente de `V:`.

Tela do resultado (`SorteioChaves`) e PDF do sorteio (`SorteioPrint` → `SorteioChaves`) passam a exibir V2 automaticamente, pois leem o `matchesGraph` já transformado de `Sorteio.resultado`.

## Relatório Congresso

**Nenhuma alteração.** `fillChaves` preenche por posição lendo `Sorteio.resultado.slots`, que é idêntico em V1 e V2.

## UI — formulário de modalidade

`frontend/src/pages/modalidades/ModalidadeForm.tsx`:

- Adicionar seletor **Versão da chave** (`V1` / `V2`), visível **somente** quando o tipo selecionado é `chaves`.
- O seletor é **editável tanto em modalidade nova quanto existente** — o usuário pode escolher/alterar a versão a qualquer momento, independente de já existir sorteio.
  - Modalidade nova: default `V2`.
  - Edição: carrega o valor salvo e permite trocar.
- Texto de apoio no seletor (quando em edição com sorteio já feito): avisar que a troca de versão **só passa a valer após re-sortear** a modalidade (o grafo é congelado no sorteio — decisão #2).
- Enviar `chave_versao` no payload de criar/editar.
- `frontend/src/services/modalidades.ts` e tipos: incluir `chave_versao`.

## Backend — API

- `backend/src/modules/modalidades/`: controller/service/validação aceitam e persistem `chave_versao` (criar e editar); retornam o campo no GET.

## Regra de processo

Registrar na memória (e neste repositório de specs): **qualquer mudança futura no desenho das chaves deve perguntar a qual versão (V1/V2) se aplica.**

## Fora de escopo

- Reescrever o relatório Congresso para desenhar a partir do grafo.
- Corrigir os N sem grafo / em render legado (17/40/58, 20, 62–77) — bug de feeders já documentado como follow-up.
- Re-sortear automaticamente modalidades ao trocar a versão (continua manual, por re-sorteio).
