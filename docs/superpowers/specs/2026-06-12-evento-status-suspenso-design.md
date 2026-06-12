# Status de evento "Suspenso" — Design

**Data:** 2026-06-12
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Adicionar um novo status de evento **"Suspenso"** que pausa o evento: o card aparece com **fundo de alerta (âmbar)** e as **ações operacionais ficam bloqueadas** até reativar.

## Decisões (do brainstorming)

- Comportamento: **visual + bloquear ações** (não é só aparência).
- Cor do card suspenso: **âmbar** (`var(--warn-soft)` + borda warn).
- Inscritos/sorteios **não são apagados** ao suspender — apenas bloqueados para alteração.
- Reativar = trocar o status de volta no formulário do evento.

## Modelo de dados

Adicionar o valor `suspenso` ao enum `EventoStatus` (schema.prisma):

```prisma
enum EventoStatus {
  rascunho
  inscricoes
  pronto
  sorteado
  parcial
  suspenso
}
```

Migration manual (`backend/prisma/migrations/<ts>_add_status_suspenso/migration.sql`):

```sql
ALTER TYPE "EventoStatus" ADD VALUE 'suspenso';
```

`prisma generate` após editar o schema. Requer Cloud SQL prod ligado no deploy-main.

## Backend (fonte da verdade do bloqueio)

- `backend/src/modules/sorteios/sorteios.service.ts` — `executar`: incluir `status` no `select` do evento e, se `evento.status === 'suspenso'`, lançar **400** "Evento suspenso — reative o evento para sortear." (bloqueia sortear e re-sortear).

(Os demais bloqueios são de UI; o ponto crítico/destrutivo — o sorteio — é barrado no servidor.)

## Frontend

- `frontend/src/types/evento.ts` — adicionar `'suspenso'` à união `EventoStatus`.
- `frontend/src/lib/evento-status.ts`:
  - `STATUS_LABEL.suspenso = 'Suspenso'`.
  - `STATUS_COLOR.suspenso = 'bg-[var(--warn-soft)] text-[var(--warn-700)] border border-[var(--warn)]'`.
- `frontend/src/pages/eventos/EventoForm.tsx` — incluir `suspenso` em `STATUS_VALUES` e em `STATUS_DESC` ("Evento pausado — ações bloqueadas até reativar.").
- `frontend/src/pages/eventos/EventosList.tsx` — quando `ev.status === 'suspenso'`, o **fundo do card** fica âmbar (`var(--warn-soft)`) com borda warn (além do selo de status, que já usa `STATUS_COLOR`).
- `frontend/src/pages/eventos/EventoInscricoes.tsx` — quando `evento.status === 'suspenso'`:
  - mostrar um aviso no topo ("Evento suspenso — ações bloqueadas. Reative no formulário do evento para liberar.");
  - **desabilitar** os botões operacionais: Sortear/Re-sortear, Inscrever, Importar CSV, Remover (inscritos/sorteios), Remover todos. O evento continua editável via "Editar evento".
- `frontend/src/pages/Painel.tsx` — o conjunto de status "ativos" (`ATIVOS_STATUS`) **não** inclui `suspenso`, de modo que eventos suspensos não entram nos "pendentes".

Já fica naturalmente fora do **Modo Congresso** (`CongressoStepEvento` lista só `pronto`/`parcial`) e não publica site público (publicar exige `sorteado`).

## Tratamento de erros / casos

- Sortear evento suspenso → 400 (toast no front).
- Suspender um evento já sorteado não apaga o sorteio; ao reativar, ele permanece.
- Site público já publicado de um evento depois suspenso: snapshot estático, inalterado até republicar (e republicar exige `sorteado`).

## Testes

- **Backend (Vitest, mock prisma):** `executar` rejeita (400) quando `evento.status === 'suspenso'`; segue normal nos demais status.
- **Frontend:** `npm run build` + teste manual (card âmbar na lista; botões desabilitados + aviso em EventoInscricoes; suspenso fora do Painel; reativar destrava).

## Fora de escopo

- Apagar inscritos/sorteios ao suspender.
- Despublicar automaticamente o site de um evento suspenso.
- Bloquear a edição do próprio evento (necessária para reativar).
