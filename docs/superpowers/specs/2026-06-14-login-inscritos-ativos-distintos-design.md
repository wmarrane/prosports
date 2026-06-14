# Login: "Inscritos ativos" = participantes distintos — Design

**Data:** 2026-06-14
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Ajustar a stat **"Inscritos ativos"** da tela de login para contar **participantes distintos** (não linhas de inscrição), mesma regra aplicada no card de eventos — corrigindo a contagem inflada (mesmo participante somado por cada modalidade).

## Decisão (do brainstorming)

- Contagem **por evento**, igual ao card: `distinct ['evento_id', 'participante_id']`. Quem está em N modalidades de um evento conta 1; quem está em 2 eventos ativos conta 2.

## Contexto atual

- Endpoint `GET /stats/public` em `backend/src/modules/stats/stats.routes.ts` (lógica inline na rota). Hoje:
  ```ts
  const [inscritos_ativos, sorteios_realizados] = await Promise.all([
    prisma.inscricao.count({ where: { evento: { data_hora: { gte: hoje } } } }),
    prisma.sorteio.count(),
  ])
  ```
  `inscritos_ativos` conta **linhas** de `Inscricao` (participante × modalidade) de eventos com `data_hora >= hoje` (hoje 00:00). Escopo global; sem filtro de status.
- Frontend `frontend/src/pages/Login.tsx` lê `stats.inscritos_ativos` via `statsService.publicas` (`GET /stats/public`); tipo `PublicStats = { inscritos_ativos, sorteios_realizados }`.

## Mudança (backend, 1 query)

Em `stats.routes.ts`, trocar o cálculo de `inscritos_ativos` por participantes distintos por evento, mantendo o filtro `evento.data_hora >= hoje`:
```ts
const [participantesDistintos, sorteios_realizados] = await Promise.all([
  prisma.inscricao.findMany({
    where: { evento: { data_hora: { gte: hoje } } },
    distinct: ['evento_id', 'participante_id'],
    select: { evento_id: true },
  }),
  prisma.sorteio.count(),
])
const inscritos_ativos = participantesDistintos.length
res.json({ inscritos_ativos, sorteios_realizados })
```
- O nome do campo (`inscritos_ativos`) e o frontend **não mudam** — só o valor reflete pessoas.
- `sorteios_realizados` e "100% auditados" (literal no front) permanecem.

## Tratamento de erros / casos

- Sem eventos ativos → `findMany` retorna `[]` → `inscritos_ativos = 0`.
- Mantém o `try/catch`/`next(err)` existente da rota.

## Testes

- **Build + manual:** `npm run build`; manual — a stat "Inscritos ativos" no login passa a contar participantes distintos por evento (mesmo participante em N modalidades de um evento conta 1).
- Sem migration; sem mudança de frontend. (A rota é lógica inline sem teste unitário hoje; verificação por build + manual, consistente com o módulo.)

## Fora de escopo

- Mudar o filtro "ativos" (continua `data_hora >= hoje`).
- Headcount global (decisão foi por evento, como no card).
- Alterar `sorteios_realizados` ou "Auditados".
