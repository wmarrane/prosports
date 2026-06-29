# Auto-publish — progresso preciso (R1–R4) + toast — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O denominador dos 25% do auto-publish passa a ser calculado no backend, contando só Grupos/Chaves que realmente vão a sorteio (R1–R4), e o Modo Congresso mostra um toast ao disparar cada publicação.

**Architecture:** Novo serviço/endpoint `progressoSorteio(eventoId) → {sorteadas, sorteaveis}` reusa `isSorteavel` + a mesma checagem de regras do sorteio (grupos/chaves/bracket). O `CongressoStepSorteio` consome esse endpoint para os marcos e dispara `publicarParcial` com toast.

**Tech Stack:** Backend Express/Prisma/Vitest; Frontend React/TS/Vitest; React Query; Toast (`components/Toast`).

## Global Constraints

- Host Windows; ler antes de editar; caminhos absolutos.
- Git identity inline: `git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit …`.
- Nunca `git add -A`; commitar só os arquivos nomeados.
- Validar: `cd backend && npm test`; `cd frontend && npm run build && npm run build:site`.
- Reusar padrões; sem cores novas. Branch atual: `feat/autopublish-regra`.
- Gatilho de auto-publish só quando `evento.status === 'pronto'` (mantido).

---

### Task 1: Backend — serviço/endpoint `progressoSorteio`

**Files:**
- Modify: `backend/src/modules/eventos/eventos.service.ts` (nova função `progressoSorteio`)
- Modify: `backend/src/modules/eventos/eventos.controller.ts` (handler `progressoSorteio`)
- Modify: `backend/src/modules/eventos/eventos.routes.ts` (rota GET)
- Test: `backend/src/modules/eventos/progresso-sorteio.test.ts` (criar)

**Interfaces:**
- Produces: `progressoSorteio(eventoId: number): Promise<{ sorteadas: number; sorteaveis: number }>` e `GET /eventos/:id/progresso-sorteio` → `{ sorteadas, sorteaveis }`.

- [ ] **Step 1: Teste (falha primeiro)**

Criar `backend/src/modules/eventos/progresso-sorteio.test.ts`. Mockar `../../lib/prisma` (seguir o estilo de `eventos.service.test.ts` — `vi.mock('../../lib/prisma', ...)`). Cenário base (competição 1):
- mod 1 `chaves`, 8 inscritos, sem regra-pular, tem `sistemaDisputasChaves(8)`+`bracketChavesByes(8)`, **sorteada** → conta sorteável + sorteada.
- mod 2 `grupos`, 6 inscritos, tem `sistemaDisputasGrupos(quantidade_equipes=6)`, não sorteada → conta sorteável.
- mod 3 `grupos`, 3 inscritos, **sem** `sistemaDisputasGrupos(3)` (R3) → não conta.
- mod 4 `chaves`, 5 inscritos, **sem** `bracketChavesByes(5)` (R4) → não conta.
- mod 5 `chaves`, 0 inscritos (R1) → não conta.
- mod 6 `ordem_entrada`, 10 inscritos → não conta (2.1).
- mod 7 `especifico` → não conta.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mp = {
  evento: { findUnique: vi.fn() },
  modalidade: { findMany: vi.fn() },
  inscricao: { groupBy: vi.fn() },
  sorteio: { findMany: vi.fn() },
  eventoModalidadeExcluida: { findMany: vi.fn() },
  sistemaDisputasGrupos: { findMany: vi.fn() },
  sistemaDisputasChaves: { findMany: vi.fn() },
  bracketChavesByes: { findMany: vi.fn() },
}
vi.mock('../../lib/prisma', () => ({ default: mp }))

import { progressoSorteio } from './eventos.service'

beforeEach(() => {
  vi.clearAllMocks()
  mp.evento.findUnique.mockResolvedValue({ id: 1, competicao_id: 1 })
  mp.modalidade.findMany.mockResolvedValue([
    { id: 1, tipo_modalidade: { tipo: 'chaves' }, mensagens_inscritos: [] },
    { id: 2, tipo_modalidade: { tipo: 'grupos' }, mensagens_inscritos: [] },
    { id: 3, tipo_modalidade: { tipo: 'grupos' }, mensagens_inscritos: [] },
    { id: 4, tipo_modalidade: { tipo: 'chaves' }, mensagens_inscritos: [] },
    { id: 5, tipo_modalidade: { tipo: 'chaves' }, mensagens_inscritos: [] },
    { id: 6, tipo_modalidade: { tipo: 'ordem_entrada' }, mensagens_inscritos: [] },
    { id: 7, tipo_modalidade: { tipo: 'especifico' }, mensagens_inscritos: [] },
  ])
  mp.inscricao.groupBy.mockResolvedValue([
    { modalidade_id: 1, _count: { _all: 8 } },
    { modalidade_id: 2, _count: { _all: 6 } },
    { modalidade_id: 3, _count: { _all: 3 } },
    { modalidade_id: 4, _count: { _all: 5 } },
    { modalidade_id: 5, _count: { _all: 0 } },
    { modalidade_id: 6, _count: { _all: 10 } },
  ])
  mp.sorteio.findMany.mockResolvedValue([{ modalidade_id: 1 }])
  mp.eventoModalidadeExcluida.findMany.mockResolvedValue([])
  mp.sistemaDisputasGrupos.findMany.mockResolvedValue([{ quantidade_equipes: 6 }])
  mp.sistemaDisputasChaves.findMany.mockResolvedValue([{ numero_inscrito: 8 }, { numero_inscrito: 5 }])
  mp.bracketChavesByes.findMany.mockResolvedValue([{ numero_inscrito: 8 }]) // 5 ausente → R4 exclui mod 4
})

describe('progressoSorteio', () => {
  it('conta só grupos/chaves sorteáveis (R1–R4) e as já sorteadas', async () => {
    const r = await progressoSorteio(1)
    expect(r.sorteaveis).toBe(2) // mod 1 (chaves/8) e mod 2 (grupos/6)
    expect(r.sorteadas).toBe(1)  // mod 1
  })
  it('exclui chaves sem bracket (R4) e grupos sem regra (R3)', async () => {
    const r = await progressoSorteio(1)
    expect(r.sorteaveis).toBe(2) // mod 3 (R3) e mod 4 (R4) fora
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/modules/eventos/progresso-sorteio.test.ts`
Expected: FAIL — `progressoSorteio` não existe.

- [ ] **Step 3: Implementar o serviço**

Em `backend/src/modules/eventos/eventos.service.ts` (já importa `isSorteavel` de `../../lib/sorteaveis` e `prisma`; importar também o helper de exclusões — `getModalidadeIdsExcluidas` de `./evento-modalidades.service`, mesmo usado pelo site-publico). Adicionar:

```ts
import { getModalidadeIdsExcluidas } from './evento-modalidades.service'

export async function progressoSorteio(eventoId: number): Promise<{ sorteadas: number; sorteaveis: number }> {
  const evento = await prisma.evento.findUnique({ where: { id: eventoId }, select: { id: true, competicao_id: true } })
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })

  const [modalidades, inscricoesGrp, sorteios, excluidasIds, gruposRegras, chavesRegras] = await Promise.all([
    prisma.modalidade.findMany({
      where: { competicao_id: evento.competicao_id, ativa: true },
      select: { id: true, tipo_modalidade: { select: { tipo: true } }, mensagens_inscritos: true },
    }),
    prisma.inscricao.groupBy({ by: ['modalidade_id'], where: { evento_id: eventoId }, _count: { _all: true } }),
    prisma.sorteio.findMany({ where: { evento_id: eventoId }, select: { modalidade_id: true } }),
    getModalidadeIdsExcluidas(eventoId),
    prisma.sistemaDisputasGrupos.findMany({ where: { competicao_id: evento.competicao_id }, select: { quantidade_equipes: true } }),
    prisma.sistemaDisputasChaves.findMany({ where: { competicao_id: evento.competicao_id }, select: { numero_inscrito: true } }),
  ])

  const inscritosPorMod = new Map<number, number>()
  for (const g of inscricoesGrp) inscritosPorMod.set(g.modalidade_id, (g as any)._count?._all ?? 0)
  const sorteadasSet = new Set<number>(sorteios.map((s) => s.modalidade_id))
  const gruposSet = new Set<number>(gruposRegras.map((r) => r.quantidade_equipes))
  const chavesSet = new Set<number>(chavesRegras.map((r) => r.numero_inscrito))

  // Candidatas: grupos/chaves, ativas, não excluídas
  const candidatas = modalidades.filter(
    (m) => (m.tipo_modalidade.tipo === 'grupos' || m.tipo_modalidade.tipo === 'chaves') && !excluidasIds.has(m.id),
  )
  // Bracket byes só para os N candidatos de chaves (consulta enxuta)
  const nsChaves = [...new Set(candidatas.filter((m) => m.tipo_modalidade.tipo === 'chaves').map((m) => inscritosPorMod.get(m.id) ?? 0))]
  const byes = nsChaves.length
    ? await prisma.bracketChavesByes.findMany({ where: { numero_inscrito: { in: nsChaves } }, select: { numero_inscrito: true } })
    : []
  const bracketSet = new Set<number>(byes.map((b) => b.numero_inscrito))

  let sorteaveis = 0
  let sorteadas = 0
  for (const m of candidatas) {
    const n = inscritosPorMod.get(m.id) ?? 0
    if (!isSorteavel({ tipo: m.tipo_modalidade.tipo, mensagens_inscritos: m.mensagens_inscritos }, n)) continue // R1+R2
    if (m.tipo_modalidade.tipo === 'grupos' && !gruposSet.has(n)) continue // R3
    if (m.tipo_modalidade.tipo === 'chaves' && (!chavesSet.has(n) || !bracketSet.has(n))) continue // R4
    sorteaveis++
    if (sorteadasSet.has(m.id)) sorteadas++
  }
  return { sorteadas, sorteaveis }
}
```
(Se `getModalidadeIdsExcluidas` já estiver importado no arquivo, não duplicar o import.)

- [ ] **Step 4: Controller + rota**

Em `backend/src/modules/eventos/eventos.controller.ts`, adicionar:
```ts
export async function progressoSorteio(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseIntParam(req.params.id, 'id')
    const r = await service.progressoSorteio(id)
    res.json(r)
  } catch (err) { next(err) }
}
```
(Usar os mesmos imports já presentes no controller — `service`, `parseIntParam`, tipos do express.)

Em `backend/src/modules/eventos/eventos.routes.ts`, adicionar (junto às rotas `/:id/...`, exige autenticação admin como as demais de operação; usar `...admin`):
```ts
router.get('/:id/progresso-sorteio', ...admin, ctrl.progressoSorteio)
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && npx vitest run src/modules/eventos/progresso-sorteio.test.ts && npm test`
Expected: novos testes PASS; suíte do backend verde.

- [ ] **Step 6: Commit**
```bash
git add backend/src/modules/eventos/eventos.service.ts backend/src/modules/eventos/eventos.controller.ts backend/src/modules/eventos/eventos.routes.ts backend/src/modules/eventos/progresso-sorteio.test.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(eventos): endpoint progresso-sorteio (conta grupos/chaves sorteaveis R1-R4)"
```

---

### Task 2: Frontend — consumir progresso + toast no Modo Congresso

**Files:**
- Modify: `frontend/src/services/eventos.ts` (add `progressoSorteio`)
- Modify: `frontend/src/pages/congresso/CongressoStepSorteio.tsx` (usar endpoint, toast, limpar queries antigas)

**Interfaces:**
- Consumes: `GET /eventos/:id/progresso-sorteio` (Task 1); `useToast` de `../../components/Toast`; `proximoMarcoCruzado`/`pctSorteado` de `./autopublish`.

- [ ] **Step 1: Serviço**

Em `frontend/src/services/eventos.ts`, adicionar:
```ts
  progressoSorteio: (id: number) => api.get<{ sorteadas: number; sorteaveis: number }>(`${BASE}/${id}/progresso-sorteio`).then(r => r.data),
```

- [ ] **Step 2: Reescrever o gatilho em `CongressoStepSorteio.tsx`**

a) Imports: adicionar `import { useToast } from '../../components/Toast'`. Garantir `useEffect`/`useRef` no import de 'react' (já presentes do trabalho anterior). Manter `proximoMarcoCruzado, pctSorteado` de `./autopublish`.

b) **Remover** as duas queries de denominador local adicionadas antes (`modalidadesEvento` via `getModalidadesDoEvento` e `inscricoesEvento` via `inscricoesService.listar({ evento_id })`) — elas saem. (Se `inscricoesService` ficar sem uso no arquivo, remover o import; conferir que `inscricoes`/`inscricoesSel` da modalidade atual NÃO dependem delas — elas são queries separadas e permanecem.)

c) Adicionar a query de progresso (perto das outras `useQuery`):
```ts
  const { data: progresso } = useQuery({
    queryKey: ['progresso-sorteio', eventoId],
    queryFn: () => eventosService.progressoSorteio(eventoId),
    enabled: !!evento,
  })
```

d) Invalidar o progresso quando um sorteio é concluído — no `onSuccess` da mutation `executar`:
```ts
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sorteios', eventoId] })
      queryClient.invalidateQueries({ queryKey: ['progresso-sorteio', eventoId] })
      setErro('')
    },
```

e) Toast hook (no topo do componente, junto aos outros hooks):
```ts
  const toast = useToast()
```

f) Substituir o efeito de auto-publish pelo que usa o endpoint (a API do Toast tem só `success`/`error` — usar `success` para o aviso de início):
```ts
  const publicandoMarcoRef = useRef(false)
  useEffect(() => {
    if (!evento || (evento as any).status !== 'pronto' || !progresso) return
    const pct = pctSorteado(progresso.sorteadas, progresso.sorteaveis)
    const key = `prosports.congresso.autopublish.${eventoId}`
    let ultimo = 0
    try { ultimo = Number(localStorage.getItem(key) ?? '0') || 0 } catch { /* storage off */ }
    const marco = proximoMarcoCruzado(pct, ultimo)
    if (marco == null || publicandoMarcoRef.current) return
    publicandoMarcoRef.current = true
    toast.success(`Publicação do site iniciada — atualização ${marco}%`)
    eventosService.publicarParcial(eventoId)
      .then(() => { try { localStorage.setItem(key, String(marco)) } catch { /* storage off */ } })
      .catch(() => { toast.error('Falha ao iniciar a publicação do site.') })
      .finally(() => { publicandoMarcoRef.current = false })
  }, [evento, progresso, eventoId, toast])
```
(Nota: `(evento as any).status` — usar `evento.status` se o tipo `Evento` expõe `status`, que expõe; preferir sem cast.)

- [ ] **Step 3: Verificar build + testes**

Run: `cd frontend && npm run build && npx vitest run src/pages/congresso`
Expected: `tsc -b && vite build` sem erros (sem imports/locals não usados); testes verdes (`autopublish.test.ts`).

Conferência manual rápida: `useToast` está disponível na rota do congresso (o `ToastProvider` deve envolver o app no `main.tsx`/`App.tsx`). Se não estiver, reportar como concern (NÃO adicionar provider sem alinhar).

- [ ] **Step 4: Commit**
```bash
git add frontend/src/services/eventos.ts frontend/src/pages/congresso/CongressoStepSorteio.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(congresso): auto-publish usa progresso do backend + toast ao publicar"
```

---

## Verificação final (após as 2 tasks)

- [ ] `cd backend && npm test` e `cd frontend && npm run build && npm run build:site` verdes.
- [ ] **Demo antes do merge na develop**: evidência do endpoint retornando `{sorteadas, sorteaveis}` coerentes (R1–R4) e do toast aparecendo ao cruzar um marco (dev/mock). 
- [ ] Após aprovação: merge `feat/autopublish-regra` → develop (só arquivos esperados, sem `git add -A`), push, monitorar deploy.

## Self-Review (cobertura da spec)

- 2.1 só grupos/chaves: Task 1 (candidatas filtram tipo) ✓.
- 2.2 R1+R2+R3+R4: Task 1 (isSorteavel + gruposSet/chavesSet/bracketSet) ✓.
- Cálculo no backend (fonte única): Task 1 ✓; frontend consome (Task 2) ✓.
- Item 1 toast ao disparar (+ erro discreto): Task 2 ✓.
- Item 3 só status 'pronto': mantido no efeito ✓.
- Sem cores novas; demo antes da develop ✓.
