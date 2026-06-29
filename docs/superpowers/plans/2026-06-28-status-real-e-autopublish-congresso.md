# Status real no público + auto-publicação parcial no congresso — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O site público passa a mostrar o status real do evento (badge do detalhe + card da listagem) e o Modo Congresso publica o evento em background a cada 25% de sorteios, enquanto o evento estiver "Pronto p/ sorteio".

**Architecture:** Backend inclui `status` no snapshot e ganha um caminho de publicação parcial (aceita pronto/parcial). O público lê `status` do snapshot via um mapa `STATUS_PUBLICO`. O Modo Congresso, após cada sorteio, calcula a % (sorteáveis com inscritos) e dispara `publicarParcial` em background ao cruzar marcos (25/50/75/100), com dedupe em localStorage.

**Tech Stack:** Backend Express/Prisma/Vitest; Frontend React/TS/Vite/Vitest; SSG `renderToStaticMarkup`.

## Global Constraints

- Host Windows; ler antes de editar; caminhos absolutos.
- Git identity inline: `git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit …`.
- Nunca `git add -A`; commitar só os arquivos nomeados.
- Validar: `cd backend && npm test`; `cd frontend && npm run build && npm run build:site && npx vitest run src/site-publico`.
- Reusar tokens/classes; sem cores novas. Branch atual: `feat/status-real-autopublish`.
- Botão manual "Publicar no site" continua exigindo status `sorteado`. Auto-publish só quando status === `pronto`.

---

### Task 1: Backend — `status` no snapshot

**Files:**
- Modify: `backend/src/modules/site-publico/snapshot-types.ts`
- Modify: `backend/src/modules/site-publico/snapshot.ts`
- Test: `backend/src/modules/site-publico/snapshot.test.ts` (criar se não existir; senão, adicionar ao teste de snapshot existente)

**Interfaces:**
- Produces: `SnapEvento.status: string` no snapshot escrito por `montaSnapshot`.

- [ ] **Step 1: Teste (falha primeiro)**

Criar `backend/src/modules/site-publico/snapshot.test.ts`:
```ts
import { it, expect } from 'vitest'
import { montaSnapshot } from './snapshot'

const evento = {
  id: 1, nome: 'E', local: 'L', organizador: null, data_hora: new Date('2026-06-18T00:00:00Z'),
  anfitriao_id: null, status: 'pronto',
  competicao: { nome: 'C', considerar_anfitriao: false, subtitulo_campos: [] },
  municipio: { nome: 'Cidade' }, data_inicio: null, data_fim: null, boletins: [],
} as any

it('montaSnapshot inclui o status do evento', () => {
  const snap = montaSnapshot({
    evento,
    modalidades: [],
    inscricoesPorModalidade: new Map(),
    campeoesPorModalidade: new Map(),
    sorteiosPorModalidade: new Map(),
    subtituloFn: () => null,
  })
  expect(snap.status).toBe('pronto')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/modules/site-publico/snapshot.test.ts`
Expected: FAIL — `snap.status` é `undefined` (e/ou erro de tipo em `evento.status`).

- [ ] **Step 3: Implementar**

Em `backend/src/modules/site-publico/snapshot-types.ts`, adicionar `status` ao `SnapEvento` (logo após `id`/`nome` — antes de `boletins`):
```ts
  status: string
```

Em `backend/src/modules/site-publico/snapshot.ts`:
- No tipo `EventoRow` (linha ~6), adicionar `status: string`.
- No objeto retornado por `montaSnapshot` (o `return { id: evento.id, ... }`), adicionar a propriedade:
```ts
    status: evento.status,
```
(colocar junto aos campos escalares, por ex. logo após `id`/`nome` ou antes de `modalidades`).

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && npx vitest run src/modules/site-publico/snapshot.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add backend/src/modules/site-publico/snapshot-types.ts backend/src/modules/site-publico/snapshot.ts backend/src/modules/site-publico/snapshot.test.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): inclui status do evento no snapshot"
```

---

### Task 2: Backend — caminho de publicação parcial

**Files:**
- Modify: `backend/src/modules/site-publico/site-publico.service.ts`
- Modify: `backend/src/modules/site-publico/site-publico.controller.ts`
- Test: `backend/src/modules/site-publico/site-publico.service.test.ts`

**Interfaces:**
- Produces: `publicar(eventoId: number, opts?: { permitirParcial?: boolean })`. Controller lê `?parcial=1` e chama com `{ permitirParcial: true }`.

- [ ] **Step 1: Teste (falha primeiro)**

No arquivo `backend/src/modules/site-publico/site-publico.service.test.ts`, adicionar casos (seguindo o padrão de mocks já usado no arquivo — reutilizar os mocks de `prisma`/storage existentes; ajustar o `status` do evento mockado por caso):
```ts
it('publicar parcial aceita status pronto', async () => {
  // arrange: evento mock com status 'pronto'
  await expect(service.publicar(1, { permitirParcial: true })).resolves.toBeUndefined()
})
it('publicar parcial rejeita status rascunho', async () => {
  // arrange: evento mock com status 'rascunho'
  await expect(service.publicar(1, { permitirParcial: true })).rejects.toMatchObject({ status: 400 })
})
it('publicar normal continua exigindo sorteado', async () => {
  // arrange: evento mock com status 'pronto'
  await expect(service.publicar(1)).rejects.toMatchObject({ status: 400 })
})
```
(Adaptar o arrange aos mocks já presentes no arquivo de teste — o ponto é cobrir: parcial aceita pronto/parcial, rejeita rascunho/inscricoes/suspenso; normal exige sorteado.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx vitest run src/modules/site-publico/site-publico.service.test.ts`
Expected: FAIL — `publicar` ainda não aceita o 2º argumento e a guarda atual rejeita 'pronto' sempre.

- [ ] **Step 3: Implementar o serviço**

Em `backend/src/modules/site-publico/site-publico.service.ts`, trocar a assinatura e a guarda de `publicar`:
```ts
const STATUS_PARCIAL_OK = ['pronto', 'parcial', 'sorteado']

export async function publicar(eventoId: number, opts: { permitirParcial?: boolean } = {}): Promise<void> {
  const evento = await prisma.evento.findUnique({ /* ...select atual, mantém status: true... */ })
  if (!evento) throw Object.assign(new Error('Evento não encontrado'), { status: 404 })
  if (opts.permitirParcial) {
    if (!STATUS_PARCIAL_OK.includes(evento.status)) {
      throw Object.assign(new Error('Publicação parcial requer evento a partir de "Pronto p/ sorteio".'), { status: 400 })
    }
  } else if (evento.status !== 'sorteado') {
    throw Object.assign(new Error('Só é possível publicar eventos com status "Sorteado".'), { status: 400 })
  }
  // ... resto inalterado (modalidades, montaSnapshot, putSnapshot, dispatchBuild, update site_publicado_em) ...
}
```
(Manter todo o corpo existente após a guarda.)

- [ ] **Step 4: Implementar o controller**

Em `backend/src/modules/site-publico/site-publico.controller.ts`, no handler `publicar`:
```ts
export async function publicar(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseIntParam(req.params.id, 'id')
    const permitirParcial = req.query.parcial === '1'
    await service.publicar(id, { permitirParcial })
    res.json({ ok: true })
  } catch (err) { next(err) }
}
```
(A rota `POST /:id/publicar` não muda; o parâmetro vem por query `?parcial=1`.)

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && npx vitest run src/modules/site-publico` 
Expected: PASS (os novos casos + os existentes).

- [ ] **Step 6: Commit**
```bash
git add backend/src/modules/site-publico/site-publico.service.ts backend/src/modules/site-publico/site-publico.controller.ts backend/src/modules/site-publico/site-publico.service.test.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): caminho de publicacao parcial (aceita pronto/parcial via ?parcial=1)"
```

---

### Task 3: Frontend público — renderizar o status real

**Files:**
- Create: `frontend/src/site-publico/lib/status-evento.ts`
- Modify: `frontend/src/site-publico/snapshot-types.ts` (add `status`)
- Modify: `frontend/src/site-publico/pages/EventoPage.tsx` (badge do hero)
- Modify: `frontend/src/site-publico/components/EventoCardListagem.tsx` (status do card)
- Modify: `frontend/src/site-publico/pages/EventosPage.tsx` (pílulas de filtro por status)
- Tests: `frontend/src/site-publico/EventoCardListagem.test.tsx`, `frontend/src/site-publico/EventosPage.test.tsx`, `frontend/src/site-publico/EventoPage-hero.test.tsx` (adicionar `status` às fixtures e novas asserções)

**Interfaces:**
- Consumes: snapshot `SnapEvento.status`.
- Produces: `statusPublico(s)` / `STATUS_PUBLICO` em `lib/status-evento.ts`.

- [ ] **Step 1: Criar o mapa de status**

Criar `frontend/src/site-publico/lib/status-evento.ts`:
```ts
export type EventoStatus = 'rascunho' | 'inscricoes' | 'pronto' | 'sorteado' | 'parcial' | 'suspenso'

export const STATUS_PUBLICO: Record<EventoStatus, { label: string; grad: string; dot: string }> = {
  sorteado:   { label: 'Sorteado',          grad: 'var(--grad-accent)', dot: 'var(--accent)' },
  parcial:    { label: 'Parcial',           grad: 'var(--grad-brand)',  dot: 'var(--info)' },
  pronto:     { label: 'Pronto p/ sorteio', grad: 'var(--grad-warn)',   dot: 'var(--warn)' },
  inscricoes: { label: 'Inscrições',        grad: 'var(--grad-brand)',  dot: 'var(--info)' },
  rascunho:   { label: 'Rascunho',          grad: 'var(--grad-warn)',   dot: 'var(--warn)' },
  suspenso:   { label: 'Suspenso',          grad: 'var(--grad-warn)',   dot: 'var(--warn)' },
}

export function statusPublico(s: string): { label: string; grad: string; dot: string } {
  return STATUS_PUBLICO[(s as EventoStatus)] ?? STATUS_PUBLICO.pronto
}

// ordem de exibição das pílulas de filtro
export const STATUS_ORDEM: EventoStatus[] = ['pronto', 'parcial', 'sorteado', 'inscricoes', 'rascunho', 'suspenso']
```

- [ ] **Step 2: Adicionar `status` ao tipo do snapshot (frontend)**

Em `frontend/src/site-publico/snapshot-types.ts`, no `SnapEvento`, adicionar (após `nome`):
```ts
  status: string
```

- [ ] **Step 3: Atualizar as fixtures + asserções de teste (falham primeiro)**

Adicionar `status` às fixtures de `SnapEvento` nos 3 arquivos de teste e novas asserções.

`EventoPage-hero.test.tsx`: no `base()`, adicionar `status: 'pronto',` ao objeto. No 1º teste, trocar a asserção do badge derivado por:
```ts
    expect(html).toContain('Pronto p/ sorteio')
```
e adicionar um teste:
```ts
  it('badge do hero segue o status real do evento', () => {
    expect(renderToStaticMarkup(<EventoPage evento={base({ status: 'parcial' } as any)} />)).toContain('Parcial')
    expect(renderToStaticMarkup(<EventoPage evento={base({ status: 'sorteado' } as any)} />)).toContain('Sorteado')
  })
```

`EventoCardListagem.test.tsx`: a fixture `ev(mods)` deve incluir `status`. Trocar a assinatura para `ev(mods, status = 'pronto')` e adicionar `status,` ao objeto retornado. Reescrever os 3 testes para asserir por status do admin:
```ts
it('status pronto → aguardando visual', () => {
  const html = renderToStaticMarkup(<EventoCardListagem evento={ev([mod({ id: 1, participantes: [{ id: 1, nome: 'A', subtitulo: null }] })], 'pronto')} />)
  expect(html).toContain('data-status="pronto"')
  expect(html).toContain('Pronto p/ sorteio')
  expect(html).toContain('var(--grad-warn)')
  expect(html).toContain('/evento-5.html')
})
it('status parcial → andamento visual', () => {
  const html = renderToStaticMarkup(<EventoCardListagem evento={ev([mod({ id: 1, status: 'sorteado', participantes: [{ id: 1, nome: 'A', subtitulo: null }] })], 'parcial')} />)
  expect(html).toContain('data-status="parcial"')
  expect(html).toContain('Parcial')
  expect(html).toContain('var(--grad-brand)')
})
it('status sorteado → verde', () => {
  const html = renderToStaticMarkup(<EventoCardListagem evento={ev([mod({ id: 1, status: 'sorteado', participantes: [{ id: 1, nome: 'A', subtitulo: null }] })], 'sorteado')} />)
  expect(html).toContain('data-status="sorteado"')
  expect(html).toContain('Sorteado')
  expect(html).toContain('var(--grad-accent)')
})
```

`EventosPage.test.tsx`: a fixture `ev(id, status)` já recebe um `status` de sorteio na modalidade — renomear para deixar claro que agora é o status do EVENTO. Ajustar:
```ts
function ev(id: number, statusEvento: string): SnapEvento {
  return { id, nome: `Evento ${id}`, competicao: 'Jogos', cidade: 'Cidade', local: 'Ginásio', data: '2026-06-18T00:00:00.000Z', organizador: null, publicadoEm: '', dataInicio: null, dataFim: null, status: statusEvento, boletins: [], modalidades: [mod({ id: 1, status: 'sorteado', participantes: [{ id: 1, nome: 'A', subtitulo: null }] })] } as any
}
```
e atualizar o teste de cabeçalho para o novo modelo de filtro por status do admin:
```ts
it('renderiza cabecalho de ano, filtro por status e grade', () => {
  const html = renderToStaticMarkup(<EventosPage eventos={[ev(1, 'pronto'), ev(2, 'sorteado')]} />)
  expect(html).toContain('yr-head')
  expect(html).toContain('ev-grid3')
  expect(html).toContain('data-filter="todos"')
  expect(html).toContain('data-filter="pronto"')
  expect(html).toContain('data-filter="sorteado"')
  expect(html).toContain('data-status="pronto"')
  expect(html).toContain('data-status="sorteado"')
})
```
(Manter o teste do script de filtro com `.year-group`/`addEventListener`.)

- [ ] **Step 4: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/site-publico`
Expected: FAIL (componentes ainda derivam status dos sorteios; faltam imports de `status-evento`).

- [ ] **Step 5: Implementar o hero (`EventoPage.tsx`)**

Adicionar import:
```ts
import { statusPublico } from '../lib/status-evento'
```
Trocar o conteúdo do badge do hero (a linha do `<span className="badge b-accent">…`) por:
```tsx
                  <span className="badge b-accent"><span className="dot" />{statusPublico(evento.status).label}</span>
```
(Remove a expressão `prog.done ? 'Sorteado' : prog.sorteaveis > 0 ? 'Sorteios em andamento' : 'Pronto p/ sorteio'`. A barra de progresso e o resto permanecem.)

- [ ] **Step 6: Implementar o card (`EventoCardListagem.tsx`)**

Substituir a derivação por sorteios pelo status do evento:
- Remover `STATUS_INFO`/`statusDe` (derivados de sorteios) e o uso de `progressoSorteios` para status. **Manter** `progressoSorteios` só para o número de Sorteios (`sorteadas`) e a classe `hl`/`zero`.
- Importar `statusPublico` de `../lib/status-evento`.
- No corpo:
```tsx
  const { sorteadas, done } = progressoSorteios(evento)
  const info = statusPublico(evento.status)
  const sortCls = sorteadas === 0 ? 'zero' : done ? 'hl' : ''
```
- No JSX: `<a className="evc" href={...} data-status={evento.status}>`; `.accent`/`.evc-tile` usam `info.grad`; `.evc-status .d` usa `info.dot`; o texto do status usa `info.label`.

- [ ] **Step 7: Implementar o filtro por status (`EventosPage.tsx`)**

- Importar `statusPublico, STATUS_ORDEM, type EventoStatus` de `../lib/status-evento`.
- Para cada ano, calcular os status presentes e renderizar as pílulas:
```tsx
                  <div className="yr-filter">
                    <button type="button" className="on" data-filter="todos">Todos</button>
                    {STATUS_ORDEM.filter((s) => lista.some((e) => e.status === s)).map((s) => (
                      <button type="button" key={s} data-filter={s}><span className="d" style={{ background: statusPublico(s).dot }} />{statusPublico(s).label}</button>
                    ))}
                  </div>
```
(O `<script>` de filtro e o `data-status` dos cards passam a usar o status do admin — nada muda na mecânica do script, pois ele compara `data-filter` com `data-status`.)

- [ ] **Step 8: Rodar testes + build**

Run: `cd frontend && npx vitest run src/site-publico && npm run build:site`
Expected: PASS; build sem erros.

- [ ] **Step 9: Commit**
```bash
git add frontend/src/site-publico/lib/status-evento.ts frontend/src/site-publico/snapshot-types.ts frontend/src/site-publico/pages/EventoPage.tsx frontend/src/site-publico/components/EventoCardListagem.tsx frontend/src/site-publico/pages/EventosPage.tsx frontend/src/site-publico/EventoCardListagem.test.tsx frontend/src/site-publico/EventosPage.test.tsx frontend/src/site-publico/EventoPage-hero.test.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): status real do evento no hero e na listagem (mapa STATUS_PUBLICO)"
```

---

### Task 4: Frontend admin — auto-publicação parcial no Modo Congresso

**Files:**
- Modify: `frontend/src/services/eventos.ts` (add `publicarParcial`)
- Create: `frontend/src/pages/congresso/autopublish.ts` (função pura de marco)
- Test: `frontend/src/pages/congresso/autopublish.test.ts`
- Modify: `frontend/src/pages/congresso/CongressoStepSorteio.tsx` (gatilho + dedupe)

**Interfaces:**
- Consumes: `eventosService.getModalidadesDoEvento`, `inscricoesService.listar({ evento_id })`, `sorteiosService.listar`, `eventosService.publicarParcial`.
- Produces: `proximoMarcoCruzado(pct, ultimoMarco)` em `autopublish.ts`.

- [ ] **Step 1: Teste da função de marco (falha primeiro)**

Criar `frontend/src/pages/congresso/autopublish.test.ts`:
```ts
import { it, expect } from 'vitest'
import { proximoMarcoCruzado, pctSorteado } from './autopublish'

it('pctSorteado calcula porcentagem inteira', () => {
  expect(pctSorteado(0, 4)).toBe(0)
  expect(pctSorteado(1, 4)).toBe(25)
  expect(pctSorteado(3, 4)).toBe(75)
  expect(pctSorteado(4, 4)).toBe(100)
  expect(pctSorteado(2, 0)).toBe(0)
})

it('proximoMarcoCruzado retorna o maior marco novo atingido', () => {
  expect(proximoMarcoCruzado(0, 0)).toBeNull()
  expect(proximoMarcoCruzado(25, 0)).toBe(25)
  expect(proximoMarcoCruzado(60, 25)).toBe(50)   // cruzou 50, ainda não 75
  expect(proximoMarcoCruzado(100, 75)).toBe(100)
  expect(proximoMarcoCruzado(30, 25)).toBeNull() // nada novo entre 25 e 30
  expect(proximoMarcoCruzado(100, 100)).toBeNull()
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/pages/congresso/autopublish.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar `autopublish.ts`**

Criar `frontend/src/pages/congresso/autopublish.ts`:
```ts
export const MARCOS = [25, 50, 75, 100] as const

export function pctSorteado(sorteadas: number, sorteaveis: number): number {
  return sorteaveis > 0 ? Math.round((sorteadas / sorteaveis) * 100) : 0
}

// Maior marco já atingido pela % atual que ainda não foi publicado; null se nenhum novo.
export function proximoMarcoCruzado(pct: number, ultimoMarcoPublicado: number): number | null {
  const novos = MARCOS.filter((m) => m <= pct && m > ultimoMarcoPublicado)
  return novos.length ? novos[novos.length - 1] : null
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/pages/congresso/autopublish.test.ts`
Expected: PASS.

- [ ] **Step 5: Adicionar `publicarParcial` ao serviço**

Em `frontend/src/services/eventos.ts`, ao lado de `publicar`:
```ts
  publicarParcial: (id: number) => api.post(`${BASE}/${id}/publicar?parcial=1`).then(r => r.data),
```

- [ ] **Step 6: Ligar o gatilho no `CongressoStepSorteio.tsx`**

Imports (adicionar):
```ts
import { useRef } from 'react'
import { proximoMarcoCruzado, pctSorteado } from './autopublish'
```
(`useRef` já pode estar importado de 'react' — ajustar o import existente.)

Adicionar duas queries (perto das outras `useQuery`), para o denominador:
```ts
  const { data: modalidadesEvento = [] } = useQuery({
    queryKey: ['evento-modalidades', eventoId],
    queryFn: () => eventosService.getModalidadesDoEvento(eventoId),
  })
  const { data: inscricoesEvento = [] } = useQuery({
    queryKey: ['inscricoes', eventoId],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId }),
  })
```

Adicionar o efeito de auto-publicação (após as queries, antes do `return`):
```ts
  const publicandoMarcoRef = useRef(false)
  useEffect(() => {
    if (!evento || (evento as any).status !== 'pronto') return
    const comInscritos = new Set(inscricoesEvento.map((i: any) => i.modalidade_id))
    const sorteaveis = modalidadesEvento.filter(
      (m: any) => m.tipo_modalidade?.tipo !== 'especifico' && comInscritos.has(m.id),
    ).length
    const sorteadasCount = new Set(sorteios.map((s) => s.modalidade_id)).size
    const pct = pctSorteado(sorteadasCount, sorteaveis)
    const key = `prosports.congresso.autopublish.${eventoId}`
    let ultimo = 0
    try { ultimo = Number(localStorage.getItem(key) ?? '0') || 0 } catch { /* storage off */ }
    const marco = proximoMarcoCruzado(pct, ultimo)
    if (marco == null || publicandoMarcoRef.current) return
    publicandoMarcoRef.current = true
    eventosService.publicarParcial(eventoId)
      .then(() => { try { localStorage.setItem(key, String(marco)) } catch { /* storage off */ } })
      .catch(() => { /* silencioso: não interrompe o congresso */ })
      .finally(() => { publicandoMarcoRef.current = false })
  }, [evento, modalidadesEvento, inscricoesEvento, sorteios, eventoId])
```
(`useEffect`/`useMemo` já são importados no arquivo; garantir que `useEffect` está no import de 'react'.)

- [ ] **Step 7: Verificar build + testes**

Run: `cd frontend && npm run build && npx vitest run src/pages/congresso`
Expected: `tsc -b && vite build` sem erros; testes verdes (inclui `autopublish.test.ts`).

- [ ] **Step 8: Commit**
```bash
git add frontend/src/services/eventos.ts frontend/src/pages/congresso/autopublish.ts frontend/src/pages/congresso/autopublish.test.ts frontend/src/pages/congresso/CongressoStepSorteio.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(congresso): auto-publicacao parcial a cada 25% (status pronto, dedupe localStorage)"
```

---

## Verificação final (após as 4 tasks)

- [ ] `cd backend && npm test` verde; `cd frontend && npm run build && npm run build:site && npx vitest run src/site-publico` verdes.
- [ ] **Demo antes do merge na develop**: detalhe e listagem exibindo rótulos/cores de status reais (ex.: forçar um snapshot com `status: 'pronto'` ou `'parcial'`); e, se viável no dev, evidência da auto-publicação disparando ao cruzar um marco no Modo Congresso (ou ao menos o teste unitário do marco + a chamada `publicarParcial`).
- [ ] Após aprovação: merge `feat/status-real-autopublish` → develop (só arquivos esperados, sem `git add -A`), push, monitorar deploy.

## Self-Review (cobertura da spec)

- Status no snapshot: Task 1 ✓.
- Publicação parcial dedicada (aceita pronto/parcial; manual exige sorteado): Task 2 ✓.
- Status real no hero + card + filtro da listagem: Task 3 ✓.
- Auto-publicação a cada 25% no congresso (status pronto, denominador sorteáveis-com-inscritos, dedupe por marco): Task 4 ✓.
- Sem cores novas; demo antes da develop ✓.
- Fora de escopo: auto-transição de status; afrouxar botão manual; produção.
