# Indicador "X/Y sorteadas" do card de evento por modalidades sorteáveis — Design

**Data:** 2026-06-10
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

No card do evento (lista, `EventosList`), o indicador "X/Y sorteadas" usa hoje `Y = total de modalidades da competição` (ex.: 1/65). Ajustar para `Y = modalidades sorteáveis do evento` (sem `especifico`, sem inscritos, com regra "pular sorteio"), igual ao que já vale na tela de Inscritos e no Painel.

## Escopo

- Ajustar **apenas** o indicador "X/Y sorteadas". O stat "MODALIDADES" do card continua mostrando o total da competição (`competicao.modalidades.length`).
- Cálculo no **backend** (endpoint de listar eventos), pois o card não tem contagens de inscritos por modalidade.
- **Fora de escopo:** "sugerir uma distribuição" dos inscritos pelas modalidades (feature separada).

## Regra de "sorteável"

Mesma da tela de Inscritos: uma modalidade é sorteável num evento quando `tipo !== 'especifico'` E `inscritos > 0` E a regra de `mensagens_inscritos` que casa com o nº de inscritos **não** tem `pular_sorteio`.

## Backend

### Helper puro
`backend/src/lib/sorteaveis.ts` (novo): `matchMensagem(regras, n)` + `isSorteavel({ tipo, mensagens_inscritos }, n)` — espelho do frontend (`frontend/src/lib/mensagens-inscritos.ts` + `sorteaveis.ts`). Testável.

### `eventos.service.listar`
- No `LIST_INCLUDE`, adicionar `mensagens_inscritos: true` ao `select` das modalidades (hoje só `id` + `tipo_modalidade.tipo`).
- Depois de buscar os eventos (`eventos`), com `eventIds = eventos.map(e => e.id)`:
  - `prisma.inscricao.groupBy({ by: ['evento_id', 'modalidade_id'], where: { evento_id: { in: eventIds } }, _count: { _all: true } })` → `countsByEvento[evento_id][modalidade_id] = n`.
  - `prisma.sorteio.findMany({ where: { evento_id: { in: eventIds } }, select: { evento_id: true, modalidade_id: true } })` → `sorteadasByEvento[evento_id] = Set<modalidade_id>`.
- Para cada evento, computar `modalidades_sorteaveis`:
  - `ids = new Set(sorteadasByEvento[e.id] ?? [])` (já sorteadas entram, garante numerador ≤ denominador).
  - para cada `m` em `e.competicao.modalidades`: se `isSorteavel({ tipo: m.tipo_modalidade.tipo, mensagens_inscritos: m.mensagens_inscritos }, countsByEvento[e.id]?.[m.id] ?? 0)` → `ids.add(m.id)`.
  - `modalidades_sorteaveis = ids.size`.
- Retornar cada evento com o campo extra `modalidades_sorteaveis` (mantendo o restante e o `_count`).

Custo: 3 queries na listagem (eventos + groupBy + sorteios) — aceitável para a escala atual.

## Frontend

- `frontend/src/types/evento.ts`: `Evento` ganha `modalidades_sorteaveis?: number` (presente só na listagem).
- `frontend/src/pages/eventos/EventosList.tsx`: o indicador de sorteio passa a usar `Y = ev.modalidades_sorteaveis ?? (competicao.modalidades.length)` (fallback ao total se o campo não vier) e `X = ev._count.sorteios`. O stat "MODALIDADES" permanece `competicao.modalidades.length`.

## Testes

- `backend/src/lib/sorteaveis.test.ts`: `isSorteavel` (especifico→false; inscritos 0→false; pular_sorteio casa→false; casa sem pular→true; grupos/chaves com inscritos→true) e `matchMensagem` (primeira que casa, max nulo, inclusivo, sem match).
- `backend/src/modules/eventos/eventos.service.test.ts`: `listar` com prisma mockado (evento.findMany + inscricao.groupBy + sorteio.findMany) conferindo `modalidades_sorteaveis` por evento (ex.: ignora específico/sem-inscritos/pular; inclui já sorteadas).
- Frontend: card validado por `npm run build` (tsc) + verificação manual.
