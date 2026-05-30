# Campeões como Sementes (grupos + chaves) + Modo Congresso 5 passos — Design

**Data:** 2026-05-30
**Status:** Aprovado para implementação
**Versão alvo:** 1.16.0

## Objetivo

1. Restaurar tabela `sistema_disputas_chaves` no schema.prisma (drift identificado durante exploração).
2. Atualizar motor de sorteio para que campeões cadastrados em `CampeaoAnterior` e inscritos na modalidade atual ocupem posições fixas (sementes) ao invés de serem totalmente aleatorizados.
3. Adicionar novo passo "Campeões do Ano Anterior" ao Modo Congresso, entre Participantes e Sorteio.

## Escopo

- **In:**
  - Prisma model `SistemaDisputasChaves` + migration idempotente (`CREATE TABLE IF NOT EXISTS`).
  - Mudanças em `engine.drawGroups` (parâmetro `campeoesPids`) e `engine.drawBracket` (parâmetros `campeoesPids` + `regra`; size = N literal).
  - Service `sorteios.executar`: carrega CampeaoAnterior + lookup `sistema_disputas_chaves` para tipo chaves.
  - Novo passo `'campeoes'` no Modo Congresso entre Participantes (3) e Sorteio (5).
  - Página `CongressoStepCampeoes.tsx` listando campeões com status inscrito/não-inscrito.
  - Testes vitest novos no engine + service.
- **Out:**
  - Render visual extra para "cabeças" em `SorteioChaves` (badge já cobre — visualização das sementes vai pela posição natural no slot).
  - Edição de campeões dentro do Modo Congresso.
  - Mudança em `ordem_entrada` ou `especifico` (continuam como estão).

## Restauração `sistema_disputas_chaves`

A tabela já existe no DB dev (76 linhas, `numero_inscrito` de 2 a 77) mas não está no `schema.prisma` — risco igual ao `sistema_disputas_grupos` (vide `feedback_prisma_migrate_diff_drift.md`).

### Schema

```prisma
model SistemaDisputasChaves {
  id                       Int @id @default(autoincrement())
  numero_inscrito          Int
  posicao_primeiro_cabeca  Int
  posicao_segundo_cabeca   Int
  posicao_terceiro_cabeca  Int
  posicao_quarto_cabeca    Int

  @@unique([numero_inscrito])
  @@map("sistema_disputas_chaves")
}
```

Observações:
- Posições com valor `0` significam "não há essa cabeça" (ex: N=2 só tem 2 cabeças, então 3ª e 4ª = 0).
- Unique em `numero_inscrito` (1 linha por N).

### Migration

`backend/prisma/migrations/<ts>_restore_sistema_disputas_chaves/migration.sql`:

```sql
-- Adopt existing sistema_disputas_chaves table (already exists in dev DB).
-- IF NOT EXISTS makes it safe for both adopted-dev and fresh environments.

CREATE TABLE IF NOT EXISTS "sistema_disputas_chaves" (
  "id" SERIAL PRIMARY KEY,
  "numero_inscrito" INTEGER NOT NULL,
  "posicao_primeiro_cabeca" INTEGER NOT NULL,
  "posicao_segundo_cabeca" INTEGER NOT NULL,
  "posicao_terceiro_cabeca" INTEGER NOT NULL,
  "posicao_quarto_cabeca" INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "sistema_disputas_chaves_numero_inscrito_key"
  ON "sistema_disputas_chaves"("numero_inscrito");
```

Sem FK porque a tabela é global (ao contrário de `sistema_disputas_grupos` que é por competição).

## Engine — `drawGroups` (mudança)

**Assinatura atual:**
```ts
drawGroups(participantes: readonly number[], regra: RegraGrupos, seed: string): GruposResultado
```

**Nova:**
```ts
drawGroups(
  participantes: readonly number[],
  regra: RegraGrupos,
  seed: string,
  campeoesPids?: readonly number[],  // ordenados por posicao ASC
): GruposResultado
```

**Algoritmo:**
1. Calcular sequência de tamanhos `sizes` (como hoje, shuffled).
2. `numGrupos = sizes.length`.
3. Tomar `cabeças = campeoesPids.slice(0, numGrupos)` (somente os que cabem; demais entram no shuffle).
4. `outros = participantes.filter(pid => !cabeças.includes(pid))`.
5. `outrosShuffled = shuffleSeeded(outros, seed)`.
6. Para cada grupo `g` (0..numGrupos-1):
   - Tamanho `tam = sizes[g]`.
   - 1ª posição: `cabeças[g]` se existir, senão `outrosShuffled.shift()`.
   - Demais (tam-1 vagas): `outrosShuffled.splice(0, tam - 1)`.
7. Mesmo formato de saída.

**Caso edge:** se `campeoesPids` é vazio ou `undefined`, comportamento idêntico ao atual.

## Engine — `drawBracket` (mudança breaking no shape)

**Assinatura atual:**
```ts
drawBracket(participantes: readonly number[], seed: string): BracketResultado
```

**Nova:**
```ts
type RegraChaves = {
  posicao_primeiro_cabeca: number
  posicao_segundo_cabeca: number
  posicao_terceiro_cabeca: number
  posicao_quarto_cabeca: number
}

drawBracket(
  participantes: readonly number[],
  regra: RegraChaves,
  seed: string,
  campeoesPids?: readonly number[],  // ordenados por posicao ASC
): BracketResultado
```

**Algoritmo:**
1. `N = participantes.length`.
2. Criar `slots: (number | null)[] = new Array(N).fill(null)`.
3. Lista de posições da regra: `[regra.posicao_primeiro_cabeca, ..., regra.posicao_quarto_cabeca]`. Para cada posição `p_i` (1-based):
   - Se `p_i === 0` ou `campeoesPids[i]` ausente → pular.
   - Senão → `slots[p_i - 1] = campeoesPids[i]`.
4. `outros = participantes.filter(pid => !slots.includes(pid))`.
5. `outrosShuffled = shuffleSeeded(outros, seed)`.
6. Para cada slot `j` (0..N-1) onde `slots[j] === null` → `slots[j] = outrosShuffled.shift()`.
7. `return { size: N, slots }`.

**Mudança breaking vs atual:** `size = N` literal (não mais `2^ceil(log2(N))`). `slots` não tem mais BYEs nulos (porque tem exatamente N elementos = N participantes). Renderer `SorteioChaves` continua funcionando — a verificação `pid == null ? BYE : nome` deixa de pegar nulls em prática (mas o código segue defensivo, sem alteração).

**Caso edge:**
- `campeoesPids` vazio: nenhuma cabeça fixa; todos shuffled.
- Mais de 4 campeões: ignorar do índice 4 em diante (só os 4 primeiros são cabeças possíveis pela regra).

## Service — `sorteios.executar`

Mudanças no fluxo de `executar`:

1. Após validar evento + modalidade + competição + tipo, antes do dispatch:
   - Se tipo ∈ {`grupos`, `chaves`}: carregar `prisma.campeaoAnterior.findMany({ where: { evento_id, modalidade_id }, orderBy: { posicao: 'asc' }, select: { participante_id: true } })`.
   - Derivar `campeoesPidsInscritos = campeoes.map(c => c.participante_id).filter(pid => inscritosSet.has(pid))` (mantendo ordem).

2. Para tipo `chaves`:
   - Buscar `regraChaves = prisma.sistemaDisputasChaves.findFirst({ where: { numero_inscrito: pids.length } })`.
   - Se ausente: throw 400 "Não há regra de chaveamento para X inscritos. Cadastre em Administração."
   - Chamar `engine.drawBracket(pids, regraChaves, seed, campeoesPidsInscritos)`.

3. Para tipo `grupos`:
   - Chamar `engine.drawGroups(pids, regraGrupos, seed, campeoesPidsInscritos)`.

4. Para tipo `ordem_entrada` e `especifico`: sem mudança.

## Modo Congresso — Novo Passo

### `CongressoStep` (tipo)

```ts
export type CongressoStep = 'evento' | 'modalidade' | 'participantes' | 'campeoes' | 'sorteio'
```

### `CongressoShell` (header)

```ts
const STEP_LABELS: Record<CongressoStep, string> = {
  evento: 'Selecione o Evento',
  modalidade: 'Selecione a Modalidade',
  participantes: 'Participantes Confirmados',
  campeoes: 'Campeões do Ano Anterior',
  sorteio: 'Sorteio',
}

const STEP_INDEX: Record<CongressoStep, number> = {
  evento: 1,
  modalidade: 2,
  participantes: 3,
  campeoes: 4,
  sorteio: 5,
}
```

Indicador: "Passo X de 5 · ..." (era 4).

### Página `CongressoStepCampeoes.tsx`

Props: `{ eventoId, modalidadeId, onNext }`. Layout:
- Header local com nome da modalidade.
- Empty state: "Nenhum campeão cadastrado para esta modalidade." + botão "Próximo →".
- Para cada campeão (em ordem por posicao ASC), card grande com:
  - `<CampeaoBadge posicao={c.posicao} large />` à esquerda
  - Nome do participante + subtítulo (font grande, ~22px)
  - Status à direita: pill verde "✓ Inscrito" se `c.participante_id` está em `inscricoes` daquela modalidade; cinza "Não inscrito" senão.
- Footer com botão "Próximo →".

Data fetching: `useQuery(['campeoes-anteriores', eventoId, modalidadeId])` + `useQuery(['inscricoes', eventoId, modalidadeId])` para o status.

### `ModoCongresso` (state machine)

`handleBack` atualizado:
- 'sorteio' → 'campeoes'
- 'campeoes' → 'participantes'
- 'participantes' → 'modalidade'
- 'modalidade' → 'evento' + reset eventoId

Render: switch ganha bloco `'campeoes'`:
```tsx
{step === 'campeoes' && eventoId != null && modalidadeId != null && (
  <CongressoStepCampeoes
    eventoId={eventoId}
    modalidadeId={modalidadeId}
    onNext={() => setStep('sorteio')}
  />
)}
```

E o passo `'participantes'` passa a transitar para `'campeoes'` (não mais `'sorteio'`).

## Testes vitest

### `engine.test.ts` — novos casos

1. `drawGroups: sem campeões → comportamento igual ao atual` (regressão).
2. `drawGroups: 1 campeão + 5 outros + regra (2g de 3) → campeão na 1ª pos do Grupo A, outros 5 distribuídos`.
3. `drawGroups: 3 campeões + 3 outros + regra (2g de 3) → 1º e 2º campeão como 1ªs pos de A e B; 3º campeão entra no shuffle de outros`.
4. `drawBracket: sem campeões + regra básica + 5 inscritos → size=5, sem nulls, todos pids presentes`.
5. `drawBracket: 4 campeões + 4 outros + regra (1,8,5,4) → slots[0,7,4,3] preenchidos com campeões em ordem; outros nos demais slots`.
6. `drawBracket: 2 campeões + regra com posicao_terceiro_cabeca=0 → só 2 cabeças usadas`.

### `sorteios.service.test.ts` — atualizar/adicionar

7. Adicionar mock de `campeaoAnterior.findMany` e `sistemaDisputasChaves.findFirst`.
8. Atualizar test existente "executar (chaves) faz upsert com bracket" para passar `regra` mock (não vai mais quebrar — pegar do mock).
9. Novo teste: `executar (chaves) lança 400 amigável se sem regra na tabela sistema_disputas_chaves`.
10. Novo teste: `executar (grupos) com campeões inscritos chama engine.drawGroups com lista de pids`.
11. Novo teste: `executar (chaves) com campeões inscritos chama engine.drawBracket com lista de pids + regra`.

## Implementação — File Structure

**Backend — Create:**
- `backend/prisma/migrations/<ts>_restore_sistema_disputas_chaves/migration.sql`.

**Backend — Modify:**
- `backend/prisma/schema.prisma` — adicionar `SistemaDisputasChaves` model.
- `backend/src/modules/sorteios/engine.ts` — drawGroups e drawBracket alteradas.
- `backend/src/modules/sorteios/engine.test.ts` — +6 testes; ajustar 1-2 existentes.
- `backend/src/modules/sorteios/sorteios.service.ts` — carrega campeões + regra chaves + passa para engine.
- `backend/src/modules/sorteios/sorteios.service.test.ts` — mocks novos + ajustes + 3 novos testes.

**Frontend — Create:**
- `frontend/src/pages/congresso/CongressoStepCampeoes.tsx`.

**Frontend — Modify:**
- `frontend/src/types/congresso-step.ts` — adicionar `'campeoes'` ao union.
- `frontend/src/pages/congresso/CongressoShell.tsx` — STEP_LABELS, STEP_INDEX, "Passo X de 5".
- `frontend/src/pages/congresso/ModoCongresso.tsx` — state machine novo step.

**Release:**
- `package.json`: `1.15.1` → `1.16.0` (MINOR).
- `CHANGELOG.md`: bloco `[1.16.0]`.

## Smoke pós-deploy

1. Verificar via DB que tabela `sistema_disputas_chaves` está no `_prisma_migrations` (adotada).
2. Cadastrar evento+modalidade `chaves` com 5 inscritos, sendo 2 deles campeões (posições 1 e 2).
3. /eventos/:id/inscricoes → realizar sorteio chaves → resultado deve ter:
   - slots[0] = campeão 1º (posicao_primeiro_cabeca=1)
   - slots[4] = campeão 2º (posicao_segundo_cabeca=5)
   - slots[2,3] = outros 3 inscritos em ordem aleatória
   - size = 5 (não 8)
4. Modalidade `grupos` com 6 inscritos sendo 2 campeões + regra (2g de 3): sortear → campeões nas 1ªs vagas de A e B; outros 4 distribuídos.
5. Modo Congresso → wizard 5 passos. Passo 4 mostra lista de campeões com pills verde/cinza.
6. Modalidade `chaves` com N não-cadastrado em sistema_disputas_chaves → 400 amigável.
7. Rodapé: `v1.16.0`.

## Risco / efeitos colaterais

- **`sistema_disputas_chaves` adotada via IF NOT EXISTS**: a migração roda sem erro em ambiente dev (tabela existe) e cria em ambientes novos. _prisma_migrations registra a entrada. Verificar manualmente que tabela está populada (em dev, sim — 76 linhas; em prod, vazio, operador precisa popular).
- **Shape do drawBracket mudou**: sorteios antigos persistidos têm `size` potência de 2 com nulls. Render continua funcionando (`pid == null ? BYE`). Novos sorteios terão `size = N`. Aceito — operador re-sorteia se quiser o novo formato.
- **Modalidade `chaves` sem regra**: bloqueia sorteio com 400 amigável. Operador precisa cadastrar regras ANTES. Em dev já tem N=2..77, então qualquer evento com 2-77 inscritos funciona.
- **N=1 em chaves**: tabela só tem de N=2 em diante. Erro 400 ("Não há regra...") funciona como guarda implícita.
- **Mais de 4 campeões em chaves**: do 5º em diante viram inscritos comuns no shuffle. Documentado no engine.
- **Campeão NÃO inscrito**: ignorado (filtrado por `inscritosSet.has`). Não vira cabeça.
- **Performance**: 2 queries extras por executar (campeões + regra chaves). Insignificante.
- **Migration de chaves**: NÃO precisa popular dados (em prod, operador popula via CRUD futuro ou import). Em dev já tem dados.
