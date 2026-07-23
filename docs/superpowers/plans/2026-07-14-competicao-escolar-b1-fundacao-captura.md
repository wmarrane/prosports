# Competição escolar B1 — Fundação + captura — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans. Steps usam checkbox (`- [ ]`).

**Goal:** Habilitar, na competição, o toggle "subtítulo e município variam por modalidade" e permitir capturar/persistir esses overrides por inscrição (import + manual), expondo-os na API. Sem mudança de exibição ainda (isso é o B2).

**Architecture:** Migração aditiva (flag na Competição; `subtitulo`/`municipio_id` nullable na Inscrição). Backend passa a aceitar/retornar os overrides no create, no import e no listar de inscrições. Frontend: toggle no cadastro da competição; colunas de override no import; campos no cadastro manual. Toggle desligado ⇒ comportamento idêntico ao atual.

**Tech Stack:** Prisma/Postgres, Express, Zod, Vitest; React/Vite (admin).

## Global Constraints

- Host Windows; ler antes de editar; caminhos absolutos; git identity inline (`-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`); nunca `git add -A`.
- Migração **aditiva** — inspecionar o `migration.sql` gerado (sem DROP). **Não** aplicar em prod nesta fase.
- Backend: `cd backend && npx tsc --noEmit` e `npx vitest run` dos módulos tocados. Frontend: `cd frontend && npm run build`.
- Toggle **desligado** deve manter tudo como hoje (regressão zero para as outras competições).
- Validar no dev; promoção a prod só com confirmação do Wagner (e Cloud SQL ligada — há migração).

---

### Task 1: Schema + migração aditiva

**Files:** `backend/prisma/schema.prisma`; nova migração em `backend/prisma/migrations/`.

- [ ] **Step 1: Editar o schema**
Em `model Competicao`, após `subtitulo_campos`:
```prisma
  subtitulo_municipio_por_modalidade Boolean @default(false)
```
Em `model Inscricao`, após `participante_id`:
```prisma
  subtitulo       String?
  municipio       Municipio?   @relation("InscricaoMunicipio", fields: [municipio_id], references: [id])
  municipio_id    Int?
```
Em `model Municipio`, adicionar a back-relation (encontrar o bloco `model Municipio` e adicionar na lista de relações):
```prisma
  inscricoes      Inscricao[]  @relation("InscricaoMunicipio")
```
(Se `Municipio` já tem outra relação com `Inscricao`, usar o nome `"InscricaoMunicipio"` só aqui; o `Participante.municipio` continua com sua relação default.)

- [ ] **Step 2: Gerar a migração (sem aplicar em prod)**
Run: `cd backend && npx prisma migrate dev --name escolar_subtitulo_municipio_por_modalidade --create-only`
Depois **inspecionar** `backend/prisma/migrations/<timestamp>_escolar_subtitulo_municipio_por_modalidade/migration.sql`: deve conter apenas `ALTER TABLE "Competicao" ADD COLUMN ... DEFAULT false`, `ALTER TABLE "Inscricao" ADD COLUMN "subtitulo"`, `ADD COLUMN "municipio_id"`, e `ADD CONSTRAINT ... FOREIGN KEY ("municipio_id")`. **Nenhum DROP.**

- [ ] **Step 3: Aplicar no banco de dev local do agente (se houver) e gerar client**
Run: `cd backend && npx prisma generate`
Expected: client atualizado, `tsc` reconhece os novos campos. (A aplicação no dev real ocorre no deploy-develop via `prisma migrate deploy`.)

- [ ] **Step 4: Commit**
```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(escolar): schema toggle na competicao + overrides subtitulo/municipio na inscricao (B1)"
```

---

### Task 2: Toggle no backend + cadastro da competição

**Files:** `backend/src/modules/competicoes/competicoes.service.ts`, `.../competicoes.controller.ts`, `frontend/src/pages/competicoes/CompeticaoForm.tsx`, `frontend/src/types/competicao.ts`.

- [ ] **Step 1: Service** — em `competicoes.service.ts`:
`criar(input)`: estender o tipo do parâmetro com `subtitulo_municipio_por_modalidade?: boolean` e incluir em `data`: `subtitulo_municipio_por_modalidade: input.subtitulo_municipio_por_modalidade ?? false`.
`editar(id, input)`: estender o `Partial<{...}>` com `subtitulo_municipio_por_modalidade: boolean` (o `update({data: input})` já repassa).

- [ ] **Step 2: Controller** — em `competicoes.controller.ts`, no `createSchema`, adicionar:
```ts
  subtitulo_municipio_por_modalidade: z.boolean().optional().default(false),
```
(`updateSchema = createSchema.partial()` já cobre o editar.)

- [ ] **Step 3: Frontend form** — em `CompeticaoForm.tsx`: ler o arquivo; adicionar um estado `const [subMunPorMod, setSubMunPorMod] = useState(false)`, popular de `existing.subtitulo_municipio_por_modalidade` no load, incluir `subtitulo_municipio_por_modalidade: subMunPorMod` no payload de criar/editar, e um checkbox rotulado **"Subtítulo e município variam por modalidade (competição escolar)"** próximo do bloco de `subtitulo_campos`. Em `frontend/src/types/competicao.ts`, adicionar `subtitulo_municipio_por_modalidade?: boolean` ao tipo `Competicao`.

- [ ] **Step 4: Verificar** — `cd backend && npx tsc --noEmit` e `cd frontend && npm run build`.

- [ ] **Step 5: Commit**
```bash
git add backend/src/modules/competicoes/competicoes.service.ts backend/src/modules/competicoes/competicoes.controller.ts frontend/src/pages/competicoes/CompeticaoForm.tsx frontend/src/types/competicao.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(escolar): toggle subtitulo/municipio por modalidade no cadastro da competicao (B1)"
```

---

### Task 3: Overrides na inscrição (create + listar) no backend

**Files:** `backend/src/modules/inscricoes/inscricoes.service.ts`, `.../inscricoes.controller.ts`, `.../inscricoes.service.test.ts`.

**Interfaces:** `criar` passa a aceitar `subtitulo?: string | null` e `municipio_id?: number | null`; `INCLUDE` passa a trazer `municipio` (override). `listar`/`buscarPorId` retornam os overrides.

- [ ] **Step 1: Teste (falha primeiro)** — em `inscricoes.service.test.ts`, adicionar um teste que cria uma inscrição com `subtitulo` e `municipio_id` e verifica que `buscarPorId`/`listar` retornam esses campos + `municipio` (override) no include. (Seguir o padrão de setup já existente no arquivo.)

- [ ] **Step 2: Rodar e ver falhar** — `cd backend && npx vitest run src/modules/inscricoes/inscricoes.service.test.ts`.

- [ ] **Step 3: Implementar** — em `inscricoes.service.ts`:
  - `INCLUDE`: adicionar `municipio: true` (a relação override) ao lado de `participante`.
  - `type CreateInput`: adicionar `subtitulo?: string | null` e `municipio_id?: number | null`.
  - `criar(data)`: se `data.municipio_id != null`, validar que o município existe (`prisma.municipio.findUnique`), senão 400 "Município inválido". Passar `subtitulo` e `municipio_id` ao `prisma.inscricao.create({ data: { ... }})` (só os campos presentes).

- [ ] **Step 4: Controller** — em `inscricoes.controller.ts`, no `createSchema`, adicionar:
```ts
  subtitulo: z.string().max(200).nullish(),
  municipio_id: z.coerce.number().int().positive().nullish(),
```

- [ ] **Step 5: Rodar** — `cd backend && npx tsc --noEmit && npx vitest run src/modules/inscricoes`.

- [ ] **Step 6: Commit**
```bash
git add backend/src/modules/inscricoes/inscricoes.service.ts backend/src/modules/inscricoes/inscricoes.controller.ts backend/src/modules/inscricoes/inscricoes.service.test.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(escolar): inscricao aceita/retorna overrides subtitulo+municipio (B1)"
```

---

### Task 4: Captura via import (backend + modal)

**Files:** `backend/src/modules/inscricoes/inscricoes.service.ts` (`importar` + `ImportRow`), `.../inscricoes.controller.ts` (`importRowSchema`), `frontend/src/components/import/ImportInscricoesModal.tsx`, `frontend/src/types/inscricao.ts`, teste do import.

**Regra:** o participante continua sendo casado por **nome + `municipio_uf`/`municipio_nome`** (município de cadastro). Quando a competição tem o toggle ligado, as colunas **override** `municipio_mod_uf`/`municipio_mod_nome` (resolvidas para `municipio_id`) e `subtitulo` são gravadas na inscrição. Toggle desligado ⇒ import inalterado (ignora as colunas override).

- [ ] **Step 1: Teste (falha primeiro)** — teste do `importar` (não-dry_run) com uma competição com toggle ligado: uma linha com `municipio_mod_uf/nome` diferente do de cadastro grava a inscrição com `municipio_id` (override) e `subtitulo` corretos; com toggle desligado, a inscrição fica sem overrides.

- [ ] **Step 2: Rodar e ver falhar** — `cd backend && npx vitest run src/modules/inscricoes`.

- [ ] **Step 3: Backend `importar`** — em `inscricoes.service.ts`:
  - `type ImportRow`: adicionar `municipio_mod_uf?: string`, `municipio_mod_nome?: string` (subtitulo já existe).
  - Em `importar`, buscar `subtitulo_municipio_por_modalidade` da competição (via `evento.competicao_id`).
  - Se ligado: resolver o `municipio_id` override de cada linha por `(uf:nome)` — reutilizar a mesma lógica de `resolverParticipantes` para município (extrair um helper `resolverMunicipios(rows)` em `resolver-participantes.service.ts` OU consultar `prisma.municipio` por `uf in [...]`). Na `prisma.inscricao.create`, incluir `subtitulo: row.subtitulo ?? null` e `municipio_id: overrideMunicipioId ?? null`. Se o override município vier preenchido mas não resolver, marcar a linha como `erro` "Município (modalidade) '<nome>/<uf>' não encontrado" (não cria).
  - Se desligado: comportamento atual (não grava overrides).

- [ ] **Step 4: Controller** — `importRowSchema`: adicionar `municipio_mod_uf: z.string().length(2).optional()`, `municipio_mod_nome: z.string().max(120).optional()`.

- [ ] **Step 5: Frontend modal** — em `ImportInscricoesModal.tsx` e `frontend/src/types/inscricao.ts`: quando `evento.competicao.subtitulo_municipio_por_modalidade` for true, aceitar os headers extras `municipio_mod_uf,municipio_mod_nome` (e sempre `subtitulo`), mapeá-los para o `ImportRow`, e atualizar o texto de ajuda/headers de exemplo. Toggle desligado: modal inalterado.

- [ ] **Step 6: Rodar** — `cd backend && npx tsc --noEmit && npx vitest run src/modules/inscricoes` e `cd frontend && npm run build`.

- [ ] **Step 7: Commit**
```bash
git add backend/src/modules/inscricoes frontend/src/components/import/ImportInscricoesModal.tsx frontend/src/types/inscricao.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(escolar): import captura subtitulo+municipio por modalidade quando toggle ligado (B1)"
```

---

### Task 5: Captura manual (UI de inscrição)

**Files:** `frontend/src/pages/eventos/EventoInscricoes.tsx` (ou o componente onde a inscrição é adicionada manualmente à modalidade).

- [ ] **Step 1: Ler o arquivo** e localizar o fluxo de adicionar inscrito a uma modalidade e a chamada ao `inscricoesService` de criar.

- [ ] **Step 2: Implementar** — quando `evento.competicao.subtitulo_municipio_por_modalidade` for true, exibir dois campos opcionais na adição da inscrição: **Subtítulo** (texto) e **Município** (seletor de município — reusar o `MunicipioSelect` existente). Enviar `subtitulo` e `municipio_id` no payload de criar inscrição. Toggle desligado: UI inalterada.

- [ ] **Step 3: Verificar** — `cd frontend && npm run build`.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/pages/eventos/EventoInscricoes.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(escolar): cadastro manual de inscricao com subtitulo+municipio por modalidade (B1)"
```

---

## Verificação final (após as tasks)

- [ ] `cd backend && npx tsc --noEmit && npx vitest run src/modules/inscricoes src/modules/competicoes` e `cd frontend && npm run build` verdes.
- [ ] Migração revisada (aditiva, sem DROP).
- [ ] Merge → develop, deploy-develop (aplica a migração no dev). **Demo no dev:** criar/editar competição com o toggle; importar uma planilha com `municipio_mod_*`+`subtitulo` (município override ≠ cadastro) e conferir via API que a inscrição guardou os overrides; adicionar uma inscrição manual com os campos. Confirmar que uma competição **sem** o toggle continua idêntica.
- [ ] Exibição por modalidade (Modo Congresso/sorteio/público/relatórios) é o **B2** (próximo plano).

## Self-Review (cobertura da spec do B1)
- Toggle na competição (schema+service+controller+form): Tasks 1,2 ✓.
- Overrides na inscrição (schema+persist+expose): Tasks 1,3 ✓.
- Captura import (match por município de cadastro + override município/subtítulo): Task 4 ✓.
- Captura manual: Task 5 ✓.
- Regressão zero com toggle desligado: exigido em cada task ✓.
- Migração aditiva revisável: Task 1 ✓.
