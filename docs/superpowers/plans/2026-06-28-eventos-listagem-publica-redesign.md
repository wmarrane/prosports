# Eventos — redesign da listagem pública (grupo de ano + card calmo) — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar a listagem pública de eventos (`/eventos.html`) com um card calmo de acento por status (3 estados) e um cabeçalho de ano forte com filtro de status client-side, mantendo a home intacta.

**Architecture:** Novo componente `EventoCardListagem.tsx` (`.evc`, consome `SnapEvento` + helper `evento-stats`). `EventosPage.tsx` passa a renderizá-lo numa grade `.ev-grid3`, com `.yr-head` (ano + resumo + filtro) e um `<script>` inline que filtra os cards por `data-status` escopado por grupo de ano. CSS portado do protótipo para `site.css`.

**Tech Stack:** React 18 + TS + Vite; SSG via `renderToStaticMarkup`; Vitest; lucide-react; design system `tokens.css`/`theme-vars.css`/`site.css`.

## Global Constraints

- Host Windows; ler antes de editar; usar caminhos absolutos.
- Git identity inline: `git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit …`.
- Nunca `git add -A`; commitar só os arquivos nomeados.
- Validar com `cd frontend && npm run build:site` e `npx vitest run src/site-publico` — sem erros.
- Reusar tokens/classes; **sem cores novas**. Vars presentes no público: `--grad-accent/-brand/-warn`, `--accent`, `--info`, `--warn`, `--accent-700`, `--brand-50/-200/-300/-600`, `--card-bg/-border`, `--hairline`, `--shadow-e1/-e3`, `--font-display/-mono/-sans`, `--duration-*`, `--ease-out`.
- Escopo: **só a listagem** (`EventosPage`). Home (`IndexPage`/`EventoCard`) e hero do detalhe ficam intactos.
- Branch atual: `feat/eventos-listagem`.

---

### Task 1: Componente `EventoCardListagem.tsx`

**Files:**
- Create: `frontend/src/site-publico/components/EventoCardListagem.tsx`
- Test: `frontend/src/site-publico/EventoCardListagem.test.tsx`

**Interfaces:**
- Consumes: `SnapEvento` (`../snapshot-types`); `progressoSorteios`, `inscritos`, `totalModalidades` (`../lib/evento-stats`); `dataPtBr` (`../../lib/boletim-categorias`); ícones lucide `Medal`, `MapPin`, `ArrowRight`.
- Produces: `default export EventoCardListagem({ evento }: { evento: SnapEvento })` — renderiza `<a className="evc" data-status="sorteado|andamento|aguardando">`. Consumido pela Task 2.

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/site-publico/EventoCardListagem.test.tsx`:

```tsx
import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoCardListagem from './components/EventoCardListagem'
import type { SnapEvento, SnapModalidade } from './snapshot-types'

function mod(over: Partial<SnapModalidade>): SnapModalidade {
  return { id: 1, nome: 'Judô', grupo: null, tipo: 'chaves', status: 'aguardando', seed: null, anfitriaoId: null, participantes: [], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [], ...over }
}
function ev(mods: SnapModalidade[]): SnapEvento {
  return { id: 5, nome: '68º Jogos Regionais de Penápolis', competicao: 'Jogos Regionais', cidade: 'Penápolis', local: 'Ginásio', data: '2026-06-18T00:00:00.000Z', organizador: null, publicadoEm: '', dataInicio: null, dataFim: null, boletins: [], modalidades: mods }
}

it('aguardando quando nada foi sorteado', () => {
  const html = renderToStaticMarkup(<EventoCardListagem evento={ev([mod({ id: 1, participantes: [{ id: 1, nome: 'A', subtitulo: null }] })])} />)
  expect(html).toContain('data-status="aguardando"')
  expect(html).toContain('Aguardando sorteio')
  expect(html).toContain('var(--grad-warn)')
  expect(html).toContain('/evento-5.html')
  expect(html).toContain('Modalidades')
  expect(html).toContain('Inscritos')
  expect(html).toContain('Sorteios')
})

it('em andamento quando parte sorteada', () => {
  const html = renderToStaticMarkup(<EventoCardListagem evento={ev([mod({ id: 1, status: 'sorteado' }), mod({ id: 2, status: 'aguardando' })])} />)
  expect(html).toContain('data-status="andamento"')
  expect(html).toContain('Sorteios em andamento')
  expect(html).toContain('var(--grad-brand)')
})

it('sorteado quando 100% das sorteaveis', () => {
  const html = renderToStaticMarkup(<EventoCardListagem evento={ev([mod({ id: 1, status: 'sorteado' }), mod({ id: 2, status: 'sorteado' })])} />)
  expect(html).toContain('data-status="sorteado"')
  expect(html).toContain('var(--grad-accent)')
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd frontend && npx vitest run src/site-publico/EventoCardListagem.test.tsx`
Expected: FAIL — `Failed to resolve import './components/EventoCardListagem'`.

- [ ] **Step 3: Implementar o componente**

Criar `frontend/src/site-publico/components/EventoCardListagem.tsx`:

```tsx
import type { SnapEvento } from '../snapshot-types'
import { progressoSorteios, inscritos, totalModalidades } from '../lib/evento-stats'
import { dataPtBr } from '../../lib/boletim-categorias'
import { Medal, MapPin, ArrowRight } from 'lucide-react'

type StatusListagem = 'sorteado' | 'andamento' | 'aguardando'

const STATUS_INFO: Record<StatusListagem, { label: string; grad: string; dot: string }> = {
  sorteado: { label: 'Sorteado', grad: 'var(--grad-accent)', dot: 'var(--accent)' },
  andamento: { label: 'Sorteios em andamento', grad: 'var(--grad-brand)', dot: 'var(--info)' },
  aguardando: { label: 'Aguardando sorteio', grad: 'var(--grad-warn)', dot: 'var(--warn)' },
}

function statusDe(sorteadas: number, done: boolean): StatusListagem {
  if (done) return 'sorteado'
  if (sorteadas > 0) return 'andamento'
  return 'aguardando'
}

export default function EventoCardListagem({ evento }: { evento: SnapEvento }) {
  const { sorteadas, done } = progressoSorteios(evento)
  const status = statusDe(sorteadas, done)
  const info = STATUS_INFO[status]
  const sortCls = sorteadas === 0 ? 'zero' : done ? 'hl' : ''
  return (
    <a className="evc" href={`/evento-${evento.id}.html`} data-status={status}>
      <div className="accent" style={{ background: info.grad }} />
      <div className="evc-h">
        <div className="evc-tile" style={{ background: info.grad }}><Medal size={19} /></div>
      </div>
      <div className="evc-body">
        <h3 className="evc-title">{evento.nome}</h3>
        <div className="evc-loc"><MapPin size={13} /> {evento.cidade} · {dataPtBr(evento.data)}</div>
      </div>
      <div className="evc-stats">
        <div><b>{totalModalidades(evento)}</b><span>Modalidades</span></div>
        <div><b>{inscritos(evento)}</b><span>Inscritos</span></div>
        <div><b className={sortCls}>{sorteadas}</b><span>Sorteios</span></div>
      </div>
      <div className="evc-foot">
        <span className="evc-status"><span className="d" style={{ background: info.dot }} />{info.label}</span>
        <span className="evc-go">Ver evento <ArrowRight size={14} /></span>
      </div>
    </a>
  )
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd frontend && npx vitest run src/site-publico/EventoCardListagem.test.tsx`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/site-publico/components/EventoCardListagem.tsx frontend/src/site-publico/EventoCardListagem.test.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): card de listagem .evc (acento por status, 3 estados)"
```

---

### Task 2: `EventosPage` + CSS + filtro client-side

**Files:**
- Modify: `frontend/src/site-publico/pages/EventosPage.tsx`
- Modify: `frontend/src/site-publico/site.css`
- Test: `frontend/src/site-publico/EventosPage.test.tsx` (criar)

**Interfaces:**
- Consumes: `EventoCardListagem` (Task 1); `inscritos` (`../lib/evento-stats`); `SnapEvento`.
- Produces: nada para tarefas seguintes.

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/site-publico/EventosPage.test.tsx`:

```tsx
import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventosPage from './pages/EventosPage'
import type { SnapEvento, SnapModalidade } from './snapshot-types'

function mod(over: Partial<SnapModalidade>): SnapModalidade {
  return { id: 1, nome: 'Judô', grupo: null, tipo: 'chaves', status: 'aguardando', seed: null, anfitriaoId: null, participantes: [], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [], ...over }
}
function ev(id: number, status: 'sorteado' | 'aguardando'): SnapEvento {
  return { id, nome: `Evento ${id}`, competicao: 'Jogos', cidade: 'Cidade', local: 'Ginásio', data: '2026-06-18T00:00:00.000Z', organizador: null, publicadoEm: '', dataInicio: null, dataFim: null, boletins: [], modalidades: [mod({ id: 1, status })] }
}

it('renderiza cabecalho de ano, filtro e grade', () => {
  const html = renderToStaticMarkup(<EventosPage eventos={[ev(1, 'aguardando'), ev(2, 'sorteado')]} />)
  expect(html).toContain('yr-head')
  expect(html).toContain('2026')
  expect(html).toContain('eventos ·')
  expect(html).toContain('ev-grid3')
  expect(html).toContain('data-filter="todos"')
  expect(html).toContain('data-filter="andamento"')
  expect(html).toContain('data-filter="aguardando"')
  expect(html).toContain('data-filter="sorteado"')
  expect(html).toContain('data-status="aguardando"')
  expect(html).toContain('data-status="sorteado"')
})

it('inclui o script de filtro escopado por grupo de ano', () => {
  const html = renderToStaticMarkup(<EventosPage eventos={[ev(1, 'aguardando')]} />)
  expect(html).toContain('.year-group')
  expect(html).toContain('addEventListener')
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd frontend && npx vitest run src/site-publico/EventosPage.test.tsx`
Expected: FAIL — asserts não encontrados (página ainda usa o layout antigo `year-head`/`EventoCard`, sem `yr-head`/`ev-grid3`/`data-filter`).

- [ ] **Step 3: Reescrever `EventosPage.tsx`**

Substituir todo o conteúdo de `frontend/src/site-publico/pages/EventosPage.tsx` por:

```tsx
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import EventoCardListagem from '../components/EventoCardListagem'
import { inscritos } from '../lib/evento-stats'
import type { SnapEvento } from '../snapshot-types'

export default function EventosPage({ eventos }: { eventos: SnapEvento[] }) {
  const porAno = new Map<number, SnapEvento[]>()
  for (const e of eventos) { const y = new Date(e.data).getFullYear(); const a = porAno.get(y) ?? []; a.push(e); porAno.set(y, a) }
  const anos = [...porAno.keys()].sort((a, b) => b - a)

  return (
    <div className="site">
      <SiteNav active="eventos" />

      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-eyebrow"><span className="dot" />Agenda · resultados</div>
          <h1>Eventos</h1>
          <p className="lead">Cada evento tem sua própria página com inscritos, campeões do ano anterior e os sorteios de cada modalidade.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {anos.map(ano => {
            const lista = porAno.get(ano)!
            const inscritosAno = lista.reduce((s, e) => s + inscritos(e), 0)
            return (
              <div className="year-group" key={ano}>
                <div className="yr-head">
                  <span className="yr">{ano}</span>
                  <span className="sub"><b>{lista.length}</b> eventos · <b>{inscritosAno}</b> inscritos</span>
                  <span className="spacer" />
                  <div className="yr-filter">
                    <button type="button" className="on" data-filter="todos">Todos</button>
                    <button type="button" data-filter="andamento"><span className="d" style={{ background: 'var(--info)' }} />Em andamento</button>
                    <button type="button" data-filter="aguardando"><span className="d" style={{ background: 'var(--warn)' }} />Aguardando</button>
                    <button type="button" data-filter="sorteado"><span className="d" style={{ background: 'var(--accent)' }} />Sorteado</button>
                  </div>
                </div>
                <div className="ev-grid3">
                  {lista.map(e => <EventoCardListagem key={e.id} evento={e} />)}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <script dangerouslySetInnerHTML={{ __html:
        "document.querySelectorAll('.year-group').forEach(function(g){var btns=g.querySelectorAll('.yr-filter button');var cards=g.querySelectorAll('.evc');btns.forEach(function(b){b.addEventListener('click',function(){var f=b.getAttribute('data-filter');btns.forEach(function(x){x.classList.remove('on')});b.classList.add('on');cards.forEach(function(c){c.style.display=(f==='todos'||c.getAttribute('data-status')===f)?'':'none'})})})});"
      }} />

      <SiteFooter />
    </div>
  )
}
```

- [ ] **Step 4: Portar o CSS no `site.css`**

No arquivo `frontend/src/site-publico/site.css`:

a) **Remover** o cabeçalho antigo da listagem (só usado por `EventosPage`): as regras `.year-head { … }`, `.yr { … }` (a standalone de 40px), e `.yc { … }`. **Manter** `.year-group`/`.year-group:last-child` e `.ev-grid`.

b) **Adicionar** (logo após `.ev-grid`/`.year-group`, na seção "event grid / year groups") o bloco portado do `Listagem-redesign.html`:

```css
/* cabeçalho do grupo de ano (listagem redesenhada) */
.yr-head { display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; padding-bottom: 18px; margin-bottom: 26px; border-bottom: 1px solid var(--hairline); }
.yr-head .yr { font-family: var(--font-display); font-size: 46px; font-weight: 800; letter-spacing: -0.03em; line-height: 0.9; color: var(--t1); }
.yr-head .sub { font-size: 14px; color: var(--t3); padding-bottom: 5px; }
.yr-head .sub b { color: var(--t1); font-weight: 700; }
.yr-head .spacer { flex: 1; }
.yr-filter { display: flex; gap: 6px; padding-bottom: 3px; flex-wrap: wrap; }
.yr-filter button { font: 600 13px var(--font-sans); padding: 8px 14px; border-radius: 9999px; border: 1px solid var(--card-border); background: var(--card-bg); color: var(--t2); cursor: pointer; display: inline-flex; align-items: center; gap: 7px; transition: border-color var(--duration-fast), color var(--duration-fast), background var(--duration-fast); }
.yr-filter button:hover { border-color: var(--t4); color: var(--t1); }
.yr-filter button.on { background: var(--brand-50); border-color: var(--brand-200); color: var(--brand-600); }
.yr-filter button .d { width: 7px; height: 7px; border-radius: 50%; }

/* grade da listagem */
.ev-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
@media (max-width: 940px) { .ev-grid3 { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .ev-grid3 { grid-template-columns: 1fr; } }

/* card de listagem (.evc) */
a.evc { text-decoration: none; color: inherit; display: flex; flex-direction: column; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 18px; overflow: hidden; box-shadow: var(--shadow-e1); transition: transform var(--duration-fast) var(--ease-out), box-shadow var(--duration-base), border-color var(--duration-base); }
a.evc:hover { transform: translateY(-3px); box-shadow: var(--shadow-e3); border-color: var(--brand-300); }
.evc .accent { height: 5px; }
.evc-h { display: flex; align-items: center; gap: 11px; padding: 16px 18px 0; }
.evc-tile { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; color: #fff; flex-shrink: 0; box-shadow: var(--shadow-e1); }
.evc-tile svg { width: 19px; height: 19px; }
.evc-body { padding: 14px 18px 0; flex: 1; }
.evc-title { font-family: var(--font-display); font-size: 17px; font-weight: 700; letter-spacing: -0.015em; line-height: 1.22; color: var(--t1); margin: 0; text-wrap: balance; }
.evc-loc { display: inline-flex; align-items: center; gap: 7px; font: 600 12px var(--font-mono); color: var(--t4); margin-top: 10px; }
.evc-loc svg { width: 13px; height: 13px; }
.evc-stats { display: grid; grid-template-columns: repeat(3, 1fr); margin: 16px 18px 0; border: 1px solid var(--card-border); border-radius: 13px; overflow: hidden; }
.evc-stats > div { padding: 11px 8px; text-align: center; border-right: 1px solid var(--card-border); }
.evc-stats > div:last-child { border-right: none; }
.evc-stats b { display: block; font-family: var(--font-display); font-weight: 800; font-size: 17px; letter-spacing: -0.02em; color: var(--t1); font-variant-numeric: tabular-nums; line-height: 1; }
.evc-stats b.hl { color: var(--accent-700); }
.evc-stats b.zero { color: var(--t4); }
.evc-stats span { display: block; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--t4); margin-top: 5px; }
.evc-foot { display: flex; align-items: center; gap: 8px; padding: 14px 18px 16px; }
.evc-status { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600; color: var(--t2); }
.evc-status .d { width: 8px; height: 8px; border-radius: 50%; }
.evc-go { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 700; color: var(--brand-600); }
.evc-go svg { width: 14px; height: 14px; transition: transform var(--duration-fast); }
a.evc:hover .evc-go svg { transform: translateX(3px); }
```

- [ ] **Step 5: Rodar testes do site e o build**

Run: `cd frontend && npx vitest run src/site-publico && npm run build:site`
Expected: vitest verde (inclui `EventoCardListagem.test.tsx` e `EventosPage.test.tsx`); `build:site` gera as páginas sem erro.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/site-publico/pages/EventosPage.tsx frontend/src/site-publico/site.css frontend/src/site-publico/EventosPage.test.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): listagem com cabecalho de ano + filtro de status (.evc)"
```

---

## Verificação final (após as 2 tasks)

- [ ] `cd frontend && npm run build:site` e `npx vitest run src/site-publico` verdes.
- [ ] **Demo (screenshots) antes do merge na develop**: `/eventos.html` desktop + mobile, com os 3 estados de status visíveis, o cabeçalho de ano e o filtro funcionando (incluir um screenshot após clicar numa pílula).
- [ ] Após aprovação: merge `feat/eventos-listagem` → develop (só arquivos esperados, sem `git add -A`), push, monitorar deploy.

## Self-Review (cobertura da spec)

- Card calmo `.evc` com 3 estados de status: Task 1 ✓ (acento/tile/dot/label, métricas, `data-status`, número Sorteios `hl`/`zero`).
- Sem selo de edição: Task 1 ✓ (header só com tile).
- Cabeçalho de ano forte + filtro 4 pílulas + grade `.ev-grid3`: Task 2 ✓.
- Filtro client-side escopado por ano: Task 2 ✓ (`<script>` por `.year-group`).
- CSS portado + remoção do cabeçalho antigo (`.year-head`/`.yr`/`.yc`), mantendo `.ev-grid`/`.evento-card` da home: Task 2 Step 4 ✓.
- Tokens existentes / sem cores novas ✓. Escopo só listagem ✓. Demo antes da develop ✓.
