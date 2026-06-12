# Ativar/Desativar modalidade na competição — Design

**Data:** 2026-06-12
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Permitir **desativar** uma modalidade na competição, fazendo os eventos daquela competição **deixarem de enxergá-la** (em todas as telas/saídas). Ao **reativar**, os eventos voltam a vê-la, com os inscritos/sorteios intactos.

## Decisões (do brainstorming)

- **Ocultar e preservar** (não apagar): desativar não remove inscritos/sorteios — eles ficam no banco, ocultos enquanto a modalidade está inativa, e voltam intactos ao reativar. Permitido mesmo em eventos já sorteados/em sorteio (sem guardrail bloqueando).
- Liga/desliga fica na gestão de modalidades da competição (`ModalidadesPanel`).
- Reusa os pontos centralizados de "modalidades do evento" — agora filtrando também `ativa=true`.

## Modelo de dados

Adicionar campo ao `Modalidade`:

```prisma
model Modalidade {
  ...
  ativa Boolean @default(true)
  ...
}
```

Migration manual (`backend/prisma/migrations/<ts>_add_ativa_modalidade/migration.sql`):

```sql
ALTER TABLE "Modalidade" ADD COLUMN "ativa" BOOLEAN NOT NULL DEFAULT true;
```

Modalidades existentes nascem **ativas**. `prisma generate` após editar o schema. Requer Cloud SQL prod ligado no deploy-main.

## Conceito "modalidades do evento"

Passa a ser: **modalidades da competição do evento com `ativa = true`** e **não excluídas** por evento (`EventoModalidadeExcluida`). Os dois filtros (global `ativa` + exclusão por evento) se somam.

## Aplicação (pontos a respeitar `ativa`)

Reusa a infraestrutura da feature "modalidades por evento". Cada ponto que enumera modalidades do evento passa a filtrar `ativa = true`:

- `backend/src/modules/eventos/evento-modalidades.service.ts` — `modalidadesDoEvento` (e, se necessário, `getModalidadeIdsExcluidas` não muda; o filtro `ativa` entra na listagem de modalidades). Adicionar `where: { competicao_id, ativa: true }`.
- `backend/src/modules/eventos/eventos.service.ts` — `listar`: o include `competicao.modalidades` passa a filtrar `where: { ativa: true }`, de modo que `modalidades_sorteaveis`/`modalidades_pendentes` ignorem inativas.
- `backend/src/modules/key_access/key_access.service.ts` — `getModalidades`: filtrar `ativa: true`.
- `backend/src/modules/site-publico/site-publico.service.ts` — `publicar`: filtrar `ativa: true` ao montar o snapshot.
- `backend/src/modules/relatorios/relatorio_congresso.service.ts` — `loadEventoComModalidades`: filtrar `ativa: true`.

O endpoint genérico `GET /modalidades?competicao_id` **não muda** (continua trazendo ativas+inativas) — é usado pela gestão da competição. As telas de evento já consomem `GET /eventos/:id/modalidades` (filtrado).

O painel per-evento "Modalidades do evento" (`ModalidadesDoEventoModal`) passa a listar apenas modalidades **ativas** (filtra `m.ativa` no client), já que não faz sentido excluir/incluir per-evento uma modalidade globalmente inativa.

## Endpoint

- `PATCH /modalidades/:id/ativa` (admin), body `{ ativa: boolean }`. Atualiza o campo e retorna a modalidade. (Não há efeito colateral em inscritos/sorteios — apenas o flag.)
- Service frontend: `modalidadesService.setAtiva(id, ativa)`.

## Frontend (gestão)

Em `ModalidadesPanel.tsx` (modalidades da competição):
- Cada linha ganha uma ação **Ativar/Desativar** (além de Editar/Remover).
- Modalidade inativa: linha esmaecida (`opacity`) + selo "Inativa".
- Ao **desativar**, abrir confirmação com aviso: "Os eventos desta competição deixarão de ver **{nome}**. Inscritos e sorteios ficam ocultos e voltam ao reativar."
- Reativar não precisa de confirmação.
- Ao alternar, invalidar `['modalidades', competicaoId]`, `['modalidades']` e `['eventos']` (para contadores).

O tipo `Modalidade` (frontend) ganha `ativa: boolean`.

## Tratamento de erros / casos

- Desativar/reativar é sempre permitido (sem bloqueio por dados existentes).
- Site público já publicado é snapshot estático: reflete a desativação só ao republicar (igual a qualquer outra mudança).
- Modalidade inativa não aparece no Modo Congresso, Painel, mobile, sidebar do evento, contadores, relatórios e novas publicações.

## Testes

- **Backend (Vitest, mock prisma):**
  - `modalidadesDoEvento` exclui inativas (além das excluídas por evento).
  - `eventos.service.listar` não conta inativas em `modalidades_sorteaveis`/`pendentes`.
  - `PATCH /modalidades/:id/ativa` atualiza o flag (service `setAtiva`).
  - key-access/site-publico/relatorio filtram inativas (onde já há testes, estender o mock).
- **Frontend:** `npm run build` + teste manual (desativar → some dos eventos/contadores/congresso; reativar → volta com inscritos/sorteios).

## Fora de escopo

- Apagar inscritos/sorteios ao desativar (decisão foi ocultar e preservar).
- Reprocessar/republicar automaticamente sites públicos já publicados.
- Desativar por evento (isso já é a feature existente `EventoModalidadeExcluida`).
