# Escolar B2 — Exibição por modalidade + gestão do override — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps usam checkbox (`- [ ]`).

**Goal:** Exibir subtítulo/município **por modalidade** (override da inscrição) em todas as telas para competições escolares, com o override como **fonte única** (vazio se ausente, sem herdar o global); e permitir **editar** o override de uma inscrição já criada, mostrando-o na lista de inscritos. Competições não-escolar: inalteradas.

**Architecture:** Um helper `participanteEfetivo(inscricao, porModalidade)` (twin backend+frontend) devolve o "participante efetivo" (escolar → subtítulo/município do override; não-escolar → do participante) para alimentar o `composeSubtituloLine`/`participantesById` existentes. Novo `PATCH /inscricoes/:id`. Cada superfície de exibição passa a usar o efetivo.

**Tech Stack:** Prisma/Express/Zod/Vitest; React (admin) + SSG (site público).

## Global Constraints

- Host Windows; ler antes de editar; caminhos absolutos; git identity inline; nunca `git add -A`.
- Backend: `cd backend && npx tsc --noEmit && npx vitest run <módulos tocados>`. Frontend: `cd frontend && npm run build`; público: `npm run build:site` quando tocar o site público.
- **Escolar = override é fonte única** (vazio se null, **sem** herdar global). **Não-escolar = inalterado** (regressão zero).
- Sem schema/migration (colunas já existem). Validar no dev com os 2 CSVs reais.

---

### Task 1: Helper `participanteEfetivo` (twin backend + frontend)

**Files:** `backend/src/lib/compose-subtitulo.ts`, `frontend/src/lib/compose-subtitulo.ts`, testes (`backend/src/lib/compose-subtitulo.test.ts` — criar se não existir; e um teste no frontend se houver suíte).

**Interfaces:** `participanteEfetivo(inscricao, porModalidade) → ParticipanteLike`.

- [ ] **Step 1: Teste (falha primeiro)** — casos: escolar com override → retorna subtítulo/município do override; escolar sem override (null) → subtítulo/município null (não herda); não-escolar → subtítulo/município do participante.

- [ ] **Step 2: Rodar e ver falhar** — `cd backend && npx vitest run src/lib/compose-subtitulo.test.ts`.

- [ ] **Step 3: Implementar** — acrescentar aos DOIS `compose-subtitulo.ts` (mesma lógica):
```ts
type InscricaoLike = {
  subtitulo?: string | null
  municipio?: { nome: string; uf: string } | null
  participante: ParticipanteLike
}

/** Participante "efetivo" p/ compor o subtítulo: escolar usa o override da inscrição
 *  (fonte única; vazio se null), não-escolar usa o participante. */
export function participanteEfetivo(insc: InscricaoLike, porModalidade: boolean): ParticipanteLike {
  if (!porModalidade) return insc.participante
  return {
    ...insc.participante,
    subtitulo: insc.subtitulo ?? null,
    municipio: insc.municipio ?? null,
  }
}
```

- [ ] **Step 4: Rodar e ver passar.** **Step 5: Commit** (`feat(escolar): helper participanteEfetivo (override fonte unica no escolar)`).

---

### Task 2: Backend — editar override da inscrição (`PATCH /inscricoes/:id`)

**Files:** `backend/src/modules/inscricoes/inscricoes.service.ts`, `.../inscricoes.controller.ts`, `.../inscricoes.routes.ts`, teste.

- [ ] **Step 1: Teste (falha primeiro)** — `editar(id, { subtitulo, municipio_id })` atualiza e retorna os overrides (INCLUDE já traz `municipio`); município inexistente → 400.

- [ ] **Step 2: Rodar e ver falhar** — `cd backend && npx vitest run src/modules/inscricoes`.

- [ ] **Step 3: Service** — em `inscricoes.service.ts`:
```ts
export async function editar(id: number, data: { subtitulo?: string | null; municipio_id?: number | null }) {
  if (data.municipio_id != null) {
    const m = await prisma.municipio.findUnique({ where: { id: data.municipio_id }, select: { id: true } })
    if (!m) throw Object.assign(new Error('Município inválido'), { status: 400 })
  }
  const patch: Record<string, unknown> = {}
  if (data.subtitulo !== undefined) patch.subtitulo = data.subtitulo
  if (data.municipio_id !== undefined) patch.municipio_id = data.municipio_id
  return prisma.inscricao.update({ where: { id }, data: patch, include: INCLUDE })
}
```

- [ ] **Step 4: Controller + rota** — `inscricoes.controller.ts`: `patchSchema = z.object({ subtitulo: z.string().max(200).nullish(), municipio_id: z.coerce.number().int().positive().nullish() })` + handler `editar` que faz `patchSchema.parse(req.body)` e chama `service.editar(parseIntParam(req.params.id,'id'), body)`. Em `inscricoes.routes.ts`: `router.patch('/:id', requireAuth, acessoInscricaoId, ctrl.editar)`.

- [ ] **Step 5: Rodar** (`tsc` + vitest inscricoes). **Step 6: Commit** (`feat(escolar): PATCH /inscricoes/:id edita override subtitulo+municipio`).

---

### Task 3: Frontend — lista de Inscritos mostra o override + edição

**Files:** `frontend/src/pages/eventos/EventoInscricoes.tsx`, `frontend/src/services/inscricoes.ts`.

- [ ] **Step 1: Ler** o `EventoInscricoes.tsx` (usa `subMunPorMod`, `subtituloLine`, `camposSubtitulo`; já cria inscrição com override) e localizar o render da lista de **Inscritos** por modalidade.

- [ ] **Step 2: Service** — em `frontend/src/services/inscricoes.ts`, adicionar `editar: (id, payload) => api.patch(`${BASE}/${id}`, payload).then(r=>r.data)` com `payload: { subtitulo?: string|null; municipio_id?: number|null }`.

- [ ] **Step 3: Lista mostra override** — no render de cada inscrito, quando `subMunPorMod`, exibir a linha de subtítulo via `subtituloLine(participanteEfetivo(inscricao, true))` (import `participanteEfetivo` de `../../lib/compose-subtitulo`) — mostra o subtítulo + município do override (ou vazio). Não-escolar: inalterado.

- [ ] **Step 4: Editar** — quando `subMunPorMod`, adicionar em cada inscrito uma ação **Editar** que abre um modal/inline (reusar o mesmo layout dos campos do cadastro manual: Subtítulo + `MunicipioSelect`, pré-preenchidos com os valores atuais da inscrição) e ao confirmar chama `inscricoesService.editar(inscricao.id, { subtitulo, municipio_id })` e invalida a query de inscrições. Toast de sucesso/erro.

- [ ] **Step 5: Verificar** (`npm run build`). **Step 6: Commit** (`feat(escolar): lista de inscritos mostra e edita o override por modalidade`).

---

### Task 4: Modo Congresso — usar o efetivo

**Files:** `frontend/src/pages/congresso/CongressoStepSorteio.tsx`, `CongressoStepParticipantes.tsx`, `CongressoStepBemvindos.tsx`, `CongressoStepCampeoes.tsx`, `CampeoesPanel.tsx` (os que compõem subtítulo por participante).

- [ ] **Step 1: Ler** cada arquivo; identificar `subtituloLine`/`composeSubtituloLine(i.participante, campos)` e `participantesById`.

- [ ] **Step 2: Implementar** — obter o flag `porModalidade = competicao?.subtitulo_municipio_por_modalidade === true`. Onde hoje se passa `i.participante` (ou se monta `participantesById` a partir das inscrições), passar `participanteEfetivo(inscricao, porModalidade)`:
  - `CongressoStepSorteio.tsx`: ao montar `participantesById` a partir das inscrições da modalidade, usar o efetivo (assim chaves/grupos/ordem exibem o override); o `subtituloLine` continua recebendo um participante-like efetivo.
  - Demais `CongressoStep*`/`CampeoesPanel`: trocar `composeSubtituloLine(i.participante, campos)` por `composeSubtituloLine(participanteEfetivo(i, porModalidade), campos)`.
  Não-escolar: `participanteEfetivo` devolve o participante → comportamento idêntico.

- [ ] **Step 3: Verificar** (`npm run build`). **Step 4: Commit** (`feat(escolar): Modo Congresso exibe subtitulo/municipio por modalidade`).

---

### Task 5: Site público (snapshot) — efetivo por modalidade

**Files:** `backend/src/modules/site-publico/site-publico.service.ts` (e `snapshot.ts` se necessário), teste `snapshot.test.ts`.

- [ ] **Step 1: Ler** como o snapshot monta as `participantes` por modalidade e usa `subtituloFn(p) = composeSubtituloLine(p, campos)`.

- [ ] **Step 2: Implementar** — carregar as inscrições com `subtitulo`/`municipio` (override) por modalidade; para cada participante de cada modalidade, computar o efetivo com `participanteEfetivo(inscricao, competicao.subtitulo_municipio_por_modalidade)` antes do `composeSubtituloLine`. Incluir o toggle na query da competição. Não-escolar: inalterado.

- [ ] **Step 3: Teste** — snapshot de competição escolar mostra o subtítulo por modalidade (override), e sem override → vazio; não-escolar inalterado.

- [ ] **Step 4: Verificar** (`tsc` + vitest site-publico + `npm run build:site`). **Step 5: Commit** (`feat(escolar): snapshot do site publico usa override por modalidade`).

---

### Task 6: Relatórios (xlsx do congresso) — efetivo

**Files:** `backend/src/modules/relatorios/relatorio_congresso.service.ts`, teste se houver.

- [ ] **Step 1: Ler** onde o relatório usa `participante`/`municipio`/subtítulo por inscrição.

- [ ] **Step 2: Implementar** — quando a competição é escolar, usar o override da inscrição (via `participanteEfetivo`) para o subtítulo/município exibido; carregar `subtitulo`/`municipio` da inscrição. Não-escolar inalterado.

- [ ] **Step 3: Verificar** (`tsc` + vitest relatorios). **Step 4: Commit** (`feat(escolar): relatorio do congresso usa override por modalidade`).

---

## Verificação final (após as tasks)

- [ ] `cd backend && npx tsc --noEmit && npx vitest run` (módulos tocados) e `cd frontend && npm run build` + `npm run build:site` verdes.
- [ ] Merge → develop, deploy dev. **Demo (com os 2 CSVs no evento "Jeesp Mirim Etapa I (est)"):** importar as duas modalidades; conferir que **cada modalidade** mostra o subtítulo (escola) + município corretos por SREL em: lista de Inscritos, Modo Congresso, resultado do sorteio, site público e relatório; **editar** o override de uma inscrição pela lista e ver refletir. Confirmar que uma competição **não-escolar** continua idêntica.

## Self-Review (cobertura da spec — REVISÃO/B2 ampliado)
- Helper efetivo (override fonte única no escolar; global no não-escolar): Task 1 ✓.
- PATCH editar override: Task 2 ✓. Lista mostra + edita: Task 3 ✓.
- Exibição: Modo Congresso + sorteio (via participantesById): Task 4 ✓; público: Task 5 ✓; relatórios: Task 6 ✓.
- Não-escolar inalterado: exigido em cada task ✓.
