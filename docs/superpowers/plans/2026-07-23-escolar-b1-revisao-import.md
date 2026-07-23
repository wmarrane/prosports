# Escolar B1-revisão — Import no formato real do Jeesp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps usam checkbox (`- [ ]`).

**Goal:** Ajustar o import de inscrições para o formato real do Jeesp quando a competição tem o toggle escolar: colunas `Participante,Subtitulo,Municipio` (pula linha de título), casa o participante **por nome** e **cria** a SREL se não existir, resolve o **município por nome** dentro dos estados da competição, e grava `Subtitulo`/`Municipio` como overrides da inscrição. Import não-escolar permanece inalterado.

**Architecture:** `importar` ganha um ramo escolar (toggle ON) com um resolver próprio (`resolverEscolar`: município por nome nos estados + participante por nome + cria se faltar). O ramo não-escolar (toggle OFF) segue com `resolverParticipantes` como hoje. Frontend: o modal, no escolar, parseia o formato de 3 colunas pulando a linha de título.

**Tech Stack:** Prisma/Postgres, Express, Zod, Vitest (mock-based); React (admin), PapaParse.

## Global Constraints

- Host Windows; ler antes de editar; caminhos absolutos; git identity inline; nunca `git add -A`.
- Backend: `cd backend && npx tsc --noEmit && npx vitest run src/modules/inscricoes`. Frontend: `cd frontend && npm run build`.
- **Não-escolar (toggle OFF) inalterado** — regressão zero. Sem schema/migration novos (as colunas já existem do B1).
- Escolar (spec REVISÃO 2026-07-23): match por nome; cria SREL se faltar (municipio placeholder = município resolvido da linha); município por nome nos `estados` da competição; override = fonte única (fallback é do B2).
- Validar no dev com os 2 CSVs reais.

---

### Task 1: Backend — ramo escolar do import (resolver + create + overrides)

**Files:** `backend/src/modules/participantes/resolver-participantes.service.ts` (novo `resolverEscolar`), `backend/src/modules/inscricoes/inscricoes.service.ts` (`ImportRow` + `importar`), `backend/src/modules/inscricoes/inscricoes.controller.ts` (`importRowSchema`), `backend/src/modules/inscricoes/inscricoes.service.test.ts`.

- [ ] **Step 1: Teste (falha primeiro)** — em `inscricoes.service.test.ts`, com competição escolar (toggle ON, `estados: ['SP']`), mockando `prisma.municipio.findMany`, `prisma.participante.findMany`, `prisma.participante.create`, `prisma.inscricao.create`:
  - linha com participante **novo** (nome inédito) → cria participante (`municipio_id` = município resolvido) e cria inscrição com `subtitulo` + `municipio_id` (override) corretos; status `criada`.
  - linha com participante **existente** (match por nome) → não cria participante; cria inscrição com overrides.
  - município (por nome, em SP) **não encontrado** → status `erro`, sem criar.
  - toggle OFF → caminho atual inalterado (usa `municipio_uf/nome`, não cria participante).

- [ ] **Step 2: Rodar e ver falhar** — `cd backend && npx vitest run src/modules/inscricoes`.

- [ ] **Step 3: `resolverEscolar`** — em `resolver-participantes.service.ts`, adicionar:
```ts
export type ResolucaoEscolar = {
  municipio_id: number | null
  ambiguo_municipio: boolean
  participante_id: number | null  // null = não existe (deve ser criado)
}

// Resolve município por NOME dentro dos estados da competição e participante por NOME.
// Nunca cria; a criação é decidida por importar() (respeita dry_run).
export async function resolverEscolar(
  rows: { nome: string; municipio_nome: string }[],
  estados: string[],
): Promise<ResolucaoEscolar[]> {
  const municipios = estados.length > 0
    ? await prisma.municipio.findMany({ where: { uf: { in: estados } }, select: { id: true, nome: true } })
    : []
  const munByNome = new Map<string, number[]>()
  for (const m of municipios) {
    const k = m.nome.toLowerCase()
    munByNome.set(k, [...(munByNome.get(k) ?? []), m.id])
  }
  const nomes = Array.from(new Set(rows.map(r => r.nome.trim().toLowerCase())))
  const participantes = nomes.length > 0
    ? await prisma.participante.findMany({ select: { id: true, nome: true } })
    : []
  const partByNome = new Map<string, number>()
  for (const p of participantes) partByNome.set(p.nome.trim().toLowerCase(), p.id)

  return rows.map(r => {
    const ids = munByNome.get(r.municipio_nome.trim().toLowerCase()) ?? []
    const municipio_id = ids.length === 1 ? ids[0] : null
    return {
      municipio_id,
      ambiguo_municipio: ids.length > 1,
      participante_id: partByNome.get(r.nome.trim().toLowerCase()) ?? null,
    }
  })
}
```

- [ ] **Step 4: `ImportRow` + `importar`** — em `inscricoes.service.ts`:
  - `ImportRow`: passar a `{ nome: string; municipio_uf?: string; municipio_nome: string; subtitulo?: string }` (remover `municipio_mod_uf`/`municipio_mod_nome`).
  - Em `importar`, ao buscar a competição, selecionar também `estados: true`.
  - **Se `toggleOn`:** usar `resolverEscolar(input.rows, competicao.estados)`. Para cada linha:
    - `ambiguo_municipio` → `erro`: `Município '<nome>' ambíguo nos estados da competição`.
    - `municipio_id == null` → `erro`: `Município '<nome>' não encontrado em <estados>`.
    - resolver `participante_id`: se `null` e `!dry_run` → `prisma.participante.create({ data: { nome: row.nome.trim(), municipio_id } })` e usar o id; se `null` e `dry_run` → tratar como criável (status `criada`, sem persistir).
    - duplicada: se o participante (id conhecido) já inscrito na modalidade → `duplicada`.
    - `!dry_run` → `prisma.inscricao.create({ data: { evento_id, modalidade_id, participante_id, subtitulo: row.subtitulo?.trim() || null, municipio_id } })` (override = o município resolvido da linha).
  - **Se toggle OFF:** manter exatamente o fluxo atual (usa `resolverParticipantes`, exige `municipio_uf`, não cria participante, não grava overrides).

- [ ] **Step 5: Controller** — `importRowSchema`: `municipio_uf: z.string().length(2).optional()`; remover `municipio_mod_uf`/`municipio_mod_nome`; manter `municipio_nome: z.string().min(1).max(120)` e `subtitulo: z.string().max(200).optional()`.

- [ ] **Step 6: Rodar** — `cd backend && npx tsc --noEmit && npx vitest run src/modules/inscricoes` verdes.

- [ ] **Step 7: Commit**
```bash
git add backend/src/modules/participantes/resolver-participantes.service.ts backend/src/modules/inscricoes/inscricoes.service.ts backend/src/modules/inscricoes/inscricoes.controller.ts backend/src/modules/inscricoes/inscricoes.service.test.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(escolar): import por nome + cria SREL + municipio por nome nos estados (formato real Jeesp)"
```

---

### Task 2: Frontend — modal de import escolar (formato de 3 colunas)

**Files:** `frontend/src/components/import/ImportInscricoesModal.tsx`, `frontend/src/types/inscricao.ts`.

- [ ] **Step 1: Ler** o modal e ver como hoje detecta `subtitulo_municipio_por_modalidade` (variável `incluiMunMod`/similar do B1) e como parseia com PapaParse.

- [ ] **Step 2: Ajustar (escolar)** — quando `evento.competicao.subtitulo_municipio_por_modalidade` for true:
  - Ler o texto do arquivo, **descartar linhas iniciais até o cabeçalho** (a 1ª linha de título não contém `Participante`): dividir por linha, achar o índice da primeira linha cujo 1º campo (case-insensitive) seja `participante` ou `nome`, e passar ao PapaParse só a partir dela.
  - Cabeçalhos esperados: `Participante,Subtitulo,Municipio` (case-insensitive). Mapear para `ImportRow`: `nome = Participante`, `subtitulo = Subtitulo || undefined`, `municipio_nome = Municipio` (sem `municipio_uf`).
  - Atualizar o texto de ajuda/exemplo do modal para o formato escolar (`Participante,Subtitulo,Municipio`).
  - Toggle OFF: parsing atual **inalterado** (`nome,municipio_uf,municipio_nome`).
- [ ] **Step 3: Tipos** — `frontend/src/types/inscricao.ts` `ImportRow`: `municipio_uf?` opcional; remover `municipio_mod_*`; garantir `municipio_nome` e `subtitulo?`.

- [ ] **Step 4: Verificar** — `cd frontend && npm run build`.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/import/ImportInscricoesModal.tsx frontend/src/types/inscricao.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(escolar): modal de import le formato real (Participante,Subtitulo,Municipio; pula titulo)"
```

---

## Verificação final (após as tasks)

- [ ] `cd backend && npx tsc --noEmit && npx vitest run src/modules/inscricoes` e `cd frontend && npm run build` verdes.
- [ ] Merge → develop, deploy dev. **Demo:** na competição do Jeesp (toggle ON), no evento "Jeesp Mirim Etapa I (est)", importar `Basquete Masculino 14 anos.csv` e `Basquete Feminino 14 anos.csv`; conferir que as SRELs foram criadas/casadas e que cada inscrição guardou o subtítulo (escola) e o município corretos por modalidade (via API). Import de outra competição (toggle OFF) continua igual.
- [ ] A **exibição** desses valores é o **B2** (próximo plano).

## Self-Review (cobertura da revisão da spec)
- Formato real (3 colunas, pula título): Task 2 ✓.
- Match por nome + cria SREL: Task 1 (Steps 3-4) ✓.
- Município por nome nos estados (erro se não achar/ambíguo): Task 1 ✓.
- Overrides gravados (subtítulo + município da linha): Task 1 ✓.
- Não-escolar inalterado: Steps 4-5 ✓.
