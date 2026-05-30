# Campeões do Ano Anterior — Design

**Data:** 2026-05-30
**Status:** Aprovado para implementação
**Versão alvo:** 1.15.0

## Objetivo

Registrar os 3 primeiros colocados do ano anterior por (evento, modalidade) e sinalizar visualmente, ao longo de todas as telas operacionais, quais desses campeões se reinscreveram no evento atual. A intenção é dar destaque ao histórico durante a apresentação ao vivo de sorteios e na operação geral.

## Escopo

- **In:**
  - Entidade `CampeaoAnterior` (Prisma) com FK para Evento, Modalidade e Participante.
  - 3 slots fixos por (evento, modalidade): 1º, 2º, 3º. Unique composto garante exclusividade por posição.
  - Backend padrão do projeto: service, controller (Zod), routes, tests vitest.
  - UI de cadastro: nova seção em `/eventos/:id/inscricoes` (modalidade selecionada).
  - Sinalização (🥇🥈🥉) em 3 lugares:
    1. Tabela de inscrições.
    2. Render do resultado de sorteio (`SorteioGrupos/Chaves/Ordem` ganham prop opcional).
    3. Modo Congresso herda automaticamente os 3 componentes.
- **Out:**
  - Campeões fora do pool global (FK obrigatório — sem nome livre).
  - Posições 4º+ (apenas pódio).
  - Histórico ano-a-ano consolidado.
  - Marcações tipo "tri-campeão", "bi-campeão" — apenas o ano anterior.
  - Edição direta de uma linha (substituir = DELETE + POST).

## Domínio

A entidade modela uma asserção: "no evento E, modalidade M, posição P do ano anterior foi o participante X". O sistema de match é exato — usa `participante_id`. Operador precisa cadastrar o Participante no pool global antes de poder marcá-lo como campeão.

Regras de negócio:
- Modalidade deve pertencer à mesma Competição do Evento (mesma validação cross-FK da Inscricao). 400 se não.
- Unique composto (evento, modalidade, posicao). Tentativa de duplicar posição → 409 "Já existe campeão para esta posição."
- Posição válida: 1, 2 ou 3 (Zod enum).
- Apagar Evento cascateia (apaga campeões anteriores junto). Modalidade e Participante são RESTRICT — não trata aqui (mesmo trade-off da Inscricao).

## Modelagem

### Prisma schema

Adicionar back-refs em Evento, Modalidade, Participante:

```prisma
model Evento {
  // ... campos existentes ...
  campeoes_anteriores  CampeaoAnterior[]
}

model Modalidade {
  // ... campos existentes ...
  campeoes_anteriores  CampeaoAnterior[]
}

model Participante {
  // ... campos existentes ...
  campeoes_anteriores  CampeaoAnterior[]
}
```

Adicionar o modelo:

```prisma
model CampeaoAnterior {
  id              Int           @id @default(autoincrement())
  evento          Evento        @relation(fields: [evento_id], references: [id], onDelete: Cascade)
  evento_id       Int
  modalidade      Modalidade    @relation(fields: [modalidade_id], references: [id])
  modalidade_id   Int
  participante    Participante  @relation(fields: [participante_id], references: [id])
  participante_id Int
  posicao         Int  // 1, 2 ou 3
  criado_em       DateTime      @default(now())
  atualizado_em   DateTime      @updatedAt

  @@unique([evento_id, modalidade_id, posicao])
  @@index([evento_id, modalidade_id])
}
```

### Migration (manual, segue lição F2)

```sql
CREATE TABLE "CampeaoAnterior" (
  "id" SERIAL PRIMARY KEY,
  "evento_id" INTEGER NOT NULL,
  "modalidade_id" INTEGER NOT NULL,
  "participante_id" INTEGER NOT NULL,
  "posicao" INTEGER NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampeaoAnterior_evento_id_fkey"
    FOREIGN KEY ("evento_id") REFERENCES "Evento"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CampeaoAnterior_modalidade_id_fkey"
    FOREIGN KEY ("modalidade_id") REFERENCES "Modalidade"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CampeaoAnterior_participante_id_fkey"
    FOREIGN KEY ("participante_id") REFERENCES "Participante"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CampeaoAnterior_evento_id_modalidade_id_posicao_key"
  ON "CampeaoAnterior"("evento_id", "modalidade_id", "posicao");

CREATE INDEX "CampeaoAnterior_evento_id_modalidade_id_idx"
  ON "CampeaoAnterior"("evento_id", "modalidade_id");
```

## Backend

### Service `backend/src/modules/campeoes_anteriores/campeoes_anteriores.service.ts`

```ts
import prisma from '../../lib/prisma'

const INCLUDE = { participante: true } as const

async function mapPrismaError<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn() }
  catch (err: any) {
    if (err?.code === 'P2002') {
      throw Object.assign(
        new Error('Já existe campeão cadastrado para esta posição.'),
        { status: 409 },
      )
    }
    throw err
  }
}

type Posicao = 1 | 2 | 3

type CreateInput = {
  evento_id: number
  modalidade_id: number
  participante_id: number
  posicao: Posicao
}

export async function listar(filtros: { evento_id?: number; modalidade_id?: number }) {
  const where: { evento_id?: number; modalidade_id?: number } = {}
  if (filtros.evento_id !== undefined) where.evento_id = filtros.evento_id
  if (filtros.modalidade_id !== undefined) where.modalidade_id = filtros.modalidade_id
  return prisma.campeaoAnterior.findMany({
    where,
    orderBy: [{ modalidade_id: 'asc' }, { posicao: 'asc' }],
    include: INCLUDE,
  })
}

export async function criar(data: CreateInput) {
  const [evento, modalidade] = await Promise.all([
    prisma.evento.findUnique({ where: { id: data.evento_id }, select: { competicao_id: true } }),
    prisma.modalidade.findUnique({ where: { id: data.modalidade_id }, select: { competicao_id: true } }),
  ])
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })
  if (!modalidade) throw Object.assign(new Error('Modalidade não encontrada'), { status: 404 })
  if (evento.competicao_id !== modalidade.competicao_id) {
    throw Object.assign(
      new Error('A modalidade não pertence à competição deste evento.'),
      { status: 400 },
    )
  }
  return mapPrismaError(() => prisma.campeaoAnterior.create({ data, include: INCLUDE }))
}

export async function remover(id: number) {
  return prisma.campeaoAnterior.delete({ where: { id } })
}
```

### Controller (Zod)

```ts
const createSchema = z.object({
  evento_id: z.coerce.number().int().positive(),
  modalidade_id: z.coerce.number().int().positive(),
  participante_id: z.coerce.number().int().positive(),
  posicao: z.coerce.number().int().min(1).max(3),
})

const listQuerySchema = z.object({
  evento_id: z.coerce.number().int().positive().optional(),
  modalidade_id: z.coerce.number().int().positive().optional(),
})
```

### Rotas

- `GET /campeoes-anteriores?evento_id&modalidade_id` (auth)
- `POST /campeoes-anteriores` (admin) → 201
- `DELETE /campeoes-anteriores/:id` (admin) → 204

Sem `GET /:id` (não precisa). Sem `PUT` (substituição = DELETE + POST).

Registrar em `backend/src/index.ts` antes de `/inscricoes`.

### Testes vitest (8 casos)

1. `listar com filtros passa where`
2. `criar lança 404 se evento não existe`
3. `criar lança 404 se modalidade não existe`
4. `criar lança 400 se competições não batem`
5. `criar chama prisma.create com data + include quando OK`
6. `criar mapeia P2002 para 409`
7. `remover deleta direto`
8. `listar sem filtros chama findMany com where vazio`

## Frontend

### Tipo

`frontend/src/types/campeao-anterior.ts`:

```ts
import type { Participante } from './participante'

export type CampeaoAnterior = {
  id: number
  evento_id: number
  modalidade_id: number
  participante_id: number
  participante: Participante
  posicao: 1 | 2 | 3
  criado_em: string
  atualizado_em: string
}
```

### Service

`frontend/src/services/campeoes-anteriores.ts`:

```ts
import api from './api'
import type { CampeaoAnterior } from '../types/campeao-anterior'

const BASE = '/campeoes-anteriores'

type CampeaoPayload = {
  evento_id: number
  modalidade_id: number
  participante_id: number
  posicao: 1 | 2 | 3
}

export const campeoesAnterioresService = {
  listar: (params?: { evento_id?: number; modalidade_id?: number }) =>
    api.get<CampeaoAnterior[]>(BASE, { params }).then(r => r.data),
  criar: (data: CampeaoPayload) => api.post<CampeaoAnterior>(BASE, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
```

### Componente `CampeaoBadge`

`frontend/src/components/CampeaoBadge.tsx`:

```tsx
const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' } as const
const LABELS = { 1: '1º colocado no ano anterior', 2: '2º colocado no ano anterior', 3: '3º colocado no ano anterior' } as const

export default function CampeaoBadge({ posicao, large = false }: { posicao: 1 | 2 | 3; large?: boolean }) {
  return (
    <span
      title={LABELS[posicao]}
      className={large ? 'text-2xl' : 'text-base'}
      style={{ display: 'inline-block', lineHeight: 1 }}
    >
      {MEDALS[posicao]}
    </span>
  )
}
```

### Página `EventoInscricoes` — nova seção

Adicionar query no topo:

```ts
const { data: campeoes = [] } = useQuery({
  queryKey: ['campeoes-anteriores', eventoId, modalidadeId],
  queryFn: () => campeoesAnterioresService.listar({ evento_id: eventoId, modalidade_id: modalidadeId! }),
  enabled: modalidadeId != null,
})

const campeoesByParticipanteId = useMemo(() => {
  const m = new Map<number, 1 | 2 | 3>()
  for (const c of campeoes) m.set(c.participante_id, c.posicao)
  return m
}, [campeoes])
```

**Nova seção UI** (entre "Sorteio" e o fechamento do bloco condicional `modalidadeId != null`):

```tsx
<div className="border-t border-[var(--card-border)] pt-5 space-y-3">
  <h2 className="text-sm font-medium text-[var(--t2)]">Campeões do ano anterior</h2>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
    {[1, 2, 3].map(pos => {
      const c = campeoes.find(c => c.posicao === pos)
      return (
        <CampeaoSlot
          key={pos}
          posicao={pos as 1 | 2 | 3}
          campeao={c ?? null}
          excludeIds={campeoes.map(c => c.participante_id)}
          onCriar={(participante_id) => criarCampeao({ evento_id: eventoId, modalidade_id: modalidadeId!, participante_id, posicao: pos as 1|2|3 })}
          onRemover={(id) => removerCampeao(id)}
        />
      )
    })}
  </div>
</div>
```

**Sub-componente `CampeaoSlot`** (inline ou em arquivo separado — fica inline no `EventoInscricoes.tsx` por enquanto):
- Header: badge `<CampeaoBadge posicao={pos} />` + label "1º lugar" / "2º lugar" / "3º lugar".
- Se `campeao` preenchido: mostra nome + subtítulo + botão "Remover" (com confirm).
- Se vazio: mostra `<ParticipanteSelect>` (excludeIds = ids dos já marcados nessa modalidade) + botão "Salvar" — disabled quando `pickedId == null`.

### Sinalização na tabela de inscrições

Adicionar coluna nova ANTES de "Nome" OU prepender no próprio nome:

```tsx
{ header: 'Nome', accessor: (row: Inscricao) => {
  const pos = campeoesByParticipanteId.get(row.participante_id)
  return (
    <span className="inline-flex items-center gap-2">
      {pos && <CampeaoBadge posicao={pos} />}
      {row.participante.nome}
    </span>
  )
}}
```

### Sinalização nos componentes de resultado (F4c)

Adicionar prop nova opcional aos 3:

```ts
type Props = {
  resultado: ...
  participantesById: Map<number, Participante>
  large?: boolean
  campeoesByParticipanteId?: Map<number, 1 | 2 | 3>
}
```

Quando o map existe e contém o pid renderizado, prepende `<CampeaoBadge posicao={pos} large={large} />` ao lado do nome.

Atualizar 3 arquivos:
- `frontend/src/components/sorteio-result/SorteioGrupos.tsx`
- `frontend/src/components/sorteio-result/SorteioChaves.tsx`
- `frontend/src/components/sorteio-result/SorteioOrdem.tsx`

Em `EventoInscricoes.tsx` passar `campeoesByParticipanteId` para os 3.

### Modo Congresso

Os 3 steps (`CongressoStepSorteio.tsx`) já passam para os mesmos componentes. Precisa:
1. `CongressoStepSorteio.tsx` carrega `campeoes-anteriores` via query.
2. Deriva `campeoesByParticipanteId` e passa para SorteioGrupos/Chaves/Ordem.
3. Opcionalmente no `CongressoStepParticipantes.tsx` também (lista de inscritos).

## Implementação — File Structure

**Backend — Create:**
- `backend/prisma/migrations/<ts>_add_campeao_anterior/migration.sql`
- `backend/src/modules/campeoes_anteriores/campeoes_anteriores.service.ts`
- `backend/src/modules/campeoes_anteriores/campeoes_anteriores.service.test.ts`
- `backend/src/modules/campeoes_anteriores/campeoes_anteriores.controller.ts`
- `backend/src/modules/campeoes_anteriores/campeoes_anteriores.routes.ts`

**Backend — Modify:**
- `backend/prisma/schema.prisma` — model + back-refs.
- `backend/src/index.ts` — wire route.

**Frontend — Create:**
- `frontend/src/types/campeao-anterior.ts`
- `frontend/src/services/campeoes-anteriores.ts`
- `frontend/src/components/CampeaoBadge.tsx`

**Frontend — Modify:**
- `frontend/src/pages/eventos/EventoInscricoes.tsx` — query + seção + sinalização na tabela + passa map pros componentes de sorteio.
- `frontend/src/components/sorteio-result/SorteioGrupos.tsx` — prop nova + render badge.
- `frontend/src/components/sorteio-result/SorteioChaves.tsx` — idem.
- `frontend/src/components/sorteio-result/SorteioOrdem.tsx` — idem.
- `frontend/src/pages/congresso/CongressoStepSorteio.tsx` — query nova + passa map.
- `frontend/src/pages/congresso/CongressoStepParticipantes.tsx` — query nova + badge inline na lista (opcional, decidir na implementação se vale).

**Release:**
- `package.json` (root): `1.14.0` → `1.15.0`.
- `CHANGELOG.md`: bloco `[1.15.0]`.

## Smoke pós-deploy

1. Login admin.
2. /eventos → Inscrições em algum evento → selecionar modalidade.
3. Seção "Campeões do ano anterior" aparece com 3 slots vazios.
4. Slot 1º: autocompletar participante, click "Salvar" → vira "🥇 João Silva" + botão Remover.
5. Tentar salvar mesmo participante em outro slot → o `excludeIds` previne (some do dropdown). Via API curl, POST com participante já marcado em outra posição → permite (cada slot é uma posição diferente). POST com mesma posição → 409.
6. Inscrever esse mesmo participante como inscrição na modalidade → linha na tabela ganha "🥇" antes do nome.
7. Realizar sorteio → resultado renderiza com 🥇 ao lado do nome do campeão.
8. Modo Congresso → step Sorteio → render com medalha em fonte grande.
9. Remover slot (confirm) → some.
10. Rodapé sidebar: `v1.15.0`.

## Risco / efeitos colaterais

- **Apagar Evento cascateia**: comportamento esperado.
- **Apagar Participante / Modalidade com campeão vinculado**: 500 (FK violation), igual ao Inscricao. Iteração futura adiciona guarda amigável.
- **Mesmo participante em múltiplas posições**: tecnicamente possível (unique é por posição). Operador pode marcar 1º + 2º como mesma pessoa — pouco provável mas não barrado. Aceito.
- **Performance da query do Congresso**: 1 query extra por step de sorteio, leve (max 3 rows por (evento, modalidade)).
- **Sem testes vitest novos no frontend**: padrão do projeto — UI valida via smoke.
- **`CongressoStepParticipantes`**: render do badge na lista é opcional. Decisão de implementação: incluir, fica consistente com tabela de inscrições. Se for muito tweak, deixar pra iteração.
