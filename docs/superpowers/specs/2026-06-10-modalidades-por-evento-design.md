# Modalidades por evento (participação/exclusão) — Design

**Data:** 2026-06-10
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Hoje um evento herda **implicitamente todas** as modalidades da sua competição (não há vínculo direto evento↔modalidade; as telas listam por `competicao_id`). Precisamos permitir que um evento **não adote todas** as modalidades herdadas — ou seja, definir por evento quais modalidades participam.

## Decisões (do brainstorming)

1. **Modelo por exclusão:** o evento continua herdando **todas** as modalidades por padrão; marca-se quais **não** participam. Modalidade nova criada na competição entra automaticamente nos eventos.
2. **Guardrail:** só é permitido excluir uma modalidade que **não tenha inscritos nem sorteio** naquele evento. Se tiver, a exclusão é bloqueada com aviso (apague antes).
3. **UI:** painel dedicado "Modalidades do evento" na tela do evento (`EventoInscricoes`), com checkboxes de todas as modalidades da competição.
4. **Abrangência:** a modalidade excluída some/não conta em **tudo** do evento — barra lateral admin, contador "X/Y sorteadas", Painel de pendentes, Modo Congresso, acesso mobile (key-access), site público e relatórios (XLSX/HTML).

## Modelo de dados

Nova tabela `EventoModalidadeExcluida` (espelha `EventoModalidadeAnfitriao`):

```prisma
model EventoModalidadeExcluida {
  id            Int        @id @default(autoincrement())
  evento        Evento     @relation(fields: [evento_id], references: [id], onDelete: Cascade)
  evento_id     Int
  modalidade    Modalidade @relation(fields: [modalidade_id], references: [id], onDelete: Cascade)
  modalidade_id Int

  @@unique([evento_id, modalidade_id])
  @@index([evento_id])
  @@map("evento_modalidade_excluida")
}
```

**Semântica:** linha presente = modalidade **excluída** daquele evento. Ausência = participa.
Adicionar back-relations `excluidas EventoModalidadeExcluida[]` em `Evento` e `Modalidade`.

Migration manual (pasta + `migration.sql` + `prisma generate`), seguindo o processo do projeto. Sem backfill (modelo por exclusão começa vazio = todos participam, comportamento atual preservado). Requer prod DB ligado no deploy-main.

## Arquitetura de aplicação (fonte única)

Para não duplicar a regra "competição menos excluídas":

- **Helper backend** `getModalidadeIdsExcluidas(evento_id): Promise<Set<number>>` e `modalidadesDoEvento(evento_id): Promise<Modalidade[]>` (modalidades da competição do evento, filtradas). Local: módulo de eventos (junto do padrão anfitriao-ordem).
- Todas as saídas server-side passam a respeitar a exclusão usando o helper:
  - `eventos.service.ts` — cálculo de `modalidades_sorteaveis` por evento na listagem.
  - `key_access.service.ts` — `getModalidades(evento)` (mobile).
  - `site-publico.service.ts` — `publicar(eventoId)` (snapshot/SSG).
  - `relatorio_congresso.service.ts` — `gerarCongressoXlsx` (planilhas por modalidade).
- **Endpoint event-scoped** `GET /eventos/:id/modalidades` retorna as modalidades já filtradas (para as telas de evento do front consumirem em vez de `GET /modalidades?competicao_id`).
- O endpoint genérico `GET /modalidades?competicao_id` **não muda** (continua usado na gestão de modalidades da competição, que precisa ver todas).

## Endpoints (padrão anfitriao-ordem)

- `GET /eventos/:id/modalidades-excluidas` → `number[]` (ids das modalidades excluídas).
- `PUT /eventos/:id/modalidades-excluidas` → body `{ excluidas: number[] }`. Substitui o conjunto de exclusões do evento.
  - **Guardrail:** antes de gravar, valida que nenhuma modalidade do novo conjunto tem inscritos ou sorteio nesse evento. Se houver, responde **400** com a lista das modalidades que impedem (id + motivo), e **não** grava nada.
  - Valida também que todos os ids pertencem à competição do evento (senão 400).
- `GET /eventos/:id/modalidades` → `Modalidade[]` já filtrada (competição menos excluídas), mesmo shape do `GET /modalidades`.

## Frontend

- **Serviço** `eventosService`: `getModalidadesExcluidas(eventoId)`, `setModalidadesExcluidas(eventoId, ids)`, `getModalidadesDoEvento(eventoId)`.
- **Painel "Modalidades do evento"** (em `EventoInscricoes`): botão no banner do evento abre modal listando **todas** as modalidades da competição (via `GET /modalidades?competicao_id`) com checkbox "participa" (marcado = participa; desmarcado = excluída). Modalidades com inscritos ou sorteio no evento aparecem com checkbox **desabilitado** e dica ("possui inscritos/sorteio — apague antes de remover"). "Salvar" envia o conjunto de excluídas (PUT); erro do guardrail → toast. Ao salvar, invalida as queries do evento.
- **Telas de evento passam a usar as modalidades filtradas** (via `GET /eventos/:id/modalidades`), de modo que a excluída some de:
  - barra lateral de modalidades e contador "X/Y sorteadas" (`EventoInscricoes`);
  - Modo Congresso (`ModoCongresso`, `CongressoStepModalidade`);
  - Painel de pendentes (`Painel`) — usa o `modalidades_sorteaveis` já filtrado vindo da listagem de eventos.

## Tratamento de erros

- PUT com modalidade que tem inscritos/sorteio → 400 + lista; front mostra toast e mantém o painel aberto.
- PUT com id fora da competição → 400.
- Conjunto vazio (`excluidas: []`) é válido = todas participam.

## Testes

- **Backend (Vitest):**
  - `getModalidadeIdsExcluidas` / `modalidadesDoEvento` retornam competição menos excluídas.
  - `PUT` aplica o conjunto (substitui), `GET` reflete.
  - Guardrail: excluir modalidade com inscritos → 400; com sorteio → 400; sem dados → ok.
  - `GET /eventos/:id/modalidades` filtra corretamente.
- **Frontend:** o painel marca/desmarca, desabilita as travadas; sidebar/contador refletem exclusões (testes com `renderToStaticMarkup`/funções puras, padrão do projeto).
- **Validação:** `npm run build` (front: `tsc -b && vite build`; back: `tsc`) + teste manual (excluir/reincluir, conferir sumiço em admin, Congresso, Painel, mobile, site público e relatório).

## Fora de escopo

- Opt-in real (materializar modalidades por evento).
- Apagar dados ao excluir (a exclusão é bloqueada quando há dados).
- Mudar o endpoint genérico `GET /modalidades?competicao_id`.
- Reordenar/renomear modalidades por evento.
