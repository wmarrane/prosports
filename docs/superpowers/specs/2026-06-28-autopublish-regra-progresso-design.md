# Auto-publish do congresso — regra de progresso precisa + toast — Design

**Data:** 2026-06-28
**Status:** Aprovado (aguardando revisão da spec)

## Contexto

A auto-publicação parcial no Modo Congresso (entregue em `feat/status-real-autopublish`) dispara a publicação do site a cada 25% de modalidades sorteadas, enquanto o evento está "Pronto p/ sorteio". Hoje o denominador é calculado no frontend como "modalidades `tipo ≠ especifico` com inscritos" — o que inclui `ordem_entrada` e **não** considera as regras de negócio que impedem o sorteio (ex.: grupos/chaves sem regra cadastrada). Isso pode tornar o 100% inatingível ou os marcos imprecisos.

Pedido do Wagner:
1. Exibir um **toast** quando uma auto-publicação for disparada.
2. Refinar o denominador dos 25%:
   2.1. Considerar apenas modalidades que **vão a sorteio** = tipo ∈ {grupos, chaves}.
   2.2. Excluir as de grupos/chaves que **não serão sorteadas** por regra de negócio.
3. Manter o gatilho apenas para eventos "Pronto p/ sorteio".

## Regras que tornam uma modalidade Grupos/Chaves "não sorteável" (decisão: aplicar R1–R4)

Da função autoritativa `backend/src/lib/sorteaveis.ts` (`isSorteavel`), também usada no admin (`modalidades_sorteaveis`):
- **R1** — Sem inscritos (`inscritos <= 0`).
- **R2** — Regra de "mensagens de inscritos" com `pular_sorteio = true` casando a faixa `[min,max]` do nº de inscritos (ex.: "abaixo de N não sorteia").

Das validações do próprio sorteio (`backend/src/modules/sorteios/sorteios.service.ts`):
- **R3 (grupos)** — Não existe `sistemaDisputasGrupos` para `competicao_id` + `quantidade_equipes = N` → o sorteio falharia.
- **R4 (chaves)** — Não existe `sistemaDisputasChaves` (`competicao_id` + `numero_inscrito = N`) **ou** não existe `bracketChavesByes` (`numero_inscrito = N`) → o sorteio falharia.

`N` = nº de inscritos da modalidade no evento. `ordem_entrada` e `especifico` ficam fora do cálculo (2.1).

## Decisões aprovadas

- Denominador aplica **R1+R2+R3+R4** (conjunto preciso) → 100% sempre atingível.
- Cálculo no **backend** (fonte única de verdade), reusando `isSorteavel` + a mesma checagem de regras do sorteio. Frontend só consome.
- Toast ao **disparar** a publicação; toast discreto de erro se o disparo falhar; sucesso silencioso.
- Gatilho continua só para status `pronto`.

## Backend — `progressoSorteio`

Novo serviço (em `backend/src/modules/sorteios/sorteios.service.ts` — perto da lógica de sorteio — ou `eventos.service.ts`; o plano fixa o arquivo) `progressoSorteio(eventoId): Promise<{ sorteadas: number; sorteaveis: number }>`:
- Carrega o evento (`competicao_id`).
- Modalidades da competição `ativa = true`, com `tipo_modalidade.tipo` ∈ {grupos, chaves}; remove as excluídas (`eventoModalidadeExcluida`).
- Inscritos por modalidade do evento (`inscricao` agrupado por `modalidade_id`).
- Sorteios do evento (`sorteio` → set de `modalidade_id` sorteados).
- Regras (em lote, por competição): `sistemaDisputasGrupos` → set de `quantidade_equipes`; `sistemaDisputasChaves` → set de `numero_inscrito`; `bracketChavesByes` → set de `numero_inscrito` presentes (consultar pelos N candidatos).
- Para cada candidata: `n = inscritos`; se `!isSorteavel({tipo, mensagens_inscritos}, n)` → pula (R1/R2); se grupos e `!gruposSet.has(n)` → pula (R3); se chaves e (`!chavesSet.has(n)` ou `!bracketSet.has(n)`) → pula (R4); senão conta em `sorteaveis` e, se já sorteada, em `sorteadas`.
- Retorna `{ sorteadas, sorteaveis }`.

Rota: `GET /eventos/:id/progresso-sorteio` (admin) → `{ sorteadas, sorteaveis }`. Controller fino.

## Frontend admin — Modo Congresso

- `eventosService.progressoSorteio(id)` → `GET .../:id/progresso-sorteio`.
- `CongressoStepSorteio.tsx`:
  - Substituir o cálculo local do denominador (as queries `getModalidadesDoEvento` + `inscricoes` do evento e o `filter` local) por uma query `['progresso-sorteio', eventoId]`. Invalidar essa query no `onSuccess` do `executar` (junto com `['sorteios', eventoId]`).
  - O efeito de auto-publish passa a usar `{ sorteadas, sorteaveis }` do endpoint: `pct = pctSorteado(sorteadas, sorteaveis)`; `proximoMarcoCruzado` + dedupe `localStorage` (`prosports.congresso.autopublish.<id>`) e o ref de concorrência permanecem; gatilho só se `evento.status === 'pronto'`.
  - Remover imports/queries que ficaram sem uso (o build do admin falha em locals não usados).
  - **Toast:** ao disparar `publicarParcial` (cruzou marco), `toast.info('Publicação do site iniciada — atualização NN%')` (NN = marco). No `.catch`, `toast.error('Falha ao iniciar a publicação do site.')` (discreto). Usar o `useToast` existente (`../../components/Toast`); confirmar no plano que o `ToastProvider` cobre a rota do congresso.

`autopublish.ts` (`MARCOS`, `pctSorteado`, `proximoMarcoCruzado`) permanece inalterado.

## Testes / Verificação

- **Backend (Vitest)** `progressoSorteio`:
  - Conta só grupos/chaves (ignora ordem_entrada e especifico).
  - R1: exclui sem inscritos. R2: exclui `pular_sorteio`. R3: exclui grupos sem regra para N. R4: exclui chaves sem regra/bracket para N.
  - `sorteadas` conta só candidatas sorteáveis já sorteadas.
- **Frontend**: a função de marco segue coberta por `autopublish.test.ts`. Adicionar/ajustar para o toast se viável (ou validar manualmente). 
- `cd backend && npm test`; `cd frontend && npm run build && npm run build:site` verdes.
- **Demo antes do merge na develop**: descrever o fluxo (não dá para sortear ao vivo facilmente) — ao menos evidência do endpoint retornando `{sorteadas, sorteaveis}` corretos para um evento e do toast aparecendo ao disparar (mock/dev).

## Fora de escopo
- Auto-transição de status no backend (segue manual).
- Mudar o botão manual de publicar (continua exigindo `sorteado`).
- Considerar `ordem_entrada` no denominador (excluída por decisão).
- Produção.

## Restrições globais
- Host Windows; ler antes de editar; caminhos absolutos. Git identity inline (`-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`).
- Validar com `npm test` (backend), `npm run build`/`build:site` (frontend). Reusar padrões; sem cores novas. Nunca `git add -A`.
- Demo antes da develop; promoção a prod só com confirmação do Wagner.
