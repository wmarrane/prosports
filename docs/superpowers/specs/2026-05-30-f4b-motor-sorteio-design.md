# F4b — Motor de Sorteio + Persistência — Design

**Data:** 2026-05-30
**Status:** Aprovado para implementação
**Versão alvo:** 1.9.0
**Sub-projeto pai:** F4 Workspace (decomposto em F4a Inscrições → **F4b Motor + persistência** → F4c Workspace UI)

## Objetivo

Implementar o motor de sorteio (funções puras determinísticas com semente) e a entidade `Sorteio` que persiste o resultado por (evento, modalidade). F4b é **backend-only** — a UI consumidora vem em F4c.

## Escopo

- **In:**
  - Entidade `Sorteio` (uma linha por evento×modalidade, unique).
  - Engine puro em `backend/src/modules/sorteios/engine.ts` com 3 algoritmos: `drawGroups`, `drawBracket`, `shuffleOrder`. Todos determinísticos via PRNG `mulberry32` semeada.
  - Service `executar`/`listar`/`buscarPorId`/`remover` + controller Zod + routes.
  - Lookup em `sistema_disputas_grupos` para tipo `grupos`.
  - Testes vitest cobrindo determinismo, branches por tipo, validações.
- **Out:**
  - UI (toda em F4c).
  - Regras extras: cabeças de chave, separar clube, separar região, pódio. (Reservado para F4b2 ou F4c.)
  - Histórico de sorteios (re-sorteio sobrescreve).
  - Exportação PDF / publicação.

## Domínio

Cada Modalidade tem um `TipoDisputa` (via `TipoModalidade.tipo`). O motor seleciona o algoritmo conforme o tipo:

| TipoDisputa | Algoritmo | Resultado JSON |
|---|---|---|
| `grupos` | Lookup `sistema_disputas_grupos` por (competicao_id, quantidade_equipes = N inscritos); aplica composição (X grupos de 3 + Y de 4); shuffle + distribuição round-robin nos grupos. | `{ regra_id, classificados_por_grupo, grupos: [{ letra, participantes:[pid,...] }] }` |
| `chaves` | Pad a próxima potência de 2 com `null` (byes); shuffle; preenche slots em ordem. | `{ size, slots: [pid \| null, ...] }` |
| `ordem_entrada` | Shuffle puro (Fisher–Yates). | `{ ordem: [pid, ...] }` |
| `especifico` | Sem sorteio — service retorna 400. | n/a |

Regras de negócio:
- 0 inscritos → 400.
- Tipo `especifico` → 400 ("Modalidade do tipo 'específico' não possui sorteio automático").
- Tipo `grupos` sem regra na tabela para o N atual → 400 amigável.
- Re-sorteio = `upsert`. Sobrescreve sem histórico. Nova seed gerada server-side.

## Modelagem

### Prisma schema

Adicionar back-refs em `Evento` e `Modalidade`:

```prisma
model Evento {
  // ... campos existentes ...
  sorteios        Sorteio[]
}

model Modalidade {
  // ... campos existentes ...
  sorteios            Sorteio[]
}
```

Adicionar o modelo `Sorteio` (após `Inscricao`):

```prisma
model Sorteio {
  id              Int          @id @default(autoincrement())
  evento          Evento       @relation(fields: [evento_id], references: [id], onDelete: Cascade)
  evento_id       Int
  modalidade      Modalidade   @relation(fields: [modalidade_id], references: [id])
  modalidade_id   Int
  tipo            TipoDisputa
  seed            String
  resultado       Json
  gerado_em       DateTime     @default(now())
  atualizado_em   DateTime     @updatedAt

  @@unique([evento_id, modalidade_id])
  @@index([evento_id])
}
```

- `tipo` é snapshot do `TipoDisputa` em vigor no momento do sorteio (preserva auditoria mesmo se o TipoModalidade for trocado depois).
- `resultado` é `Json` (Postgres `jsonb`).
- Cascade no Evento; Modalidade mantém RESTRICT (consistente com Inscricao).

### Migration

Manual (sem `prisma migrate diff`):

```sql
-- Add Sorteio table.

CREATE TABLE "Sorteio" (
  "id" SERIAL PRIMARY KEY,
  "evento_id" INTEGER NOT NULL,
  "modalidade_id" INTEGER NOT NULL,
  "tipo" "TipoDisputa" NOT NULL,
  "seed" TEXT NOT NULL,
  "resultado" JSONB NOT NULL,
  "gerado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Sorteio_evento_id_fkey"
    FOREIGN KEY ("evento_id") REFERENCES "Evento"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Sorteio_modalidade_id_fkey"
    FOREIGN KEY ("modalidade_id") REFERENCES "Modalidade"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Sorteio_evento_id_modalidade_id_key"
  ON "Sorteio"("evento_id","modalidade_id");

CREATE INDEX "Sorteio_evento_id_idx"
  ON "Sorteio"("evento_id");
```

## Backend

### Engine — `backend/src/modules/sorteios/engine.ts`

Funções puras. Sem acesso a Prisma. Sem efeitos colaterais.

```ts
// PRNG: mulberry32 (32-bit, period 2^32, deterministic, well-behaved)
function mulberry32(seed: number) {
  return function() {
    let t = (seed += 0x6D2B79F5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedToInt(seed: string): number {
  // FNV-1a 32-bit hash for stable string→int
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export function shuffleSeeded<T>(arr: readonly T[], seed: string): T[] {
  const rng = mulberry32(seedToInt(seed))
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

type RegraGrupos = {
  id: number
  quantidade_grupos: number
  grupos_3_componentes: number
  grupos_4_componentes: number
  numero_classificados: number
}

export type GruposResultado = {
  regra_id: number
  classificados_por_grupo: number
  grupos: { letra: string; participantes: number[] }[]
}

export function drawGroups(
  participantes: readonly number[],
  regra: RegraGrupos,
  seed: string,
): GruposResultado {
  // Distribuição: primeiros `grupos_3_componentes` grupos com 3 vagas,
  // depois `grupos_4_componentes` grupos com 4 vagas. Soma deve == participantes.length.
  const shuffled = shuffleSeeded(participantes, seed)
  const grupos: { letra: string; participantes: number[] }[] = []
  let i = 0
  const total = regra.grupos_3_componentes + regra.grupos_4_componentes
  for (let g = 0; g < total; g++) {
    const tam = g < regra.grupos_3_componentes ? 3 : 4
    grupos.push({
      letra: String.fromCharCode(65 + g),  // 'A','B','C'...
      participantes: shuffled.slice(i, i + tam),
    })
    i += tam
  }
  return {
    regra_id: regra.id,
    classificados_por_grupo: regra.numero_classificados,
    grupos,
  }
}

export type BracketResultado = {
  size: number
  slots: (number | null)[]
}

export function drawBracket(participantes: readonly number[], seed: string): BracketResultado {
  const n = participantes.length
  const size = n <= 1 ? 1 : 2 ** Math.ceil(Math.log2(n))
  const padded: (number | null)[] = [...participantes, ...Array(size - n).fill(null)]
  const shuffled = shuffleSeeded(padded, seed)
  return { size, slots: shuffled }
}

export type OrdemResultado = { ordem: number[] }

export function shuffleOrder(participantes: readonly number[], seed: string): OrdemResultado {
  return { ordem: shuffleSeeded(participantes, seed) }
}
```

### Service — `backend/src/modules/sorteios/sorteios.service.ts`

```ts
import { randomBytes } from 'crypto'
import prisma from '../../lib/prisma'
import * as engine from './engine'

const INCLUDE = {} as const  // não precisa de includes — resultado já contém pids

function novaSeed(): string {
  return randomBytes(8).toString('hex')  // 16 chars hex
}

export async function listar(filtros: { evento_id?: number; modalidade_id?: number }) {
  const where: { evento_id?: number; modalidade_id?: number } = {}
  if (filtros.evento_id !== undefined) where.evento_id = filtros.evento_id
  if (filtros.modalidade_id !== undefined) where.modalidade_id = filtros.modalidade_id
  return prisma.sorteio.findMany({ where, orderBy: { gerado_em: 'desc' } })
}

export async function buscarPorId(id: number) {
  const item = await prisma.sorteio.findUnique({ where: { id } })
  if (!item) throw Object.assign(new Error('Sorteio não encontrado'), { status: 404 })
  return item
}

export async function remover(id: number) {
  return prisma.sorteio.delete({ where: { id } })
}

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
    resultado = engine.drawGroups(pids, regra, seed)
  } else if (tipo === 'chaves') {
    resultado = engine.drawBracket(pids, seed)
  } else if (tipo === 'ordem_entrada') {
    resultado = engine.shuffleOrder(pids, seed)
  } else {
    // exhaustive — TS deve barrar antes de chegar aqui
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

### Controller (Zod) — `backend/src/modules/sorteios/sorteios.controller.ts`

```ts
const executarSchema = z.object({
  evento_id: z.coerce.number().int().positive(),
  modalidade_id: z.coerce.number().int().positive(),
})

const listQuerySchema = z.object({
  evento_id: z.coerce.number().int().positive().optional(),
  modalidade_id: z.coerce.number().int().positive().optional(),
})
```

Handlers: `listar`, `buscarPorId`, `executar`, `remover` — padrão do projeto.

### Rotas — `backend/src/modules/sorteios/sorteios.routes.ts`

- `GET /sorteios` (auth) — query `evento_id?`, `modalidade_id?`.
- `GET /sorteios/:id` (auth).
- `POST /sorteios/executar` (admin) — body `{evento_id, modalidade_id}`.
- `DELETE /sorteios/:id` (admin) — desfaz.

Registrar em `backend/src/index.ts` antes de `/inscricoes`.

### Testes vitest

**`engine.test.ts`** (funções puras, sem mock):
1. `shuffleSeeded: mesma seed → mesma saída`.
2. `shuffleSeeded: seeds diferentes → saídas diferentes (alta probabilidade)`.
3. `shuffleSeeded: não muta o array original`.
4. `drawGroups: 6 participantes + regra (2g, 2 de 3, 0 de 4) → 2 grupos com 3 ids cada, todos os ids presentes`.
5. `drawGroups: 7 participantes + regra (2g, 1 de 3, 1 de 4) → primeiro grupo tem 3, segundo tem 4, todos presentes`.
6. `drawBracket: 5 participantes → size 8, 3 byes (null), todos pids presentes`.
7. `drawBracket: 8 participantes → size 8, 0 byes`.
8. `drawBracket: 1 participante → size 1, slots = [pid]`.
9. `shuffleOrder: tamanho preservado, mesma seed → mesma ordem`.

**`sorteios.service.test.ts`** (mock de prisma):
10. `executar lança 404 se evento não existe`.
11. `executar lança 404 se modalidade não existe`.
12. `executar lança 400 se competições não batem`.
13. `executar lança 400 se tipo === especifico`.
14. `executar lança 400 se 0 inscritos`.
15. `executar (grupos) lança 400 amigável se sem regra na tabela`.
16. `executar (grupos) faz upsert com resultado correto quando regra existe`.
17. `executar (chaves) faz upsert com bracket`.
18. `executar (ordem_entrada) faz upsert com ordem`.
19. `listar com filtros passa where corretamente`.
20. `buscarPorId lança 404`.
21. `remover deleta direto`.

## Release

- `package.json`: `1.8.0` → `1.9.0` (MINOR).
- `CHANGELOG.md`: bloco `[1.9.0]` com `Added` (entidade Sorteio + endpoints + motor com 3 algoritmos).

## Smoke pós-deploy

Sem UI nesta sub-fase. Via curl com token admin:

1. Criar inscrições para uma modalidade de tipo `grupos` com N que tenha regra (ex: N=6, competicao_id=1).
2. `POST /sorteios/executar` body `{"evento_id":X,"modalidade_id":Y}` → 200 com `{ id, tipo:'grupos', seed, resultado: { grupos:[...] }}`.
3. Repetir o mesmo POST → 200 (upsert), mesma `id`, seed diferente, resultado pode ser diferente.
4. `POST /sorteios/executar` com N que NÃO tem regra → 400 com mensagem amigável.
5. `POST /sorteios/executar` com tipo `especifico` → 400.
6. `GET /sorteios?evento_id=X` → lista com o sorteio criado.
7. `DELETE /sorteios/:id` → 204.
8. `GET /sorteios/:id` → 404.

## Risco / efeitos colaterais

- **Re-sorteio destrói histórico:** documentado e aceito. F4b2 (futura) pode introduzir tabela de histórico.
- **Cascade no Evento:** apagar Evento limpa Sorteios em cascata.
- **Modalidade não pode ser apagada se houver Sorteio:** mesmo comportamento atual de Inscricao (RESTRICT). Sem guarda amigável — fica para iteração futura junto com a de Inscricao.
- **Tipo snapshot no Sorteio:** se TipoModalidade.tipo mudar depois, o sorteio existente preserva o tipo no momento da geração. Re-sorteio pega o tipo NOVO.
- **JSON shape:** front-end (F4c) deve usar discriminação por `sorteio.tipo` para parsear `resultado` (3 shapes diferentes). Os 3 shapes são exportados como tipos em `engine.ts` para reuso futuro.
