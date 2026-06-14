# Login: stats — inscritos distintos + novo "Eventos sorteados" — Design

**Data:** 2026-06-14
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Dois ajustes na faixa de stats da tela de login:
1. **"Inscritos ativos"** passa a contar **participantes distintos** (não linhas de inscrição), mesma regra do card de eventos.
2. Novo indicador **"Eventos sorteados"** = total de eventos com `status = 'sorteado'` (global).

## Decisões (do brainstorming)

- Inscritos ativos: contagem **por evento**, igual ao card: `distinct ['evento_id', 'participante_id']`. Quem está em N modalidades de um evento conta 1; quem está em 2 eventos ativos conta 2.
- Eventos sorteados: só `status = 'sorteado'` (não inclui `parcial`); escopo **global** (sem filtro de data), como `sorteios_realizados`.

## Contexto atual

- Endpoint `GET /stats/public` em `backend/src/modules/stats/stats.routes.ts` (lógica inline na rota). Hoje:
  ```ts
  const [inscritos_ativos, sorteios_realizados] = await Promise.all([
    prisma.inscricao.count({ where: { evento: { data_hora: { gte: hoje } } } }),
    prisma.sorteio.count(),
  ])
  ```
  `inscritos_ativos` conta **linhas** de `Inscricao` (participante × modalidade) de eventos com `data_hora >= hoje` (hoje 00:00). Escopo global; sem filtro de status.
- Frontend `frontend/src/pages/Login.tsx` lê `stats.inscritos_ativos`/`stats.sorteios_realizados` via `statsService.publicas` (`GET /stats/public`); tipo `PublicStats = { inscritos_ativos, sorteios_realizados }` em `frontend/src/services/stats.ts`. A faixa renderiza 3 itens (Inscritos ativos · Sorteios realizados · Auditados 100% literal).

## Mudança 1 — Backend (`stats.routes.ts`)

Trocar o cálculo de `inscritos_ativos` por participantes distintos por evento (mantendo `data_hora >= hoje`) e adicionar `eventos_sorteados`:
```ts
const [participantesDistintos, sorteios_realizados, eventos_sorteados] = await Promise.all([
  prisma.inscricao.findMany({
    where: { evento: { data_hora: { gte: hoje } } },
    distinct: ['evento_id', 'participante_id'],
    select: { evento_id: true },
  }),
  prisma.sorteio.count(),
  prisma.evento.count({ where: { status: 'sorteado' } }),
])
const inscritos_ativos = participantesDistintos.length
res.json({ inscritos_ativos, sorteios_realizados, eventos_sorteados })
```
- `inscritos_ativos` reflete pessoas (1x por modalidade, por evento). `sorteios_realizados` inalterado.

## Mudança 2 — Frontend

- `frontend/src/services/stats.ts`: `PublicStats` ganha `eventos_sorteados: number`.
- `frontend/src/pages/Login.tsx`: adicionar um 4º item na faixa de stats — **"Eventos sorteados"** lendo `stats.eventos_sorteados` (mesmo `fmtNum`). Ordem: Inscritos ativos · Sorteios realizados · Eventos sorteados · Auditados.

## Tratamento de erros / casos

- Sem eventos ativos → `findMany` retorna `[]` → `inscritos_ativos = 0`.
- Sem eventos sorteados → `count` = 0.
- Mantém o `try/catch`/`next(err)` existente da rota.

## Testes

- **Build + manual:** `npm run build` (back + front); manual — login mostra os 4 indicadores; "Inscritos ativos" conta participantes distintos por evento; "Eventos sorteados" conta eventos com status `sorteado`.
- Sem migration. (A rota de stats é lógica inline sem teste unitário hoje; verificação por build + manual, consistente com o módulo.)

## Fora de escopo

- Mudar o filtro "ativos" de inscritos (continua `data_hora >= hoje`).
- Incluir `parcial` em eventos sorteados (decisão: só `sorteado`).
- Headcount global de inscritos (decisão foi por evento, como no card).
- Alterar `sorteios_realizados` ou "Auditados".
