# Spec: Competição (entity) + sidebar move

Data: 2026-05-29
Status: aprovado para implementação

## Objetivo

Criar a entidade `Competicao` com 3 campos (`nome`, `estados` multi-UF, `adicionar_subtitulo` boolean), expor CRUD admin, e mover o item "Competições" do seu próprio grupo no sidebar para o grupo "Cadastros". Remove o item morto "Edições" (sem rota implementada). Bump para `1.3.0`.

## Escopo

- Backend: criar módulo `competicoes` (service + controller + routes + tests). Migration nova (CREATE TABLE Competicao + unique nome).
- Frontend: tipos, service, páginas `CompeticoesList` + `CompeticaoForm`, rotas, sidebar reorganizado.
- Refactor pequeno (incluído neste ciclo): extrair a constante `UFS` (27 siglas) que hoje vive duplicada em `MunicipiosList.tsx` e `MunicipioForm.tsx` para um módulo compartilhado `frontend/src/lib/ufs.ts` reusado pelo novo `CompeticaoForm` e pelos arquivos atuais.
- Release: bump 1.3.0 + CHANGELOG.

Fora de escopo:
- Entidade `Edicao` (item removido do sidebar; pode voltar como feature nova).
- Vínculo de Competição com outras entidades (Participante, Modalidade, etc.) — fica para outra feature.
- Uso real do flag `adicionar_subtitulo` (apenas persistido agora; será consumido em telas futuras).

## Decisões de design

| # | Decisão | Justificativa |
|---|---|---|
| 1 | `estados` como `String[]` (Postgres array) | Multi-UF nativo; sem precisar de tabela N-N |
| 2 | Validação de UFs no service usando `SIGLAS_VALIDAS` de `modules/municipios/uf.ts` | DRY — fonte única da verdade sobre quais são as 27 siglas válidas |
| 3 | `nome` unique | Consistente com Inspetoria/Delegacia; evita duplicatas |
| 4 | `adicionar_subtitulo` default `false` | Conservador; só ativa quando admin marca |
| 5 | Remover item "Edições" do sidebar | Sem entidade `Edicao` implementada — link gera 404 |
| 6 | Mover "Competições" para Cadastros (e dissolver o grupo "Competições") | Sidebar fica mais enxuto; um único grupo de cadastros admin |
| 7 | Extrair `UFS` para `frontend/src/lib/ufs.ts` | Pequena DRY enquanto eu já estou tocando esse domínio |
| 8 | Multi-select via grid de 27 checkboxes | UX clara para conjunto pequeno e fixo; sem dependência de combo multi |
| 9 | Bump `1.3.0` (MINOR) | Feature aditiva, retrocompatível |

## Modelo de dados (Prisma)

```prisma
model Competicao {
  id                  Int       @id @default(autoincrement())
  nome                String    @unique
  estados             String[]
  adicionar_subtitulo Boolean   @default(false)
  criado_em           DateTime  @default(now())
  atualizado_em       DateTime  @updatedAt
}
```

**Migração:** `prisma migrate dev --name add_competicao`. Esperado:
- `CREATE TABLE "Competicao"` com `nome TEXT NOT NULL`, `estados TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`, `adicionar_subtitulo BOOLEAN NOT NULL DEFAULT false`, `criado_em` e `atualizado_em`.
- `CREATE UNIQUE INDEX "Competicao_nome_key" ON "Competicao"("nome")`.

Sem alteração em outras tabelas.

## Backend

### Estrutura

```
backend/src/modules/competicoes/
  competicoes.controller.ts
  competicoes.routes.ts
  competicoes.service.ts
  competicoes.service.test.ts
```

### Endpoints

| Método | Rota | Auth | Body / Notas |
|---|---|---|---|
| `GET`    | `/competicoes`     | autenticado | listar (orderBy `nome asc`) |
| `GET`    | `/competicoes/:id` | autenticado | detalhe |
| `POST`   | `/competicoes`     | ADMIN | `{ nome, estados, adicionar_subtitulo? }` |
| `PUT`    | `/competicoes/:id` | ADMIN | parcial |
| `DELETE` | `/competicoes/:id` | ADMIN | deleta direto |

### Service

CRUD padrão. `criar`/`editar`:
- Validam cada item de `estados` com `SIGLAS_VALIDAS` (Set importado de `../municipios/uf.ts`). Se algum não pertencer → throw `{ status: 400, message: "UF inválida: '<sigla>'" }`.
- Wrap em try/catch para mapear `Prisma.PrismaClientKnownRequestError` código `P2002` (unique violation no `nome`) para `{ status: 409, message: 'Já existe uma competição com este nome.' }`. Outros erros sobem.

`remover` é `prisma.competicao.delete({ where: { id } })` puro.

### Controller (Zod)

```ts
const createSchema = z.object({
  nome: z.string().min(1),
  estados: z.array(z.string().length(2)).min(1, 'Selecione ao menos uma UF'),
  adicionar_subtitulo: z.boolean().optional().default(false),
})
const updateSchema = createSchema.partial()
```

O `length(2)` no Zod só garante shape básico (2 caracteres); a validação de "UF é uma das 27 válidas" fica no service.

### Routes

Padrão idêntico ao `inspetorias.routes.ts`:
- GET: `requireAuth`
- POST/PUT/DELETE: `...admin` (`[requireAuth, requireRole('ADMIN')]`)

### Registro em `src/index.ts`

Adicionar `import competicoesRoutes from './modules/competicoes/competicoes.routes'` + `app.use('/competicoes', competicoesRoutes)`.

### Tests (vitest)

`competicoes.service.test.ts`:
1. `listar` ordena por nome
2. `buscarPorId` lança 404
3. `criar` aceita estados válidos
4. `criar` rejeita UF inválida (status 400)
5. `criar` aceita default `adicionar_subtitulo: false` se omitido
6. `editar` parcial passa por validação só quando `estados` está presente
7. `remover` deleta direto
8. Unique violation no nome → 409 (mock `prisma.competicao.create` lançando `P2002`)

## Frontend

### Estrutura

```
frontend/src/
  lib/
    ufs.ts                     # novo: UFS const compartilhada
  types/
    competicao.ts              # novo
  services/
    competicoes.ts             # novo
  pages/competicoes/
    CompeticoesList.tsx        # novo
    CompeticaoForm.tsx         # novo
  pages/municipios/
    MunicipiosList.tsx         # modificar: importar UFS de lib/ufs.ts
    MunicipioForm.tsx          # modificar: idem
  App.tsx                      # +3 rotas /competicoes/*
  components/Layout.tsx        # mover item; remover grupo Competições
```

### `lib/ufs.ts`

```ts
export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
```

Substituir os literais hoje em `MunicipiosList.tsx:9` e `MunicipioForm.tsx:8` por `import { UFS } from '../../lib/ufs'`.

### `types/competicao.ts`

```ts
export type Competicao = {
  id: number
  nome: string
  estados: string[]
  adicionar_subtitulo: boolean
  criado_em: string
  atualizado_em: string
}
```

### `services/competicoes.ts`

Padrão `modalidadesService`:
```ts
listar(): Promise<Competicao[]>
buscar(id)
criar(data: { nome: string; estados: string[]; adicionar_subtitulo?: boolean })
editar(id, data: Partial<...>)
remover(id)
```

### `CompeticoesList.tsx`

Tabela com 4 colunas:
- **Nome** — `row.nome`
- **Estados** — `row.estados.slice().sort().join(', ')` (ex.: `"MG, RJ, SP"`)
- **Subtítulo** — `row.adicionar_subtitulo ? '✓' : '—'` (classe `text-center`)
- **Ações** — Editar / Remover (idêntico a outras listas)

### `CompeticaoForm.tsx`

- Input `nome` (required).
- Grid de checkboxes (4 colunas × 7 linhas, última com 6) usando `UFS`. Cada checkbox controla um item no array `estados` (estado local `string[]`). Click adiciona/remove.
- Checkbox `adicionar_subtitulo` com label "Adicionar subtítulo aos participantes".
- Submit:
  - Bloqueia se `estados.length === 0` → mensagem "Selecione ao menos uma UF".
  - Envia payload `{ nome, estados, adicionar_subtitulo }`.
- Modo edit: `useEffect(existing)` popula os 3 campos.

### `App.tsx`

Adicionar imports:
```tsx
import CompeticoesList from './pages/competicoes/CompeticoesList'
import CompeticaoForm from './pages/competicoes/CompeticaoForm'
```

E rotas dentro do `<Layout />`:
```tsx
<Route path="/competicoes"            element={<CompeticoesList />} />
<Route path="/competicoes/nova"       element={<CompeticaoForm />} />
<Route path="/competicoes/:id/editar" element={<CompeticaoForm />} />
```

### `Layout.tsx`

Transformar `navGroups`. Atual:
```tsx
[
  { title: 'Cadastros',  items: [Municípios, Inspetorias, Delegacias, Participantes, Modalidades, Categorias] },
  { title: 'Competições', items: [{ label: 'Edições', to: '/edicoes' }, { label: 'Competições', to: '/competicoes' }] },
]
```

Vira:
```tsx
[
  { title: 'Cadastros', items: [
    { label: 'Municípios',    to: '/municipios' },
    { label: 'Inspetorias',   to: '/inspetorias' },
    { label: 'Delegacias',    to: '/delegacias' },
    { label: 'Participantes', to: '/participantes' },
    { label: 'Modalidades',   to: '/modalidades' },
    { label: 'Categorias',    to: '/categorias' },
    { label: 'Competições',   to: '/competicoes' },
  ] },
]
```

Grupo "Competições" inteiro removido. "Edições" desaparece junto.

## Release

### Bump

`package.json` (root): `1.2.0` → `1.3.0`.

### CHANGELOG.md (novo bloco no topo)

```md
## [1.3.0] - 2026-05-29

### Added
- Entidade Competição com CRUD admin (nome único, lista de UFs onde acontece, flag "adicionar subtítulo").

### Changed
- Sidebar reorganizado: item "Competições" movido para o grupo "Cadastros".
- Constante de UFs do Brasil extraída para `frontend/src/lib/ufs.ts` (DRY).

### Removed
- Item "Edições" do sidebar (entidade ainda não implementada).
- Grupo "Competições" do sidebar (item único movido para Cadastros).
```

### Deploy

Push em `develop` → CI roda `prisma migrate deploy` (cria tabela Competicao) → reconstrói os 2 containers. Mesmo fluxo das releases anteriores.

### Smoke test pós-deploy (manual, browser)

1. Sidebar: grupo "Competições" sumiu; "Competições" aparece ao final de Cadastros.
2. **Cadastros → Competições** → lista vazia.
3. "+ Nova Competição" → "Copa Brasil 2026", marcar SP+RJ, marcar checkbox de subtítulo → Salvar. Lista mostra a linha com `RJ, SP` em Estados e ✓ em Subtítulo.
4. Editar → marcar MG+PR → Salvar → lista atualiza para `MG, PR, RJ, SP`.
5. Criar outra com mesmo nome → erro 409 amigável.
6. Criar uma sem nenhuma UF marcada → submit bloqueado com mensagem.
7. Excluir uma → some da lista.
8. Rodapé do sidebar mostra `v1.3.0 (<sha>)` com badge (versão nova vs. localStorage `1.2.0`).
9. `/novidades` → entrada `1.3.0 — 2026-05-29` no topo.

## Riscos

| Risco | Mitigação |
|---|---|
| Validação de UF duplicada entre Zod (length 2) e service (SIGLAS_VALIDAS) | Intencional: Zod garante shape, service garante semântica. Comentário no controller esclarece. |
| Lista de 27 checkboxes ficar visualmente densa | Grid 4×7 com espaçamento Tailwind padrão. Pode evoluir para combo multi se ficar incômodo. |
| Refactor da constante `UFS` quebrar Municípios | Mudança trivial (2 arquivos, troca o literal pelo import); coberto por tsc + build. |
| Frontend strict-mode-off não pega erro de tipo em `estados` | Aceitar — padrão do projeto. Tests no backend cobrem validação. |
| Migração destrutiva acidental | Esta migração é só `CREATE TABLE` — não destrói nada. |
