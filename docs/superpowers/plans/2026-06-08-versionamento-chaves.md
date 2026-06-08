# Versionamento de Chaves (V1/V2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir escolher por modalidade a versão do desenho de chaves (V1 = BYE entra na 2ª rodada; V2 = BYE numa linha "vs BYE" na 1ª rodada), derivando o V2 do V1 por transformação no momento do sorteio.

**Architecture:** O V2 é uma transformação determinística e pura sobre o `matches_graph` do V1 (`liftByesToFirstRoundV2`). A versão fica em `Modalidade.chave_versao` (`'V1'`/`'V2'`, default `'V1'`). No sorteio de chaves, se a modalidade é V2 e há grafo, o grafo é transformado e congelado em `Sorteio.resultado`. Tela e PDF leem o grafo já transformado; o relatório Congresso não muda (preenche por posição). O frontend ganha um seletor de versão no formulário e o `BracketTree` passa a renderizar o ref `"BYE"` e ocultar os ids de stub `B*`.

**Tech Stack:** Backend Node/Express/Prisma/PostgreSQL/Vitest; Frontend React 18/Vite/Vitest/Testing-Library. Spec: `docs/superpowers/specs/2026-06-08-versionamento-chaves-design.md`.

---

## File Structure

- `backend/src/modules/sorteios/engine.ts` — adiciona a função pura `liftByesToFirstRoundV2`. (responsável pela transformação V1→V2 do grafo)
- `backend/src/modules/sorteios/engine.test.ts` — testes da transformação.
- `backend/prisma/schema.prisma` — coluna `chave_versao` em `Modalidade`.
- `backend/prisma/migrations/<ts>_add_chave_versao_modalidade/migration.sql` — migration gerada.
- `backend/src/modules/modalidades/modalidades.service.ts` — aceita/persiste `chave_versao` em criar/editar.
- `backend/src/modules/modalidades/modalidades.controller.ts` — zod aceita `chave_versao`.
- `backend/src/modules/modalidades/modalidades.service.test.ts` — testes.
- `backend/src/modules/sorteios/sorteios.service.ts` — lê `chave_versao` e aplica o transform no sorteio de chaves.
- `backend/src/modules/sorteios/sorteios.service.test.ts` — teste do wiring V2.
- `frontend/src/types/modalidade.ts` — campo `chave_versao`.
- `frontend/src/services/modalidades.ts` — payload com `chave_versao`.
- `frontend/src/pages/modalidades/ModalidadeForm.tsx` — seletor de versão (só tipo chaves).
- `frontend/src/components/sorteio-result/BracketTree.tsx` — render do ref `"BYE"` e ocultar ids `B*`.
- `frontend/src/components/sorteio-result/BracketTree.test.tsx` — teste de render do stub V2.

---

## Task 1: Transformação pura `liftByesToFirstRoundV2` (backend)

**Files:**
- Modify: `backend/src/modules/sorteios/engine.ts` (adicionar função no fim do arquivo; tipos `MatchesGraph`/`MatchRef` já existem em `engine.ts:92-103`)
- Test: `backend/src/modules/sorteios/engine.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `backend/src/modules/sorteios/engine.test.ts`. Primeiro inclua a função no import existente (`engine.test.ts:2-7`), deixando assim:

```ts
import {
  shuffleSeeded,
  drawGroups,
  drawBracket,
  shuffleOrder,
  liftByesToFirstRoundV2,
} from './engine'
```

Depois adicione o bloco de testes:

```ts
describe('liftByesToFirstRoundV2', () => {
  // Grafo real N=6: byes nas posições 1 e 6 (P1 em J3/r2, P6 em J4/r2)
  const graphN6 = {
    matches: [
      { id: 'J1', top: 'P2', bottom: 'P3', round: 1 },
      { id: 'J2', top: 'P4', bottom: 'P5', round: 1 },
      { id: 'J3', top: 'P1', bottom: 'V:J1', round: 2 },
      { id: 'J4', top: 'V:J2', bottom: 'P6', round: 2 },
      { id: 'J6', top: 'V:J3', bottom: 'V:J4', round: 3 },
      { id: 'J5', top: 'L:J3', bottom: 'L:J4', round: 3 },
    ],
    final: 'J6',
    thirdPlace: 'J5',
  }

  it('cria um stub B* de 1ª rodada para cada BYE (P-ref em rodada >= 2)', () => {
    const out = liftByesToFirstRoundV2(graphN6)
    const stubs = out.matches.filter(m => m.id.startsWith('B'))
    expect(stubs).toHaveLength(2)
    for (const s of stubs) {
      expect(s.round).toBe(1)
      expect(s.bottom).toBe('BYE')
      expect(s.top).toMatch(/^P\d+$/)
    }
  })

  it('nenhum P-ref permanece em rodada >= 2 e as refs viram V:B*', () => {
    const out = liftByesToFirstRoundV2(graphN6)
    const r2plus = out.matches.filter(m => m.round >= 2)
    for (const m of r2plus) {
      expect(m.top.startsWith('P')).toBe(false)
      expect(m.bottom.startsWith('P')).toBe(false)
    }
    const j3 = out.matches.find(m => m.id === 'J3')!
    const j4 = out.matches.find(m => m.id === 'J4')!
    expect(j3.top).toBe('V:B1')
    expect(j4.bottom).toBe('V:B2')
  })

  it('preserva jogos reais (J*), final e thirdPlace', () => {
    const out = liftByesToFirstRoundV2(graphN6)
    const reais = out.matches.filter(m => m.id.startsWith('J'))
    expect(reais).toHaveLength(6)
    expect(out.final).toBe('J6')
    expect(out.thirdPlace).toBe('J5')
  })

  it('não muta o grafo de entrada', () => {
    const snapshot = JSON.parse(JSON.stringify(graphN6))
    liftByesToFirstRoundV2(graphN6)
    expect(graphN6).toEqual(snapshot)
  })

  it('lida com dois BYEs no mesmo jogo de 2ª rodada (gera dois stubs)', () => {
    const g = {
      matches: [
        { id: 'J1', top: 'P1', bottom: 'P2', round: 2 },
        { id: 'J2', top: 'V:J1', bottom: 'V:J1', round: 3 },
      ],
      final: 'J2',
      thirdPlace: null,
    }
    const out = liftByesToFirstRoundV2(g)
    const stubs = out.matches.filter(m => m.id.startsWith('B'))
    expect(stubs).toHaveLength(2)
    const j1 = out.matches.find(m => m.id === 'J1')!
    expect(j1.top).toBe('V:B1')
    expect(j1.bottom).toBe('V:B2')
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd backend && npx vitest run src/modules/sorteios/engine.test.ts`
Expected: FAIL — `liftByesToFirstRoundV2 is not a function` (não exportada).

- [ ] **Step 3: Implementar a função**

Adicionar ao final de `backend/src/modules/sorteios/engine.ts`:

```ts
// V2: leva cada BYE (P-ref em rodada >= 2) para uma linha "vs BYE" na 1ª rodada.
// Função pura — não muta o grafo de entrada. IDs de stub usam prefixo 'B'.
export function liftByesToFirstRoundV2(graph: MatchesGraph): MatchesGraph {
  let counter = 0
  const stubs: MatchesGraph['matches'] = []
  const lift = (ref: MatchRef): MatchRef => {
    if (!ref.startsWith('P')) return ref
    counter += 1
    const id = `B${counter}`
    stubs.push({ id, round: 1, top: ref, bottom: 'BYE' })
    return `V:${id}`
  }
  const matches = graph.matches.map(m => {
    if (m.round < 2) return { ...m }
    return { ...m, top: lift(m.top), bottom: lift(m.bottom) }
  })
  return { ...graph, matches: [...matches, ...stubs] }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd backend && npx vitest run src/modules/sorteios/engine.test.ts`
Expected: PASS (todos os testes do arquivo, incl. os 5 novos).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/sorteios/engine.ts backend/src/modules/sorteios/engine.test.ts
git commit -m "feat(sorteios): transform liftByesToFirstRoundV2 (chaves V2)"
```

---

## Task 2: Coluna `chave_versao` em Modalidade (schema + migration)

**Files:**
- Modify: `backend/prisma/schema.prisma` (model `Modalidade`, ~linha 84-100)
- Create: `backend/prisma/migrations/<ts>_add_chave_versao_modalidade/migration.sql` (gerada pelo Prisma)

- [ ] **Step 1: Adicionar o campo ao schema**

Em `backend/prisma/schema.prisma`, no model `Modalidade`, adicionar a linha após `sigla` (linha 87):

```prisma
  sigla               String
  chave_versao        String          @default("V1")
```

- [ ] **Step 2: Gerar a migration**

Run: `cd backend && npx prisma migrate dev --name add_chave_versao_modalidade`
Expected: cria `backend/prisma/migrations/<ts>_add_chave_versao_modalidade/migration.sql` e aplica no banco local. Prisma Client é regenerado.

- [ ] **Step 3: Inspecionar o migration.sql gerado**

Abrir o arquivo `backend/prisma/migrations/<ts>_add_chave_versao_modalidade/migration.sql` e confirmar que contém APENAS:

```sql
ALTER TABLE "Modalidade" ADD COLUMN "chave_versao" TEXT NOT NULL DEFAULT 'V1';
```

Expected: nenhum `DROP TABLE` / `DROP COLUMN` inesperado (proteção contra drift do `migrate diff`). Se houver qualquer DROP, parar e investigar antes de prosseguir.

- [ ] **Step 4: Garantir o Prisma Client atualizado**

Run: `cd backend && npx prisma generate`
Expected: "Generated Prisma Client". (Confirma que `chave_versao` está nos tipos do client.)

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): add chave_versao em Modalidade (default V1)"
```

---

## Task 3: API de modalidades aceita `chave_versao`

**Files:**
- Modify: `backend/src/modules/modalidades/modalidades.service.ts:36-48`
- Modify: `backend/src/modules/modalidades/modalidades.controller.ts:6-12`
- Test: `backend/src/modules/modalidades/modalidades.service.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar dentro do `describe('modalidades.service', ...)` em `backend/src/modules/modalidades/modalidades.service.test.ts` (após o teste `criar chama prisma.create...`, linha 68):

```ts
  it('criar repassa chave_versao para prisma.create', async () => {
    const data = { nome: 'Judo', sigla: 'JUD', competicao_id: 1, tipo_modalidade_id: 2, chave_versao: 'V2' }
    mockPrisma.modalidade.create.mockResolvedValue({ id: 1, ...data })
    await service.criar(data)
    expect(mockPrisma.modalidade.create).toHaveBeenCalledWith({ data, include: INCLUDE })
  })

  it('editar repassa chave_versao para prisma.update', async () => {
    mockPrisma.modalidade.update.mockResolvedValue({ id: 1 })
    await service.editar(1, { chave_versao: 'V1' })
    expect(mockPrisma.modalidade.update).toHaveBeenCalledWith({
      where: { id: 1 }, data: { chave_versao: 'V1' }, include: INCLUDE,
    })
  })
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd backend && npx vitest run src/modules/modalidades/modalidades.service.test.ts`
Expected: FAIL — TypeScript reclama que `chave_versao` não existe no tipo do parâmetro de `criar`/`editar` (erro de compilação no teste).

- [ ] **Step 3: Atualizar os tipos do service**

Em `backend/src/modules/modalidades/modalidades.service.ts`, alterar as assinaturas de `criar` (linha 36-41) e `editar` (linha 45-48):

```ts
export async function criar(data: {
  nome: string
  sigla: string
  competicao_id: number
  tipo_modalidade_id: number
  chave_versao?: string
}) {
  return mapPrismaError(() => prisma.modalidade.create({ data, include: INCLUDE }))
}

export async function editar(
  id: number,
  data: Partial<{ nome: string; sigla: string; competicao_id: number; tipo_modalidade_id: number; chave_versao: string }>
) {
```

(O corpo de `editar` não muda — `data` já é repassado a `prisma.modalidade.update`.)

- [ ] **Step 4: Atualizar a validação zod no controller**

Em `backend/src/modules/modalidades/modalidades.controller.ts`, alterar `createSchema` (linha 6-11):

```ts
const createSchema = z.object({
  nome: z.string().min(1),
  sigla: z.string().min(1),
  competicao_id: z.number().int().positive(),
  tipo_modalidade_id: z.number().int().positive(),
  chave_versao: z.enum(['V1', 'V2']).optional(),
})
```

(`updateSchema = createSchema.partial()` na linha 12 já herda o campo.)

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `cd backend && npx vitest run src/modules/modalidades/modalidades.service.test.ts`
Expected: PASS (todos, incl. os 2 novos).

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/modalidades/modalidades.service.ts backend/src/modules/modalidades/modalidades.controller.ts backend/src/modules/modalidades/modalidades.service.test.ts
git commit -m "feat(modalidades): API aceita chave_versao (V1/V2)"
```

---

## Task 4: Aplicar o transform no sorteio de chaves (wiring)

**Files:**
- Modify: `backend/src/modules/sorteios/sorteios.service.ts:98-105` (select) e `:208-217` (branch chaves)
- Test: `backend/src/modules/sorteios/sorteios.service.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Adicionar dentro do `describe('sorteios.service', ...)` em `backend/src/modules/sorteios/sorteios.service.test.ts` (após o teste `executar chaves passa matchesGraph quando disponível`, linha 279):

```ts
  it('executar chaves aplica transform V2 quando modalidade.chave_versao === V2', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 10 })
    mockPrisma.modalidade.findUnique.mockResolvedValue({
      id: 1, competicao_id: 10, chave_versao: 'V2',
      tipo_modalidade: { tipo: 'chaves' },
    })
    mockPrisma.inscricao.findMany.mockResolvedValue([
      { participante_id: 100 }, { participante_id: 200 }, { participante_id: 300 },
    ])
    mockPrisma.sistemaDisputasChaves.findFirst.mockResolvedValue({
      numero_inscrito: 3, posicao_primeiro_cabeca: 1,
      posicao_segundo_cabeca: 2, posicao_terceiro_cabeca: 0, posicao_quarto_cabeca: 0,
    })
    mockPrisma.bracketChavesByes.findUnique.mockResolvedValue({ numero_inscrito: 3, posicoes_bye: [1] })
    // Grafo V1 com BYE (P1 em rodada 2)
    const v1Graph = {
      matches: [
        { id: 'J1', top: 'P2', bottom: 'P3', round: 1 },
        { id: 'J2', top: 'P1', bottom: 'V:J1', round: 2 },
      ],
      final: 'J2', thirdPlace: null,
    }
    mockPrisma.bracketChavesMatches.findUnique.mockResolvedValue({
      numero_inscrito: 3, matches_graph: v1Graph,
    })
    mockPrisma.sorteio.upsert.mockImplementation(async (args: any) => ({ id: 1, ...args.create }))

    await service.executar({ evento_id: 1, modalidade_id: 1 })

    const call = mockPrisma.sorteio.upsert.mock.calls[0][0]
    const graph = call.create.resultado.matchesGraph
    // P1 (BYE) foi elevado para um stub B* de 1ª rodada
    expect(graph.matches.some((m: any) => m.id === 'B1' && m.round === 1 && m.bottom === 'BYE')).toBe(true)
    const j2 = graph.matches.find((m: any) => m.id === 'J2')
    expect(j2.top).toBe('V:B1')
  })
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd backend && npx vitest run src/modules/sorteios/sorteios.service.test.ts -t "transform V2"`
Expected: FAIL — sem o transform, `matchesGraph` ainda é o V1 (não há `B1`), então a asserção `some(... id === 'B1')` é `false`.

- [ ] **Step 3: Incluir `chave_versao` no select da modalidade**

Em `backend/src/modules/sorteios/sorteios.service.ts`, no `prisma.modalidade.findUnique` dentro de `executar` (linha 98-105), adicionar `chave_versao: true` ao `select`:

```ts
    prisma.modalidade.findUnique({
      where: { id: input.modalidade_id },
      select: {
        id: true,
        competicao_id: true,
        chave_versao: true,
        tipo_modalidade: { select: { tipo: true } },
      },
    }),
```

- [ ] **Step 4: Aplicar o transform no branch de chaves**

Em `backend/src/modules/sorteios/sorteios.service.ts`, substituir a linha 209:

```ts
    // matchesGraph is optional — if missing, frontend falls back to legacy render
    const matchesGraph = regraMatches?.matches_graph ? (regraMatches.matches_graph as any) : null
```

por:

```ts
    // matchesGraph is optional — if missing, frontend falls back to legacy render
    let matchesGraph = regraMatches?.matches_graph ? (regraMatches.matches_graph as any) : null
    // V2: leva os BYEs para a linha da 1ª rodada (congelado no resultado do sorteio)
    if (matchesGraph && modalidade.chave_versao === 'V2') {
      matchesGraph = engine.liftByesToFirstRoundV2(matchesGraph)
    }
```

(`engine` já está importado como namespace neste arquivo — usado em `engine.drawBracket`.)

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `cd backend && npx vitest run src/modules/sorteios/sorteios.service.test.ts`
Expected: PASS (incl. o novo; os testes antigos sem `chave_versao` continuam passando porque `undefined !== 'V2'`).

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/sorteios/sorteios.service.ts backend/src/modules/sorteios/sorteios.service.test.ts
git commit -m "feat(sorteios): congelar grafo V2 no sorteio de chaves V2"
```

---

## Task 5: Tipos e serviço de modalidades no frontend

**Files:**
- Modify: `frontend/src/types/modalidade.ts:13-23`
- Modify: `frontend/src/services/modalidades.ts:6-11`

- [ ] **Step 1: Adicionar o campo ao tipo**

Em `frontend/src/types/modalidade.ts`, no tipo `Modalidade`, adicionar após `sigla` (linha 16):

```ts
export type ChaveVersao = 'V1' | 'V2'

export type Modalidade = {
  id: number
  nome: string
  sigla: string
  chave_versao: ChaveVersao
  competicao_id: number
  competicao: Competicao
  tipo_modalidade_id: number
  tipo_modalidade: TipoModalidade
  criado_em: string
  atualizado_em: string
}
```

- [ ] **Step 2: Adicionar o campo ao payload do serviço**

Em `frontend/src/services/modalidades.ts`, alterar o `ModalidadePayload` (linha 6-11):

```ts
import api from './api'
import type { Modalidade, ChaveVersao } from '../types/modalidade'

const BASE = '/modalidades'

type ModalidadePayload = {
  nome: string
  sigla: string
  competicao_id: number
  tipo_modalidade_id: number
  chave_versao?: ChaveVersao
}
```

- [ ] **Step 3: Verificar a build de tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros novos relacionados a `chave_versao` (pode haver erros pré-existentes não relacionados; confirmar que nenhum cita `chave_versao` ou `modalidade.ts`/`modalidades.ts`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/modalidade.ts frontend/src/services/modalidades.ts
git commit -m "feat(modalidades-fe): tipo e payload com chave_versao"
```

---

## Task 6: Seletor de versão no formulário de modalidade

**Files:**
- Modify: `frontend/src/pages/modalidades/ModalidadeForm.tsx`

- [ ] **Step 1: Adicionar estado e carregamento do valor salvo**

Em `frontend/src/pages/modalidades/ModalidadeForm.tsx`:

a) Importar o tipo no topo (junto aos imports existentes):

```ts
import type { ChaveVersao } from '../../types/modalidade'
```

b) Adicionar o estado após `const [sigla, setSigla] = useState('')` (linha 44). Default `'V2'` para nova modalidade:

```ts
  const [chaveVersao, setChaveVersao] = useState<ChaveVersao>('V2')
```

c) No `useEffect` que carrega `existing` (linha 63-70), setar o valor salvo:

```ts
  useEffect(() => {
    if (existing) {
      setCompeticaoId(existing.competicao_id)
      setTipoModalidadeId(existing.tipo_modalidade_id)
      setNome(existing.nome)
      setSigla(existing.sigla)
      setChaveVersao(existing.chave_versao ?? 'V1')
    }
  }, [existing])
```

- [ ] **Step 2: Enviar `chave_versao` no payload**

No `mutationFn` (linha 83-92), incluir o campo no payload:

```ts
    mutationFn: () => {
      const payload = {
        nome: nome.trim(),
        sigla: sigla.trim().toUpperCase(),
        competicao_id: Number(competicaoId),
        tipo_modalidade_id: Number(tipoModalidadeId),
        chave_versao: chaveVersao,
      }
      return isEdit
        ? modalidadesService.editar(Number(id), payload)
        : modalidadesService.criar(payload)
    },
```

- [ ] **Step 3: Renderizar o seletor (só quando tipo === 'chaves')**

No card "Identificação", logo após o `</div>` que fecha o grid de Nome/Sigla (linha 293, antes do `</section>` na linha 294), inserir:

```tsx
            {tipoSelecionado?.tipo === 'chaves' && (
              <div style={{ marginTop: 16 }}>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Versão da chave
                </label>
                <select
                  value={chaveVersao}
                  onChange={e => setChaveVersao(e.target.value as ChaveVersao)}
                  className={inputClass}
                >
                  <option value="V1">V1 — BYE entra na 2ª rodada</option>
                  <option value="V2">V2 — BYE na 1ª rodada (vs BYE)</option>
                </select>
                <p className="text-xs text-[var(--t4)] mt-1.5">
                  Define o desenho do bracket. Trocar a versão de uma modalidade já sorteada
                  só passa a valer após <b>re-sortear</b>.
                </p>
              </div>
            )}
```

- [ ] **Step 4: Verificar a build de tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros novos citando `ModalidadeForm.tsx`.

- [ ] **Step 5: Verificação manual no navegador**

Run: `cd frontend && npm run dev` (e backend rodando)
Verificar:
- Nova modalidade + tipo "Chaves" → aparece o seletor "Versão da chave" com **V2** pré-selecionado.
- Trocar o tipo para "Grupos" → o seletor some.
- Editar uma modalidade de chaves existente → seletor carrega o valor salvo (V1 nas antigas) e permite trocar; salvar persiste.

Expected: comportamento acima confirmado.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/modalidades/ModalidadeForm.tsx
git commit -m "feat(modalidades-fe): seletor de versao de chave (so tipo chaves)"
```

---

## Task 7: Render do V2 no `BracketTree`

**Files:**
- Modify: `frontend/src/components/sorteio-result/BracketTree.tsx` (`renderSlot` ~linha 141-194; chamadas de `renderSlot` ~linhas 285/288; badge de id ~linha 290; corpo do componente ~linha 196-203)
- Test: `frontend/src/components/sorteio-result/BracketTree.test.tsx` (criar)

> **Nota de teste:** o frontend NÃO usa `@testing-library/react` nem `jsdom` — só `vitest`. O padrão do projeto (ver `frontend/src/pages/eventos/SorteioPrint.test.tsx`) é `renderToStaticMarkup` (de `react-dom/server`) + asserções de string com `.toContain`. Siga esse padrão.

> **Comportamento esperado (do mockup aprovado):** o card de BYE da 1ª rodada mostra "Participante / BYE"; e o slot da 2ª rodada que recebe o vencedor do BYE deve mostrar o **nome do participante** (vitória automática), não "Vencedor B1". Por isso o render resolve `V:B{k}` para o P-ref do stub.

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/components/sorteio-result/BracketTree.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import BracketTree from './BracketTree'
import type { Participante } from '../../types/participante'

const participantesById = new Map<number, Participante>([
  [10, { id: 10, nome: 'Fulano', subtitulo: null } as any],
  [20, { id: 20, nome: 'Beltrano', subtitulo: null } as any],
  [30, { id: 30, nome: 'Sicrano', subtitulo: null } as any],
])

// Grafo V2 (transformado): B1 = P1 (slot 0 = Fulano) vs BYE; J1 = P2 vs P3; J2 = V:B1 vs V:J1
const graphV2 = {
  matches: [
    { id: 'J1', top: 'P2', bottom: 'P3', round: 1 },
    { id: 'B1', top: 'P1', bottom: 'BYE', round: 1 },
    { id: 'J2', top: 'V:B1', bottom: 'V:J1', round: 2 },
  ],
  final: 'J2',
  thirdPlace: null,
}

describe('BracketTree (V2)', () => {
  it('renderiza o rótulo BYE e o nome do participante do stub', () => {
    const html = renderToStaticMarkup(
      <BracketTree matchesGraph={graphV2} slots={[10, 20, 30]} participantesById={participantesById} />
    )
    expect(html).toContain('BYE')
    expect(html).toContain('Fulano')
  })

  it('resolve V:B1 para o nome (sem "Vencedor B1") e oculta o id do stub', () => {
    const html = renderToStaticMarkup(
      <BracketTree matchesGraph={graphV2} slots={[10, 20, 30]} participantesById={participantesById} />
    )
    // B1 não aparece em lugar nenhum (id do card oculto + V:B1 resolvido p/ nome)
    expect(html).not.toContain('B1')
    // jogos reais e seus vencedores pendentes continuam
    expect(html).toContain('J1')
    expect(html).toContain('Vencedor J1')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd frontend && npx vitest run src/components/sorteio-result/BracketTree.test.tsx`
Expected: FAIL — o ref `"BYE"` cai no `return null` de `renderSlot` (não há "BYE"), `V:B1` é renderizado como "Vencedor B1" e o id `B1` aparece no canto do card → `html` contém `'B1'`.

- [ ] **Step 3: Construir o mapa de stubs e tratar `"BYE"` + resolução de `V:B{k}` em `renderSlot`**

Em `frontend/src/components/sorteio-result/BracketTree.tsx`:

a) Adicionar um parâmetro `byeStubTop` à assinatura de `renderSlot` (linha 141-150), ao final dos parâmetros:

```ts
function renderSlot(
  ref: string,
  slots: (number | null)[],
  participantesById: Map<number, Participante>,
  campeoesByParticipanteId: Map<number, number> | undefined,
  large: boolean,
  subtituloLine?: (p: Participante) => string | null,
  anfitriaoPid?: number | null,
  cabecasPids?: Set<number>,
  byeStubTop?: Record<string, string>,
): React.ReactNode {
```

b) Logo após a definição de `subFontSize` (linha 154, antes do `if (ref.startsWith('P'))`), inserir o tratamento de `"BYE"` e a resolução de `V:B{k}`:

```ts
  if (ref === 'BYE') {
    return <span style={{ color: 'var(--t4)', fontStyle: 'italic', fontSize: labelFontSize }}>BYE</span>
  }
  // V2: V:B{k} é a vitória automática de um BYE — mostra o nome do jogador que avançou.
  if (ref.startsWith('V:') && byeStubTop && byeStubTop[ref.slice(2)]) {
    ref = byeStubTop[ref.slice(2)]
  }
```

- [ ] **Step 4: Construir `byeStubTop` no componente e passar para as chamadas de `renderSlot`**

Em `frontend/src/components/sorteio-result/BracketTree.tsx`, no corpo do componente `BracketTree`, logo após `const layout = useMemo(...)` (linha 197), adicionar:

```ts
  const byeStubTop: Record<string, string> = {}
  for (const m of matchesGraph.matches) {
    if (m.id.startsWith('B')) byeStubTop[m.id] = m.top
  }
```

Depois, nas duas chamadas de `renderSlot` (linhas 285 e 288), acrescentar `byeStubTop` como último argumento:

```tsx
              {renderSlot(m.top, slots, participantesById, campeoesByParticipanteId, large, subtituloLine, anfitriaoPid, cabecasPids, byeStubTop)}
```

```tsx
              {renderSlot(m.bottom, slots, participantesById, campeoesByParticipanteId, large, subtituloLine, anfitriaoPid, cabecasPids, byeStubTop)}
```

- [ ] **Step 5: Ocultar o id dos stubs `B*`**

Em `frontend/src/components/sorteio-result/BracketTree.tsx`, substituir a linha 290:

```tsx
            <div style={{ position: 'absolute', top: 2, right: 4, fontSize: '0.65rem', color: 'var(--t4)' }}>{m.id}</div>
```

por:

```tsx
            {!m.id.startsWith('B') && (
              <div style={{ position: 'absolute', top: 2, right: 4, fontSize: '0.65rem', color: 'var(--t4)' }}>{m.id}</div>
            )}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `cd frontend && npx vitest run src/components/sorteio-result/BracketTree.test.tsx`
Expected: PASS (ambos os testes).

- [ ] **Step 7: Verificação manual no navegador**

Com uma modalidade de chaves marcada como **V2** e com grafo disponível para o N (ex.: N=6 ou N=22), executar o sorteio e abrir a tela do resultado e o PDF do sorteio.
Expected: os BYEs aparecem como cards de 1ª rodada "Participante / BYE", ligados por conector ao card da 2ª rodada, onde o **nome do jogador** aparece (não "Vencedor B1"); cards de BYE não mostram número de jogo; jogos reais (J*) inalterados.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/sorteio-result/BracketTree.tsx frontend/src/components/sorteio-result/BracketTree.test.tsx
git commit -m "feat(bracket): render do BYE na 1a rodada (chaves V2)"
```

---

## Task 8: Validação end-to-end e fechamento

**Files:** nenhum (verificação)

- [ ] **Step 1: Suíte de testes backend**

Run: `cd backend && npx vitest run`
Expected: tudo verde.

- [ ] **Step 2: Suíte de testes frontend**

Run: `cd frontend && npx vitest run`
Expected: tudo verde.

- [ ] **Step 3: Smoke manual V1 vs V2**

Com backend+frontend rodando, em uma competição com regra de chaveamento para um N que tenha grafo e BYEs (ex.: N=6):
- Criar/editar 2 modalidades de chaves: uma V1, outra V2 (mesmo N de inscritos).
- Sortear ambas e comparar a tela do resultado:
  - V1: BYE entra na 2ª rodada.
  - V2: BYE numa linha "vs BYE" na 1ª rodada.
- Gerar o relatório Congresso de um evento com a modalidade V2 e confirmar que as posições continuam corretas (relatório não muda com a versão).

Expected: comportamento conforme a spec.

---

## Notas de implementação

- **N sem grafo no V1** (render legado: 17/40/58, 20, 62–77) não têm `matches_graph`; o transform não roda (condição `matchesGraph &&`), então caem no render legado V1-like mesmo marcados como V2. Comportamento esperado e documentado na spec (fora de escopo).
- **Sorteios já existentes** mantêm o grafo congelado; trocar a versão exige re-sortear.
- **Relatório Congresso**: nenhuma alteração (preenche por `slots`, idêntico em V1/V2).
