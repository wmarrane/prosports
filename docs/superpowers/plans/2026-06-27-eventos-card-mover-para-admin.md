# Eventos — mover o card "Capa" para o admin + reverter card do site público — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reverter o card do site público ao desenho simples anterior e aplicar o desenho `Card-final.html` aos cards de evento do admin, mantendo o hero do detalhe público intacto.

**Architecture:** O site público volta ao `EventoCard` simples (revert do conteúdo em `6b40e08`). No admin, um novo componente isolado `EventoAdminCard.tsx` (estilos inline, dados via props, ações via callbacks) substitui o card inline atual dentro de `EventosList.tsx`, que mantém lista/filtros/agrupamento/estado.

**Tech Stack:** React 18 + TypeScript + Vite; Vitest + `react-dom/server` (`renderToStaticMarkup`) para testes; lucide-react; design system `tokens.css` + `prosports-theme.css` (admin) / `site.css` (público).

## Global Constraints

- Host Windows; ler antes de editar; usar caminhos absolutos.
- Git identity inline: `git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit …`.
- Nunca `git add -A`; commitar apenas os arquivos nomeados.
- Validar com `cd frontend && npm run build` (admin: `tsc -b && vite build`) e `npm run build:site` (público) — ambos sem erros.
- Reusar tokens/classes existentes; **sem cores novas**. Vars já confirmadas no admin: `--grad-brand`, `--grad-accent`, `--grad-violet`, `--grad-warn`, `--accent-700`, `--hairline`, `--card-bg`, `--card-border`.
- Branch atual: `feat/eventos-redesign`. Não mexer no hero do detalhe público (`EventoPage.tsx`) nem no CSS do hero/breadcrumb.

---

### Task 1: Reverter o card do site público

**Files:**
- Modify (restaurar conteúdo de `6b40e08`): `frontend/src/site-publico/components/EventoCard.tsx`
- Modify: `frontend/src/site-publico/site.css`
- Delete: `frontend/src/site-publico/EventoCard.test.tsx`

**Interfaces:**
- Consumes: `SnapEvento` (de `../snapshot-types`), `esporteBase` (de `../lib/esporte`).
- Produces: nada para tarefas seguintes (mudança isolada do site público).

- [ ] **Step 1: Restaurar `EventoCard.tsx` para a versão simples**

Substituir todo o conteúdo do arquivo por:

```tsx
import type { SnapEvento } from '../snapshot-types'
import { esporteBase } from '../lib/esporte'

export default function EventoCard({ evento }: { evento: SnapEvento }) {
  const total = new Set(evento.modalidades.map(m => esporteBase(m.nome))).size
  const inscritos = new Set(evento.modalidades.flatMap(m => m.participantes.map(p => p.id))).size
  const sorteadas = evento.modalidades.filter(m => m.status === 'sorteado').length
  return (
    <a className="evento-card" href={`/evento-${evento.id}.html`}>
      <h3>{evento.nome}</h3>
      <p className="evento-meta">{evento.cidade} · {new Date(evento.data).toLocaleDateString('pt-BR')}</p>
      <div className="evento-counts">
        <span>{total} modalidades</span><span>{inscritos} inscritos</span><span>{sorteadas} sorteadas</span>
      </div>
    </a>
  )
}
```

- [ ] **Step 2: Remover o teste do card novo**

```bash
git rm frontend/src/site-publico/EventoCard.test.tsx
```

- [ ] **Step 3: Restaurar o CSS do card no `site.css`**

No arquivo `frontend/src/site-publico/site.css`:

a) **Remover** todas as regras do card "Capa" (as classes adicionadas na branch): `.ev2`, `a.ev2`, `a.ev2:hover`, `.cover`, `.cover::after`, `.cover-top`, `.c-icons`, `.c-tile`, `.c-tile svg`, `.c-more`, `.c-badge`, `.c-badge .dot`, `.c-loc`, `.c-loc svg`, `.b`, `.b-title`, `.b-comp`, `.b-comp svg`, `.prog`, `.prog-head`, `.prog-head .lab`, `.prog-head b`, `.prog-head b.done`, `.bar`, `.bar span`, `.foot`, `.foot .st`, `.foot .st svg`, `.foot .st b`, `.foot .go`, `.foot .go svg`, `a.ev2:hover .foot .go svg`, e a media query do card que força `.ev-grid { grid-template-columns: 1fr }` em `≤760px` ligada ao card.

b) **Restaurar** estas regras (conteúdo de `6b40e08`), caso não existam mais:

```css
.evento-card {
  display: block; text-decoration: none;
  background: var(--card-bg); border: 1px solid var(--card-border);
  border-radius: 18px; padding: 22px; box-shadow: var(--shadow-e1);
  transition: transform var(--duration-fast) var(--ease-out), box-shadow var(--duration-base), border-color var(--duration-base);
}
.evento-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-e3); border-color: var(--brand-400); }
.evento-card h3 {
  font-family: var(--font-display); font-size: 17px; font-weight: 700;
  color: var(--t1); letter-spacing: -0.01em; margin: 0;
}
.evento-meta { font-size: 13px; color: var(--t3); margin: 8px 0 0; }
.evento-counts {
  display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px;
}
.evento-counts span {
  font-size: 11.5px; font-weight: 600; color: var(--t2);
  background: var(--card-bg-2); border: 1px solid var(--card-border);
  padding: 5px 10px; border-radius: 9999px; font-variant-numeric: tabular-nums;
}
```

c) **Restaurar** a grade para auto-fill (substituir o override `repeat(2,1fr)` do card):

```css
.ev-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 18px; }
```

d) **Não tocar** em nenhuma regra do hero: `.ev-hero2*`, `.ev-grid2`, `.ev-badges`, `.ev-type-tile`, `.ev-h-title`, `.ev-h-meta`, `.hero-prog`, `.hero-bar`, `.ev-actions`, `.stat-pair`, `.info-band`, `.info-card`, `.btn-onhero`, `.breadcrumb`, `.badge.b-accent` — todas permanecem.

Referência rápida (diff só do CSS do card vs. `6b40e08`):
```bash
git diff 6b40e08 -- frontend/src/site-publico/site.css
```

- [ ] **Step 4: Verificar build do site e a suíte do público**

```bash
cd frontend && npm run build:site && npx vitest run src/site-publico
```
Expected: `build:site` gera os eventos sem erro; vitest verde (sem `EventoCard.test.tsx`; `evento-stats.test.ts` e `EventoPage-hero.test.tsx` continuam passando).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/site-publico/components/EventoCard.tsx frontend/src/site-publico/site.css
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "revert(site-publico): volta o card de evento ao desenho simples (Capa vai p/ admin)"
```

---

### Task 2: Componente `EventoAdminCard.tsx`

**Files:**
- Create: `frontend/src/pages/eventos/EventoAdminCard.tsx`
- Test: `frontend/src/pages/eventos/EventoAdminCard.test.tsx`

**Interfaces:**
- Consumes: `Evento` (de `../../types/evento`), `TipoDisputa` (de `../../types/modalidade`), `STATUS_LABEL`/`STATUS_COLOR` (de `../../lib/evento-status`), ícones lucide-react.
- Produces: `default export EventoAdminCard` e a interface:
  ```ts
  interface EventoAdminCardProps {
    evento: Evento
    isAdmin: boolean
    publicando: boolean
    despublicando: boolean
    onAbrir: (ev: Evento) => void
    onInscricoes: (ev: Evento) => void
    onPublicar: (id: number) => void
    onDespublicar: (id: number) => void
    onRemover: (ev: Evento) => void
  }
  ```
  (consumida pela Task 3 em `EventosList.tsx`.)

- [ ] **Step 1: Escrever o teste que falha**

Criar `frontend/src/pages/eventos/EventoAdminCard.test.tsx`:

```tsx
import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoAdminCard from './EventoAdminCard'
import type { Evento } from '../../types/evento'

function ev(over: Partial<Evento> = {}): Evento {
  return {
    id: 7, nome: 'Jogos Regionais de Araçatuba', data_hora: '2026-06-18T13:00:00.000Z',
    local: 'Ginásio Municipal', organizador: null, status: 'sorteado',
    competicao_id: 1,
    competicao: { id: 1, nome: 'Jogos Regionais', modalidades: [
      { id: 1, tipo_modalidade: { tipo: 'chaves' } },
      { id: 2, tipo_modalidade: { tipo: 'chaves' } },
      { id: 3, tipo_modalidade: { tipo: 'grupos' } },
      { id: 4, tipo_modalidade: { tipo: 'ordem_entrada' } },
    ] } as any,
    municipio_id: 1, municipio: { id: 1, nome: 'Araçatuba', uf: 'SP' } as any,
    anfitriao_id: null, anfitriao: null, logo_url: null,
    site_publicado_em: null, criado_em: '', atualizado_em: '',
    _count: { inscricoes: 0, sorteios: 2 },
    modalidades_sorteaveis: 3, modalidades_distintas: 4, total_participantes: 84,
    ...over,
  } as Evento
}

const noop = () => {}
const cbs = { isAdmin: true, publicando: false, despublicando: false, onAbrir: noop, onInscricoes: noop, onPublicar: noop, onDespublicar: noop, onRemover: noop }

it('renderiza cover, status, progresso N/M e ações', () => {
  const html = renderToStaticMarkup(<EventoAdminCard evento={ev()} {...cbs} />)
  expect(html).toContain('Jogos Regionais de Araçatuba')
  expect(html).toContain('Araçatuba/SP')
  expect(html).toContain('Sorteado')
  expect(html).toContain('2/3')
  expect(html).toContain('+1') // 3 tipos distintos → 2 tiles + "+1"
  expect(html).toContain('Inscrições')
  expect(html).toContain('Remover')
  expect(html).toContain('var(--grad-brand)') // tipo dominante = chaves
})

it('mostra Despublicar quando publicado', () => {
  const html = renderToStaticMarkup(<EventoAdminCard evento={ev({ site_publicado_em: '2026-06-19T00:00:00Z' })} {...cbs} />)
  expect(html).toContain('Despublicar')
  expect(html).not.toContain('Publicar no site')
})

it('oculta o progresso quando não há modalidades sorteáveis', () => {
  const html = renderToStaticMarkup(<EventoAdminCard evento={ev({ modalidades_sorteaveis: 0, competicao: { id: 1, nome: 'X', modalidades: [{ id: 1, tipo_modalidade: { tipo: 'especifico' } }] } as any })} {...cbs} />)
  expect(html).not.toContain('Andamento dos sorteios')
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
cd frontend && npx vitest run src/pages/eventos/EventoAdminCard.test.tsx
```
Expected: FAIL — `Failed to resolve import './EventoAdminCard'` / módulo inexistente.

- [ ] **Step 3: Implementar `EventoAdminCard.tsx`**

Criar `frontend/src/pages/eventos/EventoAdminCard.tsx`:

```tsx
import type { Evento } from '../../types/evento'
import type { TipoDisputa } from '../../types/modalidade'
import { STATUS_LABEL, STATUS_COLOR } from '../../lib/evento-status'
import { Brackets, Group, ListOrdered, FileText, List, Trophy, Users, MapPin } from 'lucide-react'

const TIPO_GRAD: Record<TipoDisputa, string> = {
  chaves: 'var(--grad-brand)',
  grupos: 'var(--grad-accent)',
  ordem_entrada: 'var(--grad-violet)',
  especifico: 'var(--grad-warn)',
}
const TIPO_ICON: Record<TipoDisputa, typeof Brackets> = {
  chaves: Brackets, grupos: Group, ordem_entrada: ListOrdered, especifico: FileText,
}
const TIPO_LABEL: Record<TipoDisputa, string> = {
  chaves: 'Chaves', grupos: 'Grupos', ordem_entrada: 'Ordem de entrada', especifico: 'Específico',
}

function tiposPorFrequencia(ev: Evento): TipoDisputa[] {
  const freq = new Map<TipoDisputa, number>()
  for (const m of ev.competicao?.modalidades ?? []) {
    const t = m.tipo_modalidade?.tipo
    if (t) freq.set(t, (freq.get(t) ?? 0) + 1)
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
}

function formatDateBR(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

export interface EventoAdminCardProps {
  evento: Evento
  isAdmin: boolean
  publicando: boolean
  despublicando: boolean
  onAbrir: (ev: Evento) => void
  onInscricoes: (ev: Evento) => void
  onPublicar: (id: number) => void
  onDespublicar: (id: number) => void
  onRemover: (ev: Evento) => void
}

export default function EventoAdminCard({
  evento: ev, publicando, despublicando,
  onAbrir, onInscricoes, onPublicar, onDespublicar, onRemover,
}: EventoAdminCardProps) {
  const tipos = tiposPorFrequencia(ev)
  const dominanteGrad = tipos.length > 0 ? TIPO_GRAD[tipos[0]] : 'var(--grad-brand)'
  const total = ev.competicao?.modalidades?.length ?? 0
  const modalidadesCount = ev.modalidades_distintas ?? total
  const inscritos = ev.total_participantes ?? 0
  const sorteadas = ev._count?.sorteios ?? 0
  const sorteaveis = ev.modalidades_sorteaveis ?? total
  const pct = sorteaveis > 0 ? Math.round((sorteadas / sorteaveis) * 100) : 0
  const done = sorteaveis > 0 && sorteadas === sorteaveis
  const suspenso = ev.status === 'suspenso'
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div
      onClick={() => onAbrir(ev)}
      className="fade-in"
      style={{
        position: 'relative',
        background: suspenso ? 'var(--warn-soft)' : 'var(--card-bg)',
        border: suspenso ? '1px solid var(--warn)' : '1px solid var(--card-border)',
        borderRadius: 'var(--radius-xl)',
        cursor: 'pointer',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
        transition: 'border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-400)'; e.currentTarget.style.transform = 'translateY(-3px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = suspenso ? 'var(--warn)' : 'var(--card-border)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      {/* Cover */}
      <div style={{ position: 'relative', background: dominanteGrad, padding: '16px 18px', minHeight: 100, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1.4px)', backgroundSize: '14px 14px', opacity: 0.5, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {tipos.length === 0 && (
              <div title="Sem modalidades" style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', color: '#fff', background: 'rgba(255,255,255,0.14)', border: '1px dashed rgba(255,255,255,0.4)' }}>
                <FileText size={20} />
              </div>
            )}
            {tipos.slice(0, 2).map(t => {
              const Icon = TIPO_ICON[t]
              return (
                <div key={t} title={TIPO_LABEL[t]} style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', color: '#fff', background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)' }}>
                  <Icon size={20} />
                </div>
              )
            })}
            {tipos.length > 2 && (
              <div style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', font: '700 12px var(--font-mono)', color: '#fff', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.24)' }}>
                +{tipos.length - 2}
              </div>
            )}
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[ev.status]}`} style={{ whiteSpace: 'nowrap' }}>
            {STATUS_LABEL[ev.status]}
          </span>
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 7, font: '600 12px var(--font-mono)', color: 'rgba(255,255,255,0.92)' }}>
          <MapPin size={13} /> {ev.municipio.nome}/{ev.municipio.uf} · {formatDateBR(ev.data_hora)}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '18px 20px 20px' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--t1)', lineHeight: 1.2, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {ev.nome}
        </h3>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--t3)', marginTop: 8 }}>
          <Trophy size={14} style={{ color: 'var(--t4)' }} /> {ev.competicao.nome}
        </div>

        {sorteaveis > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--t4)' }}>Andamento dos sorteios</span>
              <b style={{ font: '800 13px var(--font-mono)', color: done ? 'var(--accent-700)' : 'var(--t1)', fontVariantNumeric: 'tabular-nums' }}>
                {sorteadas}/{sorteaveis}{done ? ' ✓' : ''}
              </b>
            </div>
            <div style={{ height: 7, borderRadius: 9999, background: 'var(--card-border)', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', borderRadius: 9999, width: `${Math.max(pct, 3)}%`, background: done ? 'var(--grad-accent)' : dominanteGrad }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, paddingTop: 15, borderTop: '1px solid var(--hairline)', fontSize: 12, color: 'var(--t3)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Users size={14} style={{ color: 'var(--t4)' }} /> <b style={{ color: 'var(--t1)', fontWeight: 700 }}>{inscritos.toLocaleString('pt-BR')}</b> inscritos
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <List size={14} style={{ color: 'var(--t4)' }} /> <b style={{ color: 'var(--t1)', fontWeight: 700 }}>{modalidadesCount}</b> modalidades
          </span>
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 14 }}>
          <button
            onClick={e => { stop(e); onInscricoes(ev) }}
            title="Abrir inscrições, sorteio e campeões do evento"
            className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)] font-semibold"
          >Inscrições</button>
          {ev.site_publicado_em ? (
            <button
              onClick={e => { stop(e); onDespublicar(ev.id) }}
              disabled={despublicando}
              title="Remove o evento do site público (~1–2 min). Re-publicar atualiza/sobrescreve o snapshot."
              className="text-xs text-[var(--t3)] hover:text-[var(--t1)] font-semibold"
            >Despublicar</button>
          ) : (
            <button
              onClick={e => { stop(e); onPublicar(ev.id) }}
              disabled={publicando || ev.status !== 'sorteado'}
              title={ev.status !== 'sorteado' ? 'Disponível apenas quando o evento estiver Sorteado' : 'Publica um retrato (snapshot) do evento no site público (~1–2 min). Para refletir mudanças depois, publique novamente.'}
              className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)] font-semibold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[var(--brand-500)]"
            >Publicar no site</button>
          )}
          <button
            onClick={e => { stop(e); onRemover(ev) }}
            title="Excluir o evento (inscrições e sorteios vinculados serão perdidos)"
            className="text-xs text-[var(--danger)] hover:text-[var(--danger-700)] font-semibold"
          >Remover</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

```bash
cd frontend && npx vitest run src/pages/eventos/EventoAdminCard.test.tsx
```
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/eventos/EventoAdminCard.tsx frontend/src/pages/eventos/EventoAdminCard.test.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(eventos-admin): card de evento Capa (cover por tipo + progresso + acoes)"
```

---

### Task 3: Integrar `EventoAdminCard` em `EventosList.tsx`

**Files:**
- Modify: `frontend/src/pages/eventos/EventosList.tsx`

**Interfaces:**
- Consumes: `EventoAdminCard` + `EventoAdminCardProps` (da Task 2).
- Produces: nada para tarefas seguintes.

- [ ] **Step 1: Importar o novo componente e limpar imports/maps do card antigo**

Em `frontend/src/pages/eventos/EventosList.tsx`:

a) Adicionar import: `import EventoAdminCard from './EventoAdminCard'`.

b) Ajustar o import de lucide-react para manter **apenas** o que continua em uso (filtros + toggles de grupo): trocar
```tsx
import { Brackets, Group, ListOrdered, FileText, Layers, MapPin, Users, Dices, ChevronDown } from 'lucide-react'
```
por
```tsx
import { Brackets, Group, ListOrdered, Layers, ChevronDown } from 'lucide-react'
```

c) Remover, do topo do arquivo, as constantes que migraram para o componente: `TIPO_GRAD`, `TIPO_ICON`, `TIPO_LABEL` (o card antigo as usava). **Manter** `eventoTipos(ev)` (usado por `lista`/`countPorFiltro`) e `FILTROS`.

d) Remover o import agora não usado: `import { STATUS_LABEL, STATUS_COLOR } from '../../lib/evento-status'` (usados só no card).

e) Remover a função `formatDateBR` (migrou para o componente) e a função `Meta` no fim do arquivo (migrou para o componente).

- [ ] **Step 2: Substituir o card inline pelo componente em `renderGrupos`**

Dentro de `renderGrupos`, substituir todo o bloco `{g.eventos.map((ev, i) => { … return (<div key={ev.id} …>… todo o card …</div>) })}` por:

```tsx
{g.eventos.map(ev => (
  <EventoAdminCard
    key={ev.id}
    evento={ev}
    isAdmin={isAdmin}
    publicando={publicandoSite}
    despublicando={despublicandoSite}
    onAbrir={e => navigate(`/eventos/${e.id}/${isAdmin ? 'editar' : 'inscricoes'}`)}
    onInscricoes={e => navigate(`/eventos/${e.id}/inscricoes`)}
    onPublicar={id => publicarSite(id)}
    onDespublicar={id => despublicarSite(id)}
    onRemover={e => setAlvo({ id: e.id, nome: e.nome })}
  />
))}
```

Manter o `<div>` da grade ao redor (`gridTemplateColumns: repeat(auto-fill, minmax(320px, 1fr))`, `gap: 16`) e toda a estrutura de seções/colapsáveis. A variável `i` do `.map` não é mais usada (o `animationDelay` saiu junto com o card inline) — remover do parâmetro.

f) `handleRemove` deixa de ser usado (substituído por `onRemover={e => setAlvo(...)}`). Remover a função `handleRemove` para não deixar código morto.

- [ ] **Step 3: Verificar build e suíte do admin**

```bash
cd frontend && npm run build && npx vitest run src/pages/eventos
```
Expected: `tsc -b && vite build` sem erros de tipo/imports não usados; vitest verde (inclui `EventoAdminCard.test.tsx` e `SorteioPrint.test.tsx`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/eventos/EventosList.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(eventos-admin): usa EventoAdminCard na listagem (remove card inline antigo)"
```

---

## Verificação final (após as 3 tasks)

- [ ] `cd frontend && npm run build && npm run build:site` — ambos verdes.
- [ ] `cd frontend && npx vitest run` — toda a suíte verde.
- [ ] **Demo (screenshots) antes do merge na develop** (preferência do Wagner):
  - Admin `/eventos`: cards novos (cover por tipo, +N multi-tipo, status semântico, progresso N/M, ações no rodapé) em desktop e mobile.
  - Público `/eventos.html`: card simples restaurado; `/evento-<id>.html`: hero do detalhe inalterado.
- [ ] Após aprovação: merge `feat/eventos-redesign` → develop (apenas arquivos esperados, sem `git add -A`), push, monitorar deploy.

## Self-Review (cobertura da spec)

- Reverter card público: Task 1 ✓ (EventoCard.tsx + site.css + remove teste; mantém hero/breadcrumb/evento-stats).
- Card Capa no admin: Task 2 ✓ (componente isolado, cover por tipo dominante, +N, status semântico, progresso N/M, metas, ações no rodapé).
- Integração + limpeza: Task 3 ✓ (usa componente, remove card inline/Meta/handleRemove, mantém filtros/agrupamento/eventoTipos).
- Tokens existentes / sem cores novas ✓. Demo antes da develop ✓.
