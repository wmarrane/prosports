# Spec: Participantes (rename + Inspetoria + Delegacia)

Data: 2026-05-28
Status: aprovado para implementação

## Objetivo

Substituir a entidade `Delegacao` por `Participante` (com novos campos e novas FKs), adicionar duas entidades de referência novas (`Inspetoria` e `Delegacia`), e expor CRUDs admin para as três. A versão sobe para `1.2.0`.

## Escopo

- **Backend**: criar `Inspetoria`, `Delegacia`, `Participante` (Prisma + service + controller + routes + tests). Remover o módulo `delegacoes`. Atualizar `municipios.service` para verificar vínculo em `Participante` em vez de `Delegacao`.
- **Frontend**: criar páginas de lista/form para as 3 entidades novas. Remover páginas/service/tipo de `Delegacoes`. Atualizar sidebar e rotas. Reutilizar `MunicipioSelect`.
- **Migração**: destrutiva (`DROP TABLE Delegacao`); sem preservar dados.
- **Release**: bump `package.json` para `1.2.0` e adicionar entrada no `CHANGELOG.md`.

Fora de escopo:
- Hierarquia entre Inspetoria e Delegacia (são entidades irmãs).
- Logo de Participante (removido).
- Importação em lote (CSV) de Inspetoria/Delegacia/Participante.
- Sigla/endereço/município-sede nas entidades de referência.
- Permissão por entidade (segue o esquema atual: GET autenticado, escrita ADMIN).

## Decisões de design

| # | Decisão | Justificativa |
|---|---|---|
| 1 | Inspetoria e Delegacia são entidades irmãs sem hierarquia | Wagner confirmou — Delegacia não pertence a Inspetoria |
| 2 | Inspetoria/Delegacia têm apenas `nome` (unique) | YAGNI — não precisamos de sigla ou município-sede agora |
| 3 | `subtitulo`, `inspetoria_id`, `delegacia_id` opcionais; `municipio_id` obrigatório | Confirmação direta do usuário |
| 4 | Sem logo em Participante | Não era usado pelos novos requisitos |
| 5 | Migração destrutiva (DROP Delegacao) | Sem dados de produção; sem precisar preservar registros de dev |
| 6 | Versão `1.2.0` (MINOR, não MAJOR) | Não há consumer externo da API; frontend ship junto |
| 7 | Selector autocomplete só para Município | Inspetoria/Delegacia terão poucas dezenas de itens — `<select>` é suficiente |
| 8 | 409 ao deletar registro com vínculos | Consistente com o padrão atual de Modalidade/Município |

## Modelo de dados (Prisma)

```prisma
model Inspetoria {
  id            Int            @id @default(autoincrement())
  nome          String         @unique
  participantes Participante[]
  criado_em     DateTime       @default(now())
  atualizado_em DateTime       @updatedAt
}

model Delegacia {
  id            Int            @id @default(autoincrement())
  nome          String         @unique
  participantes Participante[]
  criado_em     DateTime       @default(now())
  atualizado_em DateTime       @updatedAt
}

model Participante {
  id            Int          @id @default(autoincrement())
  nome          String
  subtitulo     String?
  inspetoria    Inspetoria?  @relation(fields: [inspetoria_id], references: [id])
  inspetoria_id Int?
  delegacia     Delegacia?   @relation(fields: [delegacia_id], references: [id])
  delegacia_id  Int?
  municipio     Municipio    @relation(fields: [municipio_id], references: [id])
  municipio_id  Int
  criado_em     DateTime     @default(now())
  atualizado_em DateTime     @updatedAt
}
```

**Mudança em `Municipio`:** a back-reference `delegacoes Delegacao[]` é renomeada para `participantes Participante[]`. Restante do modelo intocado.

**Migração:** `prisma migrate dev --name rename_delegacao_to_participante_with_refs`. Esperado:
- `DROP TABLE "Delegacao"` (e seus índices/constraints)
- `CREATE TABLE "Inspetoria"` + unique index em `nome`
- `CREATE TABLE "Delegacia"` + unique index em `nome`
- `CREATE TABLE "Participante"` com 3 FKs (Inspetoria/Delegacia opcionais, Municipio obrigatório)

## Backend

### Estrutura

```
backend/src/modules/
  inspetorias/
    inspetorias.controller.ts
    inspetorias.routes.ts
    inspetorias.service.ts
    inspetorias.service.test.ts
  delegacias/
    delegacias.controller.ts
    delegacias.routes.ts
    delegacias.service.ts
    delegacias.service.test.ts
  participantes/
    participantes.controller.ts
    participantes.routes.ts
    participantes.service.ts
    participantes.service.test.ts
```

**Remove:** todo o diretório `backend/src/modules/delegacoes/` (4 arquivos).

### Endpoints

| Método | Rota | Auth | Body / Notas |
|---|---|---|---|
| `GET`    | `/inspetorias`       | autenticado | listar |
| `GET`    | `/inspetorias/:id`   | autenticado | detalhe |
| `POST`   | `/inspetorias`       | ADMIN | `{ nome }` |
| `PUT`    | `/inspetorias/:id`   | ADMIN | `{ nome }` |
| `DELETE` | `/inspetorias/:id`   | ADMIN | 409 se vínculo em Participante |
| `GET`    | `/delegacias`        | autenticado | listar |
| `GET`    | `/delegacias/:id`    | autenticado | detalhe |
| `POST`   | `/delegacias`        | ADMIN | `{ nome }` |
| `PUT`    | `/delegacias/:id`    | ADMIN | `{ nome }` |
| `DELETE` | `/delegacias/:id`    | ADMIN | 409 se vínculo em Participante |
| `GET`    | `/participantes`     | autenticado | listar com `include` de Inspetoria/Delegacia/Município |
| `GET`    | `/participantes/:id` | autenticado | detalhe com mesmo `include` |
| `POST`   | `/participantes`     | ADMIN | `{ nome, subtitulo?, inspetoria_id?, delegacia_id?, municipio_id }` |
| `PUT`    | `/participantes/:id` | ADMIN | parcial |
| `DELETE` | `/participantes/:id` | ADMIN | deleta direto |

GET autenticado (não ADMIN) nas 3 entidades para que dropdowns do Participante funcionem para usuários não-admin.

### Services

**`participantes.service.ts`:** padrão CRUD; `listar`/`buscarPorId` usam `include: { inspetoria: true, delegacia: true, municipio: true }`. `criar`/`editar` aceitam os 5 campos (subtitulo/inspetoria_id/delegacia_id opcionais).

**`inspetorias.service.ts` / `delegacias.service.ts`:** mesmo shape do `modalidades.service.ts`. `remover` chama `prisma.participante.count({ where: { inspetoria_id: id } })` (ou `delegacia_id`) e lança 409 quando > 0.

**Atualização obrigatória em `municipios.service.ts`:** o `remover` atualmente chama `prisma.delegacao.count({ where: { municipio_id: id } })`. Substituir por `prisma.participante.count({ where: { municipio_id: id } })`. Mensagem do erro também muda para "Remova os participantes vinculados antes de excluir este município." O teste correspondente em `municipios.service.test.ts` precisa atualizar o mock (`mockPrisma.delegacao` → `mockPrisma.participante`).

### Controllers / Routes

Padrão idêntico ao existente em `municipios`/`modalidades`. Zod schemas:
- Inspetoria/Delegacia: `z.object({ nome: z.string().min(1) })`
- Participante: `z.object({ nome: z.string().min(1), subtitulo: z.string().optional(), inspetoria_id: z.coerce.number().int().positive().optional(), delegacia_id: z.coerce.number().int().positive().optional(), municipio_id: z.coerce.number().int().positive() })`

### Registro em `src/index.ts`

- Remover `import delegacoesRoutes from './modules/delegacoes/delegacoes.routes'` e `app.use('/delegacoes', delegacoesRoutes)`.
- Adicionar:
  - `import inspetoriasRoutes from './modules/inspetorias/inspetorias.routes'` + `app.use('/inspetorias', inspetoriasRoutes)`
  - `import delegaciasRoutes from './modules/delegacias/delegacias.routes'` + `app.use('/delegacias', delegaciasRoutes)`
  - `import participantesRoutes from './modules/participantes/participantes.routes'` + `app.use('/participantes', participantesRoutes)`

### Testes (vitest)

- Cada módulo novo tem seu `<name>.service.test.ts` cobrindo CRUD + 404 + (para inspetorias/delegacias) o 409 de vínculo.
- `participantes.service.test.ts` cobre listar com include, criar com FKs nulas e preenchidas, editar parcial, remover.
- `municipios.service.test.ts` adapta o mock e o teste de 409 para usar `participante`.

## Frontend

### Estrutura

```
frontend/src/
  pages/
    inspetorias/
      InspetoriasList.tsx
      InspetoriaForm.tsx
    delegacias/
      DelegaciasList.tsx
      DelegaciaForm.tsx
    participantes/
      ParticipantesList.tsx
      ParticipanteForm.tsx
  services/
    inspetorias.ts
    delegacias.ts
    participantes.ts
  types/
    participante.ts        # novo: tipos Participante + Inspetoria + Delegacia
```

**Remove:**
- `frontend/src/pages/delegacoes/` (2 arquivos)
- `frontend/src/services/delegacoes.ts`
- O type `Delegacao` em `frontend/src/types/fundacao.ts` (se o arquivo ficar vazio, deletar).

### Types

`types/participante.ts`:
```ts
import type { Municipio } from './municipio'

export type Inspetoria = { id: number; nome: string; criado_em: string; atualizado_em: string }
export type Delegacia  = { id: number; nome: string; criado_em: string; atualizado_em: string }

export type Participante = {
  id: number
  nome: string
  subtitulo: string | null
  inspetoria_id: number | null
  inspetoria: Inspetoria | null
  delegacia_id: number | null
  delegacia: Delegacia | null
  municipio_id: number
  municipio: Municipio
  criado_em: string
  atualizado_em: string
}
```

### Services

`services/inspetorias.ts` e `services/delegacias.ts` seguem o shape do `services/modalidades.ts` (listar/buscar/criar/editar/remover, payload `{ nome }`).

`services/participantes.ts` aceita o payload completo de Participante (sem FormData — sem upload).

### Páginas

**`ParticipantesList.tsx`:**
- Tabela com colunas: Nome · Subtítulo · Inspetoria · Delegacia · Município (`nome — UF`) · Ações.
- Campos opcionais vazios renderizam `—`.
- `Inspetoria` mostra `row.inspetoria?.nome ?? '—'`, idem Delegacia.
- Sem filtros nem paginação (segue padrão atual de Delegações).

**`ParticipanteForm.tsx`:**
- Inputs: `nome` (required), `subtitulo` (optional).
- `inspetoria_id`: `<select>` populado por `inspetoriasService.listar()`, primeira opção "— Sem inspetoria —" (value `''` → null).
- `delegacia_id`: idem com `delegaciasService.listar()`.
- `municipio_id`: `<MunicipioSelect />` existente, obrigatório.
- Validação client-side: bloqueia submit se `nome` vazio ou `municipio_id` nulo, mostra mensagem.

**`InspetoriasList.tsx` / `InspetoriaForm.tsx`** e **`DelegaciasList.tsx` / `DelegaciaForm.tsx`:**
- Cópia visual de `ModalidadesList.tsx` / `ModalidadeForm.tsx` adaptada (tabela com nome + ações; form de 1 campo).
- Erro de unicidade do backend é exibido como toast/`<p>` vermelho usando `err.response.data.message`.

### Layout

`components/Layout.tsx`, grupo `Cadastros`:

```tsx
items: [
  { label: 'Municípios',    to: '/municipios' },
  { label: 'Inspetorias',   to: '/inspetorias' },
  { label: 'Delegacias',    to: '/delegacias' },
  { label: 'Participantes', to: '/participantes' },
  { label: 'Modalidades',   to: '/modalidades' },
  { label: 'Categorias',    to: '/categorias' },
]
```

### Rotas

`App.tsx`:
- Remover 3 rotas de `/delegacoes/*` e o redirect `/` → `/delegacoes`.
- Adicionar:
  ```tsx
  <Route path="/inspetorias"            element={<InspetoriasList />} />
  <Route path="/inspetorias/novo"       element={<InspetoriaForm />} />
  <Route path="/inspetorias/:id/editar" element={<InspetoriaForm />} />
  <Route path="/delegacias"             element={<DelegaciasList />} />
  <Route path="/delegacias/nova"        element={<DelegaciaForm />} />
  <Route path="/delegacias/:id/editar"  element={<DelegaciaForm />} />
  <Route path="/participantes"            element={<ParticipantesList />} />
  <Route path="/participantes/novo"       element={<ParticipanteForm />} />
  <Route path="/participantes/:id/editar" element={<ParticipanteForm />} />
  ```
- Redirect raiz: `<Route path="/" element={<Navigate to="/participantes" replace />} />`.

## Release

### Bump

`package.json` (root): `1.1.0` → `1.2.0`.

### CHANGELOG.md (novo bloco no topo)

```md
## [1.2.0] - 2026-05-28

### Added
- Entidade Inspetoria com CRUD admin.
- Entidade Delegacia com CRUD admin.
- Entidade Participante (substitui Delegação) com FKs para Inspetoria, Delegacia e Município.
- Campo Subtítulo opcional em Participante.

### Changed
- Renomeada "Delegações" para "Participantes" no sidebar e nas rotas.
- Município agora bloqueia exclusão se houver Participante vinculado (antes era Delegação).

### Removed
- Entidade Delegação (substituída por Participante).
- Campo logo do registro (não era usado pelos novos requisitos).
```

### Deploy

Push em `develop` → CI executa `prisma migrate deploy` (aplica `DROP Delegacao` + `CREATE Inspetoria/Delegacia/Participante`) e reconstrói os dois containers. Mesmo fluxo das releases anteriores. ~5 min.

### Smoke test pós-deploy (manual, browser)

1. Sidebar mostra `Participantes` (não Delegações), com `Inspetorias` e `Delegacias` novos no mesmo grupo.
2. Cadastrar 2 inspetorias e 2 delegacias.
3. Cadastrar 1 participante usando ambas + município pelo autocomplete.
4. Tentar excluir uma inspetoria vinculada → 409 com mensagem clara.
5. Tentar excluir o município do participante → 409 com mensagem nova ("Remova os participantes...").
6. Sidebar rodapé mostra `v1.2.0 (<sha>)` com badge indigo (versão nova vs. localStorage `1.1.0`).
7. Abrir `/novidades` → entrada `1.2.0` no topo com Added/Changed/Removed.

## Riscos

| Risco | Mitigação |
|---|---|
| Migração destrutiva apaga dados de Delegação | Confirmado: só dados de seed dev. Documentado como intencional. |
| `municipios.service` esquecer de mudar a referência `delegacao.count` → `participante.count` | Task dedicada no plano antes de ligar os módulos novos. |
| Sidebar fica com 6 itens em Cadastros | Ordem foi pensada (referência → consumidor → domínio). Reorganizar futuro se incomodar. |
| Frontend tsconfig não-strict deixa passar erro de tipo de `Delegacao` removido | Plan vai rodar `grep` por "delegacao"/"Delegacao" antes do commit final. |
| Confusão semântica entre "delegacia" (nova entidade) e "delegação" (entidade antiga) | A nomeação é parecida mas distinta. A entidade antiga some por completo; só a nova "Delegacia" permanece. |
