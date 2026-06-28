# Eventos — card redesenhado + hero do detalhe (site público) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar o card de evento (cover colorido por tipo de sorteio + barra de progresso) e o hero da página de detalhe (progresso + painel de ações + faixa de info) no site público, reusando o design system.

**Architecture:** Helper puro `evento-stats.ts` deriva métricas do snapshot; `EventoCard.tsx` (home+listagem) e o hero de `EventoPage.tsx` são recriados conforme os protótipos; CSS portado para `site.css`. Tudo SSG (renderToStaticMarkup); "Compartilhar" via `<script>` inline (navigator.share + fallback clipboard).

**Tech Stack:** React 18 + TS + Vite (SSG via build-site-publico.tsx), lucide-react, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-27-eventos-card-detalhe-redesign-design.md`
**Fonte pixel-perfect:** `personaladmin/handoff/design_handoff_eventos/Card-final.html` e `Detalhe-redesign.html`.

## Global Constraints

- Só site público. Reusar tokens/classes do design system; as vars `--grad-brand/-accent/-violet/-warn/-brand-deep`, `--brand-600/-700`, `--accent-700`, `--shadow-e1/2/3`, `--hairline`, `--card-bg-2` JÁ existem no contexto público (sem fallback novo).
- Tipos de sorteio → cor: chaves→`var(--grad-brand)`, grupos→`var(--grad-accent)`, ordem_entrada→`var(--grad-violet)`, especifico→`var(--grad-warn)`.
- Progresso: N = modalidades `status==='sorteado'`; M = modalidades `tipo!=='especifico'`; ocultar bloco se M===0; completo (N===M) → cor verde `var(--grad-accent)` + contador `var(--accent-700)` + "✓".
- Card: `.ev-grid` vira `repeat(2,1fr)` gap 18px, 1 coluna ≤760px. Hero: empilha ≤920px; info-band 4→2 col ≤760px.
- CTA "Baixar boletim oficial" → boletim de maior `atualizadoEm` (some se não houver). "Compartilhar" → navigator.share + fallback clipboard (script inline, sem dados de usuário interpolados no script).
- Ícones via `lucide-react`. Datas via `dataPtBr`/`toLocaleDateString('pt-BR',{timeZone:'UTC'})`.
- Host Windows; ler antes de editar; absolutos com `git -C`. Git identity inline (`-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`). Validar `cd frontend && npm run build && npm run build:site`. Não pushar.

---

### Task 1: Helper `evento-stats.ts`

**Files:**
- Create: `frontend/src/site-publico/lib/evento-stats.ts`
- Test: `frontend/src/site-publico/lib/evento-stats.test.ts`

**Interfaces:**
- Produces: `TipoSorteio`, `TIPO_INFO`, `tiposPresentes(e)`, `tipoDominante(e)`, `inscritos(e)`, `totalModalidades(e)`, `categorias(e)`, `progressoSorteios(e) → {sorteadas,sorteaveis,pct,done}`, `statusEvento(e)`.

- [ ] **Step 1: Escrever o teste**

Criar `frontend/src/site-publico/lib/evento-stats.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import type { SnapEvento } from '../snapshot-types'
import { tiposPresentes, tipoDominante, inscritos, totalModalidades, categorias, progressoSorteios, statusEvento } from './evento-stats'

function ev(mods: any[]): SnapEvento {
  return { id: 1, nome: 'E', competicao: 'C', cidade: 'M', local: 'L', data: '2026-06-01T00:00:00.000Z', organizador: null, publicadoEm: '', dataInicio: null, dataFim: null, boletins: [], modalidades: mods } as any
}

describe('evento-stats', () => {
  it('tiposPresentes ordena por frequência desc; dominante é o mais comum', () => {
    const e = ev([
      { nome: 'Judô A', tipo: 'chaves', status: 'sorteado', participantes: [{ id: 1 }] },
      { nome: 'Judô B', tipo: 'chaves', status: 'aguardando', participantes: [{ id: 2 }] },
      { nome: 'Futsal', tipo: 'grupos', status: 'aguardando', participantes: [{ id: 1 }] },
    ])
    expect(tiposPresentes(e)).toEqual(['chaves', 'grupos'])
    expect(tipoDominante(e)).toBe('chaves')
  })
  it('inscritos = participantes distintos; categorias = esportes distintos; total = nº modalidades', () => {
    const e = ev([
      { nome: 'Judô Masculino', tipo: 'chaves', status: 'sorteado', participantes: [{ id: 1 }, { id: 2 }] },
      { nome: 'Judô Feminino', tipo: 'chaves', status: 'aguardando', participantes: [{ id: 2 }, { id: 3 }] },
    ])
    expect(inscritos(e)).toBe(3)
    expect(totalModalidades(e)).toBe(2)
    expect(categorias(e)).toBe(1) // ambos esporteBase "Judô"
  })
  it('progresso ignora especifico em M; done quando todas as sorteáveis estão sorteadas', () => {
    const e = ev([
      { nome: 'A', tipo: 'chaves', status: 'sorteado', participantes: [] },
      { nome: 'B', tipo: 'grupos', status: 'sorteado', participantes: [] },
      { nome: 'C', tipo: 'especifico', status: 'aguardando', participantes: [] },
    ])
    const p = progressoSorteios(e)
    expect(p).toMatchObject({ sorteadas: 2, sorteaveis: 2, pct: 100, done: true })
    expect(statusEvento(e)).toBe('Sorteado')
  })
  it('só especifico → sorteaveis 0 (oculta progresso)', () => {
    const e = ev([{ nome: 'X', tipo: 'especifico', status: 'aguardando', participantes: [] }])
    expect(progressoSorteios(e).sorteaveis).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `cd frontend && npx vitest run src/site-publico/lib/evento-stats.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar o helper**

Criar `frontend/src/site-publico/lib/evento-stats.ts`:
```ts
import type { SnapEvento } from '../snapshot-types'
import { esporteBase } from './esporte'

export type TipoSorteio = 'chaves' | 'grupos' | 'ordem_entrada' | 'especifico'

export const TIPO_INFO: Record<TipoSorteio, { grad: string; label: string }> = {
  chaves: { grad: 'var(--grad-brand)', label: 'Chaves eliminatórias' },
  grupos: { grad: 'var(--grad-accent)', label: 'Grupos' },
  ordem_entrada: { grad: 'var(--grad-violet)', label: 'Ordem de entrada' },
  especifico: { grad: 'var(--grad-warn)', label: 'Específico' },
}

export function tiposPresentes(e: SnapEvento): TipoSorteio[] {
  const freq = new Map<TipoSorteio, number>()
  for (const m of e.modalidades) {
    const t = m.tipo as TipoSorteio
    freq.set(t, (freq.get(t) ?? 0) + 1)
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
}

export function tipoDominante(e: SnapEvento): TipoSorteio {
  return tiposPresentes(e)[0] ?? 'chaves'
}

export function inscritos(e: SnapEvento): number {
  return new Set(e.modalidades.flatMap((m) => m.participantes.map((p) => p.id))).size
}

export function totalModalidades(e: SnapEvento): number {
  return e.modalidades.length
}

export function categorias(e: SnapEvento): number {
  return new Set(e.modalidades.map((m) => esporteBase(m.nome))).size
}

export function progressoSorteios(e: SnapEvento): { sorteadas: number; sorteaveis: number; pct: number; done: boolean } {
  const sorteaveis = e.modalidades.filter((m) => m.tipo !== 'especifico').length
  const sorteadas = e.modalidades.filter((m) => m.status === 'sorteado').length
  const pct = sorteaveis > 0 ? Math.round((sorteadas / sorteaveis) * 100) : 0
  return { sorteadas, sorteaveis, pct, done: sorteaveis > 0 && sorteadas === sorteaveis }
}

export function statusEvento(e: SnapEvento): 'Sorteado' | 'Pronto p/ sorteio' {
  return progressoSorteios(e).done ? 'Sorteado' : 'Pronto p/ sorteio'
}
```

- [ ] **Step 4: Rodar (deve passar) + typecheck**

Run: `cd frontend && npx vitest run src/site-publico/lib/evento-stats.test.ts && npx tsc -b`
Expected: PASS; sem erros.

- [ ] **Step 5: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/site-publico/lib/evento-stats.ts frontend/src/site-publico/lib/evento-stats.test.ts
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): helper evento-stats (tipos, progresso, contagens)"
```

---

### Task 2: Card de evento (CSS + `EventoCard.tsx` + teste)

**Files:**
- Modify: `frontend/src/site-publico/site.css` (add `.ev2`/`.cover`/... ; update `.ev-grid`; remove old `.evento-card`/`.evento-meta`/`.evento-counts`)
- Modify: `frontend/src/site-publico/components/EventoCard.tsx` (rewrite)
- Test: `frontend/src/site-publico/EventoCard.test.tsx`

**Interfaces:**
- Consumes: `evento-stats` (Task 1), `TIPO_INFO`, `tiposPresentes`, `progressoSorteios`, `inscritos`, `totalModalidades`, `statusEvento`; `dataPtBr` de `../../lib/boletim-categorias`; `lucide-react`.

- [ ] **Step 1: CSS do card no site.css**

Em `frontend/src/site-publico/site.css`: (a) REMOVER as regras antigas `.evento-card`, `.evento-card:hover`, `.evento-card h3`, `.evento-meta`, `.evento-counts`, `.evento-counts span` (linhas ~213-233); (b) trocar a regra `.ev-grid` por `.ev-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; } @media (max-width: 760px) { .ev-grid { grid-template-columns: 1fr; } }`; (c) adicionar:
```css
a.ev2 { text-decoration: none; color: inherit; display: block; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 18px; overflow: hidden; box-shadow: var(--shadow-e1); transition: transform var(--duration-fast) var(--ease-out), box-shadow var(--duration-base), border-color var(--duration-base); }
a.ev2:hover { transform: translateY(-3px); box-shadow: var(--shadow-e3); }
.cover { position: relative; padding: 16px 18px; min-height: 100px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; }
.cover::after { content: ""; position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1.4px); background-size: 14px 14px; opacity: 0.5; }
.cover-top { position: relative; z-index: 1; display: flex; align-items: flex-start; justify-content: space-between; }
.c-icons { display: flex; gap: 6px; }
.c-tile { width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; color: #fff; background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.28); backdrop-filter: blur(2px); }
.c-tile svg { width: 20px; height: 20px; }
.c-more { width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; font: 700 12px var(--font-mono); color: #fff; background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.24); }
.c-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 9999px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #fff; background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.3); backdrop-filter: blur(2px); white-space: nowrap; }
.c-badge .dot { width: 6px; height: 6px; border-radius: 50%; background: #fff; }
.c-loc { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 7px; font: 600 12px var(--font-mono); color: rgba(255,255,255,0.92); }
.c-loc svg { width: 13px; height: 13px; opacity: 0.85; }
.ev2 .b { padding: 18px 20px 20px; }
.b-title { font-family: var(--font-display); font-size: 18px; font-weight: 800; letter-spacing: -0.02em; color: var(--t1); line-height: 1.2; margin: 0; }
.b-comp { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--t3); margin-top: 8px; }
.b-comp svg { width: 14px; height: 14px; color: var(--t4); flex-shrink: 0; }
.prog { margin-top: 18px; }
.prog-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
.prog-head .lab { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--t4); }
.prog-head b { font: 800 13px var(--font-mono); color: var(--t1); font-variant-numeric: tabular-nums; }
.prog-head b.done { color: var(--accent-700); }
.bar { height: 7px; border-radius: 9999px; background: var(--card-border); overflow: hidden; }
.bar span { display: block; height: 100%; border-radius: 9999px; transition: width var(--duration-slow); }
.ev2 .foot { display: flex; align-items: center; gap: 16px; margin-top: 16px; padding-top: 15px; border-top: 1px solid var(--hairline); font-size: 12px; color: var(--t3); }
.ev2 .foot .st { display: inline-flex; align-items: center; gap: 6px; }
.ev2 .foot .st svg { width: 14px; height: 14px; color: var(--t4); }
.ev2 .foot .st b { color: var(--t1); font-weight: 700; }
.ev2 .foot .go { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 700; color: var(--brand-600); }
.ev2 .foot .go svg { width: 14px; height: 14px; transition: transform var(--duration-fast); }
a.ev2:hover .foot .go svg { transform: translateX(3px); }
```

- [ ] **Step 2: Escrever o teste do card**

Criar `frontend/src/site-publico/EventoCard.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoCard from './components/EventoCard'
import type { SnapEvento } from './snapshot-types'

function ev(mods: any[]): SnapEvento {
  return { id: 7, nome: 'Jogos Teste', competicao: 'Copa', cidade: 'Tupã', local: 'Ginásio', data: '2026-06-18T00:00:00.000Z', organizador: null, publicadoEm: '', dataInicio: null, dataFim: null, boletins: [], modalidades: mods } as any
}

describe('EventoCard', () => {
  it('mostra cover, progresso N/M e link para o evento', () => {
    const html = renderToStaticMarkup(<EventoCard evento={ev([
      { nome: 'A', tipo: 'chaves', status: 'sorteado', participantes: [{ id: 1 }] },
      { nome: 'B', tipo: 'grupos', status: 'aguardando', participantes: [{ id: 2 }] },
    ])} />)
    expect(html).toContain('class="ev2"')
    expect(html).toContain('/evento-7.html')
    expect(html).toContain('Jogos Teste')
    expect(html).toContain('1/2')
    expect(html).toContain('Andamento dos sorteios')
  })
  it('oculta o progresso quando só há modalidades específicas', () => {
    const html = renderToStaticMarkup(<EventoCard evento={ev([
      { nome: 'X', tipo: 'especifico', status: 'aguardando', participantes: [] },
    ])} />)
    expect(html).not.toContain('Andamento dos sorteios')
  })
})
```

- [ ] **Step 3: Rodar (deve falhar)**

Run: `cd frontend && npx vitest run src/site-publico/EventoCard.test.tsx`
Expected: FAIL (markup antigo / `1/2` ausente).

- [ ] **Step 4: Reescrever EventoCard**

Substituir o conteúdo de `frontend/src/site-publico/components/EventoCard.tsx` por:
```tsx
import type { SnapEvento } from '../snapshot-types'
import { GitFork, Grid2x2, ListOrdered, List, Trophy, Users, MapPin, ArrowRight } from 'lucide-react'
import { dataPtBr } from '../../lib/boletim-categorias'
import { TIPO_INFO, tiposPresentes, tipoDominante, progressoSorteios, inscritos, totalModalidades, statusEvento, type TipoSorteio } from '../lib/evento-stats'

const ICON: Record<TipoSorteio, typeof GitFork> = {
  chaves: GitFork, grupos: Grid2x2, ordem_entrada: ListOrdered, especifico: List,
}

export default function EventoCard({ evento }: { evento: SnapEvento }) {
  const tipos = tiposPresentes(evento)
  const dom = TIPO_INFO[tipoDominante(evento)]
  const prog = progressoSorteios(evento)
  const visiveis = tipos.slice(0, 2)
  const extra = tipos.length - visiveis.length
  return (
    <a className="ev2" href={`/evento-${evento.id}.html`}>
      <div className="cover" style={{ background: dom.grad }}>
        <div className="cover-top">
          <div className="c-icons">
            {visiveis.map((t) => { const Ic = ICON[t]; return <div className="c-tile" key={t}><Ic size={20} /></div> })}
            {extra > 0 && <div className="c-more">+{extra}</div>}
          </div>
          <span className="c-badge"><span className="dot" />{statusEvento(evento)}</span>
        </div>
        <div className="c-loc"><MapPin size={13} /> {evento.cidade} · {dataPtBr(evento.data)}</div>
      </div>
      <div className="b">
        <h3 className="b-title">{evento.nome}</h3>
        <div className="b-comp"><Trophy size={14} /> {evento.competicao}</div>
        {prog.sorteaveis > 0 && (
          <div className="prog">
            <div className="prog-head">
              <span className="lab">Andamento dos sorteios</span>
              <b className={prog.done ? 'done' : ''}>{prog.sorteadas}/{prog.sorteaveis}{prog.done ? ' ✓' : ''}</b>
            </div>
            <div className="bar"><span style={{ width: `${Math.max(prog.pct, 3)}%`, background: prog.done ? 'var(--grad-accent)' : dom.grad }} /></div>
          </div>
        )}
        <div className="foot">
          <span className="st"><Users size={14} /> <b>{inscritos(evento)}</b> inscritos</span>
          <span className="st"><List size={14} /> <b>{totalModalidades(evento)}</b> modalidades</span>
          <span className="go">Ver evento <ArrowRight size={14} /></span>
        </div>
      </div>
    </a>
  )
}
```

- [ ] **Step 5: Rodar (deve passar) + builds**

Run: `cd frontend && npx vitest run src/site-publico/EventoCard.test.tsx && npm run build:site && npm run build`
Expected: PASS; ambos os builds sem erro.

- [ ] **Step 6: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/site-publico/components/EventoCard.tsx frontend/src/site-publico/site.css frontend/src/site-publico/EventoCard.test.tsx
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): card de evento com cover por tipo + barra de progresso"
```

---

### Task 3: Hero do detalhe (CSS + `EventoPage.tsx` + teste)

**Files:**
- Modify: `frontend/src/site-publico/site.css` (add hero/info-band/actions classes)
- Modify: `frontend/src/site-publico/pages/EventoPage.tsx` (replace `<header className="evento-header">` with hero + info-band; add share script)
- Modify: `frontend/src/site-publico/EventoPage-boletins.test.tsx` (ajustar fixture/assert do hero) OU criar `EventoPage-hero.test.tsx`

**Interfaces:**
- Consumes: `evento-stats` (Task 1); `dataPtBr` + boletins ordenados por `atualizadoEm`; `lucide-react`.

- [ ] **Step 1: CSS do hero no site.css**

Em `frontend/src/site-publico/site.css`, adicionar (portado de `Detalhe-redesign.html`):
```css
.ev-hero2 { background: var(--grad-brand-deep); color: #fff; position: relative; overflow: hidden; }
.ev-hero2 .blob { position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none; }
.ev-hero2 .blob.b1 { width: 460px; height: 460px; background: rgba(96,165,250,0.34); top: -160px; right: -90px; }
.ev-hero2 .blob.b2 { width: 320px; height: 320px; background: rgba(20,184,138,0.22); bottom: -160px; left: -60px; }
.ev-hero2-inner { position: relative; z-index: 2; padding: 36px 0 40px; }
.ev-grid2 { display: grid; grid-template-columns: 1fr 340px; gap: 40px; align-items: start; }
@media (max-width: 920px) { .ev-grid2 { grid-template-columns: 1fr; gap: 26px; } }
.ev-badges { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
.ev-type-tile { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; color: #fff; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.26); }
.ev-type-tile svg { width: 16px; height: 16px; }
.badge.badge-onhero { background: rgba(255,255,255,0.16); color: #fff; border: 1px solid rgba(255,255,255,0.26); }
.ev-h-title { color: #fff; font-family: var(--font-display); font-weight: 800; font-size: clamp(28px, 4vw, 42px); letter-spacing: -0.03em; line-height: 1.06; margin: 0; max-width: 18ch; text-wrap: balance; }
.ev-h-meta { display: flex; flex-wrap: wrap; gap: 11px 24px; margin-top: 18px; }
.ev-h-meta .m { display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; color: rgba(255,255,255,0.84); }
.ev-h-meta .m svg { width: 16px; height: 16px; opacity: 0.7; flex-shrink: 0; }
.hero-prog { margin-top: 26px; max-width: 460px; }
.hero-prog-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 9px; }
.hero-prog-head .lab { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.13em; color: rgba(255,255,255,0.66); }
.hero-prog-head b { font: 800 15px var(--font-mono); color: #fff; font-variant-numeric: tabular-nums; }
.hero-bar { height: 9px; border-radius: 9999px; background: rgba(255,255,255,0.16); overflow: hidden; }
.hero-bar span { display: block; height: 100%; border-radius: 9999px; background: linear-gradient(90deg, #fff, rgba(255,255,255,0.8)); }
.hero-prog .sub { margin-top: 9px; font-size: 12.5px; color: rgba(255,255,255,0.6); }
.ev-actions { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.16); border-radius: 18px; padding: 20px; backdrop-filter: blur(6px); }
.ev-actions .stat-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }
.ev-actions .sp .v { font-family: var(--font-display); font-weight: 800; font-size: 26px; letter-spacing: -0.02em; line-height: 1; font-variant-numeric: tabular-nums; }
.ev-actions .sp .l { font-size: 10.5px; color: rgba(255,255,255,0.62); text-transform: uppercase; letter-spacing: 0.12em; margin-top: 7px; font-weight: 600; }
.ev-actions .divider { height: 1px; background: rgba(255,255,255,0.14); margin: 4px 0 18px; }
.btn-onhero { width: 100%; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 13px 16px; border-radius: 12px; font-size: 14px; font-weight: 700; text-decoration: none; cursor: pointer; border: 1px solid transparent; transition: transform var(--duration-fast), filter var(--duration-fast); }
.btn-onhero:active { transform: scale(0.985); }
.btn-onhero svg { width: 17px; height: 17px; }
.btn-onhero.solid { background: #fff; color: var(--brand-700); }
.btn-onhero.solid:hover { filter: brightness(0.95); }
.btn-onhero.ghost { background: rgba(255,255,255,0.08); color: #fff; border-color: rgba(255,255,255,0.22); margin-top: 10px; }
.btn-onhero.ghost:hover { background: rgba(255,255,255,0.14); }
.info-band { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: -26px; position: relative; z-index: 3; margin-bottom: 8px; }
@media (max-width: 760px) { .info-band { grid-template-columns: repeat(2, 1fr); margin-top: 18px; } }
.info-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 15px; padding: 16px 18px; box-shadow: var(--shadow-e2); }
.info-card .ic-tile { width: 34px; height: 34px; border-radius: 10px; background: var(--card-bg-2); border: 1px solid var(--card-border); color: var(--brand-500); display: grid; place-items: center; margin-bottom: 12px; }
.info-card .ic-tile svg { width: 17px; height: 17px; }
.info-card .k { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--t4); }
.info-card .vv { font-size: 14px; font-weight: 700; color: var(--t1); margin-top: 4px; }
@media (max-width: 600px) {
  .ev-hero2-inner { padding: 24px 0 30px; }
  .ev-hero2 .blob.b1 { width: 300px; height: 300px; top: -120px; right: -80px; }
  .ev-grid2 { gap: 22px; }
  .ev-actions .sp .v { font-size: 23px; }
  .info-card { padding: 14px 15px; }
}
```

- [ ] **Step 2: Escrever o teste do hero**

Criar `frontend/src/site-publico/EventoPage-hero.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoPage from './pages/EventoPage'
import type { SnapEvento } from './snapshot-types'

const base = (extra: Partial<SnapEvento> = {}): SnapEvento => ({
  id: 3, nome: 'Jogos Regionais', competicao: 'Regionais 2026', cidade: 'Campinas', local: 'Ginásio',
  data: '2026-06-18T00:00:00.000Z', organizador: 'Org X', publicadoEm: '',
  dataInicio: '2026-06-18T00:00:00.000Z', dataFim: '2026-06-20T00:00:00.000Z',
  boletins: [], modalidades: [
    { id: 1, nome: 'Judô', grupo: null, tipo: 'chaves', status: 'sorteado', seed: null, anfitriaoId: null, participantes: [{ id: 1, nome: 'A', subtitulo: null }], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [] },
    { id: 2, nome: 'Futsal', grupo: null, tipo: 'grupos', status: 'aguardando', seed: null, anfitriaoId: null, participantes: [{ id: 2, nome: 'B', subtitulo: null }], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [] },
  ], ...extra,
} as any)

describe('EventoPage hero', () => {
  it('renderiza o hero novo com título, progresso e stat-pair', () => {
    const html = renderToStaticMarkup(<EventoPage evento={base()} />)
    expect(html).toContain('ev-hero2')
    expect(html).toContain('Jogos Regionais')
    expect(html).toContain('Andamento dos sorteios')
    expect(html).toContain('1 / 2')
    expect(html).toContain('Inscritos')
    expect(html).toContain('info-band')
  })
  it('mostra "Baixar boletim oficial" só quando há boletim', () => {
    const semBol = renderToStaticMarkup(<EventoPage evento={base()} />)
    expect(semBol).not.toContain('Baixar boletim oficial')
    const comBol = renderToStaticMarkup(<EventoPage evento={base({ boletins: [{ numero: 1, titulo: 'Of', categoria: 'Oficial', data: '2026-06-18T00:00:00.000Z', url: 'http://x/1.pdf', tamanho: 1, atualizadoEm: '2026-06-18T00:00:00.000Z' }] })} />)
    expect(comBol).toContain('Baixar boletim oficial')
    expect(comBol).toContain('http://x/1.pdf')
  })
})
```

- [ ] **Step 3: Rodar (deve falhar)**

Run: `cd frontend && npx vitest run src/site-publico/EventoPage-hero.test.tsx`
Expected: FAIL (hero antigo).

- [ ] **Step 4: Substituir o header pelo hero no EventoPage**

Em `frontend/src/site-publico/pages/EventoPage.tsx`:
- Adicionar imports no topo:
```tsx
import { Trophy, Calendar, MapPin, Clock, Building2, Download, Share2, GitFork, Grid2x2, ListOrdered, List } from 'lucide-react'
import { TIPO_INFO, tiposPresentes, progressoSorteios, inscritos, totalModalidades, categorias, statusEvento, type TipoSorteio } from '../lib/evento-stats'
```
- Adicionar, no topo do módulo (fora do componente), o mapa de ícones de tipo:
```tsx
const TIPO_ICON: Record<TipoSorteio, typeof GitFork> = { chaves: GitFork, grupos: Grid2x2, ordem_entrada: ListOrdered, especifico: List }
```
- Dentro do componente, antes do `return`, derivar:
```tsx
  const prog = progressoSorteios(evento)
  const tipos = tiposPresentes(evento)
  const ultimoBoletim = [...boletins].sort((a, b) => +new Date(b.atualizadoEm) - +new Date(a.atualizadoEm))[0]
  const periodo = evento.dataInicio
    ? `${dataPtBr(evento.dataInicio)}${evento.dataFim ? ` a ${dataPtBr(evento.dataFim)}` : ''}`
    : dataPtBr(evento.data)
  const ano = new Date(evento.data).getUTCFullYear()
```
- Substituir o bloco `<header className="evento-header"> … </header>` por:
```tsx
      <section className="ev-hero2">
        <div className="blob b1" /><div className="blob b2" />
        <div className="container">
          <div className="ev-hero2-inner">
            <nav className="breadcrumb">
              <a href="/index.html">Início</a><span>›</span>
              <a href="/eventos.html">Eventos</a><span>›</span>
              <a href="/eventos.html">{ano}</a><span>›</span>
              <b>{evento.nome}</b>
            </nav>
            <div className="ev-grid2">
              <div>
                <div className="ev-badges">
                  {tipos.map((t) => { const Ic = TIPO_ICON[t]; return <span className="ev-type-tile" key={t} title={TIPO_INFO[t].label}><Ic size={16} /></span> })}
                  <span className="badge b-accent"><span className="dot" />{statusEvento(evento)}</span>
                </div>
                <h1 className="ev-h-title">{evento.nome}</h1>
                <div className="ev-h-meta">
                  <span className="m"><Trophy size={16} /> {evento.competicao}</span>
                  <span className="m"><Calendar size={16} /> {periodo}</span>
                  <span className="m"><MapPin size={16} /> {evento.local} · {evento.cidade}</span>
                </div>
                {prog.sorteaveis > 0 && (
                  <div className="hero-prog">
                    <div className="hero-prog-head"><span className="lab">Andamento dos sorteios</span><b>{prog.sorteadas} / {prog.sorteaveis}</b></div>
                    <div className="hero-bar"><span style={{ width: `${Math.max(prog.pct, 3)}%` }} /></div>
                    <div className="sub">{prog.pct}% das modalidades já sorteadas · {prog.sorteaveis - prog.sorteadas} aguardando</div>
                  </div>
                )}
              </div>
              <aside className="ev-actions">
                <div className="stat-pair">
                  <div className="sp"><div className="v">{totalModalidades(evento)}</div><div className="l">Modalidades</div></div>
                  <div className="sp"><div className="v">{inscritos(evento)}</div><div className="l">Inscritos</div></div>
                  <div className="sp"><div className="v">{categorias(evento)}</div><div className="l">Categorias</div></div>
                  <div className="sp"><div className="v">{prog.sorteadas}</div><div className="l">Com sorteio</div></div>
                </div>
                <div className="divider" />
                {ultimoBoletim && (
                  <a className="btn-onhero solid" href={ultimoBoletim.url} target="_blank" rel="noopener noreferrer"><Download size={17} /> Baixar boletim oficial</a>
                )}
                <button className="btn-onhero ghost" data-share-title={`${evento.nome} · Montana Eventos`} data-share-url={`/evento-${evento.id}.html`}><Share2 size={17} /> Compartilhar evento</button>
              </aside>
            </div>
          </div>
        </div>
      </section>
      <div className="info-band">
        <div className="info-card"><div className="ic-tile"><Calendar size={17} /></div><div className="k">Período</div><div className="vv">{periodo}</div></div>
        <div className="info-card"><div className="ic-tile"><Clock size={17} /></div><div className="k">Sorteios</div><div className="vv">{prog.sorteaveis > 0 ? `${prog.sorteadas}/${prog.sorteaveis}` : '—'}</div></div>
        <div className="info-card"><div className="ic-tile"><MapPin size={17} /></div><div className="k">Local</div><div className="vv">{evento.local} · {evento.cidade}</div></div>
        {evento.organizador && <div className="info-card"><div className="ic-tile"><Building2 size={17} /></div><div className="k">Organização</div><div className="vv">{evento.organizador}</div></div>}
      </div>
      <script dangerouslySetInnerHTML={{ __html:
        "document.querySelectorAll('.btn-onhero.ghost[data-share-url]').forEach(function(b){b.addEventListener('click',function(){var u=location.origin+b.getAttribute('data-share-url');var t=b.getAttribute('data-share-title')||document.title;if(navigator.share){navigator.share({title:t,url:u}).catch(function(){})}else if(navigator.clipboard){navigator.clipboard.writeText(u);b.textContent='Link copiado!'}})});"
      }} />
```
Manter o restante (categorias de modalidades e a seção de boletins) como está. Observação: o `<main className="evento-page">` envolve hoje o header; mover o `<section className="ev-hero2">` para FORA do `.evento-page` (largura total) e manter o resto dentro do container existente — se a estrutura atual usar `.evento-page` como container central, posicionar o hero antes dele e abrir um `.container` para a info-band/conteúdo; o implementador deve adaptar à estrutura real do arquivo preservando o wrapper de conteúdo das modalidades/boletins.

- [ ] **Step 5: Rodar (deve passar) + builds**

Run: `cd frontend && npx vitest run src/site-publico && npm run build:site && npm run build`
Expected: testes PASS; ambos os builds sem erro.

- [ ] **Step 6: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/site-publico/pages/EventoPage.tsx frontend/src/site-publico/site.css frontend/src/site-publico/EventoPage-hero.test.tsx
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): hero do detalhe (progresso + acoes + faixa de info)"
```

---

### Task 4: Verificação integrada + demonstração

**Files:** nenhum.

- [ ] **Step 1: Suite + builds**

Run: `cd frontend && npx vitest run src/site-publico && npm run build && npm run build:site`
Expected: tudo verde.

- [ ] **Step 2: Demonstração (screenshots)**

Gerar o site local com snapshots de exemplo (um evento multi-tipo p/ o card e um detalhe com boletins) e capturar screenshots desktop + mobile (~390px): home/listagem (cards com cover por tipo, progresso, "+N") e detalhe (hero com progresso, stat-pair, faixa de info, "Baixar boletim oficial", "Compartilhar"). Entregar ao Wagner antes do merge na develop.

---

## Notas finais
- Só site público; admin e menu hambúrguer fora de escopo. Promoção `develop → main` só com confirmação do Wagner.
- A estrutura exata do wrapper em `EventoPage.tsx` (`.evento-page`/`.container`) deve ser preservada para as seções existentes (modalidades, boletins); o hero entra full-width antes do conteúdo central.
