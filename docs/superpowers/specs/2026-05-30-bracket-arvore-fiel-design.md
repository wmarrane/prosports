# Bracket de Chaves — Render Fiel à Planilha (Árvore com Conectores) — Design

**Data:** 2026-05-30
**Status:** Aprovado para implementação
**Versão alvo:** 1.19.0

## Objetivo

Substituir o render atual de `SorteioChaves` (lista vertical 1→N introduzida na v1.18.1) por uma árvore visual fiel ao desenho da planilha oficial `CHAVES CT.xlsx` — colunas por rodada, cards de match, conectores SVG entre vencedores e suas próximas partidas. Preservar a regra das cabeças e a posição BYE conforme `bracket_chaves_byes` (já estabelecida em v1.18.0).

## Motivação

O render v1.18.1 (lista vertical) foi reprovado pelo operador: não parece um bracket de competição. Em torneios reais, organizadores e jogadores esperam ver a árvore visual clássica (estilo "playoffs da NBA" / "Wimbledon"). A planilha CT já define essa estrutura — falta o frontend espelhá-la.

## Escopo

**In:**
- Nova tabela `bracket_chaves_matches(numero_inscrito INT PK, matches_graph JSONB)` populada com grafo completo de matches por N=2..77.
- Engine `drawBracket` retorna campo adicional `matchesGraph` no `ChavesResultado`.
- Frontend `SorteioChaves` reescrito com render React+SVG: cada match é um card posicionado em `(coluna_round, índice_vertical)`, conectores SVG entre matches dependentes.
- Extração via Python script estendido: lê dados explícitos para N=6..22 (colunas Primeira Rodada / Segunda Rodada da planilha) + parseia bracket visual para N=2..5 e N=23..77 (jX labels em coluna por round).
- Validação obrigatória: parser visual conferido contra dados explícitos. Discrepâncias resultam em erro de extração.
- Backwards compat: sorteios pré-v1.19.0 (sem `matchesGraph`) caem no builder legado (lista vertical v1.18.1).

**Out:**
- Edição manual do grafo via UI (planilha continua a fonte canônica).
- Marcar vencedores de matches pela UI (avançar fase). Continua sendo "snapshot do sorteio inicial".
- 3rd place match destaque visual (planilha tem, mas MVP renderiza junto com a árvore principal).

## Análise da planilha — grafo de matches

Cada aba contém à direita uma lista de matches (`J | n | top | x | bottom`). Para N=6..22 (17 abas) essa lista está totalmente preenchida com referências resolvidas:
- `top`/`bottom` = posição numérica (1..N) → match envolve participante daquela posição
- `top`/`bottom` = `"Venc.JX"` → match envolve vencedor de JX
- `top`/`bottom` = `"Perd.JX"` → 3rd place match envolve perdedor de JX

Para N=2..5 e N=23..77 (59 abas) a lista de matches existe mas com placeholders (0/#REF!) onde deveriam estar as posições. A estrutura do grafo está apenas no **bracket visual à esquerda** — labels `jX` em colunas C, E, G, I (R1, R2, R3, R4...).

### Exemplo extraído (N=12)

```
J1  R1: P2  x P3
J2  R1: P4  x P5
J3  R1: P8  x P9
J4  R1: P10 x P11
J5  R2: P1  x Venc.J1   (BYE pos 1)
J6  R2: P6  x Venc.J2   (BYE pos 6)
J7  R2: P7  x Venc.J3   (BYE pos 7)
J8  R2: P12 x Venc.J4   (BYE pos 12)
J9  R3: Venc.J5 x Venc.J6   (semifinal superior)
J10 R3: Venc.J7 x Venc.J8   (semifinal inferior)
J11 Final: Venc.J9 x Venc.J10
J12 3º:    Perd.J9 x Perd.J10  (3rd place)
```

### Exemplo asimétrico (N=20)

```
R1: J1, J2, J3, J4, J6, J7, J10, J11  (8 matches)
R2: J5(P1×V.J1), J8(V.J2×P10), J9(P11×V.J3), J12(V.J4×P20)  (4 matches BYE+winner)
R3: J13(V.J5×V.J6), J14(V.J7×V.J8), J15(V.J9×V.J10), J16(V.J11×V.J12)  (4 matches mistos)
R4: J17(V.J13×V.J14), J18(V.J15×V.J16)  (semifinais)
J19 Final: V.J17 × V.J18
J20 3º:    Perd.J17 × Perd.J18
```

Note que **J6, J7, J10, J11** (R1) alimentam diretamente R3 sem passar por R2 — estrutura assimétrica que define o desenho do regulamento.

## Storage

### Nova tabela `bracket_chaves_matches`

```prisma
model BracketChavesMatches {
  numero_inscrito Int     @id
  matches_graph   Json
  @@map("bracket_chaves_matches")
}
```

76 linhas. `matches_graph` é JSON com formato:

```json
{
  "matches": [
    { "id": "J1", "round": 1, "top": "P2", "bottom": "P3" },
    { "id": "J5", "round": 2, "top": "P1", "bottom": "V:J1" },
    { "id": "J9", "round": 3, "top": "V:J5", "bottom": "V:J6" },
    { "id": "J11", "round": 4, "top": "V:J9", "bottom": "V:J10" }
  ],
  "thirdPlace": "J12",
  "final": "J11"
}
```

**Convenções:**
- `top`/`bottom` strings: `"P{n}"` = posição n (1-indexed), `"V:J{x}"` = vencedor do match Jx, `"L:J{x}"` = perdedor (só usado no thirdPlace).
- `round`: 1 = R1, 2 = R2, etc. Final = round máximo. 3rd place tem `round = final.round` mas é separado por `thirdPlace`.
- `id`: identificador único dentro do bracket (corresponde ao label da planilha).

## Extração

Script `backend/scripts/extract-bracket-graphs.py` (substitui o `extract-bracket-byes.py` ou roda em paralelo gerando seed adicional).

### Para N=6..22 (tabela explícita)

Lê colunas `Primeira Rodada` (R1) e `Segunda Rodada` (R2) da tabela existente. Reconstrói R3+ via árvore padrão (winners de pares consecutivos de R2). Para 3rd place: assume Perd.J(semifinal1) × Perd.J(semifinal2) seguindo padrão dos exemplos.

### Para N=2..5 e N=23..77 (parser visual)

Algoritmo:
1. Identificar todas as posições (números 1..N na coluna A em ordem decrescente de linha).
2. Identificar todos os labels `jX` na planilha (regex `^j\d+$` case-insensitive) com sua `(linha, coluna)`.
3. Agrupar labels por coluna: coluna mais à esquerda = R1, próxima = R2, etc.
4. Para cada label `jX` na coluna C_k (round k):
   - Para R1 (k=1): par é (posição mais próxima acima, posição mais próxima abaixo) na coluna A.
   - Para R≥2: par é (jX mais próximo acima na coluna C_{k-1} OU posição na col A se BYE estiver entre eles, jX mais próximo abaixo na coluna C_{k-1} OU posição BYE).
5. Construir o grafo `{ id: jX, round: k, top, bottom }`.
6. Identificar Final = match na maior round (round máximo). 3rd place = se houver match cujo `top`/`bottom` contém referência `"L:J{x}"` (perdedor) — esse é o 3rd place match, marcado em `thirdPlace`. Para N=6..22 (tabela explícita), 3rd place é assumido como `Perd.J(SF1) × Perd.J(SF2)` se houver match na lista de matches da planilha com esse padrão (heurística confirmada nos exemplos observados N=6, N=12).

### Validação

Roda o parser visual em N=6..22 e compara com o grafo extraído da tabela explícita. Se 100% bater, parser aceito. Caso contrário, script aborta com lista de discrepâncias para análise manual.

### Output

Arquivo `backend/prisma/seeds/bracket_chaves_matches.sql` com `INSERT INTO bracket_chaves_matches (numero_inscrito, matches_graph) VALUES (n, '{...}'::jsonb) ON CONFLICT DO UPDATE...` para cada N.

## Engine

### Mudança em `drawBracket`

Assinatura inalterada (continua aceitando `regraBracket` da v1.18.0). Adiciona novo parâmetro opcional `matchesGraph`:

```ts
export function drawBracket(
  participantes: number[],
  regra: RegraChaves,
  regraBracket: RegraBracket,
  matchesGraph: MatchesGraph,    // NOVO
  seed: string,
  campeoesPids: number[] = [],
): ChavesResultado
```

Retorna `{ size, slots, byePositions, matchesGraph }` — apenas inclui o grafo no resultado para o frontend.

Cabeças continuam sendo posicionadas via `sistema_disputas_chaves` (sem mudança). Posições BYE continuam vindas de `bracket_chaves_byes` (sem mudança).

### Mudança no service

`sorteios.service.executar` para tipo `chaves` agora carrega 3 tabelas:
- `sistemaDisputasChaves` (cabeças)
- `bracketChavesByes` (BYEs)
- `bracketChavesMatches` (grafo)

Se `bracketChavesMatches` ausente → 400 amigável "Estrutura de bracket não cadastrada para N inscritos".

## Frontend

### Mudança no tipo `ChavesResultado`

```ts
export type ChavesResultado = {
  size: number
  slots: (number | null)[]
  byePositions?: number[]
  matchesGraph?: MatchesGraph   // NOVO opcional
}

export type MatchesGraph = {
  matches: Array<{
    id: string
    round: number
    top: string   // "P{n}" | "V:J{x}"
    bottom: string
  }>
  thirdPlace?: string
  final: string
}
```

### `SorteioChaves.tsx`

Novo render quando `resultado.matchesGraph` presente:
- Agrupa matches por `round`.
- Calcula posição vertical de cada match com base em suas dependências:
  - Round 1: matches stackam verticalmente espaçados igualmente.
  - Round R>1: cada match centraliza entre seus dois inputs (top e bottom).
- Renderiza cada match como card: `<MatchCard>` com top + linha divisória + bottom. `top`/`bottom` resolvidos via:
  - `"P{n}"` → mostra `slots[n-1]` (nome do participante via `participantesById`)
  - `"V:J{x}"` → mostra `"Vencedor M{x}"` em cinza
- SVG conectores: para cada match com input `"V:J{x}"`, desenha linha do output do match `Jx` até o input do match atual. Linha em L (vai pra direita do match-fonte, depois pra cima/baixo até alinhar com match-destino, depois pra direita até a borda).
- Final (last round) destacado com borda dourada + "🏆".
- 3rd place renderizado abaixo da árvore principal com label "3º lugar".

Backwards compat: se `matchesGraph` ausente → fallback ao render v1.18.1 (lista vertical com BYEs marcados).

### Componente structure

```
SorteioChaves (root)
├── (caso matchesGraph presente)
│   └── BracketTree (novo componente)
│       ├── colunas por round (flex horizontal)
│       │   └── cards de match (posicionamento vertical absoluto)
│       └── SVG overlay com conectores
└── (caso ausente)
    └── VerticalList (extraído do render atual)
```

`BracketTree` é o componente principal; `MatchCard`, `BracketConnector` (SVG) são sub-componentes.

## Casos especiais

- **N=2:** 1 match (Final). Sem conectores. Card grande centralizado.
- **N=4:** 2 R1 + 1 Final. Bracket pequeno com 2 colunas + Final.
- **N=8, 16, 32, 64 (pow2):** árvore perfeitamente balanceada, sem BYEs.
- **N assimétricos (10, 20, 22, etc.):** árvore com colunas variadas — alguns matches "pulam" rounds, conectores podem cruzar colunas (mas a aresta SVG flui suavemente; aceito visualmente).
- **N=77:** maior caso, ~6 colunas. Scroll horizontal habilitado.

## Release

- Versão: 1.18.1 → **1.19.0** (MINOR — feature significativa, não-breaking).
- Prisma migration: `add_bracket_chaves_matches` + seed apendado.
- CHANGELOG: bloco `[1.19.0]`.

## Smoke pós-deploy

1. `/eventos` → modalidade chaves com **N=6** → árvore visual: 2 cards R1 (pares 2-3 e 4-5), 2 cards R2 (BYE pos 1 + winner J1, winner J2 + BYE pos 6), Final dourada.
2. **N=12** com 4 campeões → todos os 4 BYEs (1, 6, 7, 12) ocupados por cabeças com badge. Árvore com 4 R1 + 4 R2 + 2 SF + 1 Final + 1 3º lugar.
3. **N=20** → árvore assimétrica conforme planilha. Conectores devem cruzar colunas em alguns pontos.
4. **N=8** (pow2) → árvore perfeitamente balanceada, sem BYEs visíveis.
5. Sorteio pré-v1.19.0 → fallback lista vertical mantido.
6. Rodapé sidebar: `v1.19.0`.

## Risco / efeitos colaterais

- **Parser visual de N=2..5, 23..77:** principal fonte de erro. Validação obrigatória contra N=6..22 antes de aceitar output. Se parser falhar para algum N, script aborta — usuário precisa investigar.
- **Render SVG complexo:** posicionamento vertical de matches em N assimétricos pode gerar layouts visualmente "estranhos" (matches em rounds adjacentes desalinhados). Aceito como trade-off de fidelidade à planilha.
- **Sorteios antigos:** preservados via fallback ao builder v1.18.1.
- **Performance:** N=77 = ~75 matches renderizados. Para SVG normal não é problema. Scroll horizontal essencial.
- **N=2..5 sem dados explícitos:** parser pode falhar nesses casos triviais. Hardcoded fallback recomendado (N=2 = 1 match Final; N=3 = J1 + Final com BYE no top; N=4 = 2 R1 + Final; N=5 = J1 + J2 + R2 com BYE + Final).
