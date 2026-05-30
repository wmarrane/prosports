# Campeões como Sementes + Congresso 5 Passos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Restaurar tabela `sistema_disputas_chaves` no Prisma (drift), (2) atualizar engine drawGroups/drawBracket para colocar campeões em posições fixas (1ª vaga por grupo / cabeças via tabela), (3) atualizar service.executar para carregar regras+campeões, (4) adicionar 5º passo "Campeões do Ano Anterior" ao Modo Congresso. Bump para `1.16.0`.

**Architecture:** `sistema_disputas_chaves` adotada via migration idempotente (`CREATE TABLE IF NOT EXISTS`). Engine recebe novo parâmetro `campeoesPids` ordenado por posicao ASC; drawGroups coloca 1 campeão por grupo na 1ª vaga (até qtd grupos); drawBracket muda para `size = N` literal (sem byes) e usa regra da tabela para slots dos 4 cabeças. Service carrega `campeaoAnterior.findMany` + `sistemaDisputasChaves.findFirst` antes do dispatch. Modo Congresso ganha step `'campeoes'` entre Participantes e Sorteio.

**Tech Stack:** Prisma (Postgres + @@map), Express, Vitest. React 18 + TypeScript + React Query.

**Spec:** `docs/superpowers/specs/2026-05-30-campeoes-sementes-design.md`

---

## File Structure

**Backend — Create:**
- `backend/prisma/migrations/<ts>_restore_sistema_disputas_chaves/migration.sql` (manual, idempotente)

**Backend — Modify:**
- `backend/prisma/schema.prisma` — adicionar model `SistemaDisputasChaves`.
- `backend/src/modules/sorteios/engine.ts` — drawGroups e drawBracket alteradas.
- `backend/src/modules/sorteios/engine.test.ts` — +6 testes; ajustar 1 existente (drawBracket).
- `backend/src/modules/sorteios/sorteios.service.ts` — carregar campeões + regra chaves + passar para engine.
- `backend/src/modules/sorteios/sorteios.service.test.ts` — mocks novos + ajustar 1 + 3 novos testes.

**Frontend — Create:**
- `frontend/src/pages/congresso/CongressoStepCampeoes.tsx` — novo step.

**Frontend — Modify:**
- `frontend/src/types/congresso-step.ts` — adicionar `'campeoes'` ao union.
- `frontend/src/pages/congresso/CongressoShell.tsx` — STEP_LABELS, STEP_INDEX, "Passo X de 5".
- `frontend/src/pages/congresso/ModoCongresso.tsx` — state machine novo step.

**Release:**
- `package.json` (root): `1.15.1` → `1.16.0`.
- `CHANGELOG.md`: bloco `[1.16.0]`.

---

## Task 1: Prisma — restaurar `sistema_disputas_chaves` (adoção via IF NOT EXISTS)

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\prisma\schema.prisma`
- Create: `backend/prisma/migrations/20260530220000_restore_sistema_disputas_chaves/migration.sql`

- [ ] **Step 1: Editar `schema.prisma` — adicionar model**

Append ao final do arquivo:

```prisma
model SistemaDisputasChaves {
  id                       Int @id @default(autoincrement())
  numero_inscrito          Int
  posicao_primeiro_cabeca  Int
  posicao_segundo_cabeca   Int
  posicao_terceiro_cabeca  Int
  posicao_quarto_cabeca    Int

  @@unique([numero_inscrito])
  @@map("sistema_disputas_chaves")
}
```

- [ ] **Step 2: Criar migration idempotente**

Criar diretório `backend/prisma/migrations/20260530220000_restore_sistema_disputas_chaves/` e arquivo `migration.sql`:

```sql
-- Adopt existing sistema_disputas_chaves table (already exists in dev DB).
-- IF NOT EXISTS makes it safe for both adopted-dev and fresh environments.

CREATE TABLE IF NOT EXISTS "sistema_disputas_chaves" (
  "id" SERIAL PRIMARY KEY,
  "numero_inscrito" INTEGER NOT NULL,
  "posicao_primeiro_cabeca" INTEGER NOT NULL,
  "posicao_segundo_cabeca" INTEGER NOT NULL,
  "posicao_terceiro_cabeca" INTEGER NOT NULL,
  "posicao_quarto_cabeca" INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "sistema_disputas_chaves_numero_inscrito_key"
  ON "sistema_disputas_chaves"("numero_inscrito");
```

- [ ] **Step 3: Regenerar Prisma client local**

De `backend/`:
```
npx prisma generate
```

Esperado: "Generated Prisma Client".

- [ ] **Step 4: tsc + full suite**

De `backend/`:
```
npx tsc --noEmit && npx vitest run
```

Esperado: tsc clean; todos os testes existentes passam (engine continua igual ainda).

- [ ] **Step 5: Commit**

```
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): adopt sistema_disputas_chaves table in Prisma schema" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Engine — drawGroups com `campeoesPids` (TDD)

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\sorteios\engine.ts`
- Modify: `backend/src/modules/sorteios/engine.test.ts`

- [ ] **Step 1: Adicionar 3 novos testes ao `engine.test.ts`**

Localizar o bloco `describe('drawGroups', () => { ... })` (após os 2 testes existentes, ANTES do `})` que fecha o describe). Adicionar:

```ts
  it('sem campeoesPids: comportamento igual (regressão)', () => {
    const regra = { id: 1, quantidade_grupos: 2, grupos_3_componentes: 2, grupos_4_componentes: 0, numero_classificados: 2 }
    const a = drawGroups([1,2,3,4,5,6], regra, 'seed-x')
    const b = drawGroups([1,2,3,4,5,6], regra, 'seed-x', [])
    expect(a).toEqual(b)
  })

  it('1 campeão + 5 outros (regra 2g de 3): campeão na 1ª pos do Grupo A; outros 5 distribuídos', () => {
    const regra = { id: 1, quantidade_grupos: 2, grupos_3_componentes: 2, grupos_4_componentes: 0, numero_classificados: 2 }
    const out = drawGroups([10,20,30,40,50,60], regra, 'seed-c1', [10])
    expect(out.grupos[0].participantes[0]).toBe(10)
    const todos = [...out.grupos[0].participantes, ...out.grupos[1].participantes].sort((a,b)=>a-b)
    expect(todos).toEqual([10,20,30,40,50,60])
  })

  it('3 campeões + 3 outros (regra 2g de 3): 1º e 2º campeões nas 1ªs pos de A e B; 3º entra no shuffle', () => {
    const regra = { id: 1, quantidade_grupos: 2, grupos_3_componentes: 2, grupos_4_componentes: 0, numero_classificados: 2 }
    const out = drawGroups([10,20,30,40,50,60], regra, 'seed-c3', [10, 20, 30])
    expect(out.grupos[0].participantes[0]).toBe(10)
    expect(out.grupos[1].participantes[0]).toBe(20)
    // 30 (3º campeão) está em algum grupo, mas NÃO na 1ª pos
    const todos = [...out.grupos[0].participantes, ...out.grupos[1].participantes]
    expect(todos.includes(30)).toBe(true)
    expect(out.grupos[0].participantes[0]).not.toBe(30)
    expect(out.grupos[1].participantes[0]).not.toBe(30)
    expect(todos.sort((a,b)=>a-b)).toEqual([10,20,30,40,50,60])
  })
```

- [ ] **Step 2: Run tests — FAIL nos novos**

De `backend/`:
```
npx vitest run src/modules/sorteios/engine.test.ts
```

Esperado: os 3 novos testes falham (alguns por TS, outros por lógica — `drawGroups` ainda não aceita 4º parâmetro).

- [ ] **Step 3: Atualizar `drawGroups` em `engine.ts`**

Localizar a função `drawGroups` e substituir por:

```ts
export function drawGroups(
  participantes: readonly number[],
  regra: RegraGrupos,
  seed: string,
  campeoesPids: readonly number[] = [],
): GruposResultado {
  // Sequência de tamanhos embaralhada (igual ao atual)
  const sizes: number[] = [
    ...Array(regra.grupos_3_componentes).fill(3),
    ...Array(regra.grupos_4_componentes).fill(4),
  ]
  const shuffledSizes = shuffleSeeded(sizes, `${seed}:sizes`)
  const numGrupos = shuffledSizes.length

  // Campeões que viram cabeça de grupo (até numGrupos)
  const cabecas = campeoesPids.slice(0, numGrupos)
  const cabecasSet = new Set<number>(cabecas)

  // Outros = participantes que NÃO são cabeças (incluindo campeões excedentes)
  const outros = participantes.filter(pid => !cabecasSet.has(pid))
  const outrosShuffled = shuffleSeeded(outros, seed)

  // Montar grupos
  const grupos: { letra: string; participantes: number[] }[] = []
  let cursor = 0
  for (let g = 0; g < numGrupos; g++) {
    const tam = shuffledSizes[g]
    const grupoParticipantes: number[] = []
    // 1ª posição: cabeça (se existir) ou primeiro do shuffle
    if (g < cabecas.length) {
      grupoParticipantes.push(cabecas[g])
    } else {
      grupoParticipantes.push(outrosShuffled[cursor++])
    }
    // Demais (tam - 1 vagas)
    for (let j = 1; j < tam; j++) {
      grupoParticipantes.push(outrosShuffled[cursor++])
    }
    grupos.push({
      letra: String.fromCharCode(65 + g),
      participantes: grupoParticipantes,
    })
  }

  return {
    regra_id: regra.id,
    classificados_por_grupo: regra.numero_classificados,
    grupos,
  }
}
```

- [ ] **Step 4: Run tests — 5 pass (2 existentes + 3 novos)**

```
npx vitest run src/modules/sorteios/engine.test.ts -t drawGroups
```

Esperado: 5 testes do describe `drawGroups` passam.

- [ ] **Step 5: Commit**

```
git add backend/src/modules/sorteios/engine.ts backend/src/modules/sorteios/engine.test.ts
git commit -m "feat(sorteios): drawGroups coloca campeoes na 1a vaga por grupo (1 por grupo, ate qtd grupos)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Engine — drawBracket com regra + campeões (TDD breaking)

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\sorteios\engine.ts`
- Modify: `backend/src/modules/sorteios/engine.test.ts`

**Atenção:** `drawBracket` muda assinatura (recebe `regra` obrigatório) e mudança breaking no shape (`size = N` em vez de `nextPow2(N)`). Os 3 testes existentes do drawBracket precisam ser substituídos.

- [ ] **Step 1: Substituir o bloco `describe('drawBracket', ...)` inteiro**

Localizar o `describe('drawBracket', () => { ... })`. Substituir o bloco INTEIRO (incluindo seus 3 testes existentes) por:

```ts
describe('drawBracket', () => {
  it('sem campeoes + regra qualquer + 5 inscritos → size=5, todos pids presentes, sem nulls', () => {
    const regra = { posicao_primeiro_cabeca: 1, posicao_segundo_cabeca: 5, posicao_terceiro_cabeca: 4, posicao_quarto_cabeca: 3 }
    const out = drawBracket([1,2,3,4,5], regra, 'seed-b')
    expect(out.size).toBe(5)
    expect(out.slots).toHaveLength(5)
    expect(out.slots.filter(s => s === null)).toHaveLength(0)
    const pids = out.slots.filter((s): s is number => s !== null).sort()
    expect(pids).toEqual([1,2,3,4,5])
  })

  it('4 campeoes + 4 outros + regra (1,8,5,4) → slots[0,7,4,3] = campeoes em ordem; outros nos demais', () => {
    const regra = { posicao_primeiro_cabeca: 1, posicao_segundo_cabeca: 8, posicao_terceiro_cabeca: 5, posicao_quarto_cabeca: 4 }
    const out = drawBracket([1,2,3,4,5,6,7,8], regra, 'seed-b4', [10, 20, 30, 40])
    // Campeões NÃO estão nos participantes 1..8 — esta entrada é só pra teste; vamos verificar com campeões 1-4
  })

  it('4 campeoes inscritos + regra (1,8,5,4): slots fixos preenchidos, outros shuffled nas vagas', () => {
    const regra = { posicao_primeiro_cabeca: 1, posicao_segundo_cabeca: 8, posicao_terceiro_cabeca: 5, posicao_quarto_cabeca: 4 }
    // Inscritos 1..8 (todos cabem); campeões 1,2,3,4 são os mesmos dos primeiros 4 inscritos
    const out = drawBracket([1,2,3,4,5,6,7,8], regra, 'seed-b4b', [1, 2, 3, 4])
    expect(out.size).toBe(8)
    expect(out.slots[0]).toBe(1)  // posicao_primeiro_cabeca = 1 (1-based) → slots[0]
    expect(out.slots[7]).toBe(2)  // posicao_segundo_cabeca = 8 → slots[7]
    expect(out.slots[4]).toBe(3)  // posicao_terceiro_cabeca = 5 → slots[4]
    expect(out.slots[3]).toBe(4)  // posicao_quarto_cabeca = 4 → slots[3]
    // Outros 5,6,7,8 nos slots restantes (1, 2, 5, 6)
    const outrosSlots = [out.slots[1], out.slots[2], out.slots[5], out.slots[6]].sort((a,b) => (a as number) - (b as number))
    expect(outrosSlots).toEqual([5, 6, 7, 8])
  })

  it('2 campeoes + regra com terceira_cabeca=0 → só 2 cabeças usadas', () => {
    const regra = { posicao_primeiro_cabeca: 1, posicao_segundo_cabeca: 4, posicao_terceiro_cabeca: 0, posicao_quarto_cabeca: 0 }
    const out = drawBracket([1,2,3,4], regra, 'seed-b2', [1, 2])
    expect(out.size).toBe(4)
    expect(out.slots[0]).toBe(1)
    expect(out.slots[3]).toBe(2)
    // Outros 3 e 4 nos slots 1 e 2 (ordem aleatória)
    const outrosSlots = [out.slots[1], out.slots[2]].sort((a,b) => (a as number) - (b as number))
    expect(outrosSlots).toEqual([3, 4])
  })

  it('sem campeoes + regra (1,N) → todos no shuffle, slots[0] e slots[N-1] vazios também sorteados', () => {
    const regra = { posicao_primeiro_cabeca: 1, posicao_segundo_cabeca: 4, posicao_terceiro_cabeca: 3, posicao_quarto_cabeca: 2 }
    const a = drawBracket([1,2,3,4], regra, 'seed-b-equal')
    const b = drawBracket([1,2,3,4], regra, 'seed-b-equal', [])
    expect(a).toEqual(b)
    expect(a.size).toBe(4)
    const pids = a.slots.filter((s): s is number => s !== null).sort()
    expect(pids).toEqual([1,2,3,4])
  })
})
```

Nota: o teste 2 (4 cabeças + outros) ficou incompleto no draft acima (deixei comentário). Removê-lo — fica só o de 4 campeões inscritos (teste 3). Substituir o conteúdo final do `describe` por exatamente os 4 testes válidos abaixo:

```ts
describe('drawBracket', () => {
  it('sem campeoes + regra qualquer + 5 inscritos → size=5, todos pids presentes, sem nulls', () => {
    const regra = { posicao_primeiro_cabeca: 1, posicao_segundo_cabeca: 5, posicao_terceiro_cabeca: 4, posicao_quarto_cabeca: 3 }
    const out = drawBracket([1,2,3,4,5], regra, 'seed-b')
    expect(out.size).toBe(5)
    expect(out.slots).toHaveLength(5)
    expect(out.slots.filter(s => s === null)).toHaveLength(0)
    const pids = out.slots.filter((s): s is number => s !== null).sort()
    expect(pids).toEqual([1,2,3,4,5])
  })

  it('4 campeoes inscritos + regra (1,8,5,4): slots fixos preenchidos, outros shuffled', () => {
    const regra = { posicao_primeiro_cabeca: 1, posicao_segundo_cabeca: 8, posicao_terceiro_cabeca: 5, posicao_quarto_cabeca: 4 }
    const out = drawBracket([1,2,3,4,5,6,7,8], regra, 'seed-b4b', [1, 2, 3, 4])
    expect(out.size).toBe(8)
    expect(out.slots[0]).toBe(1)
    expect(out.slots[7]).toBe(2)
    expect(out.slots[4]).toBe(3)
    expect(out.slots[3]).toBe(4)
    const outrosSlots = [out.slots[1], out.slots[2], out.slots[5], out.slots[6]].sort((a, b) => (a as number) - (b as number))
    expect(outrosSlots).toEqual([5, 6, 7, 8])
  })

  it('2 campeoes + regra com terceira_cabeca=0 → só 2 cabeças usadas', () => {
    const regra = { posicao_primeiro_cabeca: 1, posicao_segundo_cabeca: 4, posicao_terceiro_cabeca: 0, posicao_quarto_cabeca: 0 }
    const out = drawBracket([1,2,3,4], regra, 'seed-b2', [1, 2])
    expect(out.size).toBe(4)
    expect(out.slots[0]).toBe(1)
    expect(out.slots[3]).toBe(2)
    const outrosSlots = [out.slots[1], out.slots[2]].sort((a, b) => (a as number) - (b as number))
    expect(outrosSlots).toEqual([3, 4])
  })

  it('sem campeoes (default) → todos no shuffle, regras ignoradas para fixação', () => {
    const regra = { posicao_primeiro_cabeca: 1, posicao_segundo_cabeca: 4, posicao_terceiro_cabeca: 3, posicao_quarto_cabeca: 2 }
    const a = drawBracket([1,2,3,4], regra, 'seed-b-equal')
    const b = drawBracket([1,2,3,4], regra, 'seed-b-equal', [])
    expect(a).toEqual(b)
    expect(a.size).toBe(4)
    const pids = a.slots.filter((s): s is number => s !== null).sort()
    expect(pids).toEqual([1,2,3,4])
  })
})
```

- [ ] **Step 2: Run test — FAIL**

De `backend/`:
```
npx vitest run src/modules/sorteios/engine.test.ts -t drawBracket
```

Esperado: FAIL (drawBracket atual não aceita `regra` obrigatório com essa shape).

- [ ] **Step 3: Atualizar `drawBracket` em `engine.ts`**

Substituir a função `drawBracket` e o type `BracketResultado` por:

```ts
export type BracketResultado = {
  size: number
  slots: (number | null)[]
}

type RegraChaves = {
  posicao_primeiro_cabeca: number
  posicao_segundo_cabeca: number
  posicao_terceiro_cabeca: number
  posicao_quarto_cabeca: number
}

export function drawBracket(
  participantes: readonly number[],
  regra: RegraChaves,
  seed: string,
  campeoesPids: readonly number[] = [],
): BracketResultado {
  const n = participantes.length
  const slots: (number | null)[] = new Array(n).fill(null)

  // Mapear cabeças nas posições da regra (até 4)
  const posicoes = [
    regra.posicao_primeiro_cabeca,
    regra.posicao_segundo_cabeca,
    regra.posicao_terceiro_cabeca,
    regra.posicao_quarto_cabeca,
  ]
  for (let i = 0; i < 4; i++) {
    const pos = posicoes[i]
    const pid = campeoesPids[i]
    if (pos === 0 || pid === undefined) continue
    // pos é 1-based no banco
    if (pos < 1 || pos > n) continue
    slots[pos - 1] = pid
  }

  // Outros = participantes que NÃO foram colocados como cabeça
  const colocadosSet = new Set<number>(slots.filter((s): s is number => s !== null))
  const outros = participantes.filter(pid => !colocadosSet.has(pid))
  const outrosShuffled = shuffleSeeded(outros, seed)

  // Preencher slots vazios em ordem
  let cursor = 0
  for (let j = 0; j < n; j++) {
    if (slots[j] === null) {
      slots[j] = outrosShuffled[cursor++]
    }
  }

  return { size: n, slots }
}
```

Também exportar o tipo se houver export pattern:

```ts
export type { RegraChaves }
```

(Adicionar essa linha logo após a declaração do `type RegraChaves`.)

- [ ] **Step 4: Run tests — pass**

```
npx vitest run src/modules/sorteios/engine.test.ts
```

Esperado: todos passam (shuffleSeeded + drawGroups + 4 drawBracket + shuffleOrder).

- [ ] **Step 5: Commit**

```
git add backend/src/modules/sorteios/engine.ts backend/src/modules/sorteios/engine.test.ts
git commit -m "feat(sorteios): drawBracket usa regra de cabecas + campeoes; size literal N (sem byes)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Service — carregar campeões + regra chaves + dispatch (TDD)

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\backend\src\modules\sorteios\sorteios.service.ts`
- Modify: `backend/src/modules/sorteios/sorteios.service.test.ts`

- [ ] **Step 1: Atualizar `vi.mock` no top do test file**

Localizar o bloco `vi.mock('../../lib/prisma', ...)` no topo de `sorteios.service.test.ts`. Substituir o bloco INTEIRO por:

```ts
vi.mock('../../lib/prisma', () => ({
  default: {
    sorteio: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
    evento: {
      findUnique: vi.fn(),
    },
    modalidade: {
      findUnique: vi.fn(),
    },
    inscricao: {
      findMany: vi.fn(),
    },
    sistemaDisputasGrupos: {
      findFirst: vi.fn(),
    },
    sistemaDisputasChaves: {
      findFirst: vi.fn(),
    },
    campeaoAnterior: {
      findMany: vi.fn(),
    },
  },
}))
```

- [ ] **Step 2: Atualizar o teste existente `executar (chaves) faz upsert com bracket`**

Localizar o teste em `sorteios.service.test.ts`. Substituir o bloco INTEIRO desse `it()` por:

```ts
  it('executar (chaves) faz upsert com bracket usando regra', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 1, tipo_modalidade: { tipo: 'chaves' } })
    mockPrisma.inscricao.findMany.mockResolvedValue([
      { participante_id: 1 }, { participante_id: 2 }, { participante_id: 3 }, { participante_id: 4 }, { participante_id: 5 },
    ])
    mockPrisma.sistemaDisputasChaves.findFirst.mockResolvedValue({
      id: 4, numero_inscrito: 5, posicao_primeiro_cabeca: 1, posicao_segundo_cabeca: 5, posicao_terceiro_cabeca: 4, posicao_quarto_cabeca: 3,
    })
    mockPrisma.campeaoAnterior.findMany.mockResolvedValue([])
    mockPrisma.sorteio.upsert.mockImplementation(async (args: any) => ({ id: 1, ...args.create }))
    await service.executar({ evento_id: 1, modalidade_id: 2 })
    const call = mockPrisma.sorteio.upsert.mock.calls[0][0]
    expect(call.create.tipo).toBe('chaves')
    expect(call.create.resultado.size).toBe(5)
    expect(call.create.resultado.slots).toHaveLength(5)
  })
```

- [ ] **Step 3: Adicionar 3 novos testes ao describe `sorteios.service`**

Antes do `})` que fecha o `describe('sorteios.service', ...)`, adicionar:

```ts
  it('executar (chaves) lança 400 amigável se sem regra na tabela sistema_disputas_chaves', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 1, tipo_modalidade: { tipo: 'chaves' } })
    mockPrisma.inscricao.findMany.mockResolvedValue([
      { participante_id: 1 }, { participante_id: 2 },
    ])
    mockPrisma.sistemaDisputasChaves.findFirst.mockResolvedValue(null)
    mockPrisma.campeaoAnterior.findMany.mockResolvedValue([])
    await expect(service.executar({ evento_id: 1, modalidade_id: 2 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('chaveamento') })
  })

  it('executar (grupos) com campeoes inscritos passa pids ordenados ao engine', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 1, tipo_modalidade: { tipo: 'grupos' } })
    mockPrisma.inscricao.findMany.mockResolvedValue([
      { participante_id: 11 }, { participante_id: 12 }, { participante_id: 13 },
      { participante_id: 14 }, { participante_id: 15 }, { participante_id: 16 },
    ])
    mockPrisma.sistemaDisputasGrupos.findFirst.mockResolvedValue({
      id: 100, quantidade_grupos: 2, grupos_3_componentes: 2, grupos_4_componentes: 0, numero_classificados: 2,
    })
    // Campeão posição 1 = pid 11 (inscrito); posição 2 = pid 99 (NÃO inscrito); posição 3 = pid 13 (inscrito)
    mockPrisma.campeaoAnterior.findMany.mockResolvedValue([
      { participante_id: 11, posicao: 1 },
      { participante_id: 99, posicao: 2 },
      { participante_id: 13, posicao: 3 },
    ])
    mockPrisma.sorteio.upsert.mockImplementation(async (args: any) => ({ id: 1, ...args.create }))
    await service.executar({ evento_id: 1, modalidade_id: 2 })
    const call = mockPrisma.sorteio.upsert.mock.calls[0][0]
    // grupo A deve ter pid 11 na 1ª pos (campeão 1º)
    expect(call.create.resultado.grupos[0].participantes[0]).toBe(11)
    // grupo B deve ter pid 13 na 1ª pos (campeão 3º, pois 2º não está inscrito)
    expect(call.create.resultado.grupos[1].participantes[0]).toBe(13)
  })

  it('executar (chaves) com campeoes inscritos passa pids ao engine.drawBracket', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 1, tipo_modalidade: { tipo: 'chaves' } })
    mockPrisma.inscricao.findMany.mockResolvedValue([
      { participante_id: 1 }, { participante_id: 2 }, { participante_id: 3 }, { participante_id: 4 }, { participante_id: 5 },
    ])
    mockPrisma.sistemaDisputasChaves.findFirst.mockResolvedValue({
      id: 4, numero_inscrito: 5, posicao_primeiro_cabeca: 1, posicao_segundo_cabeca: 5, posicao_terceiro_cabeca: 4, posicao_quarto_cabeca: 3,
    })
    mockPrisma.campeaoAnterior.findMany.mockResolvedValue([
      { participante_id: 1, posicao: 1 },
      { participante_id: 2, posicao: 2 },
    ])
    mockPrisma.sorteio.upsert.mockImplementation(async (args: any) => ({ id: 1, ...args.create }))
    await service.executar({ evento_id: 1, modalidade_id: 2 })
    const call = mockPrisma.sorteio.upsert.mock.calls[0][0]
    // slot 0 (posicao_primeiro_cabeca=1) deve ser pid 1
    expect(call.create.resultado.slots[0]).toBe(1)
    // slot 4 (posicao_segundo_cabeca=5) deve ser pid 2
    expect(call.create.resultado.slots[4]).toBe(2)
  })
```

- [ ] **Step 4: Run test — vai falhar (service não passa campeoes nem regra)**

De `backend/`:
```
npx vitest run src/modules/sorteios/sorteios.service.test.ts
```

Esperado: alguns testes falham (os 3 novos + o atualizado de chaves).

- [ ] **Step 5: Atualizar `executar` em `sorteios.service.ts`**

Substituir a função `executar` inteira por:

```ts
export async function executar(input: { evento_id: number; modalidade_id: number }) {
  const [evento, modalidade] = await Promise.all([
    prisma.evento.findUnique({
      where: { id: input.evento_id },
      select: { id: true, competicao_id: true },
    }),
    prisma.modalidade.findUnique({
      where: { id: input.modalidade_id },
      select: {
        id: true,
        competicao_id: true,
        tipo_modalidade: { select: { tipo: true } },
      },
    }),
  ])
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })
  if (!modalidade) throw Object.assign(new Error('Modalidade não encontrada'), { status: 404 })
  if (evento.competicao_id !== modalidade.competicao_id) {
    throw Object.assign(
      new Error('A modalidade não pertence à competição deste evento.'),
      { status: 400 },
    )
  }

  const tipo = modalidade.tipo_modalidade.tipo

  if (tipo === 'especifico') {
    throw Object.assign(
      new Error("Modalidade do tipo 'específico' não possui sorteio automático."),
      { status: 400 },
    )
  }

  const inscricoes = await prisma.inscricao.findMany({
    where: { evento_id: input.evento_id, modalidade_id: input.modalidade_id },
    orderBy: { criado_em: 'asc' },
    select: { participante_id: true },
  })
  if (inscricoes.length === 0) {
    throw Object.assign(
      new Error('Nenhum participante inscrito nesta modalidade.'),
      { status: 400 },
    )
  }
  const pids = inscricoes.map(i => i.participante_id)
  const inscritosSet = new Set<number>(pids)

  // Campeões cadastrados ordenados por posição, filtrados pelos que estão inscritos
  let campeoesPidsInscritos: number[] = []
  if (tipo === 'grupos' || tipo === 'chaves') {
    const campeoes = await prisma.campeaoAnterior.findMany({
      where: { evento_id: input.evento_id, modalidade_id: input.modalidade_id },
      orderBy: { posicao: 'asc' },
      select: { participante_id: true },
    })
    campeoesPidsInscritos = campeoes
      .map(c => c.participante_id)
      .filter(pid => inscritosSet.has(pid))
  }

  const seed = novaSeed()
  let resultado: unknown

  if (tipo === 'grupos') {
    const regra = await prisma.sistemaDisputasGrupos.findFirst({
      where: { competicao_id: evento.competicao_id, quantidade_equipes: pids.length },
    })
    if (!regra) {
      throw Object.assign(
        new Error(
          `Não há regra de composição de grupos para ${pids.length} equipes nesta competição. Cadastre em Administração.`,
        ),
        { status: 400 },
      )
    }
    resultado = engine.drawGroups(pids, regra, seed, campeoesPidsInscritos)
  } else if (tipo === 'chaves') {
    const regra = await prisma.sistemaDisputasChaves.findFirst({
      where: { numero_inscrito: pids.length },
    })
    if (!regra) {
      throw Object.assign(
        new Error(
          `Não há regra de chaveamento para ${pids.length} inscritos. Cadastre em Administração.`,
        ),
        { status: 400 },
      )
    }
    resultado = engine.drawBracket(pids, regra, seed, campeoesPidsInscritos)
  } else if (tipo === 'ordem_entrada') {
    resultado = engine.shuffleOrder(pids, seed)
  } else {
    throw Object.assign(new Error(`Tipo desconhecido: ${tipo}`), { status: 500 })
  }

  return prisma.sorteio.upsert({
    where: {
      evento_id_modalidade_id: {
        evento_id: input.evento_id,
        modalidade_id: input.modalidade_id,
      },
    },
    create: {
      evento_id: input.evento_id,
      modalidade_id: input.modalidade_id,
      tipo,
      seed,
      resultado: resultado as any,
    },
    update: {
      tipo,
      seed,
      resultado: resultado as any,
    },
  })
}
```

- [ ] **Step 6: Run test — pass**

```
npx vitest run src/modules/sorteios/sorteios.service.test.ts
```

Esperado: todos passam (anteriores + o atualizado + 3 novos = ~15 testes).

- [ ] **Step 7: tsc + full suite**

```
npx tsc --noEmit && npx vitest run
```

Esperado: tsc clean; suíte completa verde.

- [ ] **Step 8: Commit**

```
git add backend/src/modules/sorteios/sorteios.service.ts backend/src/modules/sorteios/sorteios.service.test.ts
git commit -m "feat(sorteios): service carrega campeoes inscritos + regra chaves; passa ao engine" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Frontend — type `CongressoStep` + Shell com 5 passos

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\types\congresso-step.ts`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\congresso\CongressoShell.tsx`

- [ ] **Step 1: Atualizar `congresso-step.ts`**

Substituir o arquivo inteiro por:

```ts
export type CongressoStep = 'evento' | 'modalidade' | 'participantes' | 'campeoes' | 'sorteio'
```

- [ ] **Step 2: Atualizar `CongressoShell.tsx` — STEP_LABELS, STEP_INDEX, "Passo X de 5"**

Localizar:

```tsx
const STEP_LABELS: Record<CongressoStep, string> = {
  evento: 'Selecione o Evento',
  modalidade: 'Selecione a Modalidade',
  participantes: 'Participantes Confirmados',
  sorteio: 'Sorteio',
}

const STEP_INDEX: Record<CongressoStep, number> = {
  evento: 1,
  modalidade: 2,
  participantes: 3,
  sorteio: 4,
}
```

Substituir por:

```tsx
const STEP_LABELS: Record<CongressoStep, string> = {
  evento: 'Selecione o Evento',
  modalidade: 'Selecione a Modalidade',
  participantes: 'Participantes Confirmados',
  campeoes: 'Campeões do Ano Anterior',
  sorteio: 'Sorteio',
}

const STEP_INDEX: Record<CongressoStep, number> = {
  evento: 1,
  modalidade: 2,
  participantes: 3,
  campeoes: 4,
  sorteio: 5,
}
```

Localizar o texto do indicador no header:

```tsx
        <div style={{ flex: 1, textAlign: 'center', color: SHELL_DIM, fontSize: 14 }}>
          Passo {STEP_INDEX[step]} de 4 · {STEP_LABELS[step]}
        </div>
```

Substituir por:

```tsx
        <div style={{ flex: 1, textAlign: 'center', color: SHELL_DIM, fontSize: 14 }}>
          Passo {STEP_INDEX[step]} de 5 · {STEP_LABELS[step]}
        </div>
```

- [ ] **Step 3: tsc**

De `frontend/`:
```
npx tsc --noEmit
```

Esperado: clean (a página `ModoCongresso` ainda não trata o step `'campeoes'`, mas TS não bloqueia — switch case ausente apenas não renderiza nada nesse step até atualizar).

- [ ] **Step 4: Commit**

```
git add frontend/src/types/congresso-step.ts frontend/src/pages/congresso/CongressoShell.tsx
git commit -m "feat(congresso): expand wizard to 5 steps (add 'campeoes' between Participantes and Sorteio)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Frontend — `CongressoStepCampeoes`

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\congresso\CongressoStepCampeoes.tsx`

- [ ] **Step 1: Criar o componente**

Conteúdo exato:

```tsx
import { useQuery } from '@tanstack/react-query'
import { campeoesAnterioresService } from '../../services/campeoes-anteriores'
import { inscricoesService } from '../../services/inscricoes'
import { modalidadesService } from '../../services/modalidades'
import CampeaoBadge from '../../components/CampeaoBadge'

type Props = {
  eventoId: number
  modalidadeId: number
  competicaoId: number | undefined
  onNext: () => void
}

const FG = '#f1f5fb'
const DIM = '#94a3b8'
const SUCCESS = '#14b88a'
const CARD_BG = 'rgba(255,255,255,.04)'
const CARD_BORDER = 'rgba(255,255,255,.1)'

export default function CongressoStepCampeoes({ eventoId, modalidadeId, competicaoId, onNext }: Props) {
  const { data: campeoes = [], isLoading } = useQuery({
    queryKey: ['campeoes-anteriores', eventoId, modalidadeId],
    queryFn: () => campeoesAnterioresService.listar({ evento_id: eventoId, modalidade_id: modalidadeId }),
  })

  const { data: inscricoes = [] } = useQuery({
    queryKey: ['inscricoes', eventoId, modalidadeId],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId, modalidade_id: modalidadeId }),
  })

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades', competicaoId],
    queryFn: () => modalidadesService.listar({ competicao_id: competicaoId! }),
    enabled: !!competicaoId,
  })

  const modalidade = modalidades.find(m => m.id === modalidadeId)
  const inscritosSet = new Set(inscricoes.map(i => i.participante_id))
  const ordenados = [...campeoes].sort((a, b) => a.posicao - b.posicao)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {modalidade && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, color: DIM, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Modalidade
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: FG, marginTop: 4 }}>
            {modalidade.nome} ({modalidade.sigla})
          </h2>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, marginBottom: 16 }}>
        {isLoading ? (
          <p style={{ color: DIM, fontSize: 18 }}>Carregando campeões...</p>
        ) : ordenados.length === 0 ? (
          <p style={{ color: DIM, fontSize: 18 }}>Nenhum campeão cadastrado para esta modalidade.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ordenados.map(c => {
              const inscrito = inscritosSet.has(c.participante_id)
              return (
                <li
                  key={c.id}
                  style={{
                    background: CARD_BG,
                    border: `1px solid ${CARD_BORDER}`,
                    borderRadius: 12,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <CampeaoBadge posicao={c.posicao} large />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 22, color: FG, fontWeight: 600 }}>{c.participante.nome}</div>
                    {c.participante.subtitulo && (
                      <div style={{ fontSize: 14, color: DIM, marginTop: 4 }}>{c.participante.subtitulo}</div>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      padding: '6px 14px',
                      borderRadius: 999,
                      background: inscrito ? 'rgba(20, 184, 138, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                      color: inscrito ? SUCCESS : DIM,
                      border: `1px solid ${inscrito ? SUCCESS : DIM}`,
                    }}
                  >
                    {inscrito ? '✓ Inscrito neste evento' : 'Não inscrito'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12 }}>
        <button
          onClick={onNext}
          style={{
            background: '#1061d8',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '12px 24px',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >Próximo →</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: tsc**

```
cd frontend && npx tsc --noEmit
```

Esperado: clean.

- [ ] **Step 3: Commit**

```
git add frontend/src/pages/congresso/CongressoStepCampeoes.tsx
git commit -m "feat(congresso): add CongressoStepCampeoes (lista grande com pill Inscrito/Nao inscrito)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Frontend — `ModoCongresso` state machine com novo step

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\pages\congresso\ModoCongresso.tsx`

- [ ] **Step 1: Substituir o arquivo inteiro**

```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import CongressoShell from './CongressoShell'
import CongressoStepEvento from './CongressoStepEvento'
import CongressoStepModalidade from './CongressoStepModalidade'
import CongressoStepParticipantes from './CongressoStepParticipantes'
import CongressoStepCampeoes from './CongressoStepCampeoes'
import CongressoStepSorteio from './CongressoStepSorteio'
import { eventosService } from '../../services/eventos'
import type { CongressoStep } from '../../types/congresso-step'

export default function ModoCongresso() {
  const [step, setStep] = useState<CongressoStep>('evento')
  const [eventoId, setEventoId] = useState<number | null>(null)
  const [modalidadeId, setModalidadeId] = useState<number | null>(null)

  const { data: evento } = useQuery({
    queryKey: ['eventos', eventoId],
    queryFn: () => eventosService.buscar(eventoId!),
    enabled: eventoId != null,
  })
  const competicaoId = evento?.competicao_id

  function handleBack() {
    if (step === 'sorteio') setStep('campeoes')
    else if (step === 'campeoes') setStep('participantes')
    else if (step === 'participantes') setStep('modalidade')
    else if (step === 'modalidade') { setStep('evento'); setEventoId(null) }
  }

  const onBack = step !== 'evento' ? handleBack : undefined

  return (
    <CongressoShell step={step} onBack={onBack}>
      {step === 'evento' && (
        <CongressoStepEvento
          onSelect={(id) => { setEventoId(id); setStep('modalidade') }}
        />
      )}
      {step === 'modalidade' && eventoId != null && (
        <CongressoStepModalidade
          eventoId={eventoId}
          onSelect={(id) => { setModalidadeId(id); setStep('participantes') }}
        />
      )}
      {step === 'participantes' && eventoId != null && modalidadeId != null && (
        <CongressoStepParticipantes
          eventoId={eventoId}
          modalidadeId={modalidadeId}
          competicaoId={competicaoId}
          onNext={() => setStep('campeoes')}
        />
      )}
      {step === 'campeoes' && eventoId != null && modalidadeId != null && (
        <CongressoStepCampeoes
          eventoId={eventoId}
          modalidadeId={modalidadeId}
          competicaoId={competicaoId}
          onNext={() => setStep('sorteio')}
        />
      )}
      {step === 'sorteio' && eventoId != null && modalidadeId != null && (
        <CongressoStepSorteio
          eventoId={eventoId}
          modalidadeId={modalidadeId}
          competicaoId={competicaoId}
          onProxima={() => { setModalidadeId(null); setStep('modalidade') }}
        />
      )}
    </CongressoShell>
  )
}
```

- [ ] **Step 2: tsc + build**

De `frontend/`:
```
npx tsc --noEmit && npm run build
```

Esperado: tsc clean, vite build OK.

- [ ] **Step 3: Commit**

```
git add frontend/src/pages/congresso/ModoCongresso.tsx
git commit -m "feat(congresso): wire 5-step state machine (Participantes → Campeoes → Sorteio)" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Bump versão + CHANGELOG

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\package.json`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\CHANGELOG.md`

- [ ] **Step 1: Bump version**

Editar `package.json` (root). Mudar **somente** `"version": "1.15.1"` para `"version": "1.16.0"`.

- [ ] **Step 2: Adicionar bloco no `CHANGELOG.md`**

Inserir o bloco abaixo logo após o cabeçalho e **antes** do bloco `## [1.15.1]`:

```md
## [1.16.0] - 2026-05-30

### Added
- Tabela `sistema_disputas_chaves` agora gerenciada pelo Prisma (adotada via migration idempotente).
- Motor de sorteio: campeões inscritos viram sementes —
  - `grupos`: 1 campeão por grupo (até qtd grupos) na 1ª vaga; demais e excedentes vão pro sorteio normal.
  - `chaves`: até 4 campeões viram cabeças nas posições definidas em `sistema_disputas_chaves`; demais sorteados nos slots restantes.
- Novo 4º passo "Campeões do Ano Anterior" no Modo Congresso, entre Participantes e Sorteio. Lista grande com pill verde "✓ Inscrito" ou cinza "Não inscrito".

### Changed
- `drawBracket`: agora usa `size = N` literal (não mais próxima potência de 2). Sem BYEs.
- `chaves` exige regra cadastrada em `sistema_disputas_chaves` para o N de inscritos (400 amigável quando ausente).
- Modo Congresso: wizard cresceu de 4 para 5 passos.

### Notes
- Sorteios antigos persistidos em formato `size = pot 2 com nulls` continuam renderizando corretamente. Novos sorteios usam `size = N`.
- Operador re-sorteia para aplicar a nova regra de cabeças/sementes.
```

- [ ] **Step 3: Commit**

```
git add package.json CHANGELOG.md
git commit -m "chore(release): v1.16.0 — campeoes como sementes + Congresso 5 passos" -m "" -m "Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Push + smoke (pós-deploy CI)

**Files:** (sem edição — verificação)

- [ ] **Step 1: Push**

```
git push origin develop
```

CI roda `prisma migrate deploy`. A migration `_restore_sistema_disputas_chaves` usa `CREATE TABLE IF NOT EXISTS`, então não conflita com a tabela já existente no dev. Em prod (fresh), cria do zero — operador precisa popular dados via SQL ou CRUD futuro. ~4-5min.

- [ ] **Step 2: Verificar deploy**

```
curl -s -o /dev/null -w "/health: %{http_code}\n" http://192.168.56.113:3000/health
curl -s -o /dev/null -w "frontend: %{http_code}\n" http://192.168.56.113:8080/
```

Esperado: ambos 200.

Verificar migration registrada:
```
ssh wagner@192.168.56.113 'docker exec prosports-backend-1 sh -c "cd /app && node -e \"const{PrismaClient}=require(\\\"@prisma/client\\\");const p=new PrismaClient();p.\\\$queryRawUnsafe(\\\"SELECT migration_name FROM _prisma_migrations WHERE migration_name LIKE %sistema_disputas_chaves% ORDER BY started_at\\\").then(r=>{console.log(r);process.exit(0)})\""'
```

Esperado: a migration `20260530220000_restore_sistema_disputas_chaves` está registrada.

- [ ] **Step 3: Smoke no browser**

Abrir http://192.168.56.113:8080, login `admin@prosports.com` / `admin123`:

1. Setup: criar (ou usar) evento com tipo `chaves`. Inscrever 5 participantes. Cadastrar 2 deles como campeões (posições 1 e 2).
2. /eventos/:id/inscricoes → Realizar sorteio → resultado:
   - slots[0] = campeão posição 1
   - slots[4] = campeão posição 2 (regra N=5 tem posicao_segundo_cabeca=5)
   - outros 3 nos slots 1,2,3 (ordem aleatória)
   - size = 5 (sem BYE)
3. Modalidade `grupos` com 6 inscritos (2 campeões posicao 1 e 2) e regra cadastrada (2 grupos de 3):
   - sortear → campeão 1º na 1ª vaga do Grupo A; campeão 2º na 1ª vaga do Grupo B
   - 4 outros distribuídos nas vagas restantes
4. Modalidade `chaves` com N não-cadastrado em `sistema_disputas_chaves` (ex: 100 inscritos) → 400 "Não há regra de chaveamento para 100 inscritos..."
5. Modo Congresso → wizard com indicador "Passo X de 5".
6. Passo 4 = "Campeões do Ano Anterior" mostra lista grande dos campeões cadastrados com pill verde/cinza.
7. Avançar para passo 5 (Sorteio) — render usa nova lógica.
8. Rodapé sidebar: `v1.16.0`.

- [ ] **Step 4: Reportar**

Se passou, feature fechada.

---

## Self-review

Cobertura do spec:

| Spec | Coberto por |
|---|---|
| Prisma model `SistemaDisputasChaves` + @@map | Task 1 |
| Migration idempotente `CREATE TABLE IF NOT EXISTS` | Task 1 |
| `drawGroups` com `campeoesPids` (1 por grupo, até numGrupos, demais no shuffle) | Task 2 |
| `drawBracket` com regra + `campeoesPids` + size=N literal | Task 3 |
| Service carrega campeões (ordenados, filtrados por inscritos) + regra chaves | Task 4 |
| Service 400 amigável para chaves sem regra | Task 4 |
| Tipo `CongressoStep` ganha `'campeoes'` | Task 5 |
| Shell mostra "Passo X de 5" + labels | Task 5 |
| Página `CongressoStepCampeoes` com pill Inscrito/Não inscrito | Task 6 |
| `ModoCongresso` state machine 5 passos com handleBack atualizado | Task 7 |
| Bump 1.16.0 + CHANGELOG | Task 8 |
| Smoke pós-deploy | Task 9 |

Riscos endereçados:
- **`sistema_disputas_chaves` em prod fresh**: cria vazia, operador popula (igual ao sistema_disputas_grupos no início do projeto). Documentado.
- **Sorteios antigos com size=pot2 + nulls**: renderer continua funcionando, novos sorteios usam size=N. Documentado no CHANGELOG.
- **Tipos: `regra` opcional no drawBracket?**: NÃO. Tornei obrigatório porque service sempre passa. Se houver consumidor externo (não há hoje), TS força.
- **Test do drawBracket existente "1 participante → size 1"**: removido junto com os outros 2 — o novo set cobre os mesmos casos básicos (size=N + sem nulls).
- **`shuffleSeeded` para grupos+chaves usa mesma seed**: drawGroups usa `seed:sizes` + `seed`; drawBracket usa só `seed`. Sub-seeds independentes não geram correlação.
