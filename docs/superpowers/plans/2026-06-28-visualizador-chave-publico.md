# Visualizador de chave no site público (B1) — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um overlay de visualização de chave no site público (SSG), com "Por fase" (abas por rodada) e "Chaveamento" (árvore reusando `BracketTree`), aberto por um botão "Ver chave" nas modalidades chaves+sorteado. Sem vencedores/campeão.

**Architecture:** Helper puro `resolveRef` (resolve P/V/L/BYE) + componente `BracketView` (markup estático das duas visões) + integração na `EventoPage` (botão + overlay por modalidade + `<script>` inline para abrir/fechar, alternar visão e abas). CSS `.em-*` portado (overlay adaptado a `position:fixed`).

**Tech Stack:** React 18 + TS + SSG (`renderToStaticMarkup`); Vitest; `site.css` (tokens públicos). Interatividade: `<script>` vanilla inline.

## Global Constraints

- Host Windows; ler antes de editar; caminhos absolutos.
- Git identity inline: `git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit …`.
- Nunca `git add -A`; commitar só os arquivos nomeados.
- Validar: `cd frontend && npm run build:site` e `npx vitest run src/site-publico`.
- Reusar tokens/classes/componentes; **sem cores novas**; classes do bracket sempre `.em-*`. Branch: `feat/bracket-view`.
- **Sem** vencedores/campeão (omitir `.em-champ` e `data-w`). Site é SSG: interatividade só por `<script>` inline.
- Dados (snapshot, modalidade chaves+sorteado): `resultado.matchesGraph.matches[]{id,round,top,bottom}`, `resultado.slots`, `resultado.byePositions`, `matchesGraph.final`, `matchesGraph.thirdPlace`; `modalidade.participantes[]{id,nome,subtitulo}`, `modalidade.cabecasPids`.

---

### Task 1: Helper `resolveRef` (`lib/bracket.ts`)

**Files:**
- Create: `frontend/src/site-publico/lib/bracket.ts`
- Test: `frontend/src/site-publico/lib/bracket.test.ts`

**Interfaces:** Produces `resolveRef(ref, slots, nomePorId) → { pid: number | null; nome: string | null; label: string | null; seed: number | null }`.

- [ ] **Step 1: Teste (falha primeiro)**

Criar `frontend/src/site-publico/lib/bracket.test.ts`:
```ts
import { it, expect } from 'vitest'
import { resolveRef } from './bracket'

const slots = [10, 20, 30] // posições 1..3
const nomes = new Map<number, string>([[10, 'Ana'], [20, 'Bia'], [30, 'Cris']])

it('P<n> resolve para o participante da posição n (1-indexed) + seed', () => {
  expect(resolveRef('P2', slots, nomes)).toEqual({ pid: 20, nome: 'Bia', label: null, seed: 2 })
})
it('P<n> sem participante (slot null) vira BYE/—', () => {
  expect(resolveRef('P9', slots, nomes)).toEqual({ pid: null, nome: null, label: '—', seed: 9 })
})
it('V:/L: viram rótulos de vencedor/perdedor', () => {
  expect(resolveRef('V:J1', slots, nomes)).toEqual({ pid: null, nome: null, label: 'Vencedor J1', seed: null })
  expect(resolveRef('L:J7', slots, nomes)).toEqual({ pid: null, nome: null, label: 'Perdedor J7', seed: null })
})
it('BYE vira rótulo BYE', () => {
  expect(resolveRef('BYE', slots, nomes)).toEqual({ pid: null, nome: null, label: 'BYE', seed: null })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/site-publico/lib/bracket.test.ts`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

Criar `frontend/src/site-publico/lib/bracket.ts`:
```ts
export type RefResolvido = { pid: number | null; nome: string | null; label: string | null; seed: number | null }

export function resolveRef(ref: string, slots: (number | null)[], nomePorId: Map<number, string>): RefResolvido {
  if (ref === 'BYE') return { pid: null, nome: null, label: 'BYE', seed: null }
  if (ref.startsWith('V:')) return { pid: null, nome: null, label: `Vencedor ${ref.slice(2)}`, seed: null }
  if (ref.startsWith('L:')) return { pid: null, nome: null, label: `Perdedor ${ref.slice(2)}`, seed: null }
  if (ref.startsWith('P')) {
    const pos = Number(ref.slice(1))
    const pid = Number.isFinite(pos) ? (slots[pos - 1] ?? null) : null
    const nome = pid != null ? (nomePorId.get(pid) ?? null) : null
    return { pid, nome, label: pid != null ? null : '—', seed: Number.isFinite(pos) ? pos : null }
  }
  return { pid: null, nome: null, label: ref, seed: null }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/site-publico/lib/bracket.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/site-publico/lib/bracket.ts frontend/src/site-publico/lib/bracket.test.ts
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): helper resolveRef (refs de chave P/V/L/BYE)"
```

---

### Task 2: CSS `.em-*` do bracket (overlay fixed)

**Files:**
- Modify: `frontend/src/site-publico/site.css`

**Interfaces:** Produces as classes `.em-*` usadas pelo `BracketView` (Tasks 3/4).

- [ ] **Step 1: Adicionar o CSS**

Em `frontend/src/site-publico/site.css`, ao final, adicionar um bloco "Visualizador de chave (.em-*)". **Portar de** `personaladmin/handoff/design_handoff_evento_mobile/evento-mobile.css` os blocos: `.em-vtog` (+ button/[data-on]/svg), `.em-rtabs`/`.em-rtab` (+ `.n`/[data-on]), `.em-phase-h`, `.em-mt`(+`.final`)/`.em-mt-cap`(+`.lab`,`.em-mt-ph`)/`.em-mt-row`(+`.seed`,`.nm`,`.bye`; pode manter as regras `[data-w]`/`[data-l]` mesmo sem uso), `.em-byes`(+`.bh`,`.bl`,`.bch`,`.s`), `.em-tree-hint`, `.em-tree-wrap`. **Omitir** `.em-champ*`, `.em-tree`/`.em-tcol`/`.em-tm`/`.em-tr` e as margens/conectores da árvore do protótipo (usamos o `BracketTree`).

Adicionar (overlay adaptado para o site, **não** o frame de iPhone) — substituir `.em-bracket-ov`/`.em-bk-top`/`.em-bk-head`/`.em-bk-body` por estes:
```css
/* ── Visualizador de chave (overlay) ── */
.em-bracket-ov { position: fixed; inset: 0; z-index: 200; background: var(--card-bg-2); display: none; flex-direction: column; }
.em-bracket-ov[data-open="true"] { display: flex; }
.em-bk-head { display: flex; align-items: center; gap: 8px; padding: 12px 14px; background: var(--card-bg); border-bottom: 1px solid var(--hairline); }
.em-bk-head .tt { flex: 1; min-width: 0; }
.em-bk-head .tt b { display: block; font-size: 15px; font-weight: 800; letter-spacing: -0.02em; color: var(--t1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.15; }
.em-bk-head .tt span { font-size: 11px; color: var(--t4); }
.em-bk-close { width: 38px; height: 38px; border-radius: 10px; border: 1px solid var(--card-border); background: var(--card-bg); color: var(--t2); display: grid; place-items: center; cursor: pointer; flex-shrink: 0; }
.em-bk-body { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 14px; max-width: 920px; width: 100%; margin: 0 auto; }
/* panes (alternância de visão) e abas de fase (controladas por data-attrs via script) */
.em-pane { display: none; }
.em-pane[data-on="true"] { display: block; }
.em-round { display: none; }
.em-round[data-on="true"] { display: block; }
```
Reusar tokens; sem cores novas.

- [ ] **Step 2: Verificar build**

Run: `cd frontend && npm run build:site`
Expected: sem erros.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/site-publico/site.css
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): css .em do visualizador de chave (overlay fixed)"
```

---

### Task 3: Componente `BracketView`

**Files:**
- Create: `frontend/src/site-publico/components/BracketView.tsx`
- Test: `frontend/src/site-publico/components/BracketView.test.tsx`

**Interfaces:**
- Consumes: `SnapModalidade` (`../snapshot-types`), `resolveRef` (`../lib/bracket`), `SorteioChaves` (`../../components/sorteio-result/SorteioChaves`), `Participante` (`../../types/participante`), ícones lucide.
- Produces: `default BracketView({ modalidade }: { modalidade: SnapModalidade })` — renderiza o overlay estático (`#bracket-<id>`). Consumido pela Task 4.

- [ ] **Step 1: Teste (falha primeiro)**

Criar `frontend/src/site-publico/components/BracketView.test.tsx`:
```tsx
import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import BracketView from './BracketView'
import type { SnapModalidade } from '../snapshot-types'

const mod: SnapModalidade = {
  id: 7, nome: 'Judô Feminino Livre', grupo: null, tipo: 'chaves', status: 'sorteado', seed: 'AB',
  anfitriaoId: null, cabecasPids: [10], campeoes: [], resultado: {
    size: 4, slots: [10, 20, 30, 40], byePositions: [1],
    matchesGraph: { final: 'J3', thirdPlace: null, matches: [
      { id: 'J1', round: 1, top: 'P2', bottom: 'P3' },
      { id: 'B1', round: 1, top: 'P1', bottom: 'BYE' },
      { id: 'J3', round: 2, top: 'V:B1', bottom: 'V:J1' },
    ] },
  },
  participantes: [
    { id: 10, nome: 'Ana', subtitulo: null }, { id: 20, nome: 'Bia', subtitulo: null },
    { id: 30, nome: 'Cris', subtitulo: null }, { id: 40, nome: 'Dani', subtitulo: null },
  ],
  mensagens_inscritos: [],
} as any

it('renderiza overlay com as duas visões, resolve nomes e rótulos, e abas por rodada', () => {
  const html = renderToStaticMarkup(<BracketView modalidade={mod} />)
  expect(html).toContain('id="bracket-7"')
  expect(html).toContain('em-vtog')          // alternância de visão
  expect(html).toContain('Por fase')
  expect(html).toContain('Chaveamento')
  expect(html).toContain('Bia')              // P2 → slots[1]=20 → Bia
  expect(html).toContain('Vencedor J1')      // V:J1
  expect(html).toContain('Final')            // rótulo da rodada/jogo final
  expect(html).toContain('em-byes')          // chips de byes (P1=Ana via bye)
  expect(html).not.toContain('em-champ')     // sem faixa de campeão
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/site-publico/components/BracketView.test.tsx`
Expected: FAIL — módulo inexistente.

- [ ] **Step 3: Implementar**

Criar `frontend/src/site-publico/components/BracketView.tsx`:
```tsx
import type { SnapModalidade } from '../snapshot-types'
import type { Participante } from '../../types/participante'
import SorteioChaves from '../../components/sorteio-result/SorteioChaves'
import { resolveRef } from '../lib/bracket'
import { X, GitFork, ListOrdered, Crown } from 'lucide-react'

type Match = { id: string; round: number; top: string; bottom: string }

function roundLabel(round: number, maxRound: number): string {
  const d = maxRound - round
  return d === 0 ? 'Final' : d === 1 ? 'Semifinal' : d === 2 ? 'Quartas' : d === 3 ? 'Oitavas' : `${round}ª rodada`
}

export default function BracketView({ modalidade }: { modalidade: SnapModalidade }) {
  const res = modalidade.resultado as any
  const graph = res?.matchesGraph
  if (!graph || !graph.matches?.length) return null

  const nomePorId = new Map<number, string>()
  for (const p of modalidade.participantes) nomePorId.set(p.id, p.nome)
  const cabecas = new Set(modalidade.cabecasPids)
  const slots: (number | null)[] = res.slots ?? []
  const matches: Match[] = graph.matches
  const maxRound = Math.max(...matches.map((m) => m.round))
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b)
  const isBye = (m: Match) => m.top === 'BYE' || m.bottom === 'BYE'

  const participantesById = new Map<number, Participante>()
  for (const p of modalidade.participantes) participantesById.set(p.id, { id: p.id, nome: p.nome, subtitulo: p.subtitulo } as Participante)

  const row = (ref: string) => {
    const r = resolveRef(ref, slots, nomePorId)
    const cab = r.pid != null && cabecas.has(r.pid)
    return (
      <div className={`em-mt-row${ref === 'BYE' ? ' bye' : ''}`}>
        <span className="seed">{r.seed ?? ''}</span>
        <span className="nm">{r.nome ?? r.label}</span>
        {cab && <Crown size={14} style={{ color: 'var(--warn)', flexShrink: 0 }} />}
      </div>
    )
  }

  return (
    <div className="em-bracket-ov" id={`bracket-${modalidade.id}`} data-open="false">
      <div className="em-bk-head">
        <div className="tt"><b>{modalidade.nome}</b><span>Chave sorteada</span></div>
        <button type="button" className="em-bk-close" data-bracket-close aria-label="Fechar"><X size={18} /></button>
      </div>
      <div className="em-bk-body">
        <div className="em-vtog">
          <button type="button" data-view="fase" data-on="true"><ListOrdered size={15} /> Por fase</button>
          <button type="button" data-view="arvore"><GitFork size={15} /> Chaveamento</button>
        </div>

        {/* Pane: Por fase */}
        <div className="em-pane" data-pane="fase" data-on="true">
          <div className="em-rtabs">
            {rounds.map((r) => (
              <button type="button" className="em-rtab" key={r} data-round={r} data-on={r === maxRound}>
                {roundLabel(r, maxRound)} <span className="n">{matches.filter((m) => m.round === r && !isBye(m)).length}</span>
              </button>
            ))}
          </div>
          {rounds.map((r) => {
            const reais = matches.filter((m) => m.round === r && !isBye(m))
            const byes = matches.filter((m) => m.round === r && isBye(m))
            return (
              <div className="em-round" data-round={r} data-on={r === maxRound} key={r}>
                {byes.length > 0 && (
                  <div className="em-byes">
                    <div className="bh"><Crown size={14} /> Classificados direto (bye)</div>
                    <div className="bl">{byes.map((m) => {
                      const ref = m.top === 'BYE' ? m.bottom : m.top
                      const rr = resolveRef(ref, slots, nomePorId)
                      return <span className="bch" key={m.id}><span className="s">{rr.seed ?? ''}</span>{rr.nome ?? rr.label}</span>
                    })}</div>
                  </div>
                )}
                {reais.map((m) => {
                  const ph = m.id === graph.final ? 'Final' : (graph.thirdPlace && m.id === graph.thirdPlace ? 'Disputa de 3º' : null)
                  return (
                    <div className={`em-mt${m.id === graph.final ? ' final' : ''}`} key={m.id}>
                      <div className="em-mt-cap"><span className="lab">{m.id}</span>{ph && <span className="em-mt-ph">{ph}</span>}</div>
                      {row(m.top)}
                      {row(m.bottom)}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Pane: Chaveamento (árvore — reusa SorteioChaves/BracketTree) */}
        <div className="em-pane" data-pane="arvore">
          <div className="em-tree-wrap">
            <SorteioChaves resultado={res} participantesById={participantesById} large cabecasPids={cabecas} />
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd frontend && npx vitest run src/site-publico/components/BracketView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/site-publico/components/BracketView.tsx frontend/src/site-publico/components/BracketView.test.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): BracketView (Por fase + Chaveamento, sem vencedores)"
```

---

### Task 4: Integração na `EventoPage` (botão + overlay + script)

**Files:**
- Modify: `frontend/src/site-publico/pages/EventoPage.tsx`
- Test: `frontend/src/site-publico/EventoPage-bracket.test.tsx` (criar)

**Interfaces:** Consumes `BracketView` (Task 3).

- [ ] **Step 1: Teste (falha primeiro)**

Criar `frontend/src/site-publico/EventoPage-bracket.test.tsx`:
```tsx
import { it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoPage from './pages/EventoPage'
import type { SnapEvento, SnapModalidade } from './snapshot-types'

function modChaves(over: Partial<SnapModalidade> = {}): SnapModalidade {
  return { id: 7, nome: 'Judô', grupo: null, tipo: 'chaves', status: 'sorteado', seed: null, anfitriaoId: null,
    cabecasPids: [], campeoes: [], participantes: [{ id: 1, nome: 'A', subtitulo: null }, { id: 2, nome: 'B', subtitulo: null }],
    mensagens_inscritos: [], resultado: { size: 2, slots: [1, 2], byePositions: [],
      matchesGraph: { final: 'J1', thirdPlace: null, matches: [{ id: 'J1', round: 1, top: 'P1', bottom: 'P2' }] } } } as any
}
const base = (mods: SnapModalidade[]): SnapEvento => ({ id: 3, nome: 'E', competicao: 'C', status: 'sorteado',
  cidade: 'X', local: 'L', data: '2026-06-18T00:00:00.000Z', organizador: null, publicadoEm: '', dataInicio: null, dataFim: null,
  boletins: [], modalidades: mods } as any)

it('mostra "Ver chave" e o overlay para chaves+sorteado com matchesGraph', () => {
  const html = renderToStaticMarkup(<EventoPage evento={base([modChaves()])} />)
  expect(html).toContain('Ver chave')
  expect(html).toContain('id="bracket-7"')
  expect(html).toContain('data-bracket="7"') // botão de abrir
})
it('não mostra "Ver chave" para modalidade aguardando', () => {
  const html = renderToStaticMarkup(<EventoPage evento={base([modChaves({ status: 'aguardando', resultado: null } as any)])} />)
  expect(html).not.toContain('Ver chave')
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/site-publico/EventoPage-bracket.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar na `EventoPage.tsx`**

a) Import: `import BracketView from '../components/BracketView'`.

b) Helper local para elegibilidade:
```tsx
const temChave = (m: SnapModalidade) => m.tipo === 'chaves' && m.status === 'sorteado' && !!(m.resultado as any)?.matchesGraph?.matches?.length
```

c) No corpo da modalidade (`.mod-body`), logo após `<ModalidadeSorteio modalidade={m} />`, quando `temChave(m)`, adicionar o botão:
```tsx
{temChave(m) && (
  <button type="button" className="btn btn-secondary" data-bracket={m.id} style={{ marginTop: 10 }}>Ver chave</button>
)}
```

d) Renderizar os overlays (um por modalidade elegível) ao final do `<main>` (antes de fechar), e o `<script>` de controle:
```tsx
{evento.modalidades.filter(temChave).map((m) => <BracketView key={m.id} modalidade={m} />)}
<script dangerouslySetInnerHTML={{ __html:
  "document.querySelectorAll('[data-bracket]').forEach(function(b){b.addEventListener('click',function(){var o=document.getElementById('bracket-'+b.getAttribute('data-bracket'));if(o)o.setAttribute('data-open','true')})});" +
  "document.querySelectorAll('.em-bracket-ov').forEach(function(o){" +
  "o.querySelectorAll('[data-bracket-close]').forEach(function(c){c.addEventListener('click',function(){o.setAttribute('data-open','false')})});" +
  "o.querySelectorAll('.em-vtog button[data-view]').forEach(function(v){v.addEventListener('click',function(){var view=v.getAttribute('data-view');o.querySelectorAll('.em-vtog button[data-view]').forEach(function(x){x.setAttribute('data-on',String(x===v))});o.querySelectorAll('.em-pane').forEach(function(p){p.setAttribute('data-on',String(p.getAttribute('data-pane')===view))})})});" +
  "o.querySelectorAll('.em-rtab[data-round]').forEach(function(t){t.addEventListener('click',function(){var rd=t.getAttribute('data-round');o.querySelectorAll('.em-rtab[data-round]').forEach(function(x){x.setAttribute('data-on',String(x.getAttribute('data-round')===rd))});o.querySelectorAll('.em-round[data-round]').forEach(function(p){p.setAttribute('data-on',String(p.getAttribute('data-round')===rd))})})});" +
  "});" +
  "document.addEventListener('keydown',function(e){if(e.key==='Escape')document.querySelectorAll('.em-bracket-ov[data-open=\"true\"]').forEach(function(o){o.setAttribute('data-open','false')})});"
}} />
```
(Sem dados de usuário interpolados no script.)

- [ ] **Step 4: Rodar testes + build**

Run: `cd frontend && npx vitest run src/site-publico && npm run build:site`
Expected: PASS; build sem erros.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/site-publico/pages/EventoPage.tsx frontend/src/site-publico/EventoPage-bracket.test.tsx
git -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): botao Ver chave + overlay do visualizador na EventoPage"
```

---

## Verificação final (após as 4 tasks)

- [ ] `cd frontend && npx vitest run src/site-publico && npm run build:site` verdes.
- [ ] **Demo (screenshots) antes do merge na develop**: num evento real com chave (ex.: `evento-1.html`, Judô), clicar "Ver chave" → overlay; alternar "Por fase" (abas, byes) e "Chaveamento" (árvore); desktop e mobile.
- [ ] Após aprovação: merge `feat/bracket-view` → develop (só arquivos esperados, sem `git add -A`), push, monitorar deploy.

## Self-Review (cobertura da spec)
- resolveRef (P/V/L/BYE): Task 1 ✓.
- CSS `.em-*` overlay fixed (sem `.em-champ`/árvore do protótipo): Task 2 ✓.
- BracketView (Por fase abas/byes/rótulos; Chaveamento reusa SorteioChaves/BracketTree; sem vencedores/campeão): Task 3 ✓.
- Entrada "Ver chave" + overlay + script (abrir/fechar/visão/abas) só em chaves+sorteado: Task 4 ✓.
- SSG (interatividade via script inline); sem cores novas; demo antes da develop ✓.
