# Metade da chave + mascaramento de nome — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que uma inscrição exija a metade de cima ou de baixo do bracket, e que o nome do participante apareça mascarado no Modo Congresso e no site público — ambos ligados por parâmetro na modalidade.

**Architecture:** As metades saem do desenho real da chave (`matches_graph`), nunca de `⌈N/2⌉`. O sorteio coloca as cabeças primeiro (comportamento atual intacto), separa as vagas livres em cima/baixo e distribui três baldes — pedem cima, pedem baixo, sem preferência — com o mesmo `shuffleSeeded(seed)` de hoje. O mascaramento é um helper puro aplicado no mapeamento de dados: no `montaSnapshot` (backend) e nos mapas de nome do Modo Congresso (frontend).

**Tech Stack:** Node/TypeScript, Express, Prisma/Postgres, Vitest no backend; React 18 + Vite + React Query no frontend.

**Spec:** `docs/superpowers/specs/2026-08-18-metade-chave-e-mascaramento-design.md`

## Global Constraints

- Os valores gravados em `metade_chave` são exatamente as strings `cima` e `baixo`; qualquer outro valor é rejeitado na API.
- As metades vêm SEMPRE do `matches_graph` (posições que chegam à final por cada lado). `⌈N/2⌉` não é usado em lugar nenhum.
- A metade que contém a posição 1 é a "de cima".
- Cabeça prevalece: campeão anterior e anfitrião mantêm a posição fixa e têm a `metade_chave` ignorada naquele sorteio.
- Mesma seed → mesmo resultado. Modalidade sem os parâmetros novos sorteia exatamente como hoje.
- Máscara: primeiro nome + exatamente 10 asteriscos. Nome de uma palavra só fica intacto.
- Mascaramento aplicado só em `montaSnapshot` e nas telas do Modo Congresso — NUNCA dentro de `frontend/src/components/sorteio-result/*`, que é compartilhado com o site público.
- Migração aditiva: todos os campos com default, nenhuma competição existente muda de comportamento.
- Verificação backend: `cd backend && npx tsc --noEmit && npx vitest run`. Verificação frontend: `cd frontend && npm run build` (é `tsc -b && vite build`; `tsc --noEmit` não basta).
- Host Windows: use o tool Bash, caminhos absolutos, `export MSYS_NO_PATHCONV=1` antes de comandos docker.
- Git: identidade inline `git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`. NUNCA `git add -A`.
- Se o git falhar com `unable to append to '.git/logs/HEAD': Permission denied`, é o OneDrive travando o arquivo: espere ~4s e repita o mesmo comando.

---

### Task 1: Schema + migration

**Files:**
- Modify: `backend/prisma/schema.prisma` (models `Modalidade` e `Inscricao`)
- Create: `backend/prisma/migrations/20260819090000_metade_chave_e_mascaramento/migration.sql`

**Interfaces:**
- Produces: `Modalidade.usa_metade_chave: boolean`, `Modalidade.mascarar_nome: boolean`, `Inscricao.metade_chave: string | null`.

- [ ] **Step 1: Campos no schema Prisma**

Em `model Modalidade`, logo abaixo de `chave_versao`:

```prisma
  usa_metade_chave    Boolean         @default(false)
  mascarar_nome       Boolean         @default(false)
```

Em `model Inscricao`, logo abaixo de `municipio_id`:

```prisma
  metade_chave    String?
```

- [ ] **Step 2: Migration manuscrita**

Criar `backend/prisma/migrations/20260819090000_metade_chave_e_mascaramento/migration.sql`:

```sql
-- Metade da chave por inscrição + mascaramento de nome por modalidade.
-- Aditivo: os dois booleanos nascem false e metade_chave nasce nula, então
-- nenhuma modalidade ou inscrição existente muda de comportamento.
ALTER TABLE "Modalidade" ADD COLUMN "usa_metade_chave" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Modalidade" ADD COLUMN "mascarar_nome" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Inscricao" ADD COLUMN "metade_chave" TEXT;
```

- [ ] **Step 3: Gerar o client e aplicar no banco local**

O serviço `migrate` do compose roda a partir da IMAGEM do backend — sem reconstruir a imagem antes, ele aplica o schema antigo:

```bash
cd /c/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2/backend && npx prisma generate
export MSYS_NO_PATHCONV=1
cd /c/Users/Wagner/OneDrive/Pessoal/Documentos/Projetos/prosports_v2
docker compose -f docker-compose.dev.windows.yml --env-file .env.dev.windows.local build backend
docker compose -f docker-compose.dev.windows.yml --env-file .env.dev.windows.local run --rm migrate
```

Esperado: `All migrations have been successfully applied.`

- [ ] **Step 4: Conferir que o banco recebeu as colunas**

```bash
export MSYS_NO_PATHCONV=1
docker compose -f docker-compose.dev.windows.yml exec -T postgres psql -U prosports -d newprosports -c "select column_name, data_type, column_default, is_nullable from information_schema.columns where (table_name='Modalidade' and column_name in ('usa_metade_chave','mascarar_nome')) or (table_name='Inscricao' and column_name='metade_chave');"
```

Esperado: três linhas — os dois booleanos `NOT NULL DEFAULT false` e `metade_chave` `text` nullable.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260819090000_metade_chave_e_mascaramento/migration.sql
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(sorteio): campos de metade da chave e mascaramento de nome"
```

---

### Task 2: `metadesDoGrafo` no engine

**Files:**
- Modify: `backend/src/modules/sorteios/engine.ts`
- Test: `backend/src/modules/sorteios/engine.test.ts`

**Interfaces:**
- Produces:
  - `export type MetadeChave = 'cima' | 'baixo'`
  - `export type Metades = { cima: Set<number>; baixo: Set<number> }`
  - `export function metadesDoGrafo(graph: MatchesGraph): Metades`

- [ ] **Step 1: Escrever os testes que falham** — acrescentar ao fim de `engine.test.ts`

O arquivo já tem um bloco `import { ... } from './engine'` no topo com
`drawBracket` e `liftByesToFirstRoundV2`. **Acrescente `metadesDoGrafo` a esse
bloco existente** — um segundo `import` do mesmo módulo redeclara os nomes e
quebra o `tsc`. E acrescente, em linha separada, o import de tipo:

```ts
import type { MatchesGraph } from './engine'
```

```ts
// N=4 simétrico: J1 e J2 na 1ª rodada, J3 é a final.
const GRAFO_4: MatchesGraph = {
  matches: [
    { id: 'J1', round: 1, top: 'P1', bottom: 'P2' },
    { id: 'J2', round: 1, top: 'P3', bottom: 'P4' },
    { id: 'J3', round: 2, top: 'V:J1', bottom: 'V:J2' },
  ],
  final: 'J3',
  thirdPlace: null,
}

// N=3: P1 entra direto na final (bye). Espelha a chave real de 3 (1 em cima / 2 embaixo).
const GRAFO_3: MatchesGraph = {
  matches: [
    { id: 'J1', round: 1, top: 'P2', bottom: 'P3' },
    { id: 'J2', round: 2, top: 'P1', bottom: 'V:J1' },
  ],
  final: 'J2',
  thirdPlace: null,
}

// N=7 assimétrico: espelha a chave real de 7 (3 em cima / 4 embaixo) e tem 3º lugar.
const GRAFO_7: MatchesGraph = {
  matches: [
    { id: 'J1', round: 1, top: 'P2', bottom: 'P3' },
    { id: 'J2', round: 1, top: 'P4', bottom: 'P5' },
    { id: 'J3', round: 1, top: 'P6', bottom: 'P7' },
    { id: 'J4', round: 2, top: 'P1', bottom: 'V:J1' },
    { id: 'J5', round: 2, top: 'V:J2', bottom: 'V:J3' },
    { id: 'J6', round: 3, top: 'V:J4', bottom: 'V:J5' },
    { id: 'J7', round: 3, top: 'L:J4', bottom: 'L:J5' },
  ],
  final: 'J6',
  thirdPlace: 'J7',
}

describe('metadesDoGrafo', () => {
  it('parte a chave simétrica ao meio', () => {
    const { cima, baixo } = metadesDoGrafo(GRAFO_4)
    expect([...cima].sort((a, b) => a - b)).toEqual([1, 2])
    expect([...baixo].sort((a, b) => a - b)).toEqual([3, 4])
  })

  it('em chave ímpar segue o desenho, não o arredondamento', () => {
    // N=3 real é 1/2 — se alguém usasse ceil(3/2) daria 2/1.
    const { cima, baixo } = metadesDoGrafo(GRAFO_3)
    expect([...cima]).toEqual([1])
    expect([...baixo].sort((a, b) => a - b)).toEqual([2, 3])
  })

  it('N=7 fica 3/4, com o extra embaixo, e o 3º lugar não polui as metades', () => {
    const { cima, baixo } = metadesDoGrafo(GRAFO_7)
    expect([...cima].sort((a, b) => a - b)).toEqual([1, 2, 3])
    expect([...baixo].sort((a, b) => a - b)).toEqual([4, 5, 6, 7])
  })

  it('a metade de cima é sempre a que contém a posição 1', () => {
    const invertido: MatchesGraph = {
      ...GRAFO_4,
      matches: GRAFO_4.matches.map(m => (m.id === 'J3' ? { ...m, top: 'V:J2', bottom: 'V:J1' } : m)),
    }
    const { cima } = metadesDoGrafo(invertido)
    expect(cima.has(1)).toBe(true)
  })

  it('as metades cobrem todas as posições sem sobreposição', () => {
    const { cima, baixo } = metadesDoGrafo(GRAFO_7)
    const todas = [...cima, ...baixo].sort((a, b) => a - b)
    expect(todas).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect([...cima].some(p => baixo.has(p))).toBe(false)
  })

  it('grafo V2 (byes na 1ª rodada) produz as mesmas metades', () => {
    const v1 = metadesDoGrafo(GRAFO_7)
    const v2 = metadesDoGrafo(liftByesToFirstRoundV2(GRAFO_7))
    expect([...v2.cima].sort((a, b) => a - b)).toEqual([...v1.cima].sort((a, b) => a - b))
    expect([...v2.baixo].sort((a, b) => a - b)).toEqual([...v1.baixo].sort((a, b) => a - b))
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/modules/sorteios/engine.test.ts`
Esperado: FALHA com `metadesDoGrafo is not a function` / erro de import.

- [ ] **Step 3: Implementar** — em `engine.ts`, logo depois do `export type MatchesGraph`

```ts
export type MetadeChave = 'cima' | 'baixo'

export type Metades = { cima: Set<number>; baixo: Set<number> }

/**
 * Metades da chave lidas do DESENHO, não do número de inscritos: cada lado da
 * final é uma metade. É isso que garante a promessa da regra — quem está numa
 * metade só encontra a outra na final.
 *
 * Não use ⌈N/2⌉: nas planilhas CHAVES CT o participante extra das chaves
 * ímpares fica embaixo em 33 dos 38 tamanhos (N=7 é 3/4, N=19 é 9/10).
 *
 * A metade que contém a posição 1 é a "de cima". O jogo de 3º lugar não
 * participa: o caminho é percorrido a partir da final.
 */
export function metadesDoGrafo(graph: MatchesGraph): Metades {
  const byId = new Map(graph.matches.map(m => [m.id, m]))

  const posicoes = (ref: MatchRef): Set<number> => {
    if (ref === 'BYE') return new Set()
    if (ref.startsWith('P')) return new Set([Number(ref.slice(1))])
    const alvo = byId.get(ref.split(':')[1])
    if (!alvo) return new Set()
    const out = posicoes(alvo.top)
    for (const p of posicoes(alvo.bottom)) out.add(p)
    return out
  }

  const final = byId.get(graph.final)
  if (!final) {
    throw Object.assign(new Error('Desenho da chave sem jogo final.'), { status: 400 })
  }
  const a = posicoes(final.top)
  const b = posicoes(final.bottom)
  return a.has(1) ? { cima: a, baixo: b } : { cima: b, baixo: a }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx tsc --noEmit && npx vitest run src/modules/sorteios/engine.test.ts`
Esperado: todos verdes, inclusive os testes que já existiam.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/sorteios/engine.ts backend/src/modules/sorteios/engine.test.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(sorteio): metades da chave derivadas do desenho do bracket"
```

---

### Task 3: `drawBracket` respeita a metade

**Files:**
- Modify: `backend/src/modules/sorteios/engine.ts` (`BracketResultado`, `drawBracket`)
- Test: `backend/src/modules/sorteios/engine.test.ts`

**Interfaces:**
- Consumes: `metadesDoGrafo`, `MetadeChave` (Task 2).
- Produces:
  - `BracketResultado` ganha `metadesIgnoradas: number[]` (pids de cabeças cuja metade foi descartada).
  - `drawBracket(participantes, regra, regraBracket, matchesGraph, seed, campeoesPids?, opts?)` com
    `opts: { metadePorPid?: ReadonlyMap<number, MetadeChave | null> } = {}`.

- [ ] **Step 1: Escrever os testes que falham** — acrescentar ao fim de `engine.test.ts`

`drawBracket` e `MatchesGraph` já foram importados na Task 2 — não repita os
imports.

```ts
// N=8 simétrico: cima = 1..4, baixo = 5..8.
const GRAFO_8: MatchesGraph = {
  matches: [
    { id: 'J1', round: 1, top: 'P1', bottom: 'P2' },
    { id: 'J2', round: 1, top: 'P3', bottom: 'P4' },
    { id: 'J3', round: 1, top: 'P5', bottom: 'P6' },
    { id: 'J4', round: 1, top: 'P7', bottom: 'P8' },
    { id: 'J5', round: 2, top: 'V:J1', bottom: 'V:J2' },
    { id: 'J6', round: 2, top: 'V:J3', bottom: 'V:J4' },
    { id: 'J7', round: 3, top: 'V:J5', bottom: 'V:J6' },
  ],
  final: 'J7',
  thirdPlace: null,
}

const SEM_CABECA = { posicao_primeiro_cabeca: 0, posicao_segundo_cabeca: 0, posicao_terceiro_cabeca: 0, posicao_quarto_cabeca: 0 }
const BYES_8 = { numero_inscrito: 8, posicoes_bye: [] }
const PIDS_8 = [11, 12, 13, 14, 15, 16, 17, 18]

/** Posição 1-indexed em que o pid caiu. */
function posDe(slots: (number | null)[], pid: number): number {
  return slots.findIndex(s => s === pid) + 1
}

describe('drawBracket com metade da chave', () => {
  it('respeita a metade pedida por cada inscrito', () => {
    const metades = new Map([[11, 'cima' as const], [12, 'baixo' as const]])
    const r = drawBracket(PIDS_8, SEM_CABECA, BYES_8, GRAFO_8, 'seed-1', [], { metadePorPid: metades })
    expect(posDe(r.slots, 11)).toBeLessThanOrEqual(4)
    expect(posDe(r.slots, 12)).toBeGreaterThanOrEqual(5)
    expect(r.slots.filter(s => s !== null)).toHaveLength(8)
  })

  it('quem não pediu metade preenche os dois lados', () => {
    // 1 pede cima, 1 pede baixo: sobram 3 vagas de cada lado para os 6 sem
    // preferência. Se o balde livre ficasse preso a um lado, esta conta quebra.
    const metades = new Map([[11, 'cima' as const], [12, 'baixo' as const]])
    const r = drawBracket(PIDS_8, SEM_CABECA, BYES_8, GRAFO_8, 'seed-1', [], { metadePorPid: metades })
    const posicoes = PIDS_8.filter(p => p !== 11 && p !== 12).map(p => posDe(r.slots, p))
    expect(posicoes.filter(p => p <= 4)).toHaveLength(3)
    expect(posicoes.filter(p => p >= 5)).toHaveLength(3)
  })

  it('recusa quando os pedidos não cabem na metade', () => {
    const metades = new Map(PIDS_8.slice(0, 5).map(p => [p, 'cima' as const]))
    expect(() => drawBracket(PIDS_8, SEM_CABECA, BYES_8, GRAFO_8, 'seed-1', [], { metadePorPid: metades }))
      .toThrow(/5 .*cima.*4/s)
  })

  it('cabeça prevalece: a metade dela é ignorada e registrada', () => {
    const regra = { ...SEM_CABECA, posicao_primeiro_cabeca: 1 }  // posição 1 = metade de cima
    const metades = new Map([[11, 'baixo' as const]])
    const r = drawBracket(PIDS_8, regra, BYES_8, GRAFO_8, 'seed-1', [11], { metadePorPid: metades })
    expect(posDe(r.slots, 11)).toBe(1)
    expect(r.metadesIgnoradas).toEqual([11])
  })

  it('exige o desenho da chave quando alguém pediu metade', () => {
    const metades = new Map([[11, 'cima' as const]])
    expect(() => drawBracket(PIDS_8, SEM_CABECA, BYES_8, null, 'seed-1', [], { metadePorPid: metades }))
      .toThrow(/desenho de chave/i)
  })

  it('sem ninguém pedindo metade, o resultado é idêntico ao de hoje', () => {
    const semOpts = drawBracket(PIDS_8, SEM_CABECA, BYES_8, GRAFO_8, 'seed-42')
    const comMapaVazio = drawBracket(PIDS_8, SEM_CABECA, BYES_8, GRAFO_8, 'seed-42', [], {
      metadePorPid: new Map(PIDS_8.map(p => [p, null])),
    })
    expect(comMapaVazio.slots).toEqual(semOpts.slots)
    expect(comMapaVazio.metadesIgnoradas).toEqual([])
  })

  it('mesma seed, mesmo resultado', () => {
    const metades = new Map([[11, 'cima' as const], [18, 'baixo' as const]])
    const a = drawBracket(PIDS_8, SEM_CABECA, BYES_8, GRAFO_8, 'seed-7', [], { metadePorPid: metades })
    const b = drawBracket(PIDS_8, SEM_CABECA, BYES_8, GRAFO_8, 'seed-7', [], { metadePorPid: metades })
    expect(a.slots).toEqual(b.slots)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/modules/sorteios/engine.test.ts`
Esperado: FALHA — `drawBracket` ainda ignora o 7º argumento e não tem `metadesIgnoradas`.

- [ ] **Step 3: Implementar** — em `engine.ts`

Acrescentar o campo ao tipo do resultado:

```ts
export type BracketResultado = {
  size: number
  slots: (number | null)[]
  byePositions: number[]
  matchesGraph: MatchesGraph | null
  /** Pids de cabeças cuja metade foi descartada — a posição de cabeça prevalece. */
  metadesIgnoradas: number[]
}
```

Substituir `drawBracket` inteira por:

```ts
export function drawBracket(
  participantes: readonly number[],
  regra: RegraChaves,
  regraBracket: RegraBracket,
  matchesGraph: MatchesGraph | null,
  seed: string,
  campeoesPids: readonly number[] = [],
  opts: { metadePorPid?: ReadonlyMap<number, MetadeChave | null> } = {},
): BracketResultado {
  const N = participantes.length
  const slots: (number | null)[] = new Array(N).fill(null)

  const cabecasPos = [
    regra.posicao_primeiro_cabeca,
    regra.posicao_segundo_cabeca,
    regra.posicao_terceiro_cabeca,
    regra.posicao_quarto_cabeca,
  ].filter(p => p > 0)

  const usedPids = new Set<number>()
  for (let i = 0; i < cabecasPos.length && i < campeoesPids.length; i++) {
    const pid = campeoesPids[i]
    if (cabecasPos[i] >= 1 && cabecasPos[i] <= N) {
      slots[cabecasPos[i] - 1] = pid
      usedPids.add(pid)
    }
  }

  const restantes = participantes.filter(p => !usedPids.has(p))
  const metadePorPid = opts.metadePorPid
  const metadeDe = (pid: number): MetadeChave | null => metadePorPid?.get(pid) ?? null

  // Cabeça prevalece: quem já tem posição fixa tem a metade descartada.
  const metadesIgnoradas = [...usedPids].filter(pid => metadeDe(pid) !== null)

  const pedemCima = restantes.filter(p => metadeDe(p) === 'cima')
  const pedemBaixo = restantes.filter(p => metadeDe(p) === 'baixo')

  // Ninguém pediu nada: caminho de hoje, byte a byte.
  if (pedemCima.length === 0 && pedemBaixo.length === 0) {
    const shuffled = shuffleSeeded(restantes, seed)
    let idx = 0
    for (let i = 0; i < N; i++) {
      if (slots[i] === null && idx < shuffled.length) {
        slots[i] = shuffled[idx++]
      }
    }
    const byePositions = [...regraBracket.posicoes_bye].sort((a, b) => a - b)
    return { size: N, slots, byePositions, matchesGraph, metadesIgnoradas }
  }

  if (!matchesGraph) {
    throw Object.assign(
      new Error(
        `Não há desenho de chave cadastrado para ${N} inscritos — ele é necessário para respeitar a metade da chave.`,
      ),
      { status: 400 },
    )
  }

  const { cima, baixo } = metadesDoGrafo(matchesGraph)
  const livres: number[] = []
  for (let i = 0; i < N; i++) if (slots[i] === null) livres.push(i + 1)
  const livresCima = livres.filter(p => cima.has(p))
  const livresBaixo = livres.filter(p => baixo.has(p))

  if (pedemCima.length > livresCima.length) {
    throw Object.assign(
      new Error(
        `${pedemCima.length} inscritos pedem a parte de cima da chave, que tem ${livresCima.length} vagas.`,
      ),
      { status: 400 },
    )
  }
  if (pedemBaixo.length > livresBaixo.length) {
    throw Object.assign(
      new Error(
        `${pedemBaixo.length} inscritos pedem a parte de baixo da chave, que tem ${livresBaixo.length} vagas.`,
      ),
      { status: 400 },
    )
  }

  // Embaralhar as POSIÇÕES (e não só os pids) evita que os inscritos com metade
  // marcada caiam sempre nas primeiras vagas do seu lado — o que enviesaria
  // quem pega bye.
  const posCima = shuffleSeeded(livresCima, `${seed}:pos-cima`)
  const posBaixo = shuffleSeeded(livresBaixo, `${seed}:pos-baixo`)
  const sobra = [...posCima.slice(pedemCima.length), ...posBaixo.slice(pedemBaixo.length)]
  const posLivre = shuffleSeeded(sobra, `${seed}:pos-livre`)
  const semPreferencia = restantes.filter(p => metadeDe(p) === null)

  const atribui = (posicoes: readonly number[], pids: readonly number[]) => {
    for (let k = 0; k < pids.length; k++) slots[posicoes[k] - 1] = pids[k]
  }
  atribui(posCima, pedemCima)
  atribui(posBaixo, pedemBaixo)
  atribui(posLivre, semPreferencia)

  const byePositions = [...regraBracket.posicoes_bye].sort((a, b) => a - b)
  return { size: N, slots, byePositions, matchesGraph, metadesIgnoradas }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx tsc --noEmit && npx vitest run src/modules/sorteios`
Esperado: verde, inclusive os testes antigos de `drawBracket` e os de `sorteios.service`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/sorteios/engine.ts backend/src/modules/sorteios/engine.test.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(sorteio): drawBracket respeita a metade pedida na inscricao"
```

---

### Task 4: Sorteio lê o campo + endpoint das metades

**Files:**
- Modify: `backend/src/modules/sorteios/sorteios.service.ts` (`executar`)
- Modify: `backend/src/modules/sorteios/sorteios.controller.ts`
- Modify: `backend/src/modules/sorteios/sorteios.routes.ts`
- Test: `backend/src/modules/sorteios/sorteios.service.test.ts`

**Interfaces:**
- Consumes: `drawBracket(..., { metadePorPid })`, `metadesDoGrafo` (Tasks 2 e 3).
- Produces:
  - `export async function metadesPorNumeroInscrito(numeroInscrito: number): Promise<{ numero_inscrito: number; cima: number; baixo: number }>`
  - `GET /sorteios/metades/:numeroInscrito` → `{ numero_inscrito, cima, baixo }`.

- [ ] **Step 1: Escrever os testes que falham** — acrescentar ao fim de `sorteios.service.test.ts`

```ts
describe('metade da chave no sorteio', () => {
  const GRAFO_4 = {
    matches: [
      { id: 'J1', round: 1, top: 'P1', bottom: 'P2' },
      { id: 'J2', round: 1, top: 'P3', bottom: 'P4' },
      { id: 'J3', round: 2, top: 'V:J1', bottom: 'V:J2' },
    ],
    final: 'J3',
    thirdPlace: null,
  }

  function mockChaves(opts: { usaMetade: boolean; inscricoes: any[] }) {
    mockPrisma.evento.findUnique.mockResolvedValue({
      id: 1, competicao_id: 100, anfitriao_id: null, status: 'pronto',
      competicao: { considerar_anfitriao: false },
    })
    mockPrisma.modalidade.findUnique.mockResolvedValue({
      id: 2, competicao_id: 100, chave_versao: 'V1',
      usa_metade_chave: opts.usaMetade,
      tipo_modalidade: { tipo: 'chaves' },
    })
    mockPrisma.inscricao.findMany.mockResolvedValue(opts.inscricoes)
    mockPrisma.sistemaDisputasChaves.findFirst.mockResolvedValue({
      posicao_primeiro_cabeca: 0, posicao_segundo_cabeca: 0,
      posicao_terceiro_cabeca: 0, posicao_quarto_cabeca: 0,
    })
    mockPrisma.bracketChavesByes.findUnique.mockResolvedValue({ numero_inscrito: 4, posicoes_bye: [] })
    mockPrisma.bracketChavesMatches.findUnique.mockResolvedValue({ matches_graph: GRAFO_4 })
    mockPrisma.sorteio.upsert.mockImplementation(({ create }: any) => Promise.resolve(create))
  }

  it('lê metade_chave das inscrições e coloca o inscrito na metade pedida', async () => {
    mockChaves({
      usaMetade: true,
      inscricoes: [
        { participante_id: 21, metade_chave: 'baixo' },
        { participante_id: 22, metade_chave: null },
        { participante_id: 23, metade_chave: null },
        { participante_id: 24, metade_chave: null },
      ],
    })
    const sorteio: any = await service.executar({ evento_id: 1, modalidade_id: 2 })
    const pos = sorteio.resultado.slots.findIndex((s: number) => s === 21) + 1
    expect(pos).toBeGreaterThanOrEqual(3)  // metade de baixo de uma chave de 4
  })

  it('ignora metade_chave quando a modalidade não usa a regra', async () => {
    mockChaves({
      usaMetade: false,
      inscricoes: [
        { participante_id: 21, metade_chave: 'baixo' },
        { participante_id: 22, metade_chave: 'baixo' },
        { participante_id: 23, metade_chave: 'baixo' },
        { participante_id: 24, metade_chave: 'baixo' },
      ],
    })
    // 4 pedidos de "baixo" numa metade de 2 vagas: se a regra valesse, seria erro.
    const sorteio: any = await service.executar({ evento_id: 1, modalidade_id: 2 })
    expect(sorteio.resultado.slots.filter((s: number | null) => s !== null)).toHaveLength(4)
  })

  it('metadesPorNumeroInscrito devolve o tamanho de cada metade', async () => {
    mockPrisma.bracketChavesMatches.findUnique.mockResolvedValue({ matches_graph: GRAFO_4 })
    await expect(service.metadesPorNumeroInscrito(4)).resolves.toEqual({
      numero_inscrito: 4, cima: 2, baixo: 2,
    })
  })

  it('metadesPorNumeroInscrito falha com 404 quando não há desenho cadastrado', async () => {
    mockPrisma.bracketChavesMatches.findUnique.mockResolvedValue(null)
    await expect(service.metadesPorNumeroInscrito(999)).rejects.toMatchObject({ status: 404 })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/modules/sorteios/sorteios.service.test.ts`
Esperado: FALHA — o service ainda não seleciona `metade_chave` nem exporta `metadesPorNumeroInscrito`.

- [ ] **Step 3: Implementar em `sorteios.service.ts`**

No `select` da modalidade em `executar`, acrescentar o campo novo:

```ts
      select: {
        id: true,
        competicao_id: true,
        chave_versao: true,
        usa_metade_chave: true,
        tipo_modalidade: { select: { tipo: true } },
      },
```

Na busca das inscrições, trazer a metade junto:

```ts
  const inscricoes = await prisma.inscricao.findMany({
    where: { evento_id: input.evento_id, modalidade_id: input.modalidade_id },
    orderBy: { criado_em: 'asc' },
    select: { participante_id: true, metade_chave: true },
  })
```

No ramo `tipo === 'chaves'`, logo antes da chamada do engine:

```ts
    // Só monta o mapa quando a modalidade usa a regra: sem isso, uma metade
    // marcada em modalidade que não usa a regra mudaria o sorteio.
    const metadePorPid = modalidade.usa_metade_chave
      ? new Map<number, engine.MetadeChave | null>(
          inscricoes.map(i => [
            i.participante_id,
            (i.metade_chave === 'cima' || i.metade_chave === 'baixo') ? i.metade_chave : null,
          ]),
        )
      : undefined
    resultado = engine.drawBracket(pids, regra, regraBracket, matchesGraph, seed, cabecasFinais, { metadePorPid })
```

No fim do arquivo, a consulta usada pela tela de inscrições:

```ts
/** Tamanho de cada metade da chave de N inscritos — alimenta o contador da
 *  tela de inscrições. Lê o mesmo desenho que o sorteio usa. */
export async function metadesPorNumeroInscrito(numeroInscrito: number) {
  const row = await prisma.bracketChavesMatches.findUnique({
    where: { numero_inscrito: numeroInscrito },
  })
  if (!row?.matches_graph) {
    throw Object.assign(
      new Error(`Não há desenho de chave cadastrado para ${numeroInscrito} inscritos.`),
      { status: 404 },
    )
  }
  const { cima, baixo } = engine.metadesDoGrafo(row.matches_graph as any)
  return { numero_inscrito: numeroInscrito, cima: cima.size, baixo: baixo.size }
}
```

- [ ] **Step 4: Expor no controller e na rota**

Em `sorteios.controller.ts`, ao fim do arquivo:

```ts
export async function metades(req: Request, res: Response, next: NextFunction) {
  try {
    const n = parseIntParam(req.params.numeroInscrito, 'numeroInscrito')
    res.json(await service.metadesPorNumeroInscrito(n))
  } catch (err) { next(err) }
}
```

Em `sorteios.routes.ts`, **acima** da linha `router.get('/:id', ...)` — senão `/:id` captura `metades` primeiro:

```ts
router.get('/metades/:numeroInscrito', requireAuth, ctrl.metades)
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && npx tsc --noEmit && npx vitest run src/modules/sorteios`
Esperado: verde.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/sorteios/sorteios.service.ts backend/src/modules/sorteios/sorteios.controller.ts backend/src/modules/sorteios/sorteios.routes.ts backend/src/modules/sorteios/sorteios.service.test.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(sorteio): executar le metade_chave e endpoint de metades"
```

---

### Task 5: `mascararNome` + snapshot do site público

**Files:**
- Create: `backend/src/lib/mascarar-nome.ts`
- Create: `backend/src/lib/mascarar-nome.test.ts`
- Modify: `backend/src/modules/site-publico/snapshot.ts`
- Modify: `backend/src/modules/site-publico/site-publico.service.ts:53`
- Test: `backend/src/modules/site-publico/snapshot.test.ts`

**Interfaces:**
- Produces: `export function mascararNome(nome: string): string` (o gêmeo do frontend nasce na Task 10, com o mesmo conteúdo).

- [ ] **Step 1: Escrever os testes que falham**

Criar `backend/src/lib/mascarar-nome.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mascararNome } from './mascarar-nome'

describe('mascararNome', () => {
  it('mantém o primeiro nome e esconde o resto', () => {
    expect(mascararNome('Wagner Rosa Marrane')).toBe('Wagner **********')
    expect(mascararNome('Rodrigo Moreira')).toBe('Rodrigo **********')
  })

  it('usa sempre 10 asteriscos, para não revelar o tamanho do sobrenome', () => {
    expect(mascararNome('Ana Sá')).toBe('Ana **********')
    expect(mascararNome('Ana Carolina de Albuquerque')).toBe('Ana **********')
  })

  it('nome de uma palavra fica intacto', () => {
    expect(mascararNome('Wagner')).toBe('Wagner')
  })

  it('tolera espaços sobrando', () => {
    expect(mascararNome('  Wagner   Rosa  ')).toBe('Wagner **********')
  })
})
```

Acrescentar ao fim de `backend/src/modules/site-publico/snapshot.test.ts`:

```ts
it('mascara o nome quando a modalidade pede', () => {
  const snap = montaSnapshot({
    evento: baseEvento as any,
    modalidades: [{ ...modalidadeGrupos, mascarar_nome: true } as any],
    inscricoesPorModalidade: new Map([[1, [
      { participante: { id: 100, nome: 'Wagner Rosa Marrane', subtitulo: 'Colégio França' } },
    ]]]) as any,
    campeoesPorModalidade: new Map() as any,
    sorteiosPorModalidade: new Map() as any,
    subtituloFn: (p: any) => p.subtitulo ?? null,
  })
  expect(snap.modalidades[0].participantes).toEqual([
    { id: 100, nome: 'Wagner **********', subtitulo: 'Colégio França' },
  ])
})

it('não mascara quando a modalidade não pede', () => {
  const snap = montaSnapshot({
    evento: baseEvento as any,
    modalidades: [modalidadeGrupos as any],
    inscricoesPorModalidade: new Map([[1, [
      { participante: { id: 100, nome: 'Wagner Rosa Marrane', subtitulo: 'Colégio França' } },
    ]]]) as any,
    campeoesPorModalidade: new Map() as any,
    sorteiosPorModalidade: new Map() as any,
    subtituloFn: (p: any) => p.subtitulo ?? null,
  })
  expect(snap.modalidades[0].participantes[0].nome).toBe('Wagner Rosa Marrane')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/lib/mascarar-nome.test.ts src/modules/site-publico/snapshot.test.ts`
Esperado: FALHA — módulo inexistente e snapshot ainda publicando o nome inteiro.

- [ ] **Step 3: Criar o helper** — `backend/src/lib/mascarar-nome.ts`

```ts
/**
 * Esconde o sobrenome para exibição pública (LGPD): primeiro nome + dez
 * asteriscos, sempre dez. A contagem fixa é de propósito — asteriscos do
 * tamanho real entregariam o formato do nome.
 *
 * Nome de uma palavra só volta intacto: não há sobrenome a esconder.
 *
 * GÊMEO: `frontend/src/lib/mascarar-nome.ts` tem o mesmo conteúdo. Mudou aqui,
 * mude lá (mesmo acordo de `compose-subtitulo.ts`).
 */
export function mascararNome(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  if (partes.length < 2) return partes[0] ?? ''
  return `${partes[0]} **********`
}
```

- [ ] **Step 4: Aplicar no snapshot** — `backend/src/modules/site-publico/snapshot.ts`

No topo, junto dos outros imports:

```ts
import { mascararNome } from '../../lib/mascarar-nome'
```

No `type ModalidadeRow`, acrescentar o campo:

```ts
type ModalidadeRow = { id: number; nome: string; tipo_modalidade: { tipo: string }; mensagens_inscritos: unknown; mascarar_nome?: boolean }
```

Dentro de `montaSnapshot`, trocar a montagem de `participantes`:

```ts
    // Mascaramos aqui, na origem: o JSON publicado não carrega o nome inteiro.
    const mascarar = mod.mascarar_nome === true
    const participantes: SnapParticipante[] = inscricoes.map((i) => ({
      id: i.participante.id,
      nome: mascarar ? mascararNome(i.participante.nome) : i.participante.nome,
      subtitulo: subtituloFn(participanteEfetivo(i, porModalidade)),
    }))
```

- [ ] **Step 5: Trazer o campo do banco** — `backend/src/modules/site-publico/site-publico.service.ts`, no `select` de `prisma.modalidade.findMany` (linha ~53):

```ts
    select: { id: true, nome: true, tipo_modalidade: { select: { tipo: true } }, mensagens_inscritos: true, mascarar_nome: true },
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd backend && npx tsc --noEmit && npx vitest run`
Esperado: suíte inteira verde.

- [ ] **Step 7: Commit**

```bash
git add backend/src/lib/mascarar-nome.ts backend/src/lib/mascarar-nome.test.ts backend/src/modules/site-publico/snapshot.ts backend/src/modules/site-publico/snapshot.test.ts backend/src/modules/site-publico/site-publico.service.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): mascara nome do participante quando a modalidade pede"
```

---

### Task 6: API aceita os campos novos

**Files:**
- Modify: `backend/src/modules/modalidades/modalidades.controller.ts` (`createSchema`)
- Modify: `backend/src/modules/inscricoes/inscricoes.controller.ts` (`createSchema`, `patchSchema`, `importRowSchema`)
- Modify: `backend/src/modules/inscricoes/inscricoes.service.ts` (`criar`, `editar`, `importar`)
- Test: `backend/src/modules/inscricoes/inscricoes.service.test.ts`

**Interfaces:**
- Produces:
  - `POST/PUT /modalidades` aceitam `usa_metade_chave` e `mascarar_nome` (booleanos opcionais).
  - `POST /inscricoes` e `PATCH /inscricoes/:id` aceitam `metade_chave: 'cima' | 'baixo' | null`.
  - Linha de import aceita `metade` (mesmo domínio, opcional).

- [ ] **Step 1: Zod das modalidades** — em `createSchema` de `modalidades.controller.ts`, depois de `chave_versao`:

```ts
  usa_metade_chave: z.boolean().optional(),
  mascarar_nome: z.boolean().optional(),
```

`updateSchema` é `createSchema.partial()` e herda sozinho. O service de modalidades repassa o corpo ao Prisma por spread, então não há mudança lá.

- [ ] **Step 2: Zod das inscrições** — em `inscricoes.controller.ts`

Um único domínio, reaproveitado nos três schemas:

```ts
const metadeChaveSchema = z.enum(['cima', 'baixo'])
```

Em `createSchema`, depois de `municipio_id`:

```ts
  metade_chave: metadeChaveSchema.nullish(),
```

Em `patchSchema`, depois de `municipio_id`:

```ts
  metade_chave: metadeChaveSchema.nullish(),
```

Em `importRowSchema`, depois de `subtitulo`:

```ts
  metade: metadeChaveSchema.optional(),
```

- [ ] **Step 3: Persistir no service** — `backend/src/modules/inscricoes/inscricoes.service.ts`

Em `criar`, junto dos outros campos opcionais:

```ts
  if (data.metade_chave !== undefined) createData.metade_chave = data.metade_chave
```

E o tipo `CreateInput` ganha `metade_chave?: 'cima' | 'baixo' | null`.

Em `editar`, trocar a assinatura e acrescentar o patch:

```ts
export async function editar(
  id: number,
  data: { subtitulo?: string | null; municipio_id?: number | null; metade_chave?: 'cima' | 'baixo' | null },
) {
```

```ts
  if (data.metade_chave !== undefined) patch.metade_chave = data.metade_chave
```

Em `importar`, o tipo `ImportRow` ganha `metade?: 'cima' | 'baixo'` e **os dois** `prisma.inscricao.create` recebem o campo (o do ramo escolar e o do ramo padrão — os dois têm `row` em escopo):

```ts
            metade_chave: row.metade ?? null,
```

- [ ] **Step 4: Teste do caminho de escrita** — acrescentar ao fim de `backend/src/modules/inscricoes/inscricoes.service.test.ts`, seguindo o estilo de mock do arquivo:

```ts
it('editar grava metade_chave quando informada', async () => {
  mockPrisma.inscricao.update.mockResolvedValue({ id: 7 })
  await service.editar(7, { metade_chave: 'cima' })
  expect(mockPrisma.inscricao.update).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 7 }, data: { metade_chave: 'cima' } }),
  )
})

it('editar não toca em metade_chave quando o campo não vem', async () => {
  mockPrisma.inscricao.update.mockResolvedValue({ id: 7 })
  await service.editar(7, { subtitulo: 'Colégio França' })
  const chamada = mockPrisma.inscricao.update.mock.calls[0][0]
  expect(chamada.data).not.toHaveProperty('metade_chave')
})
```

- [ ] **Step 5: Rodar**

Run: `cd backend && npx tsc --noEmit && npx vitest run`
Esperado: verde.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/modalidades/modalidades.controller.ts backend/src/modules/inscricoes/inscricoes.controller.ts backend/src/modules/inscricoes/inscricoes.service.ts backend/src/modules/inscricoes/inscricoes.service.test.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(api): aceita metade_chave e os parametros novos da modalidade"
```

---

### Task 7: Tipos e checkboxes no editor de modalidade

**Files:**
- Modify: `frontend/src/types/modalidade.ts`
- Modify: `frontend/src/types/inscricao.ts`
- Modify: `frontend/src/services/modalidades.ts`
- Modify: `frontend/src/pages/modalidades/ModalidadeForm.tsx`

**Interfaces:**
- Produces: `Modalidade.usa_metade_chave: boolean`, `Modalidade.mascarar_nome: boolean`, `Inscricao.metade_chave?: MetadeChave | null`, `export type MetadeChave = 'cima' | 'baixo'`.

- [ ] **Step 1: Tipos** — em `frontend/src/types/modalidade.ts`, dentro de `Modalidade`, logo depois de `chave_versao`:

```ts
  usa_metade_chave: boolean
  mascarar_nome: boolean
```

Em `frontend/src/types/inscricao.ts`, acima de `Inscricao`:

```ts
export type MetadeChave = 'cima' | 'baixo'
```

e dentro de `Inscricao`, depois de `municipio`:

```ts
  metade_chave?: MetadeChave | null
```

e dentro de `ImportRow`, depois de `subtitulo`:

```ts
  metade?: MetadeChave
```

Em `frontend/src/services/modalidades.ts`, no payload (perto de `chave_versao?: ChaveVersao`):

```ts
  usa_metade_chave?: boolean
  mascarar_nome?: boolean
```

- [ ] **Step 2: Estado no formulário** — `ModalidadeForm.tsx`, junto do `useState` de `chaveVersao` (linha ~48):

```tsx
  const [usaMetadeChave, setUsaMetadeChave] = useState(false)
  const [mascararNomeMod, setMascararNomeMod] = useState(false)
```

- [ ] **Step 3: Preencher ao editar** — no `useEffect` que popula de `existing`, junto de `setChaveVersao`:

```tsx
      setUsaMetadeChave(existing.usa_metade_chave === true)
      setMascararNomeMod(existing.mascarar_nome === true)
```

- [ ] **Step 4: Enviar no payload** — no objeto `payload` da mutation, depois de `chave_versao`:

```tsx
        usa_metade_chave: usaMetadeChave,
        mascarar_nome: mascararNomeMod,
```

- [ ] **Step 5: Render** — logo depois do bloco `{tipoSelecionado?.tipo === 'chaves' && (...)}` da versão da chave, ainda dentro da mesma `<section>`:

```tsx
            {tipoSelecionado?.tipo === 'chaves' && (
              <label className="flex items-start gap-2 text-sm text-[var(--t2)]" style={{ marginTop: 16 }}>
                <input
                  type="checkbox"
                  checked={usaMetadeChave}
                  onChange={e => setUsaMetadeChave(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span>
                  Usar metade da chave
                  <span className="block text-xs text-[var(--t4)]">
                    A inscrição pode exigir a parte de cima ou de baixo da chave. Quem é cabeça
                    de chave mantém a posição de cabeça e tem a metade ignorada.
                  </span>
                </span>
              </label>
            )}

            <label className="flex items-start gap-2 text-sm text-[var(--t2)]" style={{ marginTop: 16 }}>
              <input
                type="checkbox"
                checked={mascararNomeMod}
                onChange={e => setMascararNomeMod(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                Mascarar nome do participante
                <span className="block text-xs text-[var(--t4)]">
                  No Modo Congresso e no site público aparece só o primeiro nome. As telas
                  internas e os relatórios seguem com o nome completo.
                </span>
              </span>
            </label>
```

- [ ] **Step 6: Verificar**

Run: `cd frontend && npm run build`
Esperado: `tsc -b && vite build` verdes.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/modalidade.ts frontend/src/types/inscricao.ts frontend/src/services/modalidades.ts frontend/src/pages/modalidades/ModalidadeForm.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(modalidades): parametros de metade de chave e mascaramento no editor"
```

---

### Task 8: Seletor de metade + contador na tela de inscrições

**Files:**
- Modify: `frontend/src/services/sorteios.ts`
- Modify: `frontend/src/services/inscricoes.ts`
- Modify: `frontend/src/pages/eventos/EventoInscricoes.tsx`

**Interfaces:**
- Consumes: `GET /sorteios/metades/:numeroInscrito` (Task 4), `PATCH /inscricoes/:id { metade_chave }` (Task 6), `Modalidade.usa_metade_chave` e `Inscricao.metade_chave` (Task 7).
- Produces: `sorteiosService.metades(numeroInscrito)`.

- [ ] **Step 1: Service do endpoint** — em `frontend/src/services/sorteios.ts`, dentro de `sorteiosService`:

```ts
  metades: (numeroInscrito: number) =>
    api.get<{ numero_inscrito: number; cima: number; baixo: number }>(`${BASE}/metades/${numeroInscrito}`).then(r => r.data),
```

- [ ] **Step 2: `editar` do frontend aceita a metade** — em `frontend/src/services/inscricoes.ts`, no tipo do payload de `editar`, acrescentar:

```ts
  metade_chave?: 'cima' | 'baixo' | null
```

- [ ] **Step 3: Buscar os tamanhos das metades** — em `EventoInscricoes.tsx`, junto das outras queries (perto da query de `campeoes-anteriores`, linha ~161):

```tsx
  const modalidadeAtual = modalidades.find(m => m.id === modalidadeId) ?? null
  const usaMetade = modalidadeAtual?.usa_metade_chave === true

  const { data: metadesInfo } = useQuery({
    queryKey: ['metades-chave', inscricoes.length],
    queryFn: () => sorteiosService.metades(inscricoes.length),
    enabled: usaMetade && inscricoes.length > 1,
    retry: false,   // sem desenho cadastrado o endpoint responde 404; o contador só some
  })
```

Se `modalidades` não estiver em escopo com esse nome, use a lista de modalidades que a tela já carrega para o seletor.

- [ ] **Step 4: Mutation do seletor** — junto da mutation `editarInscricao` (linha ~313):

```tsx
  const { mutate: definirMetade } = useMutation({
    mutationFn: ({ id, metade_chave }: { id: number; metade_chave: 'cima' | 'baixo' | null }) =>
      inscricoesService.editar(id, { metade_chave }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inscricoes', eventoId, modalidadeId] }) },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao definir a metade da chave.'),
  })
```

- [ ] **Step 5: Contador acima da lista** — logo antes do `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>` que renderiza os inscritos:

```tsx
                      {usaMetade && (() => {
                        const pedemCima = inscricoes.filter(i => i.metade_chave === 'cima').length
                        const pedemBaixo = inscricoes.filter(i => i.metade_chave === 'baixo').length
                        const capCima = metadesInfo?.cima
                        const capBaixo = metadesInfo?.baixo
                        const estouro = (capCima != null && pedemCima > capCima) || (capBaixo != null && pedemBaixo > capBaixo)
                        const ignoradas = (sorteioDaModalidade?.resultado as any)?.metadesIgnoradas as number[] | undefined
                        return (
                          <div
                            style={{
                              marginBottom: 8, padding: '8px 12px', fontSize: 12,
                              borderRadius: 'var(--radius-lg)',
                              background: estouro ? 'var(--danger-bg, #3b1113)' : 'var(--card-bg-2)',
                              border: `1px solid ${estouro ? 'var(--danger)' : 'var(--card-border)'}`,
                              color: estouro ? 'var(--danger)' : 'var(--t3)',
                            }}
                          >
                            Metade da chave — cima {pedemCima}{capCima != null ? `/${capCima}` : ''} · baixo {pedemBaixo}{capBaixo != null ? `/${capBaixo}` : ''}
                            {estouro && <b> · não cabe: o sorteio vai recusar</b>}
                            {ignoradas && ignoradas.length > 0 && (
                              <span style={{ display: 'block', marginTop: 4, color: 'var(--t4)' }}>
                                O último sorteio ignorou a metade de {ignoradas.length}{' '}
                                {ignoradas.length === 1 ? 'inscrito que é cabeça de chave' : 'inscritos que são cabeça de chave'}.
                              </span>
                            )}
                          </div>
                        )
                      })()}
```

- [ ] **Step 6: Seletor por inscrito** — dentro do card de cada inscrito, logo antes do botão de editar override (o `{subMunPorMod && isAdmin && (`):

```tsx
                            {usaMetade && isAdmin && (
                              <select
                                value={i.metade_chave ?? ''}
                                onChange={e => definirMetade({ id: i.id, metade_chave: (e.target.value || null) as 'cima' | 'baixo' | null })}
                                disabled={eventoSuspenso}
                                title="Metade da chave em que este inscrito deve cair"
                                style={{
                                  fontSize: 11, padding: '2px 4px', borderRadius: 6, flexShrink: 0,
                                  background: 'var(--card-bg)', color: 'var(--t2)',
                                  border: '1px solid var(--card-border)',
                                }}
                              >
                                <option value="">—</option>
                                <option value="cima">Cima</option>
                                <option value="baixo">Baixo</option>
                              </select>
                            )}
```

- [ ] **Step 7: Import do service** — garantir no topo do arquivo:

```tsx
import { sorteiosService } from '../../services/sorteios'
```

- [ ] **Step 8: Verificar**

Run: `cd frontend && npm run build`
Esperado: verde.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/services/sorteios.ts frontend/src/services/inscricoes.ts frontend/src/pages/eventos/EventoInscricoes.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(inscricoes): seletor de metade da chave e contador de viabilidade"
```

---

### Task 9: Coluna `metade` no import CSV

**Files:**
- Modify: `frontend/src/components/import/ImportInscricoesModal.tsx`

**Interfaces:**
- Consumes: `ImportRow.metade` (Task 7), `importRowSchema.metade` (Task 6).

- [ ] **Step 1: Ler a coluna nos dois parsers** — em cada um dos dois `complete:` do Papa.parse (o do ramo escolar, linha ~137, e o do padrão, linha ~172), junto de `subtitulo: r.subtitulo?.trim() || undefined`:

```ts
            metade: normalizaMetade(r.metade),
```

- [ ] **Step 2: Normalizador** — no topo do arquivo, depois dos imports:

```ts
/** Aceita "cima"/"baixo" em qualquer caixa e com acento sobrando; qualquer
 *  outra coisa vira "sem preferência", que é o comportamento padrão. */
function normalizaMetade(v: unknown): 'cima' | 'baixo' | undefined {
  const s = String(v ?? '').trim().toLowerCase()
  if (s === 'cima') return 'cima'
  if (s === 'baixo') return 'baixo'
  return undefined
}
```

- [ ] **Step 3: Documentar a coluna na ajuda do modal** — na lista de colunas (perto de `<li><b>subtitulo</b>: opcional …`), acrescentar:

```tsx
                    <li><b>metade</b>: opcional — <code>cima</code> ou <code>baixo</code>; vazio significa sem preferência. Usada só quando a modalidade liga "usar metade da chave".</li>
```

- [ ] **Step 4: Verificar**

Run: `cd frontend && npm run build`
Esperado: verde.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/import/ImportInscricoesModal.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(import): coluna metade no CSV de inscricoes"
```

---

### Task 10: Mascaramento no Modo Congresso

**Files:**
- Create: `frontend/src/lib/mascarar-nome.ts`
- Create: `frontend/src/lib/mascarar-nome.test.ts`
- Modify: `frontend/src/pages/congresso/CongressoStepSorteio.tsx:97-100`
- Modify: `frontend/src/pages/congresso/CongressoStepParticipantes.tsx:127`
- Modify: `frontend/src/pages/congresso/CongressoStepCampeoes.tsx:128`
- Modify: `frontend/src/pages/congresso/CampeoesPanel.tsx:67-70,251`

**Interfaces:**
- Consumes: `Modalidade.mascarar_nome` (Task 7).
- Produces: `frontend/src/lib/mascarar-nome.ts` — gêmeo idêntico ao do backend (Task 5).

- [ ] **Step 1: Escrever o teste que falha** — criar `frontend/src/lib/mascarar-nome.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { mascararNome } from './mascarar-nome'

describe('mascararNome', () => {
  it('mantém o primeiro nome e esconde o resto', () => {
    expect(mascararNome('Wagner Rosa Marrane')).toBe('Wagner **********')
    expect(mascararNome('Rodrigo Moreira')).toBe('Rodrigo **********')
  })

  it('usa sempre 10 asteriscos', () => {
    expect(mascararNome('Ana Sá')).toBe('Ana **********')
  })

  it('nome de uma palavra fica intacto', () => {
    expect(mascararNome('Wagner')).toBe('Wagner')
  })
})
```

- [ ] **Step 2: Criar o gêmeo** — `frontend/src/lib/mascarar-nome.ts`, conteúdo idêntico ao do backend:

```ts
/**
 * Esconde o sobrenome para exibição pública (LGPD): primeiro nome + dez
 * asteriscos, sempre dez. A contagem fixa é de propósito — asteriscos do
 * tamanho real entregariam o formato do nome.
 *
 * Nome de uma palavra só volta intacto: não há sobrenome a esconder.
 *
 * GÊMEO: `backend/src/lib/mascarar-nome.ts` tem o mesmo conteúdo. Mudou aqui,
 * mude lá (mesmo acordo de `compose-subtitulo.ts`).
 */
export function mascararNome(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  if (partes.length < 2) return partes[0] ?? ''
  return `${partes[0]} **********`
}
```

- [ ] **Step 3: `CongressoStepSorteio.tsx`** — no `useMemo` de `participantesById` (linha ~97):

```tsx
  const mascarar = modalidade?.mascarar_nome === true

  const participantesById = useMemo(() => {
    const m = new Map<number, Participante>()
    for (const i of inscricoes) {
      const p = participanteEfetivo(i, porModalidade)
      m.set(i.participante_id, mascarar ? { ...p, nome: mascararNome(p.nome) } : p)
    }
    return m
  }, [inscricoes, porModalidade, mascarar])
```

Import no topo:

```tsx
import { mascararNome } from '../../lib/mascarar-nome'
```

Mascarar no mapeamento (e não dentro de `BracketTree`/`SorteioChaves`) é o que impede o mascaramento de vazar para o site público, que usa os mesmos componentes.

- [ ] **Step 4: `CongressoStepParticipantes.tsx`** — trocar a linha 127:

```tsx
            const nome = modalidade?.mascarar_nome === true
              ? mascararNome(i.participante.nome)
              : i.participante.nome
```

Import no topo: `import { mascararNome } from '../../lib/mascarar-nome'`.

- [ ] **Step 5: `CongressoStepCampeoes.tsx`** — trocar a linha 128:

```tsx
                  <div style={{ fontSize: 'clamp(18px, 1.6vw, 22px)', color: FG, fontWeight: 700 }}>
                    {modalidade?.mascarar_nome === true ? mascararNome(c.participante.nome) : c.participante.nome}
                  </div>
```

Import no topo: `import { mascararNome } from '../../lib/mascarar-nome'`.

- [ ] **Step 6: `CampeoesPanel.tsx`** — no `useMemo` de `participantesById` (linha ~67), mesmo padrão do Step 3:

```tsx
  const mascarar = modalidade?.mascarar_nome === true

  const participantesById = useMemo(() => {
    const m = new Map<number, Participante>()
    for (const i of inscricoes) {
      const p = participanteEfetivo(i, porModalidade)
      m.set(i.participante_id, mascarar ? { ...p, nome: mascararNome(p.nome) } : p)
    }
    return m
  }, [inscricoes, porModalidade, mascarar])
```

E na linha ~251, onde o nome do campeão é exibido:

```tsx
                  >{mascarar ? mascararNome(it.participante?.nome ?? '—') : (it.participante?.nome ?? '—')}</span>
```

Import no topo: `import { mascararNome } from '../../lib/mascarar-nome'`.

Se `modalidade` não existir no escopo de algum desses componentes, pegue-a da mesma fonte que o componente já usa para `porModalidade`/`camposSubtitulo` (a modalidade selecionada no shell do Modo Congresso) — não crie uma query nova.

- [ ] **Step 7: Verificar**

Run: `cd frontend && npx vitest run src/lib/mascarar-nome.test.ts && npm run build`
Esperado: teste verde e build verde.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/mascarar-nome.ts frontend/src/lib/mascarar-nome.test.ts frontend/src/pages/congresso/CongressoStepSorteio.tsx frontend/src/pages/congresso/CongressoStepParticipantes.tsx frontend/src/pages/congresso/CongressoStepCampeoes.tsx frontend/src/pages/congresso/CampeoesPanel.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(congresso): mascara nome do participante quando a modalidade pede"
```

---

## Verificação final (após as tasks)

- [ ] `cd backend && npx tsc --noEmit && npx vitest run` e `cd frontend && npm run build` verdes.
- [ ] **Confronto com os dados reais** — rodar no ambiente local, com o banco de produção restaurado, um script que compare `metadesDoGrafo` com a divisão contígua de cada um dos 76 grafos cadastrados:

```bash
export MSYS_NO_PATHCONV=1
docker compose -f docker-compose.dev.windows.yml exec -T postgres psql -U prosports -d newprosports -t -A -c "select json_agg(json_build_object('n',numero_inscrito,'g',matches_graph)) from bracket_chaves_matches;" > /tmp/graphs.json
```

Depois, num script Node de uma vez só, verificar para cada N que `cima ∪ baixo = {1..N}`, que as duas são faixas contíguas e que `cima` contém a posição 1. Esperado: 76/76.

- [ ] **Ponta a ponta no ambiente local** (`npm run dev:update` antes), numa modalidade de chaves de teste:
  - ligar "usar metade da chave" e "mascarar nome" na modalidade;
  - marcar um inscrito como cima e outro como baixo, sortear e conferir os lados;
  - estourar uma metade de propósito e conferir o aviso na tela e a recusa do sorteio;
  - marcar como cabeça um inscrito com metade oposta, sortear e conferir que ele foi para a posição de cabeça e que o aviso de metade ignorada apareceu;
  - publicar o evento e conferir no JSON do snapshot (`/data/snapshots/evento-<id>.json`) que os nomes saíram mascarados.
- [ ] **Regressão**: numa modalidade sem os dois parâmetros, sortear e conferir que o resultado é o mesmo de antes para a mesma seed, e que o snapshot sai com nome completo.

## Self-Review (cobertura da spec)

- Campos no schema, migração aditiva: Task 1 ✓
- Metades derivadas do grafo, nunca de ⌈N/2⌉: Task 2 ✓
- Metade que contém a posição 1 é a de cima: Task 2 ✓
- Ordem cabeças → metades → sem preferência, com `shuffleSeeded`: Task 3 ✓
- Cabeça prevalece e o descarte é registrado: Task 3 (registro) + Task 8 (exibição) ✓
- Recusa sem grafo cadastrado: Task 3 ✓
- Grupos e ordem de entrada ignoram o campo: Task 4 (mapa só em `chaves`) + Task 7 (checkbox só em chaves) ✓
- V1/V2 sem tratamento especial: Task 2 (teste do grafo liftado) ✓
- Aviso na tela + recusa no sorteio: Task 8 + Task 3 ✓
- Máscara primeiro nome + 10 asteriscos, uma palavra intacta: Tasks 5 e 10 ✓
- Máscara no snapshot e no Modo Congresso, fora dos componentes compartilhados: Tasks 5 e 10 ✓
- Máscara não afeta subtítulo: Task 5 (teste) ✓
- Entrada por tela e por CSV: Tasks 8 e 9 ✓
- Valores aceitos só `cima`/`baixo`: Task 6 ✓
- Regressão byte a byte sem os parâmetros: Task 3 (teste) + verificação final ✓
