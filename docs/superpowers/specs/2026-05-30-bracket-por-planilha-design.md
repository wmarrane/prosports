# Bracket de Chaves por Estrutura da Planilha — Design

**Data:** 2026-05-30
**Status:** Aprovado para implementação
**Versão alvo:** 1.18.0

## Objetivo

Substituir o cálculo de BYEs do engine de chaves (atualmente `nextPow2(N) - N` BYEs no final do array) por uma estrutura predefinida em planilha (`personaladmin/CHAVES CT.xlsx`) que descreve, por N (número de inscritos), quais posições recebem BYE. Preservar a regra das cabeças: champions do ano anterior continuam ocupando as posições reservadas em `sistema_disputas_chaves`.

## Motivação

O engine atual posiciona BYEs no final do array (`slots = [...participantes, ...nulls]`), o que produz estruturas de bracket diferentes das definidas pelo regulamento. Exemplo:
- **N=6:** engine atual coloca BYEs em posições 7 e 8 (depois do último jogador). Planilha define BYEs em posições **1 e 6** — top-seed e bottom-seed entram direto na semifinal.
- **N=20:** engine criaria 12 BYEs (pot2=32). Planilha define apenas **4 BYEs** (posições 1, 10, 11, 20) — estrutura assimétrica customizada com R1 de 8 matches + 4 BYEs entrando em R2.

Operadores hoje precisam manualmente reorganizar o resultado para alinhar com o regulamento. Esta feature elimina essa fricção.

## Escopo

**In:**
- Nova tabela `bracket_chaves_byes(numero_inscrito INT PK, posicoes_bye INT[])` populada com dados extraídos da planilha para N=2..77.
- Engine `drawBracket` lê essa tabela e usa as posições BYE definidas.
- Cabeças seguem `sistema_disputas_chaves` (regra atual preservada). Quando N tem `>4` BYEs (ex.: N=22 com 6 BYEs), os BYEs sobrando são preenchidos aleatoriamente com não-cabeças.
- Resultado do sorteio (`ChavesResultado`) ganha campo `byePositions: number[]` (1-indexed).
- Frontend `SorteioChaves.tsx` usa `byePositions` para construir a árvore corretamente (BYEs em pares pré-determinados pela planilha, não mais no final).
- Backwards compatibility: sorteios antigos (sem `byePositions`) continuam renderizando via lógica `nextPow2` atual.

**Out:**
- Grafo completo de matches em R3, R4, ... A planilha tem estruturas asimétricas customizadas (ex.: N=20 onde 4 R1-winners vão direto pra R3 pulando R2). Render fiel desse grafo fica para V2.
- Edição manual da estrutura de bracket pela UI (a planilha é a fonte canônica; alterações vão por SQL ou novo seed).
- Validação cruzada de que cabeças nas posições BYE coincidem (assumimos consistência entre `sistema_disputas_chaves` e `bracket_chaves_byes`).

## Análise da planilha

Planilha tem 76 abas (N=2..77). Cada aba contém:
- Bracket visual à esquerda (posições 1..N com labels `jX` indicando matches).
- Lista de matches à direita (J1, J2... → quem joga contra quem em cada rodada).
- Apenas N=6..22 (17 abas) têm uma "tabela SQL-friendly" com colunas explícitas `(id, Chave, posicao, rodada, primeira_rodada, segunda_rodada, isbye)`.
- N=2..5 e N=23..77 (59 abas) só têm a representação visual.

### Padrão observado (não derivável algoritmicamente)

| N | BYEs (planilha) | Cabeças (sistema_disputas_chaves) | Observação |
|---|---|---|---|
| 6 | 1, 6 | 1, 6, 4, 3 | 2 cabeças nos BYEs + 2 em posições R1 |
| 9 | 1 | 1, 9, 6, 5 | 1 BYE, 3 cabeças em posições R1 |
| 11 | 1, 6, 11 | 1, 11, 6, 5 | 3 BYEs ≤ 4 cabeças |
| 12 | 1, 6, 7, 12 | 1, 12, 7, 6 | Casamento 4=4 perfeito |
| 20 | 1, 10, 11, 20 | 1, 20, 11, 10 | Casamento 4=4 perfeito |
| 22 | 1, 6, 11, 12, 17, 22 | 1, 22, 12, 11 | 6 BYEs > 4 cabeças → 2 BYEs random |

O número de BYEs **não** segue `nextPow2(N) - N`. É uma escolha do organizador para manter estruturas customizadas (ex.: N=20 com 8 matches em R1 e 4 BYEs entrando em R2 → R2 com 12 participantes, não 16). Por isso a planilha é fonte canônica, não derivável.

## Storage

### Nova tabela `bracket_chaves_byes`

```prisma
model BracketChavesByes {
  numero_inscrito Int     @id
  posicoes_bye    Int[]
  @@map("bracket_chaves_byes")
}
```

Postgres `INT[]` (array nativo). 76 linhas (N=2..77).

**Convenção:** array vazio `{}` para N=potência de 2 (2, 4, 8, 16, 32, 64). Posições 1-indexed (alinhado com `sistema_disputas_chaves`).

### Seed da tabela

Arquivo `backend/prisma/seeds/bracket_chaves_byes.sql`:
```sql
INSERT INTO bracket_chaves_byes (numero_inscrito, posicoes_bye) VALUES
  (2, '{}'),
  (3, '{1}'),         -- exemplo, valor real vem da planilha
  ...
  (77, '{...}')
ON CONFLICT (numero_inscrito) DO UPDATE SET posicoes_bye = EXCLUDED.posicoes_bye;
```

Executado automaticamente pelo deploy (após `prisma migrate deploy`). Idempotente.

### Extração da planilha

**Script utilitário** `backend/scripts/extract-bracket-byes.ts` (não roda em prod; gera o `.sql` seed):
1. Lê `personaladmin/CHAVES CT.xlsx` via biblioteca (`exceljs` ou similar — escolher na implementação).
2. Para cada aba N=6..22: lê coluna `isbye` da tabela explícita.
3. Para cada aba N=2..5, 23..77: parseia o bracket visual:
   - Encontra todos os números inteiros isolados em coluna A/B (= posições).
   - Para cada posição, verifica se existe label `jX` em coluna +1/+2 na mesma linha ou linha adjacente.
   - Posição **sem** label adjacente próximo (ou cujo label aparece apenas em coluna mais à direita, indicando R2 entry) = **BYE**.
4. **Validação:** roda o parser também em N=6..22 e compara com a tabela explícita. Se 100% bater, parser está validado.
5. Casos triviais hard-coded: N=2 (`{}`), N=3 (`{1}` — derivado do bracket).
6. Output: arquivo `bracket_chaves_byes.sql` gerado.

Script roda **uma vez** localmente, output é commitado. Não é parte do pipeline de produção.

## Engine algorithm

### Mudança em `drawBracket`

Assinatura nova:
```ts
type RegraBracket = {
  numero_inscrito: number
  posicoes_bye: number[]  // 1-indexed
}

function drawBracket(
  pids: number[],
  regraChaves: RegraChaves,
  regraBracket: RegraBracket,  // NOVO parâmetro
  seed: string,
  campeoesPids: number[] = [],
): ChavesResultado
```

Algoritmo:
```ts
const N = pids.length
const slots: (number | null)[] = new Array(N).fill(null)

// 1. Coleta posições de cabeça (1-indexed → 0-indexed)
const cabecasPos = [
  regraChaves.posicao_primeiro_cabeca,
  regraChaves.posicao_segundo_cabeca,
  regraChaves.posicao_terceiro_cabeca,
  regraChaves.posicao_quarto_cabeca,
].filter(p => p > 0)

// 2. Coloca cabeças nas posições reservadas
const usedPids = new Set<number>()
for (let i = 0; i < cabecasPos.length && i < campeoesPids.length; i++) {
  const pid = campeoesPids[i]
  slots[cabecasPos[i] - 1] = pid
  usedPids.add(pid)
}

// 3. Sorteia restantes (mulberry32 + FNV-1a — mesmo PRNG atual)
const restantes = pids.filter(p => !usedPids.has(p))
const shuffled = seededShuffle(restantes, seed)

// 4. Preenche posições vazias na ordem natural (0, 1, 2, ...)
let idx = 0
for (let i = 0; i < N; i++) {
  if (slots[i] === null) {
    slots[i] = shuffled[idx++]
  }
}

return {
  size: N,
  slots,
  byePositions: [...regraBracket.posicoes_bye].sort((a, b) => a - b),
}
```

**Notas:**
- `byePositions` é guardado no JSON `Sorteio.resultado` — sem migration DB (campo é JSON).
- Engine determinístico preservado (mesmo seed + mesmo input → mesma saída).
- A regra "cabeças nas posições BYE primeiro" é implícita: a `sistema_disputas_chaves` table já encoda posições que coincidem com BYEs quando há ≥4 BYEs. Para N com `<4` BYEs (ex.: N=6 com 2 BYEs, N=9 com 1), cabeças que sobram caem em posições R1 conforme tabela atual. Sem mudança na tabela `sistema_disputas_chaves`.

### Validação no service

`sorteios.service.executar` para tipo `chaves`:
- Lê `bracket_chaves_byes` por N. Se ausente → 400 "Não há estrutura de bracket cadastrada para N inscritos."
- Lê `sistema_disputas_chaves` por N (já faz). 
- Passa ambas regras ao engine.

## Frontend `SorteioChaves.tsx`

### Mudança no `ChavesResultado`

```ts
type ChavesResultado = {
  size: number
  slots: (number | null)[]
  byePositions?: number[]  // 1-indexed; opcional para compat com sorteios antigos
}
```

### Builder de bracket (3 colunas: R1 / R2 / "Rodadas seguintes")

Para evitar bracket malformado em N assimétricos, MVP renderiza **apenas R1 e R2 explicitamente**. A partir de R3, mostra uma coluna de placeholder único.

Algoritmo:
```ts
function buildBracket(slots, byePositions?): Round[] {
  if (!byePositions) {
    // Comportamento legado: nextPow2 padding (mantém código atual completo)
    return buildBracketLegacy(slots)
  }

  const N = slots.length
  const byeSet = new Set(byePositions)
  const nonByeIndices = Array.from({ length: N }, (_, i) => i + 1).filter(p => !byeSet.has(p))

  // R1 (round 0): pares consecutivos de não-BYEs.
  const r1Matches: Match[] = []
  for (let i = 0; i < nonByeIndices.length; i += 2) {
    r1Matches.push({
      id: `R0M${i / 2}`,
      round: 0,
      index: i / 2,
      top: slots[nonByeIndices[i] - 1] ?? null,
      bottom: (i + 1) < nonByeIndices.length ? (slots[nonByeIndices[i + 1] - 1] ?? null) : null,
    })
  }

  // R2 (round 1): cards individuais para cada BYE (mostrando o participante avançado).
  // Cards-pareamento real (BYE vs Winner R1) fica para V2.
  const r2Matches: Match[] = byePositions.map((pos, i) => ({
    id: `R1M${i}`,
    round: 1,
    index: i,
    top: slots[pos - 1] ?? null,
    bottom: null,           // placeholder visual: "vs vencedor de R1"
    isByeAdvanceCard: true, // sinaliza ao SlotRender para mostrar "(BYE → avança)"
  }))

  // R3+: uma única coluna "Demais rodadas" com texto explicativo.
  return {
    r1: { label: roundLabel(r1Matches.length, 0), matches: r1Matches },
    r2Byes: { label: 'Avançam (BYEs)', matches: r2Matches },
    placeholder: 'Rodadas seguintes conforme regulamento da modalidade',
  }
}
```

**Render:**
- Coluna 1 "R1": cards de pares reais. Label: "1ª Rodada · N matches".
- Coluna 2 "Avançam (BYEs)": cards individuais para cada BYE, mostrando o nome do participante + texto "(avança direto)". Não aparece se não houver BYE (N pow2).
- Coluna 3 "Demais rodadas": placeholder com texto "Conforme regulamento". Quando o operador apertar "Avançar fase" (V2), essa coluna será substituída pela árvore real.

**Notas:**
- Operador imprime/printa o resultado e usa a planilha CT como referência para os matches subsequentes.
- V2 (futuro): importa o grafo completo (`matches[]`) da planilha e renderiza árvore fiel até a Final.

## Casos especiais

- **N=2:** sem BYE, 1 match. Final imediata.
- **N=3:** 1 BYE em pos 1 (ou 3). R1 = 1 match (pos 2 vs 3). R2 = 1 match (BYE vs Winner R1) = Final.
- **N=8, 16, 32, 64:** sem BYE. Comportamento idêntico ao atual.
- **N=22:** 6 BYEs > 4 cabeças → 4 cabeças nas posições da `sistema_disputas_chaves`, 2 BYEs restantes preenchidos por inscritos aleatórios.
- **N > 77 ou ausente da tabela:** 400 "Não há estrutura cadastrada para N inscritos."

## Release

- **Versão:** 1.17.1 → 1.18.0 (MINOR — feature significativa, não-breaking).
- **Migration Prisma:** adiciona tabela `bracket_chaves_byes`.
- **Seed:** roda automaticamente no deploy (script idempotente).
- **CHANGELOG:** bloco `[1.18.0]` com `Added` (tabela + extração) e `Changed` (engine + frontend usando byePositions).

## Smoke pós-deploy

1. `/eventos` → modalidade chaves com **N=6 inscritos** → sorteia.
   - Backend: posições 1 e 6 ocupadas por cabeças (se houver) ou inscritos sorteados. Posições 2-5 sorteadas entre não-cabeças.
   - Frontend: Coluna 1 (R1) com 2 cards de pares (pos 2-3, pos 4-5). Coluna 2 (Avançam) com 2 cards individuais para pos 1 e pos 6. Coluna 3 placeholder "Rodadas seguintes".
2. Modalidade chaves com **N=12** → 4 BYEs (1, 6, 7, 12). Se houver 4 campeões inscritos, eles ocupam exatamente essas 4 posições.
3. Modalidade chaves com **N=8** → sem BYE. Render idêntico ao comportamento atual (coluna "Avançam" oculta). Backwards compat via fallback do legado.
4. Modalidade chaves com **N=22** → 6 BYEs. 4 cabeças nas posições (1, 11, 12, 22) da `sistema_disputas_chaves`. Posições 6 e 17 (BYEs sobrando) recebem inscritos aleatórios.
5. Sorteio antigo (pré-v1.18.0) → render legado mantém-se (testar abrindo um sorteio existente — campo `byePositions` ausente no JSON, builder cai no fallback).
6. Rodapé sidebar: `v1.18.0`.

## Risco / efeitos colaterais

- **Sorteios antigos:** preservados via campo opcional `byePositions`. Frontend faz fallback para builder legado.
- **Parser visual de N=2..5, 23..77:** principal fonte de erro. Validação obrigatória contra N=6..22 antes de aceitar output.
- **Cabeças em posições R1 (para N com <4 BYEs):** já era assim no engine atual. Sem regressão.
- **N sem regra:** validação no service garante erro amigável (400) em vez de crash.
- **Render de R3+ é placeholder:** operadores que esperavam ver a árvore completa precisam consultar a planilha CT. Aceitamos no MVP em troca de evitar render malformado (estruturas assimétricas como N=20 não formam árvore binária limpa).
- **Refinamento V2 (futuro):** importar grafo completo de matches da planilha (matches J1..Jn com conexões `Venc.Jx vs Venc.Jy`) para render fiel até a Final em todos os N.
