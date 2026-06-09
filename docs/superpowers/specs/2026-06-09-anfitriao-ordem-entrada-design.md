# Posição do anfitrião em "Ordem de Entrada" (por evento) — Design

**Data:** 2026-06-09
**Status:** Aprovado (aguardando revisão da spec)

## Objetivo

Para modalidades do tipo **Ordem de Entrada**, permitir designar — **por evento** — a posição que o anfitrião do evento ocupará na lista sorteada. Ao sortear, o anfitrião ocupa a posição designada e os demais são embaralhados nas posições restantes. Sem posição designada → sorteio normal.

## Decisões (do brainstorming)

1. **Por evento** (não por modalidade): a mesma modalidade pode ter posições diferentes em eventos diferentes (cada evento tem seu anfitrião).
2. **Validação no registro:** inteiro entre **1 e o nº de inscritos** da modalidade naquele evento (a tela conhece a contagem).
3. **Aplica no sorteio apenas quando:** competição com **"Considerar anfitrião"** ligado **E** posição configurada **E** anfitrião **inscrito** na modalidade.
4. **Re-validação no sorteio:** se a posição > nº de inscritos (caso a contagem tenha mudado) → o sorteio **falha** com mensagem. Sem clamp.
5. Config fica na tela **Inscritos do evento** (`EventoInscricoes`). O sorteio respeita a config independentemente de onde for disparado (inclui Modo Congresso).

## Modelo de dados

Nova tabela (Prisma):
```prisma
model EventoModalidadeAnfitriao {
  id            Int        @id @default(autoincrement())
  evento        Evento     @relation(fields: [evento_id], references: [id], onDelete: Cascade)
  evento_id     Int
  modalidade    Modalidade @relation(fields: [modalidade_id], references: [id], onDelete: Cascade)
  modalidade_id Int
  posicao       Int
  @@unique([evento_id, modalidade_id])
  @@index([evento_id])
  @@map("evento_modalidade_anfitriao")
}
```
- Back-relations: adicionar `evento_modalidade_anfitriao EventoModalidadeAnfitriao[]` em `Evento` e em `Modalidade`.
- Migration criada **manualmente** (CREATE TABLE + FKs + unique), aplicada pelo deploy (ver memória de migrations). **Há migration nova → promover a prod exige ligar a Cloud SQL.**
- Ausência de registro para (evento, modalidade) = sem posição designada.

## Backend — API

Módulo novo enxuto (ex.: `backend/src/modules/anfitriao-ordem/`) ou dentro de `eventos`:
- `GET /eventos/:eventoId/anfitriao-ordem` → `Record<modalidade_id, posicao>` (todas as configs do evento; 1 query, cacheável).
- `PUT /eventos/:eventoId/anfitriao-ordem` body `{ modalidade_id, posicao }`:
  - `posicao === null` → remove o registro (volta ao normal).
  - `posicao` inteiro ≥ 1 → valida `posicao ≤ nº de inscritos` em (evento, modalidade); se exceder → 400. Upsert por `@@unique([evento_id, modalidade_id])`.
  - valida também que a modalidade é do tipo `ordem_entrada` (senão 400).

## Backend — sorteio

`engine.ts`: nova função pura
```ts
export function shuffleOrderAnfitriao(
  participantes: readonly number[], seed: string, anfitriaoPid: number, posicao: number,
): OrdemResultado
```
- Coloca `anfitriaoPid` no índice `posicao - 1`; embaralha os demais (`shuffleSeeded(others, seed)`) preenchendo as posições restantes em ordem. Determinístico.

`sorteios.service.ts` (branch `tipo === 'ordem_entrada'`):
- Carrega a config: `eventoModalidadeAnfitriao.findUnique({ evento_id, modalidade_id })`.
- `aplicar = consideraAnfitriao && anfitriaoInscrito && config?.posicao != null`.
- Se `aplicar`:
  - se `config.posicao > pids.length` → `throw 400` "A posição do anfitrião (X) excede o nº de inscritos (Y)."
  - `resultado = engine.shuffleOrderAnfitriao(pids, seed, anfitriaoPid, config.posicao)`
- Senão: `resultado = engine.shuffleOrder(pids, seed)` (atual).
- (`consideraAnfitriao`, `anfitriaoInscrito`, `anfitriaoPid` já são computados em `executar`.)

## Frontend

- Serviço: `getAnfitriaoOrdem(eventoId)` e `setAnfitriaoOrdem(eventoId, modalidade_id, posicao|null)`.
- `EventoInscricoes.tsx`: quando a modalidade selecionada é `ordem_entrada`, exibir um campo **"Posição do anfitrião"** (numérico, opcional) na área da modalidade (perto do sorteio). 
  - Valor inicial vem do `getAnfitriaoOrdem`. Salvar via `setAnfitriaoOrdem` (toast no sucesso/erro — padrão `useToast`).
  - Validação no input: vazio (= normal) ou inteiro `1..nº de inscritos` (a tela tem `countsByModalidade`/`inscricoes.length`). Bloquear salvar fora do intervalo com `toast.error`.
  - Texto de apoio: "Posição reservada ao anfitrião do evento na ordem sorteada. Requer 'Considerar anfitrião' na competição e anfitrião inscrito."

## Testes

- Engine `shuffleOrderAnfitriao`: anfitrião no índice certo; demais embaralhados e determinísticos; permutação completa (ninguém some/duplica); posição 1 e última.
- Service: aplica quando (considera + inscrito + posição); 400 quando posição > inscritos; normal quando flag off / não inscrito / sem config.
- API config: upsert cria/atualiza; `posicao=null` remove; 400 quando posição > inscritos ou modalidade não é ordem_entrada.

## Fora de escopo

- Configurar a posição dentro do Modo Congresso (config fica em Inscritos do evento; o sorteio respeita de qualquer origem).
- Posição padrão por modalidade / override (decidiu-se só por evento).
- Reordenar/posicionar outros participantes além do anfitrião.
