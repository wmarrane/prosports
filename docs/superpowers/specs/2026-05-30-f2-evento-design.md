# Spec: F2 — Entidade Evento

Data: 2026-05-30
Status: aprovado para implementação
Backlog redesign: sub-projeto 2 do handoff. Pré-requisito do F4 (Workspace administrativo do Congresso) e F6 (Modo Congresso).

## Objetivo

Criar a entidade `Evento` (edição de uma `Competicao` com data/hora, local, município, organizador e status), expor CRUD admin no backend, substituir o placeholder F0 de `/eventos` por uma lista de cards e formulário de criação/edição. Bump para `1.6.0`.

## Escopo

- **Backend**: model `Evento` + enum `EventoStatus` + módulo `eventos` (service/controller/routes/tests). Migration nova. Atualizar `competicoes.service.remover` e `municipios.service.remover` para verificar Evento vinculado (409).
- **Frontend**: tipo `Evento`, service, página `EventosList` (cards grid), página `EventoForm`. Remove o placeholder F0 (`pages/Eventos.tsx`). Mapas `STATUS_LABEL` e `STATUS_COLOR` em `lib/evento-status.ts`.
- **Roteamento**: substitui `/eventos` (placeholder) por rotas reais; adiciona `/eventos/novo` e `/eventos/:id/editar`.
- **Release**: bump `1.6.0` + bloco CHANGELOG.

Fora de escopo:
- Junção Evento × Modalidade × Participante (pool por modalidade do evento) — fase F4.
- Modalidade.forma_sorteio enum (chaves/grupos/ordem/especifico) — fase F3.
- Filtro por tipo na lista de eventos — fase F4 (depende das modalidades do evento).
- Ribbon colorido + ícone(s) de tipo nos cards — fase F4.
- Métricas no card (modalidades / inscritos / sorteadas X/Y) — fase F4.
- Workspace administrativo do Congresso — fase F4.
- Botão "Importar inscritos" no header — fase F5.

## Decisões de design

| # | Decisão | Justificativa |
|---|---|---|
| 1 | `municipio_id` FK (não string livre) | Consistente com `Participante`; reusa autocomplete `MunicipioSelect`; rastreabilidade. |
| 2 | `data_hora DateTime` (campo único) | Mais simples no banco e consultas; UI usa input `datetime-local`. |
| 3 | Enum com 5 valores | Cobre todo ciclo; em F2 admin muda manualmente; em F4/F6 será derivado. |
| 4 | `@@unique([competicao_id, nome])` | Mesma Copa não pode ter 2 "Etapa Araçatuba". |
| 5 | `organizador` opcional, texto livre | YAGNI. Vira FK futuro se necessário. |
| 6 | Click no card abre `/eventos/:id/editar` | Workspace é F4. Edit é a próxima ação útil hoje. |
| 7 | Sem filtros nem paginação em F2 | Sem `tipos`/`modalidades` na entidade ainda. Volume baixo. |
| 8 | Ribbon top do card monocromático (`--grad-brand`) | Variação por tipo de modalidade vem em F4. |
| 9 | Bump `1.6.0` (MINOR) | Feature aditiva; sem mudança de contrato existente. |

## Modelo de dados (Prisma)

```prisma
enum EventoStatus {
  rascunho
  inscricoes
  pronto
  sorteado
  parcial
}

model Evento {
  id              Int           @id @default(autoincrement())
  nome            String
  data_hora       DateTime
  local           String
  organizador     String?
  status          EventoStatus  @default(rascunho)
  competicao      Competicao    @relation(fields: [competicao_id], references: [id])
  competicao_id   Int
  municipio       Municipio     @relation(fields: [municipio_id], references: [id])
  municipio_id    Int
  criado_em       DateTime      @default(now())
  atualizado_em   DateTime      @updatedAt

  @@unique([competicao_id, nome])
}
```

**Back-refs adicionadas:**
- `Competicao.eventos Evento[]`
- `Municipio.eventos Evento[]`

**Migração esperada (CREATE TABLE Evento + CREATE TYPE EventoStatus):**
- `CREATE TYPE "EventoStatus" AS ENUM ('rascunho','inscricoes','pronto','sorteado','parcial')`
- `CREATE TABLE "Evento"` com colunas conforme modelo
- 2 FK constraints (competicao_id, municipio_id)
- `CREATE UNIQUE INDEX "Evento_competicao_id_nome_key" ON "Evento"("competicao_id","nome")`

Sem dados a preservar (entidade nova).

## Backend

### Estrutura

```
backend/src/modules/eventos/
  eventos.service.ts
  eventos.service.test.ts
  eventos.controller.ts
  eventos.routes.ts
```

### Endpoints

| Método | Rota | Auth | Body / Notas |
|---|---|---|---|
| `GET`    | `/eventos`     | autenticado | listar (orderBy `data_hora desc`); query opcional `competicao_id`; `include` competicao + municipio |
| `GET`    | `/eventos/:id` | autenticado | detalhe com mesmo include |
| `POST`   | `/eventos`     | ADMIN | `{ nome, data_hora, local, organizador?, status?, competicao_id, municipio_id }` |
| `PUT`    | `/eventos/:id` | ADMIN | parcial |
| `DELETE` | `/eventos/:id` | ADMIN | deleta direto |

### Service `eventos.service.ts`

- `INCLUDE = { competicao: true, municipio: true } as const`
- `listar(competicao_id?: number)` — `where: competicao_id ? { competicao_id } : undefined`, `orderBy: { data_hora: 'desc' }`, `include: INCLUDE`.
- `buscarPorId(id)` — `include: INCLUDE`; 404 se não encontrado.
- `criar(data)` e `editar(id, data)` wrap em `mapPrismaError` que captura `P2002` (unique `(competicao_id, nome)`) → `{ status: 409, message: 'Já existe um evento com este nome nesta competição.' }`.
- `remover(id)` — `prisma.evento.delete({ where: { id } })` direto.

### Atualizações em outros services

**`competicoes.service.ts.remover`** — incluir check de Evento além de Modalidade:
```ts
export async function remover(id: number) {
  const [modalidades, eventos] = await Promise.all([
    prisma.modalidade.count({ where: { competicao_id: id } }),
    prisma.evento.count({ where: { competicao_id: id } }),
  ])
  const motivos: string[] = []
  if (modalidades > 0) motivos.push('modalidades')
  if (eventos > 0) motivos.push('eventos')
  if (motivos.length > 0) {
    throw Object.assign(
      new Error(`Remova os ${motivos.join(' e ')} vinculados antes de excluir esta competição.`),
      { status: 409 }
    )
  }
  return prisma.competicao.delete({ where: { id } })
}
```

E os testes de `competicoes.service.test.ts` ganham 2 novos cases (com Evento vinculado, com ambos).

**`municipios.service.ts.remover`** — incluir check de Evento além de Participante:
```ts
export async function remover(id: number) {
  const [participantes, eventos] = await Promise.all([
    prisma.participante.count({ where: { municipio_id: id } }),
    prisma.evento.count({ where: { municipio_id: id } }),
  ])
  const motivos: string[] = []
  if (participantes > 0) motivos.push('participantes')
  if (eventos > 0) motivos.push('eventos')
  if (motivos.length > 0) {
    throw Object.assign(
      new Error(`Remova os ${motivos.join(' e ')} vinculados antes de excluir este município.`),
      { status: 409 }
    )
  }
  return prisma.municipio.delete({ where: { id } })
}
```

E o teste `municipios.service.test.ts` ganha 1 novo case (Evento vinculado).

### Controller (Zod)

```ts
const STATUS_VALUES = ['rascunho','inscricoes','pronto','sorteado','parcial'] as const

const createSchema = z.object({
  nome: z.string().min(1),
  data_hora: z.coerce.date(),
  local: z.string().min(1),
  organizador: z.string().optional(),
  status: z.enum(STATUS_VALUES).optional(),
  competicao_id: z.coerce.number().int().positive(),
  municipio_id: z.coerce.number().int().positive(),
})
const updateSchema = createSchema.partial()
const listQuerySchema = z.object({
  competicao_id: z.coerce.number().int().positive().optional(),
})
```

### Routes

GET autenticado, POST/PUT/DELETE ADMIN — mesmo padrão dos outros módulos.

### Registro em `src/index.ts`

Adicionar `import eventosRoutes` + `app.use('/eventos', eventosRoutes)` antes do bloco `/competicoes`.

### Tests (vitest)

`eventos.service.test.ts` cobre:
- `listar` sem filtro com include correto
- `listar` com filtro `competicao_id`
- `buscarPorId` 404
- `criar` com payload completo + include
- `criar` com status omitido (Prisma aplica default `rascunho`)
- `criar` mapeia P2002 → 409
- `editar` parcial com include
- `editar` também mapeia P2002 → 409
- `remover` deleta direto

`competicoes.service.test.ts` ganha:
- `remover` lança 409 quando há Evento vinculado (mock `evento.count` retornando 2)
- `remover` lança 409 com mensagem composta quando há Modalidade E Evento

`municipios.service.test.ts` ganha:
- `remover` lança 409 quando há Evento vinculado

## Frontend

### Estrutura

```
frontend/src/
  types/evento.ts                       # NEW
  services/eventos.ts                   # NEW
  lib/evento-status.ts                  # NEW (STATUS_LABEL + STATUS_COLOR)
  pages/eventos/
    EventosList.tsx                     # NEW
    EventoForm.tsx                      # NEW
```

**Remove:** `frontend/src/pages/Eventos.tsx` (placeholder F0).

### Types

`types/evento.ts`:
```ts
import type { Competicao } from './competicao'
import type { Municipio } from './municipio'

export type EventoStatus = 'rascunho' | 'inscricoes' | 'pronto' | 'sorteado' | 'parcial'

export type Evento = {
  id: number
  nome: string
  data_hora: string
  local: string
  organizador: string | null
  status: EventoStatus
  competicao_id: number
  competicao: Competicao
  municipio_id: number
  municipio: Municipio
  criado_em: string
  atualizado_em: string
}
```

### Service

`services/eventos.ts` segue o padrão `competicoes.ts`:
```ts
listar(params?: { competicao_id?: number })
buscar(id)
criar(data: EventoPayload)
editar(id, data: Partial<EventoPayload>)
remover(id)
```

### Status helpers

`lib/evento-status.ts`:
```ts
import type { EventoStatus } from '../types/evento'

export const STATUS_LABEL: Record<EventoStatus, string> = {
  rascunho: 'Rascunho',
  inscricoes: 'Inscrições',
  pronto: 'Pronto p/ sorteio',
  sorteado: 'Sorteado',
  parcial: 'Parcial',
}

// classes para badges — usam tokens do tema
export const STATUS_COLOR: Record<EventoStatus, string> = {
  rascunho: 'bg-[var(--card-bg-2)] text-[var(--t3)] border border-[var(--card-border)]',
  inscricoes: 'bg-[var(--info-soft)] text-[var(--info-700)] border border-[var(--info)]',
  pronto: 'bg-[var(--warn-soft)] text-[var(--warn-700)] border border-[var(--warn)]',
  sorteado: 'bg-[var(--success-soft)] text-[var(--success-700)] border border-[var(--success)]',
  parcial: 'bg-[var(--info-soft)] text-[var(--info-700)] border border-[var(--info)]',
}
```

### `EventosList.tsx`

- `<PageHeader eyebrow="OPERAÇÃO" title="Eventos" sub="Gerencie edições de competições, datas e locais." actionLabel="+ Novo Evento" actionTo="/eventos/novo" />`
- Container `.card` com padding, ou grid direto na page-body. Grid: `display: grid; gridTemplateColumns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px`.
- Card de evento (`.card` com `position: relative; padding: 20px; cursor: pointer`):
  - Ribbon top horizontal absoluto: `<div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'var(--grad-brand)', borderRadius: '12px 12px 0 0' }} />`
  - Header (flex justify-between): `<div className="eyebrow font-mono">#{id} · {municipio.nome} — {municipio.uf}</div>` à esquerda; `<span className={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</span>` à direita (badge pill rounded-full px-2.5 py-0.5 text-xs).
  - Título h3 `nome` (clamp 2 linhas, font-semibold text-base).
  - Linha competição: `<Trophy size={13}/> {competicao.nome}` em `text-[var(--brand-500)]`.
  - Linha data/local: `<Evento size={13}/> {formatDateBR(data_hora)} · {local}` em `text-[var(--t3)]`.
  - Linha organizador (se existir): `<Cadastro size={13}/> {organizador}` em `text-[var(--t3)]`.
  - `onClick={() => navigate(`/eventos/${id}/editar`)}`.
- Helper `formatDateBR(iso): string` — usa `Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })`.
- Empty state `<DataTable>`-style mas inline: "Nenhum evento cadastrado."

### `EventoForm.tsx`

- `<PageHeader title={isEdit ? 'Editar Evento' : 'Novo Evento'} backTo="/eventos" />`
- Form container `.card` com padding generoso.
- Campos:
  - **Competição** (combo `<select>` populado por `competicoesService.listar`, required).
  - **Município** (`<MunicipioSelect value={municipioId} onChange={setMunicipioId} />`, required).
  - **Nome** (text input, required).
  - **Data e hora** (`<input type="datetime-local">`, required; conversão pra ISO no submit).
  - **Local** (text input, required).
  - **Organizador** (text input, optional).
  - **Status** (combo, default `rascunho`).
- Validação client-side bloqueia submit se algum required vazio; erro do backend renderizado inline (cor `--danger`).
- Submit chama `criar` ou `editar`; on success navega para `/eventos`.

### App.tsx

Imports:
```tsx
import EventosList from './pages/eventos/EventosList'
import EventoForm from './pages/eventos/EventoForm'
```

Remover:
```tsx
import Eventos from './pages/Eventos'
// e a rota <Route path="/eventos" element={<Eventos />} />
```

Adicionar:
```tsx
<Route path="/eventos"             element={<EventosList />} />
<Route path="/eventos/novo"        element={<EventoForm />} />
<Route path="/eventos/:id/editar"  element={<EventoForm />} />
```

(Posicionar onde estava a rota antiga, dentro do `<Route element={<Layout />}>`.)

**Sidebar:** sem mudança — o item "Eventos" já existe na nova IA pós-F0 apontando pra `/eventos`. Continua o mesmo path; agora a página por trás é real.

## Release

### Bump

`package.json` (root): `1.5.0` → `1.6.0`.

### CHANGELOG.md (novo bloco no topo)

```md
## [1.6.0] - 2026-05-30

### Added
- Entidade Evento: edições de competições com data/hora, local, organizador e status (rascunho / inscrições / pronto / sorteado / parcial). FKs para Competição e Município.
- Página /eventos com grid de cards (substitui placeholder F0) + formulário de criação/edição.

### Changed
- Competição agora bloqueia exclusão se houver Eventos vinculados (além de Modalidades).
- Município agora bloqueia exclusão se houver Eventos vinculados (além de Participantes).
```

### Deploy

Push em `develop` → CI roda `prisma migrate deploy` (cria tabela + enum) → rebuild dos 2 containers. ~5 min.

### Smoke test pós-deploy (manual)

1. **Sidebar → Operação → Eventos** → lista vazia (placeholder F0 não aparece mais).
2. **+ Novo Evento**:
   - Competição: "Copa Brasil 2026" (existente)
   - Município: digitar "São Paulo" no autocomplete → seleciona
   - Nome: "Etapa Inaugural"
   - Data: amanhã 09:00
   - Local: "Ginásio Tancredão"
   - Organizador: "SEJEL"
   - Status: rascunho (default)
   - Salvar → volta pra lista; card aparece com badge "Rascunho".
3. Criar outro evento com **mesmo nome na mesma Competição** → 409 amigável.
4. Criar mesmo nome em **outra Competição** → permitido.
5. Click no card → `/eventos/:id/editar` → mudar status para "Inscrições" → salvar → lista atualiza badge (cor azul info).
6. Tentar excluir a Competição "Copa Brasil 2026" → 409 "Remova os eventos vinculados...".
7. Tentar excluir o Município "São Paulo" → 409 (com Participante já vinculado de fase anterior, mensagem composta "participantes e eventos").
8. Excluir o evento da lista → some.
9. Rodapé sidebar `v1.6.0 (<sha>)`.

## Riscos

| Risco | Mitigação |
|---|---|
| Esquecer de atualizar `competicoes.service.remover` ou `municipios.service.remover` | Plano dedica steps explícitos; reviewer compara contra spec. |
| `data_hora` enviado como string ISO incompatível | `z.coerce.date()` aceita string ISO; backend persiste como `DateTime`. |
| P2002 não capturado por outros uniques | Único unique do model é `(competicao_id, nome)` — não há ambiguidade na mensagem. |
| Campos de competição/município com pouca variedade na hora do form | Spec de smoke test pressupõe Competição e Município já existentes; CRUDs anteriores permitem criar. |
| Migration falhar em ambiente que já tem dados de Evento | Entidade nova; sem dados anteriores. |
| Type Evento conflitar com tipo nativo do browser | Não há conflito — namespace é local ao módulo TS. |
