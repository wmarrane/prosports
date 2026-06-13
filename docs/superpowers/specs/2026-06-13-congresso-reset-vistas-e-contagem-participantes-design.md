# Ajustes: reset de vistas + pular_sorteio vista + contagem de participantes distintos — Design

**Data:** 2026-06-13
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Dois ajustes independentes:

1. **Modo Congresso (vistas):** (a) ao **apagar todos os sorteios** de um evento, resetar também as "apresentadas/vistas"; (b) marcar como **vista** as modalidades sorteáveis (grupos/chaves) cujo sorteio é **pulado** (inscritos insuficientes), com o mesmo check verde.
2. **Card do evento (contador):** o número de "inscritos" deve contar **participantes distintos** por evento, não linhas de inscrição (mesmo participante em N modalidades = 1).

## Contexto atual

- "Vistas" do congresso vivem em localStorage por evento (`prosports.congresso.vistas.{eventoId}`), via `frontend/src/lib/congresso-vistas.ts` (`addVista`/`loadVistas`/`saveVistas`). `ModoCongresso.tsx` carrega/persiste e marca **apenas específico** ao concluir (`nextAfterParticipantes`).
- "Apagar sorteios" (bulk) é acionado em `frontend/src/pages/eventos/EventoInscricoes.tsx` (mutation `apagarTodosSorteios` → `sorteiosService.removerTodosDoEvento(eventoId)`; `onSuccess` invalida `['sorteios', eventoId]`). Não mexe nas vistas hoje.
- O fluxo `nextAfterParticipantes(opts?: { pularSorteio?: boolean })` decide: se `opts.pularSorteio || tipo === 'especifico'` → volta sem sorteio; senão → etapa de sorteio. O `pularSorteio` vem de uma regra (`regraMensagem?.pular_sorteio === true`) na etapa de participantes (modalidade sorteável sem inscritos suficientes / sem regra).
- Card do evento: `frontend/src/pages/eventos/EventosList.tsx` lê `ev._count?.inscricoes`. O backend `backend/src/modules/eventos/eventos.service.ts` (`listar`, `LIST_INCLUDE`) popula `_count: { select: { inscricoes: true, sorteios: true } }` — conta **linhas** de `Inscricao`. `Inscricao` é `@@unique([evento_id, modalidade_id, participante_id])`, então o mesmo participante aparece em várias linhas. Só o `EventosList` exibe esse número (Painel não usa). Não há contagem de participantes distintos hoje.

## Item 1 — Modo Congresso

### 1a. Resetar vistas ao apagar todos os sorteios

- Novo helper em `frontend/src/lib/congresso-vistas.ts`:
  ```ts
  export function clearVistas(eventoId: number): void {
    try { localStorage.removeItem(`prosports.congresso.vistas.${eventoId}`) } catch { /* ignora */ }
  }
  ```
  (Reusar a mesma função `KEY` interna.)
- Em `EventoInscricoes.tsx`, no `onSuccess` da mutation `apagarTodosSorteios`, chamar `clearVistas(eventoId)` (além do que já faz). Assim, apagar **todos** os sorteios reinicia a apresentação. Apagar um sorteio **único** não reseta.

### 1b. Marcar vista quando o sorteio é pulado

- Em `ModoCongresso.tsx`, `nextAfterParticipantes`: passar a marcar vista no **ramo sem sorteio inteiro** — ou seja, sempre que `opts?.pularSorteio || tipoAtual === 'especifico'`. Decisão: **qualquer** `pular_sorteio` marca vista (cobre o caso de inscritos insuficientes em grupos/chaves).
  ```ts
  function nextAfterParticipantes(opts?: { pularSorteio?: boolean }) {
    if (opts?.pularSorteio || tipoAtual === 'especifico') {
      if (eventoId != null && modalidadeId != null) {
        const next = addVista(vistas, modalidadeId)
        setVistas(next)
        saveVistas(eventoId, next)
      }
      voltarParaModalidade()
    } else {
      setStep('sorteio')
    }
  }
  ```
  (Antes só `especifico` marcava; agora o `pularSorteio` também.)

## Item 2 — Contador de inscritos = participantes distintos

### Backend (`eventos.service.ts`, `listar`)

- Após buscar os eventos (e o `groupBy` por modalidade já existente), adicionar um agrupamento por participante:
  ```ts
  const participantesGrouped = await prisma.inscricao.groupBy({
    by: ['evento_id', 'participante_id'],
    where: { evento_id: { in: eventIds } },
  })
  const totalParticipantesPorEvento: Record<number, number> = {}
  for (const g of participantesGrouped) {
    totalParticipantesPorEvento[g.evento_id] = (totalParticipantesPorEvento[g.evento_id] ?? 0) + 1
  }
  ```
  Cada linha do `groupBy` é um par `(evento, participante)` único, então o número de linhas por `evento_id` = participantes distintos.
- Anexar `total_participantes: totalParticipantesPorEvento[ev.id] ?? 0` a cada evento no retorno do `listar` (no mesmo ponto onde os contadores por modalidade já são anexados).
- `_count.inscricoes` permanece no retorno (não removido), apenas deixa de ser a fonte do número exibido no card.

### Frontend

- `frontend/src/types/evento.ts` — `Evento` ganha `total_participantes?: number`.
- `frontend/src/pages/eventos/EventosList.tsx` — `const inscritos = ev.total_participantes ?? 0` (no lugar de `ev._count?.inscricoes`). Rótulo permanece **"inscritos"**.

## Tratamento de erros / casos

- localStorage indisponível → `clearVistas` é no-op (try/catch).
- Evento sem inscrições → `total_participantes = 0`.
- Apagar **um** sorteio (não todos) → vistas inalteradas (só o bulk reseta).
- `pular_sorteio` em específico já caía no ramo sem sorteio; continua marcando vista.

## Testes

- **Backend (Vitest, mock prisma):** `listar` retorna `total_participantes` = participantes distintos por evento (mock `inscricao.groupBy` por `[evento_id, participante_id]`; mesmo participante em N modalidades conta 1).
- **Frontend (Vitest):** `clearVistas` (chama `removeItem` com a chave correta; tolera erro). `addVista` já testado.
- **Build + manual:** `npm run build`; manual — card mostra participantes distintos; apagar todos os sorteios reseta as vistas; modalidade sorteável com inscritos insuficientes (pular sorteio) ganha check verde e a etapa avança.

## Fora de escopo

- Mudar a contagem de inscritos em outros lugares (só o card da lista usa `_count.inscricoes`).
- Distinguir o motivo do `pular_sorteio` (qualquer pular_sorteio marca vista).
- Resetar vistas ao apagar um sorteio único.
- Filtrar participantes por modalidade ativa na contagem (conta todas as inscrições do evento).
