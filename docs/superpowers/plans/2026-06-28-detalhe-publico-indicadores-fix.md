# Detalhe público — correção dos indicadores — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No detalhe público, "Modalidades" passa a contar esportes distintos (removendo "Categorias") e a barra de progresso usa sorteáveis com inscritos.

**Architecture:** Ajuste no helper compartilhado `evento-stats.ts` (semântica de `sorteaveis` + alias `modalidadesDistintas`) com correção dos testes dependentes; depois o hero de `EventoPage.tsx` consome a contagem de esportes distintos e perde o card "Categorias", com pequeno ajuste de CSS.

**Tech Stack:** React 18 + TS + Vite; SSG (`renderToStaticMarkup`); Vitest; `site.css`.

## Global Constraints

- Host Windows; ler antes de editar; caminhos absolutos.
- Git identity inline: `git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit …`.
- Nunca `git add -A`; commitar só os arquivos nomeados.
- Validar com `cd frontend && npx vitest run src/site-publico` e `npm run build:site` — sem erros.
- Reusar tokens/classes; sem cores novas. Branch atual: `feat/detalhe-indicadores-fix`. Sem mudança de backend/snapshot.

---

### Task 1: `evento-stats` — sorteáveis com inscritos + `modalidadesDistintas` (e correção dos testes dependentes)

**Files:**
- Modify: `frontend/src/site-publico/lib/evento-stats.ts`
- Test: `frontend/src/site-publico/lib/evento-stats.test.ts`
- Test (fixtures dependentes): `frontend/src/site-publico/EventoCardListagem.test.tsx`, `frontend/src/site-publico/EventosPage.test.tsx`

**Interfaces:**
- Produces: `progressoSorteios(e)` com `sorteaveis` = modalidades `tipo!=='especifico'` **e** `participantes.length>0`; novo `modalidadesDistintas(e: SnapEvento): number` (= esportes distintos). Consumido pela Task 2.

- [ ] **Step 1: Atualizar o teste do helper (falha primeiro)**

Em `frontend/src/site-publico/lib/evento-stats.test.ts`, adicionar (mantendo os testes existentes) um caso que fixa a nova semântica. Acrescentar ao final, antes do fechamento do `describe`/arquivo:

```ts
it('progressoSorteios ignora modalidades sem inscritos no total sorteavel', () => {
  const e = {
    id: 1, nome: 'E', competicao: 'C', cidade: 'X', local: 'L', data: '2026-01-01T00:00:00.000Z',
    organizador: null, publicadoEm: '', dataInicio: null, dataFim: null, boletins: [],
    modalidades: [
      { id: 1, nome: 'Judô', grupo: null, tipo: 'chaves', status: 'sorteado', seed: null, anfitriaoId: null, participantes: [{ id: 1, nome: 'A', subtitulo: null }], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [] },
      { id: 2, nome: 'Futsal', grupo: null, tipo: 'chaves', status: 'aguardando', seed: null, anfitriaoId: null, participantes: [], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [] },
    ],
  } as any
  const p = progressoSorteios(e)
  expect(p.sorteaveis).toBe(1)
  expect(p.sorteadas).toBe(1)
  expect(p.done).toBe(true)
})

it('modalidadesDistintas conta esportes pela base do nome', () => {
  const e = {
    id: 1, nome: 'E', competicao: 'C', cidade: 'X', local: 'L', data: '2026-01-01T00:00:00.000Z',
    organizador: null, publicadoEm: '', dataInicio: null, dataFim: null, boletins: [],
    modalidades: [
      { id: 1, nome: 'Atletismo Masculino', grupo: null, tipo: 'chaves', status: 'aguardando', seed: null, anfitriaoId: null, participantes: [], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [] },
      { id: 2, nome: 'Atletismo Feminino', grupo: null, tipo: 'chaves', status: 'aguardando', seed: null, anfitriaoId: null, participantes: [], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [] },
      { id: 3, nome: 'Judô Livre', grupo: null, tipo: 'chaves', status: 'aguardando', seed: null, anfitriaoId: null, participantes: [], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [] },
    ],
  } as any
  expect(modalidadesDistintas(e)).toBe(2)
})
```

Garantir que o import no topo do teste inclua `modalidadesDistintas`:
```ts
import { progressoSorteios, modalidadesDistintas } from './evento-stats'
```
(Se o arquivo já importa de `./evento-stats`, apenas acrescentar os nomes faltantes ao import existente.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/site-publico/lib/evento-stats.test.ts`
Expected: FAIL — `modalidadesDistintas` não exportado e/ou `sorteaveis` ainda conta a modalidade sem inscritos (espera 1, recebe 2).

- [ ] **Step 3: Implementar no helper**

Em `frontend/src/site-publico/lib/evento-stats.ts`:

a) Alterar `progressoSorteios` para excluir modalidades sem inscritos do `sorteaveis`:
```ts
export function progressoSorteios(e: SnapEvento): { sorteadas: number; sorteaveis: number; pct: number; done: boolean } {
  const sorteaveis = e.modalidades.filter((m) => m.tipo !== 'especifico' && m.participantes.length > 0).length
  const sorteadas = e.modalidades.filter((m) => m.status === 'sorteado').length
  const pct = sorteaveis > 0 ? Math.round((sorteadas / sorteaveis) * 100) : 0
  return { sorteadas, sorteaveis, pct, done: sorteaveis > 0 && sorteadas === sorteaveis }
}
```

b) Adicionar o alias semântico (logo após `categorias`):
```ts
export function modalidadesDistintas(e: SnapEvento): number {
  return categorias(e)
}
```

- [ ] **Step 4: Corrigir as fixtures dos testes da listagem que dependiam do antigo `sorteaveis`**

Motivo: as fixtures de "sorteado"/"andamento" usavam modalidades com `participantes: []`, que agora NÃO contam como sorteáveis (então `done` ficaria `false`). Dar inscritos a essas modalidades.

Em `frontend/src/site-publico/EventoCardListagem.test.tsx`, nos casos "em andamento" e "sorteado", trocar as chamadas `mod({...})` para incluir participantes:

```tsx
it('em andamento quando parte sorteada', () => {
  const html = renderToStaticMarkup(<EventoCardListagem evento={ev([mod({ id: 1, status: 'sorteado', participantes: [{ id: 1, nome: 'A', subtitulo: null }] }), mod({ id: 2, status: 'aguardando', participantes: [{ id: 2, nome: 'B', subtitulo: null }] })])} />)
  expect(html).toContain('data-status="andamento"')
  expect(html).toContain('Sorteios em andamento')
  expect(html).toContain('var(--grad-brand)')
})

it('sorteado quando 100% das sorteaveis', () => {
  const html = renderToStaticMarkup(<EventoCardListagem evento={ev([mod({ id: 1, status: 'sorteado', participantes: [{ id: 1, nome: 'A', subtitulo: null }] }), mod({ id: 2, status: 'sorteado', participantes: [{ id: 2, nome: 'B', subtitulo: null }] })])} />)
  expect(html).toContain('data-status="sorteado"')
  expect(html).toContain('var(--grad-accent)')
  expect(html).toContain('class="hl"')
})
```

Em `frontend/src/site-publico/EventosPage.test.tsx`, ajustar a fixture `ev(id, status)` para dar um inscrito à modalidade, de modo que o status "sorteado" derive corretamente:

```tsx
function ev(id: number, status: 'sorteado' | 'aguardando'): SnapEvento {
  return { id, nome: `Evento ${id}`, competicao: 'Jogos', cidade: 'Cidade', local: 'Ginásio', data: '2026-06-18T00:00:00.000Z', organizador: null, publicadoEm: '', dataInicio: null, dataFim: null, boletins: [], modalidades: [mod({ id: 1, status, participantes: [{ id: 1, nome: 'A', subtitulo: null }] })] }
}
```

- [ ] **Step 5: Rodar a suíte do site e ver passar**

Run: `cd frontend && npx vitest run src/site-publico`
Expected: PASS (todos os arquivos, incluindo `evento-stats.test.ts`, `EventoCardListagem.test.tsx`, `EventosPage.test.tsx`).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/site-publico/lib/evento-stats.ts frontend/src/site-publico/lib/evento-stats.test.ts frontend/src/site-publico/EventoCardListagem.test.tsx frontend/src/site-publico/EventosPage.test.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "fix(site-publico): progresso conta sorteaveis com inscritos + helper modalidadesDistintas"
```

---

### Task 2: Hero do detalhe — Modalidades distintas, remover Categorias

**Files:**
- Modify: `frontend/src/site-publico/pages/EventoPage.tsx`
- Modify: `frontend/src/site-publico/site.css`
- Test: `frontend/src/site-publico/EventoPage-hero.test.tsx`

**Interfaces:**
- Consumes: `modalidadesDistintas` (Task 1), `progressoSorteios`, `inscritos`.

- [ ] **Step 1: Atualizar o teste do hero (falha primeiro)**

Em `frontend/src/site-publico/EventoPage-hero.test.tsx`, no teste "renderiza o hero novo…", acrescentar asserções:
```ts
    expect(html).not.toContain('Categorias')
    expect(html).toContain('Modalidades')
    expect(html).toContain('Com sorteio')
```
(Manter as asserções existentes, inclusive `expect(html).toContain('1 / 2')` — a `base()` tem 2 modalidades com inscritos, então `sorteaveis=2`, `sorteadas=1`.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/site-publico/EventoPage-hero.test.tsx`
Expected: FAIL — o hero ainda contém o card "Categorias".

- [ ] **Step 3: Atualizar o hero em `EventoPage.tsx`**

a) No import de `'../lib/evento-stats'` (linha ~8): remover `totalModalidades` e `categorias`; adicionar `modalidadesDistintas`. Resultado (manter os demais nomes já usados):
```tsx
import { TIPO_INFO, tiposPresentes, progressoSorteios, inscritos, modalidadesDistintas, type TipoSorteio } from '../lib/evento-stats'
```

b) Substituir o bloco `.stat-pair` (4 cards) por 3 cards:
```tsx
                <div className="stat-pair">
                  <div className="sp"><div className="v">{modalidadesDistintas(evento)}</div><div className="l">Modalidades</div></div>
                  <div className="sp"><div className="v">{inscritos(evento)}</div><div className="l">Inscritos</div></div>
                  <div className="sp wide"><div className="v">{prog.sorteadas}</div><div className="l">Com sorteio</div></div>
                </div>
```

- [ ] **Step 4: Ajustar o CSS do `.stat-pair` para 3 cards**

Em `frontend/src/site-publico/site.css`, logo após a regra `.ev-actions .stat-pair { … }` (linha ~488), adicionar:
```css
.ev-actions .stat-pair .sp.wide { grid-column: 1 / -1; }
```
(O 3º indicador ocupa a linha inteira, mantendo o grid de 2 colunas equilibrado.)

- [ ] **Step 5: Rodar testes + build**

Run: `cd frontend && npx vitest run src/site-publico && npm run build:site`
Expected: PASS; `build:site` gera as páginas sem erro. (Se `tsc` reclamar de import não usado, confirmar que `totalModalidades`/`categorias` foram removidos do import e não são usados em outro ponto de `EventoPage.tsx`.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/site-publico/pages/EventoPage.tsx frontend/src/site-publico/site.css frontend/src/site-publico/EventoPage-hero.test.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "fix(site-publico): hero usa modalidades distintas e remove indicador Categorias"
```

---

## Verificação final (após as 2 tasks)

- [ ] `cd frontend && npx vitest run src/site-publico && npm run build:site` verdes.
- [ ] **Demo (screenshots) antes do merge na develop**: hero de um evento real (ex.: Itatiba/`evento-2.html`) mostrando "Modalidades" = esportes distintos (ex.: 21), sem o card "Categorias", e a barra "Andamento dos sorteios" com o total corrigido (sorteáveis com inscritos).
- [ ] Após aprovação: merge `feat/detalhe-indicadores-fix` → develop (só arquivos esperados, sem `git add -A`), push, monitorar deploy.

## Self-Review (cobertura da spec)

- Modalidades = esportes distintos + remover Categorias: Task 2 ✓.
- Progresso = sorteáveis com inscritos: Task 1 ✓ (helper) + reflete no hero/info-band via `prog`.
- Helper compartilhado afeta a listagem → fixtures corrigidas: Task 1 Step 4 ✓.
- Sem backend/cores novas ✓. Demo antes da develop ✓.
