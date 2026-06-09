# Posição do anfitrião em Ordem de Entrada (por evento) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir configurar, por evento, a posição do anfitrião na lista sorteada de modalidades Ordem de Entrada; ao sortear, o anfitrião ocupa essa posição.

**Architecture:** Nova tabela `evento_modalidade_anfitriao` (config por evento+modalidade). Função pura `shuffleOrderAnfitriao` no engine. Endpoints GET/PUT em `/eventos/:id/anfitriao-ordem`. UI na tela Inscritos do evento. O sorteio de `ordem_entrada` lê a config e aplica quando "Considerar anfitrião" + anfitrião inscrito + posição configurada.

**Tech Stack:** Backend Node/Express/Prisma/PostgreSQL/Vitest/zod; Frontend React 18/react-query/Vitest. Spec: `docs/superpowers/specs/2026-06-09-anfitriao-ordem-entrada-design.md`.

---

## File Structure

- `backend/src/modules/sorteios/engine.ts` — `shuffleOrderAnfitriao`.
- `backend/src/modules/sorteios/engine.test.ts` — testes.
- `backend/prisma/schema.prisma` — model `EventoModalidadeAnfitriao` + back-relations.
- `backend/prisma/migrations/<ts>_add_evento_modalidade_anfitriao/migration.sql`.
- `backend/src/modules/eventos/anfitriao-ordem.service.ts` — get/set config.
- `backend/src/modules/eventos/anfitriao-ordem.controller.ts` — handlers + zod.
- `backend/src/modules/eventos/eventos.routes.ts` — rotas.
- `backend/src/modules/sorteios/sorteios.service.ts` — branch `ordem_entrada`.
- `backend/src/modules/sorteios/sorteios.service.test.ts` — teste do wiring.
- `frontend/src/services/eventos.ts` — métodos get/set.
- `frontend/src/pages/eventos/EventoInscricoes.tsx` — campo de posição.

---

## Task 1: Engine `shuffleOrderAnfitriao`

**Files:**
- Modify: `backend/src/modules/sorteios/engine.ts`
- Test: `backend/src/modules/sorteios/engine.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao final de `engine.test.ts` (e incluir `shuffleOrderAnfitriao` no import de `'./engine'`):

```ts
describe('shuffleOrderAnfitriao', () => {
  it('coloca o anfitrião na posição (1-based) e mantém todos', () => {
    const out = shuffleOrderAnfitriao([1, 2, 3, 4, 5], 'seed', 3, 2)
    expect(out.ordem[1]).toBe(3) // posição 2 → índice 1
    expect(out.ordem).toHaveLength(5)
    expect([...out.ordem].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5])
  })

  it('determinístico para a mesma seed', () => {
    const a = shuffleOrderAnfitriao([1, 2, 3, 4, 5], 's', 1, 1)
    const b = shuffleOrderAnfitriao([1, 2, 3, 4, 5], 's', 1, 1)
    expect(a).toEqual(b)
  })

  it('posição 1 e última', () => {
    expect(shuffleOrderAnfitriao([10, 20, 30], 's', 20, 1).ordem[0]).toBe(20)
    const ult = shuffleOrderAnfitriao([10, 20, 30], 's', 20, 3)
    expect(ult.ordem[2]).toBe(20)
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd backend && npx vitest run src/modules/sorteios/engine.test.ts -t shuffleOrderAnfitriao`
Expected: FAIL — função não existe.

- [ ] **Step 3: Implementar**

Adicionar em `engine.ts` após `shuffleOrder`:

```ts
export function shuffleOrderAnfitriao(
  participantes: readonly number[],
  seed: string,
  anfitriaoPid: number,
  posicao: number,
): OrdemResultado {
  const others = participantes.filter(p => p !== anfitriaoPid)
  const shuffled = shuffleSeeded(others, seed)
  const ordem: number[] = []
  let j = 0
  for (let i = 0; i < participantes.length; i++) {
    if (i === posicao - 1) ordem.push(anfitriaoPid)
    else ordem.push(shuffled[j++])
  }
  return { ordem }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && npx vitest run src/modules/sorteios/engine.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/sorteios/engine.ts backend/src/modules/sorteios/engine.test.ts
git commit -m "feat(sorteios): shuffleOrderAnfitriao (posiciona anfitrião na ordem)"
```

---

## Task 2: DB — tabela `evento_modalidade_anfitriao`

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260609000000_add_evento_modalidade_anfitriao/migration.sql`

- [ ] **Step 1: Schema — novo model + back-relations**

Em `backend/prisma/schema.prisma`:

(a) adicionar o model (perto dos outros):
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

(b) no model `Evento`, adicionar a back-relation (junto das outras listas, ex.: após `event_keys      EventoKey[]`):
```prisma
  anfitriao_ordem EventoModalidadeAnfitriao[]
```

(c) no model `Modalidade`, adicionar (após `sorteios            Sorteio[]`):
```prisma
  anfitriao_ordem     EventoModalidadeAnfitriao[]
```

- [ ] **Step 2: Migration manual**

Criar `backend/prisma/migrations/20260609000000_add_evento_modalidade_anfitriao/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "evento_modalidade_anfitriao" (
    "id" SERIAL NOT NULL,
    "evento_id" INTEGER NOT NULL,
    "modalidade_id" INTEGER NOT NULL,
    "posicao" INTEGER NOT NULL,
    CONSTRAINT "evento_modalidade_anfitriao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evento_modalidade_anfitriao_evento_id_modalidade_id_key" ON "evento_modalidade_anfitriao"("evento_id", "modalidade_id");
CREATE INDEX "evento_modalidade_anfitriao_evento_id_idx" ON "evento_modalidade_anfitriao"("evento_id");

-- AddForeignKey
ALTER TABLE "evento_modalidade_anfitriao" ADD CONSTRAINT "evento_modalidade_anfitriao_evento_id_fkey" FOREIGN KEY ("evento_id") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evento_modalidade_anfitriao" ADD CONSTRAINT "evento_modalidade_anfitriao_modalidade_id_fkey" FOREIGN KEY ("modalidade_id") REFERENCES "Modalidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

(Não rodar `prisma migrate dev` — banco de dev compartilhado; o deploy aplica via `migrate deploy`.)

- [ ] **Step 3: Gerar Prisma Client (offline)**

Run: `cd backend && npx prisma generate`
Expected: "Generated Prisma Client" (sem conectar no banco).

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(db): tabela evento_modalidade_anfitriao (posição anfitrião por evento)"
```

---

## Task 3: Backend — service + controller + rotas da config

**Files:**
- Create: `backend/src/modules/eventos/anfitriao-ordem.service.ts`
- Create: `backend/src/modules/eventos/anfitriao-ordem.controller.ts`
- Modify: `backend/src/modules/eventos/eventos.routes.ts`

- [ ] **Step 1: Service**

Criar `backend/src/modules/eventos/anfitriao-ordem.service.ts`:

```ts
import prisma from '../../lib/prisma'

export async function getAnfitriaoOrdem(evento_id: number): Promise<Record<number, number>> {
  const rows = await prisma.eventoModalidadeAnfitriao.findMany({
    where: { evento_id },
    select: { modalidade_id: true, posicao: true },
  })
  const map: Record<number, number> = {}
  for (const r of rows) map[r.modalidade_id] = r.posicao
  return map
}

export async function setAnfitriaoOrdem(
  evento_id: number,
  modalidade_id: number,
  posicao: number | null,
): Promise<{ posicao: number | null }> {
  const mod = await prisma.modalidade.findUnique({
    where: { id: modalidade_id },
    select: { tipo_modalidade: { select: { tipo: true } } },
  })
  if (!mod) throw Object.assign(new Error('Modalidade não encontrada'), { status: 404 })
  if (mod.tipo_modalidade.tipo !== 'ordem_entrada') {
    throw Object.assign(new Error('Posição do anfitrião só se aplica a modalidades de Ordem de Entrada.'), { status: 400 })
  }

  if (posicao == null) {
    await prisma.eventoModalidadeAnfitriao.deleteMany({ where: { evento_id, modalidade_id } })
    return { posicao: null }
  }

  const n = await prisma.inscricao.count({ where: { evento_id, modalidade_id } })
  if (posicao < 1 || posicao > n) {
    throw Object.assign(new Error(`A posição deve estar entre 1 e ${n} (nº de inscritos).`), { status: 400 })
  }

  await prisma.eventoModalidadeAnfitriao.upsert({
    where: { evento_id_modalidade_id: { evento_id, modalidade_id } },
    create: { evento_id, modalidade_id, posicao },
    update: { posicao },
  })
  return { posicao }
}
```

- [ ] **Step 2: Controller**

Criar `backend/src/modules/eventos/anfitriao-ordem.controller.ts`:

```ts
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './anfitriao-ordem.service'

const setSchema = z.object({
  modalidade_id: z.number().int().positive(),
  posicao: z.number().int().min(1).nullable(),
})

export async function getAnfitriaoOrdem(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.getAnfitriaoOrdem(Number(req.params.id)))
  } catch (err) { next(err) }
}

export async function setAnfitriaoOrdem(req: Request, res: Response, next: NextFunction) {
  try {
    const body = setSchema.parse(req.body)
    res.json(await service.setAnfitriaoOrdem(Number(req.params.id), body.modalidade_id, body.posicao))
  } catch (err) { next(err) }
}
```

- [ ] **Step 3: Rotas**

Em `backend/src/modules/eventos/eventos.routes.ts`:
(a) adicionar import: `import * as anfitriaoOrdem from './anfitriao-ordem.controller'`
(b) adicionar as rotas (antes de `router.use('/:evento_id/keys', ...)`):
```ts
router.get('/:id/anfitriao-ordem', requireAuth, anfitriaoOrdem.getAnfitriaoOrdem)
router.put('/:id/anfitriao-ordem', ...admin, anfitriaoOrdem.setAnfitriaoOrdem)
```

- [ ] **Step 4: Build do backend**

Run: `cd backend && npm run build`
Expected: `tsc` sem erros.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/eventos/anfitriao-ordem.service.ts backend/src/modules/eventos/anfitriao-ordem.controller.ts backend/src/modules/eventos/eventos.routes.ts
git commit -m "feat(eventos): API anfitriao-ordem (get/set posição por evento)"
```

---

## Task 4: Backend — aplicar no sorteio de ordem_entrada

**Files:**
- Modify: `backend/src/modules/sorteios/sorteios.service.ts:223-224`
- Test: `backend/src/modules/sorteios/sorteios.service.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Em `sorteios.service.test.ts`, no mock do prisma (objeto `default`), adicionar a entidade:
```ts
    eventoModalidadeAnfitriao: {
      findUnique: vi.fn(),
    },
```
E adicionar, dentro do `describe('sorteios.service', ...)`, após o teste de ordem_entrada existente:

```ts
  it('executar (ordem_entrada) posiciona o anfitrião quando configurado', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1, anfitriao_id: 30, competicao: { considerar_anfitriao: true } })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 1, tipo_modalidade: { tipo: 'ordem_entrada' } })
    mockPrisma.inscricao.findMany.mockResolvedValue([
      { participante_id: 10 }, { participante_id: 20 }, { participante_id: 30 }, { participante_id: 40 },
    ])
    mockPrisma.eventoModalidadeAnfitriao.findUnique.mockResolvedValue({ posicao: 2 })
    mockPrisma.sorteio.upsert.mockImplementation(async (args: any) => ({ id: 1, ...args.create }))
    await service.executar({ evento_id: 1, modalidade_id: 2 })
    const call = mockPrisma.sorteio.upsert.mock.calls[0][0]
    expect(call.create.resultado.ordem[1]).toBe(30) // posição 2 → índice 1
    expect(call.create.resultado.ordem).toHaveLength(4)
  })

  it('executar (ordem_entrada) falha se posição > nº de inscritos', async () => {
    mockPrisma.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1, anfitriao_id: 30, competicao: { considerar_anfitriao: true } })
    mockPrisma.modalidade.findUnique.mockResolvedValue({ id: 2, competicao_id: 1, tipo_modalidade: { tipo: 'ordem_entrada' } })
    mockPrisma.inscricao.findMany.mockResolvedValue([{ participante_id: 10 }, { participante_id: 30 }])
    mockPrisma.eventoModalidadeAnfitriao.findUnique.mockResolvedValue({ posicao: 5 })
    await expect(service.executar({ evento_id: 1, modalidade_id: 2 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringContaining('excede') })
  })
```

> Nota: o teste `'executar (ordem_entrada) faz upsert com ordem'` existente usa modalidade sem `anfitriao_id`/config; garanta que `mockPrisma.eventoModalidadeAnfitriao.findUnique` retorne `undefined`/`null` por padrão no `beforeEach` (ou que aquele teste não ative as 3 condições). Se necessário, no `beforeEach` adicione `mockPrisma.eventoModalidadeAnfitriao.findUnique.mockResolvedValue(null)`.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `cd backend && npx vitest run src/modules/sorteios/sorteios.service.test.ts -t ordem_entrada`
Expected: FAIL — sem o wiring, não posiciona nem falha.

- [ ] **Step 3: Implementar o wiring**

Em `backend/src/modules/sorteios/sorteios.service.ts`, substituir:
```ts
  } else if (tipo === 'ordem_entrada') {
    resultado = engine.shuffleOrder(pids, seed)
  } else {
```
por:
```ts
  } else if (tipo === 'ordem_entrada') {
    const cfg = (consideraAnfitriao && anfitriaoInscrito && anfitriaoPid != null)
      ? await prisma.eventoModalidadeAnfitriao.findUnique({
          where: { evento_id_modalidade_id: { evento_id: input.evento_id, modalidade_id: input.modalidade_id } },
          select: { posicao: true },
        })
      : null
    if (cfg && anfitriaoPid != null) {
      if (cfg.posicao > pids.length) {
        throw Object.assign(
          new Error(`A posição do anfitrião (${cfg.posicao}) excede o nº de inscritos (${pids.length}).`),
          { status: 400 },
        )
      }
      resultado = engine.shuffleOrderAnfitriao(pids, seed, anfitriaoPid, cfg.posicao)
    } else {
      resultado = engine.shuffleOrder(pids, seed)
    }
  } else {
```

(`consideraAnfitriao`, `anfitriaoInscrito`, `anfitriaoPid` já existem em `executar`; `prisma` e `engine` já importados.)

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && npx vitest run src/modules/sorteios/sorteios.service.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Build do backend**

Run: `cd backend && npm run build`
Expected: `tsc` sem erros.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/sorteios/sorteios.service.ts backend/src/modules/sorteios/sorteios.service.test.ts
git commit -m "feat(sorteios): aplica posição do anfitrião no sorteio de ordem_entrada"
```

---

## Task 5: Frontend — serviço

**Files:**
- Modify: `frontend/src/services/eventos.ts`

- [ ] **Step 1: Adicionar métodos**

Em `frontend/src/services/eventos.ts`, adicionar ao objeto `eventosService`:

```ts
  getAnfitriaoOrdem: (eventoId: number) =>
    api.get<Record<number, number>>(`/eventos/${eventoId}/anfitriao-ordem`).then(r => r.data),
  setAnfitriaoOrdem: (eventoId: number, modalidade_id: number, posicao: number | null) =>
    api.put<{ posicao: number | null }>(`/eventos/${eventoId}/anfitriao-ordem`, { modalidade_id, posicao }).then(r => r.data),
```

(Confirme que `api` é importado no arquivo — é o padrão dos outros serviços.)

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && npx tsc --noEmit`
Expected: sem erros citando `eventos.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/eventos.ts
git commit -m "feat(eventos-fe): serviço get/set anfitriao-ordem"
```

---

## Task 6: Frontend — campo na tela Inscritos

**Files:**
- Modify: `frontend/src/pages/eventos/EventoInscricoes.tsx`

- [ ] **Step 1: Imports e queries**

Em `frontend/src/pages/eventos/EventoInscricoes.tsx`:
(a) garantir `useEffect` no import do react: `import { useState, useMemo, useEffect } from 'react'`.
(b) adicionar a query (perto das outras `useQuery`):
```tsx
  const { data: anfitriaoOrdemMap = {} } = useQuery({
    queryKey: ['anfitriao-ordem', eventoId],
    queryFn: () => eventosService.getAnfitriaoOrdem(eventoId),
  })
```
(c) estado do input + sync com a modalidade selecionada (após os outros `useState`):
```tsx
  const [posAnfitriao, setPosAnfitriao] = useState('')
  useEffect(() => {
    if (modalidadeId != null) {
      const v = (anfitriaoOrdemMap as Record<number, number>)[modalidadeId]
      setPosAnfitriao(v != null ? String(v) : '')
    }
  }, [modalidadeId, anfitriaoOrdemMap])
```
(d) mutation de salvar (perto das outras mutations):
```tsx
  const { mutate: salvarPosAnfitriao } = useMutation({
    mutationFn: (posicao: number | null) => eventosService.setAnfitriaoOrdem(eventoId, modalidadeId!, posicao),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anfitriao-ordem', eventoId] })
      toast.success('Posição do anfitrião salva.')
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao salvar posição.'),
  })
```
(`useMutation`, `useQuery`, `queryClient`, `toast`, `eventosService` já estão no arquivo.)

- [ ] **Step 2: Render do campo (card Sorteio, só ordem_entrada)**

No card "Sorteio", logo após o `</div>` que fecha o cabeçalho do card (o bloco com o ícone `Shuffle` e o `<h3>`), inserir:

```tsx
                  {tipoDaModalidade === 'ordem_entrada' && (
                    <div style={{ marginBottom: 14, padding: '12px 14px', background: 'var(--card-bg-2)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-lg)' }}>
                      <label className="block text-sm font-medium text-[var(--t2)]" style={{ marginBottom: 6 }}>Posição do anfitrião</label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="number" min={1} max={inscricoes.length}
                          value={posAnfitriao}
                          onChange={e => setPosAnfitriao(e.target.value)}
                          placeholder="—"
                          style={{ width: 120, padding: '8px 10px', borderRadius: 'var(--radius-md)', background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--t1)', fontSize: 14 }}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            const v = posAnfitriao.trim() === '' ? null : Number(posAnfitriao)
                            if (v != null && (!Number.isInteger(v) || v < 1 || v > inscricoes.length)) {
                              toast.error(`A posição deve estar entre 1 e ${inscricoes.length}.`)
                              return
                            }
                            salvarPosAnfitriao(v)
                          }}
                        >Salvar</button>
                      </div>
                      <p className="text-xs text-[var(--t4)]" style={{ marginTop: 6 }}>
                        Reservada ao anfitrião do evento na ordem sorteada. Requer "Considerar anfitrião" na competição e anfitrião inscrito. Vazio = sorteio normal.
                      </p>
                    </div>
                  )}
```

- [ ] **Step 3: Verificar tipos e build**

Run: `cd frontend && npx tsc --noEmit`  → sem erros novos citando `EventoInscricoes.tsx`.
Run: `cd frontend && npm run build`  → conclui sem erros.

- [ ] **Step 4: Verificação manual**

Backend+frontend rodando, competição com "Considerar anfitrião" ligado, evento com anfitrião inscrito numa modalidade Ordem de Entrada:
- Na tela Inscritos da modalidade, definir "Posição do anfitrião" (ex.: 2) e Salvar → toast; recarregar e confirmar persistência.
- Tentar salvar posição > nº de inscritos → erro (toast/400).
- Sortear → o anfitrião aparece na posição definida; demais embaralhados.
- Deixar em branco e Salvar → volta ao sorteio normal.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/eventos/EventoInscricoes.tsx
git commit -m "feat(eventos-fe): campo posição do anfitrião (ordem de entrada)"
```

---

## Self-review (cobertura da spec)

- Tabela por evento+modalidade → Task 2 ✓
- Engine posiciona anfitrião → Task 1 ✓
- API get/set + validações (tipo ordem_entrada, 1..inscritos, null remove) → Task 3 ✓
- Sorteio aplica nas 3 condições + falha se posição > inscritos → Task 4 ✓
- UI na tela Inscritos (só ordem_entrada, validação contra inscritos) → Tasks 5-6 ✓
- Testes: engine (Task 1), service wiring (Task 4); API/UI por build + manual.
- **Migration nova** → ao promover a prod, ligar a Cloud SQL antes.
