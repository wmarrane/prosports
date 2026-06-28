# Status real no site público + auto-publicação a cada 25% no Modo Congresso — Design

**Data:** 2026-06-28
**Status:** Aprovado (aguardando revisão da spec)

## Contexto

Dois pedidos relacionados (itens 1 e 2 da lista do Wagner):
1. O status mostrado no site público (badge do detalhe e card da listagem) deve **acompanhar o status real do evento no NewProsports** (admin), em vez de ser derivado dos sorteios.
2. No **Modo Congresso**, a cada **25%** de modalidades sorteadas, **publicar o evento em background** (sobrescrevendo o snapshot atual), até 100%. Ativo apenas para eventos com status **"Pronto p/ sorteio"**.

Fatos relevantes do código:
- O `status` do evento (`EventoStatus`: rascunho/inscricoes/pronto/sorteado/parcial/suspenso) é **manual** (admin define; não muda sozinho durante os sorteios).
- O snapshot público **não** carrega `status` hoje (`backend/src/modules/site-publico/snapshot.ts` / `snapshot-types.ts`). O `publicar` (`site-publico.service.ts`) já faz `select: { status: true }` do evento.
- A publicação é **travada para `status === 'sorteado'`** (`site-publico.service.ts`).
- O sorteio (`sorteios.service.ts`) **não** altera o status do evento.
- Sorteio executado via `sorteiosService.executar` no Modo Congresso (`frontend/src/pages/congresso/`).

## Decisões aprovadas

- **Gatilho da auto-publicação:** **frontend** (Modo Congresso), em background (fire-and-forget) após cada sorteio.
- **Trava:** **caminho de publicação parcial dedicado** — aceita `pronto`/`parcial`; o botão manual "Publicar no site" continua exigindo `sorteado`.
- **Status no público:** **detalhe (badge) + card da listagem** seguem o status real do admin.

## Parte 1 — Status real no snapshot e no público

### Backend
- `SnapEvento` (em `backend/src/modules/site-publico/snapshot-types.ts`) ganha `status: string` (o `EventoStatus`).
- `montaSnapshot` (`snapshot.ts`) passa a escrever `status: evento.status`. O tipo `EventoRow` recebe `status: string`. (O `publicar` já seleciona `status`.)

### Frontend público
- Espelhar `status` no `SnapEvento` de `frontend/src/site-publico/snapshot-types.ts`.
- **Detalhe (`EventoPage.tsx`):** o badge do hero passa a exibir o **rótulo real** do status, via um mapa `STATUS_PUBLICO` (label por status). Remove a lógica derivada (`prog.done ? 'Sorteado' : …`). A **barra de progresso** continua usando `progressoSorteios` (independe do badge).
- **Listagem (`EventoCardListagem.tsx` + `EventosPage.tsx`):** o status visual do card passa a vir de `evento.status` (não dos sorteios). Mapa `STATUS_PUBLICO` (label + grad do acento/tile + cor do dot):
  - `sorteado` → "Sorteado", `var(--grad-accent)`, `var(--accent)`
  - `parcial` → "Parcial", `var(--grad-brand)`, `var(--info)`
  - `pronto` → "Pronto p/ sorteio", `var(--grad-warn)`, `var(--warn)`
  - `inscricoes` → "Inscrições", `var(--grad-brand)`, `var(--info)`
  - `rascunho` → "Rascunho", `var(--grad-warn)`, `var(--warn)`
  - `suspenso` → "Suspenso", `var(--grad-warn)`, `var(--warn)`
  - `data-status` do card passa a ser o `status` do admin.
  - **Filtro por ano:** as pílulas passam a refletir os status do admin **presentes** naquele grupo de ano (sempre "Todos" + um botão por status presente, na ordem pronto → parcial → sorteado → demais), filtrando por `data-status`. O `<script>` de filtro (escopado por `.year-group`) permanece igual na mecânica.
- O mapa `STATUS_PUBLICO` fica em um único lugar reutilizável (ex.: `frontend/src/site-publico/lib/status-evento.ts`) e é consumido por hero, card e página.

> Observação: como hoje só se publica evento `sorteado` (e, com a Parte 2, também `pronto`/`parcial`), os status realmente vistos no público serão `pronto`/`parcial`/`sorteado`; os demais são mapeados por robustez.

## Parte 2 — Auto-publicação parcial no Modo Congresso

### Backend — caminho de publicação parcial
- Nova função/atalho de serviço (ex.: `publicar(eventoId, { permitirParcial: true })` em `site-publico.service.ts`) que, quando `permitirParcial`, aceita status `pronto`/`parcial`/`sorteado` e **rejeita** `rascunho`/`inscricoes`/`suspenso` (HTTP 400). O caminho normal (sem a flag) continua exigindo `sorteado`.
- Rota: aceitar um parâmetro explícito, ex.: `POST /eventos/:id/publicar?parcial=1` (mesmo handler, lê a query) **ou** rota dedicada `POST /eventos/:id/publicar-parcial`. Decisão de forma fica no plano; comportamento: `parcial=1` chama o caminho `permitirParcial`.
- O resto é idêntico: `putSnapshot` + `dispatchBuild` + grava `site_publicado_em`.

### Frontend — serviço + gatilho
- `frontend/src/services/eventos.ts`: `publicarParcial(id)` → `POST` no caminho parcial.
- **Modo Congresso:** após cada sorteio concluído (no `onSuccess` da mutation de executar, no fluxo `frontend/src/pages/congresso/`), recalcular a **% sorteadas**:
  - Denominador = **sorteáveis com inscritos** (modalidades `tipo≠'especifico'` e com ≥1 inscrito), consistente com a barra de progresso.
  - Marcos: 25/50/75/100%. Manter, por evento, o **maior marco já publicado** (persistido em `localStorage`, chave por `evento_id`).
  - Se o evento tem `status === 'pronto'` **e** a % atual cruzou um marco ainda não publicado, disparar `publicarParcial(eventoId)` em **background (fire-and-forget)**; em sucesso, atualizar o maior marco publicado. Erros não interrompem o congresso (apenas log/toast discreto).
- Não publicar repetidamente no mesmo marco; só dispara quando cruza um novo.

## Testes / Verificação

- **Backend (Vitest):**
  - `montaSnapshot` inclui `status` no snapshot.
  - Publicação parcial: aceita `pronto`/`parcial`, **rejeita** `rascunho`/`inscricoes`/`suspenso`; caminho normal continua exigindo `sorteado`.
- **Frontend público (Vitest + `renderToStaticMarkup`):**
  - Hero exibe o rótulo do status real (ex.: status `pronto` → "Pronto p/ sorteio"; `parcial` → "Parcial").
  - Card/listagem: `data-status` e rótulo vêm do `status` do evento; mapa de cor correto; filtro lista os status presentes.
- **Frontend congresso (Vitest, função pura de marco):** uma função pura `marcoAtingido(sorteadas, sorteaveis, ultimoMarco)` (ou equivalente) testável: cruzar 25% retorna o novo marco; sorteios subsequentes no mesmo intervalo não retornam novo marco; 100% retorna 100.
- `cd frontend && npm run build && npm run build:site` e `cd backend && npm test` verdes.
- **Demo (screenshots) antes do merge na develop**: detalhe e listagem mostrando rótulos de status reais; e (se viável no dev) evidência da auto-publicação disparando ao cruzar um marco no Modo Congresso.

## Fora de escopo
- Auto-transição de status no backend (status segue manual).
- Gatilho de auto-publicação no backend (escolhido frontend).
- Afrouxar a trava do botão manual de publicar (continua `sorteado`).
- Promoção a produção (depende de confirmação do Wagner; provisionamento GCS de prod ainda pendente).

## Restrições globais
- Host Windows; ler antes de editar; caminhos absolutos. Git identity inline (`-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`).
- Validar com `npm run build`, `npm run build:site` (frontend) e `npm test` (backend). Reusar tokens/classes; sem cores novas. Nunca `git add -A`.
- Demo antes da develop; promoção a prod só com confirmação do Wagner.
