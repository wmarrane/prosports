# Spec: Modalidades restruturada + TipoModalidade + drop Categoria

Data: 2026-05-29
Status: aprovado para implementação

## Objetivo

Remover a entidade `Categoria` (e o enum `Genero` associado), criar a nova entidade `TipoModalidade` (CRUD admin), e reescrever `Modalidade` para ter FKs obrigatórias para `Competicao` e `TipoModalidade`, novo campo `sigla`, e uniqueness composto `(competicao_id, nome)` + `(competicao_id, sigla)`. Bump para `1.4.0`.

## Escopo

- **Backend**: drop módulo `categorias` (+ tabela + enum Genero); novo módulo `tipos_modalidade`; reescrita do módulo `modalidades`; `competicoes.service.remover` ganha check 409 quando há Modalidade vinculada.
- **Frontend**: drop pages/service/types de Categoria; novo `types/modalidade.ts` (consolida `TipoModalidade` e `Modalidade`); apaga `fundacao.ts`; novos services + páginas para `TipoModalidade`; reescrita das páginas de `Modalidade`; sidebar reorganizado (remove "Categorias", insere "Tipos de Modalidade" entre Participantes e Modalidades); rotas atualizadas.
- **Migração**: destrutiva (drop Categoria + drop dados existentes de Modalidade — só dev seed; recria estrutura).
- **Release**: bump `package.json` para `1.4.0` + bloco CHANGELOG.

Fora de escopo:
- Substituir o conceito de Categoria (gênero/idade) por outra coisa — descartado por completo.
- Combo dependente (filtrar Modalidades ao escolher Competição em telas futuras).
- Validação adicional além das já descritas.

## Decisões de design

| # | Decisão | Justificativa |
|---|---|---|
| 1 | Drop Categoria + Genero | Wagner confirmou que Categoria não será usada |
| 2 | `TipoModalidade` como FK (não enum) | Wagner escolheu — permite CRUD admin sem deploy |
| 3 | `sigla` obrigatória, 2–6 chars | Curta, consistente (FUT, BSK, VOL) |
| 4 | Uniqueness composto `(competicao_id, nome)` + `(competicao_id, sigla)` | Mesma modalidade pode existir em competições diferentes |
| 5 | Drop `descricao` de Modalidade | Não utilizado |
| 6 | Drop dados existentes de Modalidade | Dev seed; recria via UI após deploy |
| 7 | Sidebar: "Tipos de Modalidade" entre Participantes e Modalidades | Referência antes do consumidor |
| 8 | `competicoes.remover` retorna 409 quando há Modalidade vinculada | Consistente com Município/Inspetoria |
| 9 | Map `P2002` para mensagem genérica de duplicidade | Cobre ambos os uniques sem inspecionar `err.meta.target` |
| 10 | Bump `1.4.0` (MINOR) | Feature aditiva no domínio (TipoModalidade) apesar de breaking interno; sem consumer externo |

## Modelo de dados

```prisma
model TipoModalidade {
  id            Int          @id @default(autoincrement())
  nome          String       @unique
  modalidades   Modalidade[]
  criado_em     DateTime     @default(now())
  atualizado_em DateTime     @updatedAt
}

model Modalidade {
  id                  Int             @id @default(autoincrement())
  nome                String
  sigla               String
  competicao          Competicao      @relation(fields: [competicao_id], references: [id])
  competicao_id       Int
  tipo_modalidade     TipoModalidade  @relation(fields: [tipo_modalidade_id], references: [id])
  tipo_modalidade_id  Int
  criado_em           DateTime        @default(now())
  atualizado_em       DateTime        @updatedAt

  @@unique([competicao_id, nome])
  @@unique([competicao_id, sigla])
}
```

**Mudanças em outros models:**
- `Competicao`: adicionar `modalidades Modalidade[]`.
- Remover por completo: model `Categoria` e enum `Genero`.

**Migração esperada:**
1. `DROP TABLE "Categoria"` (cascade na FK para Modalidade).
2. `DROP TYPE "Genero"`.
3. `ALTER TABLE "Modalidade"`: `DROP COLUMN descricao`, `DROP INDEX Modalidade_nome_key` (unique global).
4. **`DELETE FROM "Modalidade"`** — dev seed; FKs novas obrigatórias inviáveis em rows pré-existentes.
5. `ALTER TABLE "Modalidade"` adicionando `sigla TEXT NOT NULL`, `competicao_id INT NOT NULL`, `tipo_modalidade_id INT NOT NULL` + 2 FKs.
6. `CREATE UNIQUE INDEX` para os 2 uniques compostos.
7. `CREATE TABLE "TipoModalidade"` com unique `nome`.

## Backend

### Estrutura

```
backend/src/modules/
  tipos_modalidade/
    tipos_modalidade.controller.ts
    tipos_modalidade.routes.ts
    tipos_modalidade.service.ts
    tipos_modalidade.service.test.ts
  modalidades/
    modalidades.controller.ts    (reescrito)
    modalidades.routes.ts        (intacto — paths não mudam)
    modalidades.service.ts       (reescrito)
    modalidades.service.test.ts  (reescrito)
  competicoes/
    competicoes.service.ts       (modificar: remover ganha check 409)
    competicoes.service.test.ts  (modificar: novo teste)
```

**Remove:** `backend/src/modules/categorias/` (4 arquivos) + import + `app.use` em `src/index.ts`.

### Endpoints

| Método | Rota | Auth | Body |
|---|---|---|---|
| `GET`    | `/tipos-modalidade`      | autenticado | listar |
| `GET`    | `/tipos-modalidade/:id`  | autenticado | detalhe |
| `POST`   | `/tipos-modalidade`      | ADMIN | `{ nome }` |
| `PUT`    | `/tipos-modalidade/:id`  | ADMIN | parcial |
| `DELETE` | `/tipos-modalidade/:id`  | ADMIN | 409 se vínculo com Modalidade |
| `GET`    | `/modalidades`           | autenticado | listar; query opcional `?competicao_id=N` filtra |
| `GET`    | `/modalidades/:id`       | autenticado | detalhe (com `include` de competicao + tipo) |
| `POST`   | `/modalidades`           | ADMIN | `{ nome, sigla, competicao_id, tipo_modalidade_id }` |
| `PUT`    | `/modalidades/:id`       | ADMIN | parcial |
| `DELETE` | `/modalidades/:id`       | ADMIN | deleta direto (sem dependências após drop Categoria) |
| `DELETE` | `/competicoes/:id`       | ADMIN | **agora retorna 409** se Modalidade vinculada |

### Services

**`tipos_modalidade.service.ts`** — padrão idêntico a `inspetorias.service.ts`. `remover` chama `prisma.modalidade.count({ where: { tipo_modalidade_id: id } })` e lança 409 se > 0.

**`modalidades.service.ts`** — reescrita:
- `listar(competicao_id?: number)` — orderBy `[{ competicao: { nome: 'asc' } }, { nome: 'asc' }]`, com `include: { competicao: true, tipo_modalidade: true }`. Quando `competicao_id` informado, filtra.
- `buscarPorId` com mesmo include.
- `criar(data)` e `editar(id, data)` wrap em `mapPrismaError` que captura `P2002` e lança `{ status: 409, message: 'Já existe uma modalidade com este nome ou sigla nesta competição.' }`.
- `remover(id)` é `prisma.modalidade.delete({ where: { id } })` puro.

**`competicoes.service.ts`** — alterar `remover`:
```ts
export async function remover(id: number) {
  const vinculadas = await prisma.modalidade.count({ where: { competicao_id: id } })
  if (vinculadas > 0) {
    throw Object.assign(
      new Error('Remova as modalidades vinculadas antes de excluir esta competição.'),
      { status: 409 }
    )
  }
  return prisma.competicao.delete({ where: { id } })
}
```

E o test correspondente em `competicoes.service.test.ts` adicionado: 2 novos casos (`prisma.modalidade.count` retornando 2 → 409; retornando 0 → delete chamado).

### Controllers (Zod)

**TipoModalidade:**
```ts
const createSchema = z.object({ nome: z.string().min(1) })
```

**Modalidade:**
```ts
const createSchema = z.object({
  nome: z.string().min(1),
  sigla: z.string().min(2).max(6),
  competicao_id: z.coerce.number().int().positive(),
  tipo_modalidade_id: z.coerce.number().int().positive(),
})
const updateSchema = createSchema.partial()
```

`listar` query: `z.object({ competicao_id: z.coerce.number().int().positive().optional() }).parse(req.query)`.

### Routes

GET = `requireAuth` apenas. POST/PUT/DELETE = `[requireAuth, requireRole('ADMIN')]`.

### Registro em `src/index.ts`

- Remover import + `app.use` de `categoriasRoutes`.
- Adicionar `import tiposModalidadeRoutes from './modules/tipos_modalidade/tipos_modalidade.routes'`.
- Adicionar `app.use('/tipos-modalidade', tiposModalidadeRoutes)` antes de `app.use('/modalidades', ...)`.

### Tests (vitest)

- `tipos_modalidade.service.test.ts`: 6 testes (CRUD + 404 + 409).
- `modalidades.service.test.ts` reescrito: listar com include, listar filtrando por `competicao_id`, 404, criar com FKs + sigla, editar parcial, remover, P2002 → 409.
- `competicoes.service.test.ts`: + 2 testes (remover 409 / remover OK).

## Frontend

### Estrutura

```
frontend/src/
  types/
    modalidade.ts                  # NEW: TipoModalidade + Modalidade
  services/
    tipos-modalidade.ts            # NEW
    modalidades.ts                 # REWRITE (payload + Partial)
  pages/
    tipos-modalidade/
      TiposModalidadeList.tsx      # NEW
      TipoModalidadeForm.tsx       # NEW
    modalidades/
      ModalidadesList.tsx          # REWRITE (4 cols: Competição/Tipo/Nome/Sigla)
      ModalidadeForm.tsx           # REWRITE (2 combos + nome + sigla)
  App.tsx                          # routes: drop /categorias/*, add /tipos-modalidade/*
  components/Layout.tsx            # sidebar reorder
```

**Remove:**
- `frontend/src/pages/categorias/` (2 arquivos).
- `frontend/src/services/categorias.ts`.
- `frontend/src/types/fundacao.ts` — apaga o arquivo (Modalidade migra; Categoria/Genero saem).

### Types

`types/modalidade.ts`:
```ts
import type { Competicao } from './competicao'

export type TipoModalidade = {
  id: number
  nome: string
  criado_em: string
  atualizado_em: string
}

export type Modalidade = {
  id: number
  nome: string
  sigla: string
  competicao_id: number
  competicao: Competicao
  tipo_modalidade_id: number
  tipo_modalidade: TipoModalidade
  criado_em: string
  atualizado_em: string
}
```

### Services

**`services/tipos-modalidade.ts`** — padrão `inspetorias.ts`:
```ts
listar(), buscar(id), criar({nome}), editar(id, {nome?}), remover(id)
```

**`services/modalidades.ts`** — reescrito:
```ts
type ModalidadePayload = { nome: string; sigla: string; competicao_id: number; tipo_modalidade_id: number }
listar(params?: { competicao_id?: number }), buscar(id), criar(data), editar(id, Partial<data>), remover(id)
```

### Páginas

**`TiposModalidadeList.tsx` / `TipoModalidadeForm.tsx`** — clones de `InspetoriasList`/`InspetoriaForm` adaptadas (1 coluna `nome`, 1 input `nome`, `actionTo='/tipos-modalidade/novo'`, `backTo='/tipos-modalidade'`).

**`ModalidadesList.tsx`** (reescrito):
- Colunas: `Competição` (`row.competicao.nome`) · `Tipo` (`row.tipo_modalidade.nome`) · `Nome` (`row.nome`) · `Sigla` (`row.sigla`, classe `w-20 font-mono`) · `Ações`.
- queryKey `['modalidades']`, sem filtros agora (eventual filtro por competição é refinamento futuro).

**`ModalidadeForm.tsx`** (reescrito):
- Combo `Competição` (obrigatório) — carrega via `competicoesService.listar()`.
- Combo `Tipo de Modalidade` (obrigatório) — carrega via `tiposModalidadeService.listar()`.
- Input `Nome` (obrigatório).
- Input `Sigla` (obrigatório, `maxLength={6}` no input; converter pra uppercase no submit via `sigla.trim().toUpperCase()`).
- Validação client-side: se algum required vazio, mostra erro inline.

### App.tsx

Remover:
```tsx
import CategoriasList from './pages/categorias/CategoriasList'
import CategoriaForm from './pages/categorias/CategoriaForm'
// e as 3 rotas /categorias/*
```

Adicionar (após as rotas de `/participantes/*`, antes das de `/modalidades/*`):
```tsx
import TiposModalidadeList from './pages/tipos-modalidade/TiposModalidadeList'
import TipoModalidadeForm from './pages/tipos-modalidade/TipoModalidadeForm'

<Route path="/tipos-modalidade"            element={<TiposModalidadeList />} />
<Route path="/tipos-modalidade/novo"       element={<TipoModalidadeForm />} />
<Route path="/tipos-modalidade/:id/editar" element={<TipoModalidadeForm />} />
```

### Layout.tsx (sidebar)

Substituir o array `items` do grupo Cadastros por:
```tsx
items: [
  { label: 'Municípios',          to: '/municipios' },
  { label: 'Inspetorias',         to: '/inspetorias' },
  { label: 'Delegacias',          to: '/delegacias' },
  { label: 'Participantes',       to: '/participantes' },
  { label: 'Tipos de Modalidade', to: '/tipos-modalidade' },
  { label: 'Modalidades',         to: '/modalidades' },
  { label: 'Competições',         to: '/competicoes' },
]
```

"Categorias" removido. "Tipos de Modalidade" entre Participantes e Modalidades.

## Release

### Bump

`package.json` (root): `1.3.0` → `1.4.0`.

### CHANGELOG.md

Novo bloco no topo (após cabeçalho, antes de `## [1.3.0]`):

```md
## [1.4.0] - 2026-05-29

### Added
- Entidade TipoModalidade com CRUD admin.
- Modalidade ganha FKs obrigatórias para Competição e TipoModalidade, e novo campo Sigla.

### Changed
- Modalidade reescrita: agora pertence a uma Competição, tem Tipo (FK) e Sigla; nome e sigla únicos por competição (uniqueness composto).
- Sidebar: "Tipos de Modalidade" entra entre Participantes e Modalidades; "Categorias" removido.

### Removed
- Entidade Categoria (e enum Genero — só era usado por Categoria).
- Campo `descricao` de Modalidade.
- Item "Categorias" do sidebar e rotas correspondentes.
```

### Deploy

Push em `develop` → CI roda `prisma migrate deploy` (drop Categoria/Genero, drop Modalidade rows, create TipoModalidade, alter Modalidade) → reconstrói os 2 containers. ~5 min.

### Smoke test pós-deploy (manual, browser)

1. **Sidebar** tem 7 itens em Cadastros nessa ordem: Municípios · Inspetorias · Delegacias · Participantes · **Tipos de Modalidade** · Modalidades · Competições. Sem "Categorias".
2. **Tipos de Modalidade** → cadastrar "Coletivo" e "Individual".
3. **Modalidades** → "+ Nova Modalidade": Competição = "Copa Brasil 2026" (já criada), Tipo = "Coletivo", Nome = "Futebol", Sigla = "FUT" → Salvar. Lista mostra `Copa Brasil 2026 · Coletivo · Futebol · FUT`.
4. Criar **outra Modalidade na mesma Competição com mesma sigla "FUT"** → 409 amigável.
5. Criar a mesma "Futebol" "FUT" em **outra Competição** → permitido.
6. Tentar excluir o TipoModalidade "Coletivo" → 409.
7. Tentar excluir a Competição "Copa Brasil 2026" → 409.
8. Remover a Modalidade → consegue. Tentar excluir o Tipo de novo → consegue (sem vínculo).
9. Rodapé do sidebar `v1.4.0 (<sha>)` com badge → `/novidades` tem entrada `1.4.0 — 2026-05-29` no topo.

## Riscos

| Risco | Mitigação |
|---|---|
| Drop de Modalidade existente apaga dados | Confirmado: só dev seed. Migration documenta intenção. |
| Wagner cria Modalidades antes do deploy quebrar tudo | Não há produção; aceitável recriar via UI após deploy. |
| Combo Tipo / Competição ficar vazio se admin não cadastrou ainda | UI mostra dropdown vazio; validação client-side bloqueia submit; é responsabilidade do admin popular as referências primeiro. Documentado no smoke test (ordem: Tipos → Modalidades). |
| Map P2002 não diferencia qual unique violou | Mensagem genérica "este nome ou sigla". Aceito — simplifica e cobre os 2 casos. |
| `fundacao.ts` ser referenciado por algum arquivo esquecido | Plan inclui grep antes do commit final para garantir. |
| Migration falhar se houver Categorias órfãs no DB de prod | Sem prod ainda; dev é destrutivo. |
