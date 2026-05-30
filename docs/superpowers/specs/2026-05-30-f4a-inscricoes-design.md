# F4a — Inscrições — Design

**Data:** 2026-05-30
**Status:** Aprovado para implementação
**Versão alvo:** 1.8.0
**Sub-projeto pai:** F4 Workspace (decomposto em F4a Inscrições → F4b Motor + persistência de sorteio → F4c Workspace UI)

## Objetivo

Implementar a entidade `Inscricao` (vínculo Evento × Modalidade × Participante) com CRUD admin. F4a é a fundação: produz o pool de participantes por (evento, modalidade) que o F4b vai consumir no motor de sorteio.

## Escopo

- **In:** entidade `Inscricao` + endpoints + tela de gestão de inscritos por evento.
- **Out:** motor de sorteio, persistência de resultado, regras (cabeça-de-chave, separação por clube), modo congresso, exportação. Tudo isso fica em F4b / F4c / F6.

## Domínio

Cada modalidade de um evento tem seu próprio pool de participantes (citação do handoff: *"cada modalidade do evento tem seu próprio pool de participantes e status"*). A inscrição é a entidade que materializa esse vínculo.

Regras:
- Modalidade só pode ser inscrita em um Evento se ambas pertencem à mesma Competição (`modalidade.competicao_id === evento.competicao_id`).
- Mesmo participante não pode aparecer duas vezes na mesma (Evento, Modalidade) — unique composto.
- Status do evento NÃO bloqueia inscrição (livre em qualquer status; reabertura sempre permitida).

## Modelagem

### Prisma schema

Adicionar back-refs em `Evento`, `Modalidade`, `Participante`:

```prisma
model Evento {
  // ... campos existentes ...
  inscricoes      Inscricao[]
}

model Modalidade {
  // ... campos existentes ...
  inscricoes          Inscricao[]
}

model Participante {
  // ... campos existentes ...
  inscricoes    Inscricao[]
}
```

Adicionar o modelo `Inscricao`:

```prisma
model Inscricao {
  id              Int          @id @default(autoincrement())
  evento          Evento       @relation(fields: [evento_id], references: [id], onDelete: Cascade)
  evento_id       Int
  modalidade      Modalidade   @relation(fields: [modalidade_id], references: [id])
  modalidade_id   Int
  participante    Participante @relation(fields: [participante_id], references: [id])
  participante_id Int
  criado_em       DateTime     @default(now())
  atualizado_em   DateTime     @updatedAt

  @@unique([evento_id, modalidade_id, participante_id])
  @@index([evento_id, modalidade_id])
}
```

- **Cascade** apenas no Evento (apagar evento → remove inscrições). Modalidade e Participante mantêm FK padrão — tentar apagar uma Modalidade ou Participante com inscrições retorna o erro padrão do Postgres (não tratado nesta sub-fase; reservado para futura iteração).
- **Unique composto** garante o "sem duplicatas".
- **Índice** em `(evento_id, modalidade_id)` cobre a query mais comum (listar inscritos da modalidade selecionada no workspace).

### Migration

Escrita manualmente (não usar `prisma migrate diff` — risco de drift vide memory `feedback_prisma_migrate_diff_drift.md`):

```sql
CREATE TABLE "Inscricao" (
  "id" SERIAL PRIMARY KEY,
  "evento_id" INTEGER NOT NULL,
  "modalidade_id" INTEGER NOT NULL,
  "participante_id" INTEGER NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Inscricao_evento_id_fkey"
    FOREIGN KEY ("evento_id") REFERENCES "Evento"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Inscricao_modalidade_id_fkey"
    FOREIGN KEY ("modalidade_id") REFERENCES "Modalidade"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Inscricao_participante_id_fkey"
    FOREIGN KEY ("participante_id") REFERENCES "Participante"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Inscricao_evento_id_modalidade_id_participante_id_key"
  ON "Inscricao"("evento_id","modalidade_id","participante_id");

CREATE INDEX "Inscricao_evento_id_modalidade_id_idx"
  ON "Inscricao"("evento_id","modalidade_id");
```

## Backend (módulo `inscricoes`)

Estrutura: `backend/src/modules/inscricoes/inscricoes.{service,controller,routes,service.test}.ts`.

### Service

```ts
import prisma from '../../lib/prisma'

const INCLUDE = { participante: true } as const

async function mapPrismaError<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn() }
  catch (err: any) {
    if (err?.code === 'P2002') {
      throw Object.assign(
        new Error('Este participante já está inscrito nesta modalidade do evento.'),
        { status: 409 }
      )
    }
    throw err
  }
}

export async function listar(filtros: { evento_id?: number; modalidade_id?: number }) {
  return prisma.inscricao.findMany({
    where: filtros,
    orderBy: { criado_em: 'asc' },
    include: INCLUDE,
  })
}

export async function buscarPorId(id: number) {
  const item = await prisma.inscricao.findUnique({ where: { id }, include: INCLUDE })
  if (!item) throw Object.assign(new Error('Inscrição não encontrada'), { status: 404 })
  return item
}

export async function criar(data: { evento_id: number; modalidade_id: number; participante_id: number }) {
  const [evento, modalidade] = await Promise.all([
    prisma.evento.findUnique({ where: { id: data.evento_id }, select: { competicao_id: true } }),
    prisma.modalidade.findUnique({ where: { id: data.modalidade_id }, select: { competicao_id: true } }),
  ])
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })
  if (!modalidade) throw Object.assign(new Error('Modalidade não encontrada'), { status: 404 })
  if (evento.competicao_id !== modalidade.competicao_id) {
    throw Object.assign(
      new Error('A modalidade não pertence à competição deste evento.'),
      { status: 400 }
    )
  }
  return mapPrismaError(() => prisma.inscricao.create({ data, include: INCLUDE }))
}

export async function remover(id: number) {
  return prisma.inscricao.delete({ where: { id } })
}
```

### Controller (Zod)

```ts
const createSchema = z.object({
  evento_id: z.coerce.number().int().positive(),
  modalidade_id: z.coerce.number().int().positive(),
  participante_id: z.coerce.number().int().positive(),
})

const listQuerySchema = z.object({
  evento_id: z.coerce.number().int().positive().optional(),
  modalidade_id: z.coerce.number().int().positive().optional(),
})
```

Rotas:
- `GET /inscricoes` (requireAuth) — query: `evento_id?`, `modalidade_id?`.
- `GET /inscricoes/:id` (requireAuth).
- `POST /inscricoes` (admin).
- `DELETE /inscricoes/:id` (admin).

(Sem `PUT` — inscrição não tem campos editáveis.)

Registrar `inscricoesRoutes` em `backend/src/index.ts` antes de `/eventos`.

### Testes vitest

Mock de `prisma` com `inscricao`, `evento`, `modalidade`:

1. `listar com filtro evento_id + modalidade_id passa where corretamente`
2. `listar sem filtros chama findMany com where vazio`
3. `buscarPorId lança 404 se não encontrado`
4. `criar lança 404 se evento não existe`
5. `criar lança 404 se modalidade não existe`
6. `criar lança 400 se competições não batem`
7. `criar passa quando competições batem e chama create com include`
8. `criar mapeia P2002 para 409`
9. `remover deleta direto`

## Frontend

### Tipo

`frontend/src/types/inscricao.ts`:

```ts
import type { Participante } from './participante'

export type Inscricao = {
  id: number
  evento_id: number
  modalidade_id: number
  participante_id: number
  participante: Participante
  criado_em: string
  atualizado_em: string
}
```

### Service

`frontend/src/services/inscricoes.ts`:

```ts
import api from './api'
import type { Inscricao } from '../types/inscricao'

const BASE = '/inscricoes'

type InscricaoPayload = {
  evento_id: number
  modalidade_id: number
  participante_id: number
}

export const inscricoesService = {
  listar: (params?: { evento_id?: number; modalidade_id?: number }) =>
    api.get<Inscricao[]>(BASE, { params }).then(r => r.data),
  criar: (data: InscricaoPayload) => api.post<Inscricao>(BASE, data).then(r => r.data),
  remover: (id: number) => api.delete(`${BASE}/${id}`),
}
```

### Componente `ParticipanteSelect`

`frontend/src/components/ParticipanteSelect.tsx`. Padrão `MunicipioSelect`: autocomplete com debounce (300ms), busca via `participantesService.listar({ q })`, dropdown com nome + subtítulo. Props `{ value: number | null, onChange: (id, participante) => void, excludeIds?: number[] }`. O `excludeIds` filtra do dropdown participantes já inscritos.

**Nota sobre `participantesService.listar`:** já existe e suporta `q` (busca). Se não suportar paginação que limite a 20-30 resultados, manter o limite no client.

### Página `EventoInscricoes`

`frontend/src/pages/eventos/EventoInscricoes.tsx`. Layout:

- `PageHeader` com `title = evento.nome`, `eyebrow = "OPERAÇÃO"`, `sub = competicao.nome`, `backTo = "/eventos"`.
- Linha de chips horizontais com as modalidades da competição do evento. Modalidade selecionada destacada.
  - Query: `useQuery(['modalidades', evento.competicao_id], () => modalidadesService.listar({ competicao_id: evento.competicao_id }))`. **Atenção:** verificar se `modalidadesService.listar` aceita filtro por `competicao_id`; se não, filtrar no client após listar todas.
- Quando uma modalidade está selecionada:
  - Botão "+ Inscrever" no topo direito da seção.
  - DataTable com colunas: Nome (`participante.nome`), Subtítulo (`participante.subtitulo ?? '—'`), Município (`participante.municipio?.nome — uf` se incluído pela API, caso contrário só ID), Ações (botão Remover).
  - Query: `useQuery(['inscricoes', evento.id, modalidadeId], () => inscricoesService.listar({ evento_id, modalidade_id: modalidadeId }))`.
- Estado local: `modalidadeId: number | null`, `inscreverOpen: boolean`.
- Modal `Inscrever`: `<ParticipanteSelect>` (excludeIds = ids dos já inscritos) + botão Confirmar → mutation `criar` → invalidate query → fecha modal.
- Tratamento de erro do submit do modal: mostra mensagem do backend (400 ou 409) inline no modal.

### Modificações em arquivos existentes

- `frontend/src/pages/eventos/EventosList.tsx`: nos cards, adicionar botão pequeno "Inscrições" antes do botão "Remover". Click navega para `/eventos/${ev.id}/inscricoes`. Click no card (área restante) continua abrindo `/eventos/:id/editar`.
- `frontend/src/App.tsx`: adicionar rota `<Route path="/eventos/:id/inscricoes" element={<EventoInscricoes />} />`.

### Type checks importantes

- `participantesService.listar` provavelmente retorna `{ data, total, ... }` (formato paginado). Confirmar shape antes de implementar `ParticipanteSelect`.
- Se `participante.municipio` não vier por padrão no `/participantes`, ou exibir só o nome do participante, ou adicionar include no service — não mexer no service de participantes nesta sub-fase, mostrar apenas o que vier.

## Risco / efeitos colaterais

- **Cascade no Evento:** apagar um Evento agora remove silenciosamente todas suas inscrições. Aceito — esse é o comportamento esperado e o `evento.remover` já existe sem checks adicionais.
- **Modalidade.remover / Participante.remover:** tentar apagar com inscrição vinculada vai retornar 500 (FK violation). Aceito por ora — não há UI que delete modalidades hoje sem antes desinscrever, e o erro vai vazar como mensagem genérica. Adicionar guardas amigáveis fica em sub-projeto futuro (sugerido junto de F4c).
- **competicoes.remover:** já bloqueia em modalidades+eventos vinculados. Inscrições não precisam de check adicional porque um evento com inscrições não pode ser apagado sem cascade, e a competição já barra no evento.

## Release

- `package.json`: `1.7.0` → `1.8.0` (MINOR).
- `CHANGELOG.md`: bloco `[1.8.0]` com `Added` (Inscrição + tela /eventos/:id/inscricoes + botão Inscrições no card).

## Smoke pós-deploy

1. Login admin.
2. /eventos → click no botão "Inscrições" do card de algum evento existente → abre nova tela.
3. Header mostra nome do evento + competição.
4. Selecionar modalidade no chips → lista vazia.
5. "+ Inscrever" → autocomplete encontra participante → confirmar → linha aparece.
6. Tentar inscrever o mesmo participante novamente → 409 "Este participante já está inscrito...".
7. Verificar via backend que a unique constraint dispara: tentar `POST /inscricoes` com payload duplicado via curl → 409.
8. Click "Remover" em uma linha → confirm → some.
9. Trocar modalidade no chips → lista de outra modalidade (vazia ou diferente).
10. Voltar para /eventos → editar o evento → status "rascunho" → salvar → voltar para /inscricoes → ainda funciona normalmente (não bloqueia por status).
