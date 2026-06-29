# Reskin de Boletins (admin + site público) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar o design hi-fi do handoff aos Boletins — painel+modal no admin e seção "Boletins & documentos" (destaque + lista agrupada por tipo) no site público — alinhando o conjunto de tipos ao design.

**Architecture:** Troca do enum `CategoriaBoletim` para o conjunto do design; um mapa único de categoria (label/badge/swatch/grupo) compartilhado por admin e público; recriação visual de `EventoBoletins.tsx` (painel `.card` + modal) e da seção pública em `EventoPage.tsx`, reusando o design system existente (`tokens.css`/`prosports-theme.css`/`site.css`) + CSS portado dos protótipos. Sem mudança nas rotas/serviço de upload já existentes.

**Tech Stack:** React 18 + TS + Vite, lucide-react; backend Express + Prisma (Postgres); SSG (renderToStaticMarkup) no site público; Vitest.

**Spec:** `docs/superpowers/specs/2026-06-27-boletins-reskin-design.md`
**Fonte pixel-perfect:** `personaladmin/handoff/design_handoff_boletins/Boletins-admin.html` e `Boletins-publico.html`.

## Global Constraints

- Escopo: **visual + tipos**. FORA: status Publicado/Rascunho, contagem de páginas, auditoria real (texto "Registrado em auditoria" é decorativo).
- Tipos (enum): `Oficial, Regulamento, Resultados, Convocacao, ComunicadoErrata`. Labels/badges: Oficial→`b-brand`, Regulamento→`b-violet`, Resultados→`b-success`, Convocação→`b-warn`, Comunicado/Errata→`b-neutral`.
- Reusar classes do design system (`.card .btn .btn-primary .btn-ghost .btn-lg .badge .b-* .eyebrow .sec-title .dot .section .sec-head .sec-eyebrow`). Adicionar só o que falta (`.b-neutral`, `.ibtn-sm`, `.sep`, `.bol-*`, modal, `.doc-*`).
- Datas no público/admin: `toLocaleDateString('pt-BR', { timeZone: 'UTC' })`.
- Host Windows; ler antes de editar; caminhos absolutos com `git -C`. Git identity inline (`-c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com"`). Dev tem 0 boletins; prod não tem a feature → enum sem migração de dados. Abortar migration se Prisma propor reset/drift destrutivo.
- Validar: backend `npx tsc --noEmit` + `npx vitest run`; frontend `npm run build` e `npm run build:site`.

---

### Task 1: Enum de tipos + validação (backend)

**Files:**
- Modify: `backend/prisma/schema.prisma` (enum `CategoriaBoletim`)
- Create (gerado): `backend/prisma/migrations/<ts>_boletim_categorias_design/migration.sql`
- Modify: `backend/src/modules/boletins/boletins.controller.ts` (z.enum)

**Interfaces:**
- Produces: enum `CategoriaBoletim` = Oficial|Regulamento|Resultados|Convocacao|ComunicadoErrata; zod aceita esses 5 valores.

- [ ] **Step 1: Trocar o enum no schema**

Em `backend/prisma/schema.prisma`, substituir o bloco `enum CategoriaBoletim { ... }` por:
```prisma
enum CategoriaBoletim {
  Oficial
  Regulamento
  Resultados
  Convocacao
  ComunicadoErrata
}
```

- [ ] **Step 2: Gerar a migration**

Run: `cd backend && npx prisma migrate dev --name boletim_categorias_design`
Expected: aplica sem reset; cria o tipo enum novo / altera. Inspecionar o `migration.sql`: deve recriar/alterar o enum `CategoriaBoletim`. NÃO deve conter `DROP TABLE "Boletim"`. (Se o Prisma propuser reset por causa de valores antigos em uso — não há dados — abortar e reportar.)

- [ ] **Step 3: Atualizar o zod do controller**

Em `backend/src/modules/boletins/boletins.controller.ts`, trocar a linha das categorias por:
```ts
const CATEGORIAS = ['Oficial','Regulamento','Resultados','Convocacao','ComunicadoErrata'] as const
```
(o `criarSchema` já usa `z.enum(CATEGORIAS)`).

- [ ] **Step 4: Typecheck + suite**

Run: `cd backend && npx tsc --noEmit && npx vitest run src/modules/boletins`
Expected: sem erros; testes de boletins passam (o service não referencia valores específicos do enum).

- [ ] **Step 5: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add backend/prisma backend/src/modules/boletins/boletins.controller.ts
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(boletins): tipos do design (Oficial/Regulamento/Resultados/Convocacao/ComunicadoErrata)"
```

---

### Task 2: Snapshot inclui `tamanho` do boletim

**Files:**
- Modify: `backend/src/modules/site-publico/snapshot.ts` (EventoRow.boletins + map)
- Modify: `backend/src/modules/site-publico/snapshot-types.ts` (SnapEvento.boletins)
- Modify: `frontend/src/site-publico/snapshot-types.ts` (SnapEvento.boletins)
- Modify: `backend/src/modules/site-publico/site-publico.service.ts` (select boletins)
- Modify: `backend/src/modules/site-publico/snapshot.test.ts` (asserir tamanho)

**Interfaces:**
- Produces: `SnapEvento.boletins[]` ganha `tamanho: number` (bytes). Usado pelo público para exibir o tamanho.

- [ ] **Step 1: Atualizar tipos (backend + frontend)**

Em `backend/src/modules/site-publico/snapshot-types.ts` e `frontend/src/site-publico/snapshot-types.ts`, no `boletins` de `SnapEvento`, adicionar `tamanho: number`:
```ts
boletins: { numero: number; titulo: string; categoria: string; data: string; url: string; tamanho: number }[]
```

- [ ] **Step 2: Atualizar teste do snapshot**

Em `backend/src/modules/site-publico/snapshot.test.ts`, no boletim do input adicionar `size_bytes` e asserir o mapeamento. No teste "inclui boletins e datas...", trocar os boletins do input por (com `size_bytes`):
```ts
boletins: [
  { numero: 2, titulo: 'B2', categoria: 'Comunicado', data_publicacao: new Date('2026-07-02'), public_url: 'http://vm/2.pdf', size_bytes: 2048 },
  { numero: 1, titulo: 'B1', categoria: 'Resultados', data_publicacao: new Date('2026-07-01'), public_url: 'http://vm/1.pdf', size_bytes: 1024 },
],
```
e adicionar a asserção:
```ts
expect(snap.boletins[0]).toMatchObject({ titulo: 'B1', categoria: 'Resultados', url: 'http://vm/1.pdf', tamanho: 1024 })
```

- [ ] **Step 3: Rodar (deve falhar)**

Run: `cd backend && npx vitest run src/modules/site-publico/snapshot.test.ts`
Expected: FAIL (`tamanho` undefined).

- [ ] **Step 4: Implementar no montaSnapshot + select**

Em `backend/src/modules/site-publico/snapshot.ts`, no type `EventoRow.boletins`, adicionar `size_bytes: number`; no `.map(b => ({...}))` dos boletins, adicionar `tamanho: b.size_bytes`.

Em `backend/src/modules/site-publico/site-publico.service.ts`, no `select` de `boletins` dentro do `findUnique`, adicionar `size_bytes: true`.

- [ ] **Step 5: Rodar (deve passar) + typecheck + build frontend**

Run: `cd backend && npx vitest run src/modules/site-publico/snapshot.test.ts && npx tsc --noEmit`
Run: `cd frontend && npm run build`
Expected: PASS; sem erros.

- [ ] **Step 6: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add backend/src/modules/site-publico frontend/src/site-publico/snapshot-types.ts
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): snapshot inclui tamanho do boletim"
```

---

### Task 3: Mapa de categorias + helper de bytes (frontend)

**Files:**
- Create: `frontend/src/lib/boletim-categorias.ts`

**Interfaces:**
- Produces: `CategoriaBoletimValor`, `CATEGORIAS_BOLETIM` (array), `categoriaInfo(v)`, `formatBytes(n)`.

- [ ] **Step 1: Criar o módulo**

Criar `frontend/src/lib/boletim-categorias.ts`:
```ts
export type CategoriaBoletimValor =
  | 'Oficial' | 'Regulamento' | 'Resultados' | 'Convocacao' | 'ComunicadoErrata'

export type CategoriaInfo = {
  value: CategoriaBoletimValor
  label: string
  grupo: string
  badgeClass: string
  swatch: string
}

export const CATEGORIAS_BOLETIM: CategoriaInfo[] = [
  { value: 'Oficial',          label: 'Oficial',              grupo: 'Oficiais',    badgeClass: 'b-brand',   swatch: 'var(--brand-500)' },
  { value: 'Regulamento',      label: 'Regulamento',          grupo: 'Regulamento', badgeClass: 'b-violet',  swatch: '#8b5cf6' },
  { value: 'Resultados',       label: 'Resultados',           grupo: 'Resultados',  badgeClass: 'b-success', swatch: 'var(--accent)' },
  { value: 'Convocacao',       label: 'Convocação',           grupo: 'Convocação',  badgeClass: 'b-warn',    swatch: 'var(--warn)' },
  { value: 'ComunicadoErrata', label: 'Comunicado / Errata',  grupo: 'Comunicados', badgeClass: 'b-neutral', swatch: 'var(--t4)' },
]

export function categoriaInfo(v: string): CategoriaInfo {
  return CATEGORIAS_BOLETIM.find((c) => c.value === v) ?? CATEGORIAS_BOLETIM[0]
}

export function formatBytes(n: number): string {
  if (!n || n < 1024) return `${n || 0} B`
  const kb = n / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1).replace('.', ',')} MB`
}

export function dataPtBr(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc -b`
Expected: sem erros.

- [ ] **Step 3: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/lib/boletim-categorias.ts
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(boletins): mapa de categorias + helpers (label/badge/swatch/bytes)"
```

---

### Task 4: CSS do admin (boletins.css)

**Files:**
- Create: `frontend/src/styles/boletins.css`
- Modify: `frontend/src/main.tsx` (import do css)

**Interfaces:**
- Produces: classes `.bol-head .bol-list .bol-row .pdf .acts .ibtn-sm .sep .badge.b-neutral` + modal `.overlay .modal .mh .mb .mf .field .req .fake-select .type-menu .type-opt .bol-drop .file-chip` + `.toast`.

- [ ] **Step 1: Criar o CSS (portado do protótipo admin, sem itens de rascunho/status)**

Criar `frontend/src/styles/boletins.css`:
```css
.ic { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

.bol-head { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 18px; }
.bol-head .ic-tile { width: 42px; height: 42px; border-radius: 12px; background: var(--grad-brand); color: #fff; display: grid; place-items: center; box-shadow: var(--shadow-brand); flex-shrink: 0; }
.bol-head .ic-tile svg { width: 21px; height: 21px; }
.bol-head .count { font-size: 12.5px; color: var(--t3); margin-top: 3px; }
.bol-head .spacer { flex: 1; }

.bol-list { display: flex; flex-direction: column; }
.bol-row { display: flex; align-items: center; gap: 14px; padding: 13px 14px; border: 1px solid var(--card-border); border-radius: 14px; background: var(--card-bg); transition: border-color var(--duration-fast), box-shadow var(--duration-fast); }
.bol-row + .bol-row { margin-top: 9px; }
.bol-row:hover { border-color: var(--t4); box-shadow: var(--shadow-e1); }
.pdf { width: 38px; height: 46px; border-radius: 8px; background: linear-gradient(160deg,#fef2f2,#fee2e2); border: 1px solid #fecaca; color: #dc2626; display: grid; place-items: center; flex-shrink: 0; position: relative; }
.pdf::after { content: "PDF"; position: absolute; bottom: 4px; left: 0; right: 0; text-align: center; font: 800 7px/1 var(--font-mono); letter-spacing: 0.05em; }
.pdf svg { width: 16px; height: 16px; margin-bottom: 5px; }
.bol-row .body { flex: 1; min-width: 0; }
.bol-row .num { font: 700 11px/1 var(--font-mono); color: var(--t4); letter-spacing: 0.03em; }
.bol-row .ttl { font-size: 14px; font-weight: 700; color: var(--t1); margin-top: 3px; overflow-wrap: anywhere; }
.bol-row .meta { font-size: 11.5px; color: var(--t3); margin-top: 5px; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.bol-row .meta .sep, .sep { width: 3px; height: 3px; border-radius: 50%; background: var(--t4); opacity: 0.7; display: inline-block; }
.bol-row .right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.acts { display: flex; gap: 4px; position: relative; }
.ibtn-sm { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; cursor: pointer; border: 1px solid transparent; background: transparent; color: var(--t3); transition: background var(--duration-fast), color var(--duration-fast); }
.ibtn-sm:hover { background: var(--card-bg-2); color: var(--t1); border-color: var(--card-border); }
.ibtn-sm svg { width: 17px; height: 17px; }
.kebab-menu { position: absolute; top: calc(100% + 4px); right: 0; z-index: 5; padding: 6px; border-radius: 11px; background: var(--card-bg); border: 1px solid var(--card-border); box-shadow: var(--shadow-e3); min-width: 140px; }
.kebab-menu button { display: flex; width: 100%; gap: 8px; align-items: center; padding: 8px 10px; border: none; background: transparent; cursor: pointer; border-radius: 8px; font: 600 13px/1 var(--font-sans); color: var(--danger, #dc2626); text-align: left; }
.kebab-menu button:hover { background: var(--card-bg-2); }

.bol-empty { border: 1.6px dashed var(--card-border); border-radius: 16px; padding: 34px; text-align: center; color: var(--t3); display: flex; flex-direction: column; align-items: center; gap: 10px; }

.badge.b-neutral { background: var(--card-bg-2); color: var(--t3); border: 1px solid var(--card-border); }

.field { display: flex; flex-direction: column; gap: 6px; }
.field > label { font-size: 11.5px; font-weight: 600; color: var(--t2); }
.req { color: var(--brand-500); }
.lg-input { width: 100%; box-sizing: border-box; border: 1.5px solid var(--input-border); background: var(--input-bg); color: var(--t1); padding: 11px 13px; border-radius: 12px; font: 600 13.5px/1 var(--font-sans); }
.lg-input:focus { outline: none; border-color: var(--brand-500); }
.fake-select, .fake-date { width: 100%; box-sizing: border-box; display: flex; align-items: center; gap: 9px; border: 1.5px solid var(--input-border); background: var(--input-bg); color: var(--t1); padding: 11px 13px; border-radius: 12px; font: 600 13.5px/1 var(--font-sans); cursor: pointer; transition: border-color var(--duration-fast); position: relative; }
.fake-select:hover { border-color: var(--t4); }
.fake-select .chev { margin-left: auto; color: var(--t4); }
.fake-select .swatch, .type-opt .swatch { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }
.type-menu { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 5; padding: 6px; border-radius: 13px; background: var(--card-bg); border: 1px solid var(--card-border); box-shadow: var(--shadow-e3); }
.type-opt { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border-radius: 9px; border: none; background: transparent; cursor: pointer; font: 600 13px/1 var(--font-sans); color: var(--t1); text-align: left; }
.type-opt:hover { background: var(--card-bg-2); }

.bol-drop { display: flex; align-items: center; gap: 14px; border: 1.6px dashed var(--card-border); border-radius: 14px; padding: 16px 18px; background: var(--card-bg); cursor: pointer; transition: border-color var(--duration-fast), background var(--duration-fast); }
.bol-drop:hover, .bol-drop.drag { border-color: var(--brand-500); background: var(--brand-50); }
.bol-drop .dz-ic { width: 44px; height: 44px; border-radius: 12px; background: var(--card-bg-2); border: 1px solid var(--card-border); color: var(--brand-500); display: grid; place-items: center; flex-shrink: 0; }
.bol-drop .dz-ic svg { width: 21px; height: 21px; }
.bol-drop .t { font-size: 13.5px; font-weight: 700; color: var(--t1); }
.bol-drop .s { font-size: 11.5px; color: var(--t3); margin-top: 3px; }
.file-chip { display: flex; align-items: center; gap: 13px; border: 1px solid var(--card-border); border-radius: 14px; padding: 12px 14px; background: var(--card-bg); }
.file-chip .pdf { width: 36px; height: 44px; }
.file-chip .name { font-size: 13px; font-weight: 700; color: var(--t1); overflow-wrap: anywhere; }
.file-chip .fmeta { font-size: 11.5px; color: var(--t3); margin-top: 2px; }
.file-chip .x { margin-left: auto; }

.overlay { position: fixed; inset: 0; background: rgba(8,12,21,0.46); backdrop-filter: blur(3px); display: grid; place-items: start center; padding: 56px 20px; z-index: 60; opacity: 0; pointer-events: none; transition: opacity var(--duration-base); }
.overlay.open { opacity: 1; pointer-events: auto; }
.modal { width: 460px; max-width: 100%; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 20px; box-shadow: var(--shadow-e3); overflow: visible; transform: translateY(8px) scale(0.99); transition: transform var(--duration-base) var(--ease-spring); }
.overlay.open .modal { transform: none; }
.modal .mh { display: flex; align-items: center; gap: 13px; padding: 20px 22px; border-bottom: 1px solid var(--hairline); }
.modal .mh .mi { width: 40px; height: 40px; border-radius: 11px; background: var(--grad-brand); color: #fff; display: grid; place-items: center; box-shadow: var(--shadow-brand); }
.modal .mh .mi svg { width: 20px; height: 20px; }
.modal .mb { padding: 20px 22px; display: flex; flex-direction: column; gap: 13px; }
.modal .mf { display: flex; align-items: center; gap: 10px; padding: 16px 22px; border-top: 1px solid var(--hairline); background: var(--card-bg-2); }
.modal .mf .hint { font-size: 11.5px; color: var(--t4); display: inline-flex; align-items: center; gap: 6px; }
.modal .mf .grow { flex: 1; }
.modal .mf svg { width: 13px; height: 13px; }
.grid-num-title { display: grid; grid-template-columns: 110px 1fr; gap: 12px; }
.grid-tipo-data { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.toast { position: fixed; bottom: 26px; left: 50%; transform: translateX(-50%) translateY(20px); z-index: 80; display: flex; align-items: center; gap: 10px; padding: 12px 18px; border-radius: 13px; background: var(--card-bg); border: 1px solid var(--card-border); box-shadow: var(--shadow-e3); font-size: 13px; font-weight: 600; color: var(--t1); opacity: 0; pointer-events: none; transition: opacity var(--duration-base), transform var(--duration-base) var(--ease-spring); }
.toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
.toast .tk { width: 24px; height: 24px; border-radius: 8px; background: var(--grad-accent); color: #fff; display: grid; place-items: center; }
.toast .tk svg { width: 14px; height: 14px; }

@media (max-width: 560px) {
  .bol-head { flex-wrap: wrap; }
  .bol-head .pub-btn { flex-basis: 100%; justify-content: center; margin-top: 6px; }
  .bol-row { flex-wrap: wrap; padding: 12px; }
  .bol-row .body { flex-basis: calc(100% - 52px); }
  .bol-row .right { width: 100%; justify-content: flex-end; margin-top: 2px; padding-left: 52px; }
  .overlay { padding: 0; align-items: stretch; }
  .modal { width: 100%; max-width: 100%; min-height: 100%; border-radius: 0; display: flex; flex-direction: column; }
  .modal .mb { flex: 1; }
  .grid-num-title { grid-template-columns: 90px 1fr; }
}
```

- [ ] **Step 2: Importar no main.tsx**

Em `frontend/src/main.tsx`, após `import './styles/prosports-theme.css'`, adicionar:
```ts
import './styles/boletins.css'
```

- [ ] **Step 3: Build**

Run: `cd frontend && npm run build`
Expected: sem erros.

- [ ] **Step 4: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/styles/boletins.css frontend/src/main.tsx
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(boletins): css do painel/modal de boletins (admin)"
```

---

### Task 5: Admin — recriar `EventoBoletins.tsx` (painel + modal)

**Files:**
- Modify (rewrite): `frontend/src/pages/eventos/EventoBoletins.tsx`

**Interfaces:**
- Consumes: `boletinsService` (`listar/enviar/remover`) de `../../services/boletins`; `CATEGORIAS_BOLETIM, categoriaInfo, formatBytes, dataPtBr` de `../../lib/boletim-categorias`; classes do Task 4; `lucide-react`.

- [ ] **Step 1: Reescrever o componente**

Substituir todo o conteúdo de `frontend/src/pages/eventos/EventoBoletins.tsx` por:
```tsx
import { useEffect, useRef, useState } from 'react'
import { FileText, Plus, Download, MoreHorizontal, X, Check, ChevronDown, Calendar, Upload, Lock, Trash2 } from 'lucide-react'
import { boletinsService, type Boletim } from '../../services/boletins'
import { CATEGORIAS_BOLETIM, categoriaInfo, formatBytes, dataPtBr } from '../../lib/boletim-categorias'

export default function EventoBoletins({ eventoId, eventoNome }: { eventoId: number; eventoNome?: string }) {
  const [docs, setDocs] = useState<Boletim[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [kebab, setKebab] = useState<number | null>(null)

  async function load() { setDocs(await boletinsService.listar(eventoId)) }
  useEffect(() => { load() }, [eventoId])
  useEffect(() => {
    const close = () => setKebab(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2600) }

  async function onRemove(id: number) {
    setKebab(null)
    if (!confirm('Remover este boletim?')) return
    try { await boletinsService.remover(eventoId, id); await load() } catch { showToast('Falha ao remover') }
  }

  const ordenados = [...docs].sort((a, b) => b.numero - a.numero)

  return (
    <div className="card" style={{ padding: 24, marginTop: 24 }}>
      <div className="bol-head">
        <div className="ic-tile"><FileText size={21} /></div>
        <div>
          <div className="eyebrow">Documentos do evento</div>
          <h3 className="sec-title" style={{ fontSize: 19 }}>Boletins</h3>
          <div className="count">{docs.length} publicado{docs.length === 1 ? '' : 's'}{eventoNome ? ` — ${eventoNome}` : ''}</div>
        </div>
        <div className="spacer" />
        <button className="btn btn-primary pub-btn" onClick={() => setModalOpen(true)}><Plus size={18} /> Publicar boletim</button>
      </div>

      {ordenados.length === 0 ? (
        <div className="bol-empty">
          <FileText size={28} />
          <div>Nenhum boletim publicado</div>
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}><Plus size={18} /> Publicar primeiro boletim</button>
        </div>
      ) : (
        <div className="bol-list">
          {ordenados.map((d) => {
            const info = categoriaInfo(d.categoria)
            return (
              <div className="bol-row" key={d.id}>
                <div className="pdf"><FileText size={16} /></div>
                <div className="body">
                  <div className="num">Nº {String(d.numero).padStart(3, '0')}</div>
                  <div className="ttl">{d.titulo}</div>
                  <div className="meta">
                    <span className={`badge ${info.badgeClass}`}>{info.label}</span>
                    <span className="sep" />{dataPtBr(d.data_publicacao)}
                    <span className="sep" />{formatBytes(d.size_bytes)}
                  </div>
                </div>
                <div className="right">
                  <div className="acts" onClick={(e) => e.stopPropagation()}>
                    <a className="ibtn-sm" href={d.public_url} target="_blank" rel="noopener noreferrer" title="Baixar"><Download size={17} /></a>
                    <button className="ibtn-sm" title="Mais" onClick={() => setKebab(kebab === d.id ? null : d.id)}><MoreHorizontal size={17} /></button>
                    {kebab === d.id && (
                      <div className="kebab-menu"><button onClick={() => onRemove(d.id)}><Trash2 size={15} /> Remover</button></div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && (
        <PublicarModal
          eventoId={eventoId}
          eventoNome={eventoNome}
          onClose={() => setModalOpen(false)}
          onPublished={async () => { setModalOpen(false); await load(); showToast('Boletim publicado') }}
        />
      )}

      {toast && (
        <div className="toast show"><span className="tk"><Check size={14} /></span> {toast}</div>
      )}
    </div>
  )
}

function PublicarModal({ eventoId, eventoNome, onClose, onPublished }: {
  eventoId: number; eventoNome?: string; onClose: () => void; onPublished: () => void
}) {
  const [numero, setNumero] = useState('')
  const [titulo, setTitulo] = useState('')
  const [categoria, setCategoria] = useState(CATEGORIAS_BOLETIM[0].value)
  const [data, setData] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [typeOpen, setTypeOpen] = useState(false)
  const [drag, setDrag] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const info = categoriaInfo(categoria)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function pick(f: File | null) {
    if (!f) return
    if (f.type !== 'application/pdf') { setErro('Apenas arquivos PDF.'); return }
    setErro(null); setFile(f)
  }

  async function publicar() {
    if (!file || !numero || !titulo || !data) { setErro('Preencha número, título, data e arquivo.'); return }
    setLoading(true); setErro(null)
    try {
      await boletinsService.enviar(eventoId, { numero: Number(numero), titulo, categoria, data_publicacao: data, file })
      onPublished()
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? 'Falha ao publicar')
    } finally { setLoading(false) }
  }

  return (
    <div className="overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="mh">
          <div className="mi"><FileText size={20} /></div>
          <div style={{ flex: 1 }}>
            <h3 className="sec-title" style={{ fontSize: 16 }}>Publicar boletim</h3>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>{eventoNome ?? ''}</div>
          </div>
          <button className="ibtn-sm" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="mb">
          <div className="grid-num-title">
            <div className="field"><label>Número <span className="req">*</span></label><input className="lg-input" value={numero} onChange={(e) => setNumero(e.target.value)} /></div>
            <div className="field"><label>Título <span className="req">*</span></label><input className="lg-input" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
          </div>
          <div className="grid-tipo-data">
            <div className="field">
              <label>Tipo <span className="req">*</span></label>
              <div className="fake-select" onClick={(e) => { e.stopPropagation(); setTypeOpen((v) => !v) }}>
                <span className="swatch" style={{ background: info.swatch }} />
                <span>{info.label}</span>
                <ChevronDown size={16} className="chev" />
                {typeOpen && (
                  <div className="type-menu" onClick={(e) => e.stopPropagation()}>
                    {CATEGORIAS_BOLETIM.map((c) => (
                      <button key={c.value} className="type-opt" onClick={() => { setCategoria(c.value); setTypeOpen(false) }}>
                        <span className="swatch" style={{ background: c.swatch }} /> {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="field"><label>Data <span className="req">*</span></label>
              <input className="lg-input" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Arquivo PDF <span className="req">*</span></label>
            <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            {file ? (
              <div className="file-chip">
                <div className="pdf"><FileText size={14} /></div>
                <div><div className="name">{file.name}</div><div className="fmeta">{formatBytes(file.size)}</div></div>
                <button className="ibtn-sm x" onClick={() => setFile(null)}><X size={16} /></button>
              </div>
            ) : (
              <div
                className={`bol-drop${drag ? ' drag' : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0] ?? null) }}
              >
                <div className="dz-ic"><Upload size={21} /></div>
                <div><div className="t">Arraste o PDF ou clique para selecionar</div><div className="s">Apenas .pdf · até 25 MB</div></div>
              </div>
            )}
          </div>
          {erro && <p style={{ color: 'var(--danger, crimson)', fontSize: 12, margin: 0 }}>{erro}</p>}
        </div>
        <div className="mf">
          <span className="hint"><Lock size={13} /> Registrado em auditoria</span>
          <span className="grow" />
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={loading} onClick={publicar}><Check size={16} /> {loading ? 'Publicando…' : 'Publicar'}</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Passar `eventoNome` no uso (EventoForm)**

Em `frontend/src/pages/eventos/EventoForm.tsx`, onde renderiza `<EventoBoletins eventoId={Number(id)} />`, passar também o nome do evento se disponível no form (ex.: `nome` do estado). Se não houver um nome em estado acessível, manter só `eventoId` (o componente trata `eventoNome` opcional):
```tsx
{isEdit && <EventoBoletins eventoId={Number(id)} eventoNome={nome} />}
```
(usar a variável de nome real do form; se o nome não estiver em escopo, omitir a prop.)

- [ ] **Step 3: Build**

Run: `cd frontend && npm run build`
Expected: `tsc -b && vite build` sem erros.

- [ ] **Step 4: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/pages/eventos/EventoBoletins.tsx frontend/src/pages/eventos/EventoForm.tsx
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(admin): painel de boletins + modal de publicacao (reskin)"
```

---

### Task 6: CSS público (`site.css`) — `.doc-*`

**Files:**
- Modify: `frontend/src/site-publico/site.css` (adicionar classes)

**Interfaces:**
- Produces: `.doc-layout .doc-feature .doc-list .doc-group-lbl .doc-card .dl .badge.b-neutral` + responsivo.

- [ ] **Step 1: Adicionar o CSS (portado do protótipo público)**

Em `frontend/src/site-publico/site.css`, ao final, adicionar:
```css
.doc-layout { display: grid; grid-template-columns: 380px 1fr; gap: 28px; align-items: start; }
.doc-feature { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 20px; padding: 26px; box-shadow: var(--shadow-e2); position: sticky; top: 92px; }
.doc-feature .flag { font-size: 10.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--brand-500); display: inline-flex; align-items: center; gap: 8px; }
.doc-feature .flag .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 10px var(--accent); }
.doc-feature .big-pdf { width: 88px; height: 108px; border-radius: 14px; margin: 22px 0 20px; position: relative; background: linear-gradient(160deg, #fef2f2, #fee2e2); border: 1px solid #fecaca; color: #dc2626; display: grid; place-items: center; box-shadow: 0 16px 36px -16px rgba(220,38,38,0.4); }
.doc-feature .big-pdf svg { width: 34px; height: 34px; margin-bottom: 14px; }
.doc-feature .big-pdf::after { content: "PDF"; position: absolute; bottom: 14px; left: 0; right: 0; text-align: center; font: 800 11px/1 var(--font-mono); letter-spacing: 0.08em; }
.doc-feature h3 { font-family: var(--font-display); font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: var(--t1); margin: 0; line-height: 1.18; }
.doc-feature .fmeta { display: flex; flex-wrap: wrap; gap: 8px 16px; margin: 14px 0 22px; font-size: 13px; color: var(--t3); }
.doc-feature .fmeta .m { display: inline-flex; align-items: center; gap: 7px; }
.doc-feature .fmeta .m svg { width: 14px; height: 14px; color: var(--t4); }
.btn-block { width: 100%; }
.doc-list { display: grid; gap: 12px; }
.doc-group-lbl { font-size: 11px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--t4); margin: 10px 2px 2px; }
.doc-group-lbl:first-child { margin-top: 0; }
.doc-card { display: flex; align-items: center; gap: 16px; padding: 16px 18px; border-radius: 15px; background: var(--card-bg); border: 1px solid var(--card-border); box-shadow: var(--shadow-e1); transition: transform var(--duration-base) var(--ease-out), box-shadow var(--duration-base), border-color var(--duration-base); }
.doc-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-e3); border-color: var(--brand-400); }
.doc-card .pdf { width: 44px; height: 54px; border-radius: 9px; flex-shrink: 0; position: relative; background: linear-gradient(160deg, #fef2f2, #fee2e2); border: 1px solid #fecaca; color: #dc2626; display: grid; place-items: center; }
.doc-card .pdf svg { width: 18px; height: 18px; margin-bottom: 7px; }
.doc-card .pdf::after { content: "PDF"; position: absolute; bottom: 6px; left: 0; right: 0; text-align: center; font: 800 7.5px/1 var(--font-mono); letter-spacing: 0.06em; }
.doc-card .dc-main { flex: 1; min-width: 0; }
.doc-card .dc-num { font: 700 11px/1 var(--font-mono); color: var(--t4); letter-spacing: 0.04em; }
.doc-card .dc-title { font-family: var(--font-display); font-size: 15.5px; font-weight: 700; color: var(--t1); letter-spacing: -0.01em; margin-top: 5px; }
.doc-card .dc-meta { font-size: 12.5px; color: var(--t3); margin-top: 7px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.doc-card .dc-meta .sep { width: 3px; height: 3px; border-radius: 50%; background: var(--t4); opacity: 0.7; display: inline-block; }
.doc-card .dl { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; text-decoration: none; padding: 10px 16px; border-radius: 11px; font-size: 13px; font-weight: 700; background: var(--card-bg-2); border: 1px solid var(--card-border); color: var(--t1); transition: border-color var(--duration-fast), background var(--duration-fast), color var(--duration-fast); }
.doc-card .dl:hover { border-color: var(--brand-400); color: var(--brand-600); background: var(--brand-50); }
.doc-card .dl svg { width: 16px; height: 16px; }
.badge.b-neutral { background: var(--card-bg-2); color: var(--t3); border: 1px solid var(--card-border); }
@media (max-width: 940px) { .doc-layout { grid-template-columns: 1fr; gap: 20px; } .doc-feature { position: static; } }
@media (max-width: 560px) {
  .doc-feature { padding: 22px; }
  .doc-feature .big-pdf { width: 76px; height: 94px; margin: 18px 0 16px; }
  .doc-feature h3 { font-size: 20px; }
  .doc-card { flex-wrap: wrap; gap: 13px; padding: 14px; }
  .doc-card .dc-title { font-size: 15px; }
  .doc-card .dl { width: 100%; justify-content: center; margin-top: 4px; }
}
```
(`.b-violet` já existe no `theme-vars.css`/`prosports-theme.css`; se faltar no contexto público, adicionar `.badge.b-violet { background: color-mix(in srgb, #8b5cf6 14%, transparent); color: #7c3aed; }`.)

- [ ] **Step 2: Build do site**

Run: `cd frontend && npm run build:site`
Expected: sem erros.

- [ ] **Step 3: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/site-publico/site.css
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): css da secao Boletins & documentos"
```

---

### Task 7: Público — seção "Boletins & documentos" em `EventoPage.tsx` + teste

**Files:**
- Modify: `frontend/src/site-publico/pages/EventoPage.tsx` (substituir a seção de boletins)
- Modify: `frontend/src/site-publico/EventoPage-boletins.test.tsx` (novo markup)

**Interfaces:**
- Consumes: `evento.boletins` (`{numero,titulo,categoria,data,url,tamanho}`); `categoriaInfo, formatBytes, dataPtBr` de `../../lib/boletim-categorias`; `lucide-react` (`FileText, Download, Calendar`).

- [ ] **Step 1: Atualizar o teste para o novo markup**

Substituir o conteúdo de `frontend/src/site-publico/EventoPage-boletins.test.tsx` por:
```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import EventoPage from './pages/EventoPage'
import type { SnapEvento } from './snapshot-types'

const base: SnapEvento = {
  id: 1, nome: 'Ev', competicao: 'C', cidade: 'M', local: 'L',
  data: '2026-07-01T00:00:00.000Z', organizador: null, publicadoEm: '2026-07-01T00:00:00.000Z',
  dataInicio: '2026-07-01T00:00:00.000Z', dataFim: '2026-07-03T00:00:00.000Z',
  boletins: [
    { numero: 1, titulo: 'Abertura', categoria: 'Oficial', data: '2026-07-01T00:00:00.000Z', url: 'http://vm/1.pdf', tamanho: 2516582 },
    { numero: 2, titulo: 'Resultados R1', categoria: 'Resultados', data: '2026-07-02T00:00:00.000Z', url: 'http://vm/2.pdf', tamanho: 1258291 },
  ],
  modalidades: [],
}

describe('EventoPage boletins (reskin)', () => {
  it('mostra a seção, destaque (mais recente) e badges de tipo', () => {
    const html = renderToStaticMarkup(<EventoPage evento={base} />)
    expect(html).toContain('Boletins')
    expect(html).toContain('doc-feature')
    expect(html).toContain('http://vm/2.pdf') // destaque = numero 2 (data maior)
    expect(html).toContain('Resultados')
    expect(html).toContain('Oficial')
  })
  it('omite a seção quando não há boletins', () => {
    const html = renderToStaticMarkup(<EventoPage evento={{ ...base, boletins: [] }} />)
    expect(html).not.toContain('id="boletins-evento"')
  })
})
```

- [ ] **Step 2: Rodar (deve falhar)**

Run: `cd frontend && npx vitest run src/site-publico/EventoPage-boletins.test.tsx`
Expected: FAIL (markup antigo / sem `doc-feature`).

- [ ] **Step 3: Substituir a seção de boletins no EventoPage**

Em `frontend/src/site-publico/pages/EventoPage.tsx`:
- Adicionar imports no topo:
```tsx
import { FileText, Download, Calendar } from 'lucide-react'
import { CATEGORIAS_BOLETIM, categoriaInfo, formatBytes, dataPtBr } from '../../lib/boletim-categorias'
```
- Remover o bloco atual `{boletins.length > 0 && (() => { ... })()}` (a seção com chips de filtro e o `<script>`), e em seu lugar inserir:
```tsx
{boletins.length > 0 && (() => {
  const ordenados = [...boletins].sort((a, b) => +new Date(b.data) - +new Date(a.data))
  const destaque = ordenados[0]
  const di = categoriaInfo(destaque.categoria)
  return (
    <section id="boletins-evento" className="section">
      <div className="sec-head">
        <div className="sec-eyebrow">Acompanhe</div>
        <h2>Boletins &amp; documentos</h2>
        <p>Boletins oficiais, regulamento e resultados publicados pela organização. Baixe sempre a versão mais recente.</p>
      </div>
      <div className="doc-layout">
        <aside className="doc-feature">
          <div className="flag"><span className="dot" /> Último boletim</div>
          <div className="big-pdf"><FileText /></div>
          <span className={`badge ${di.badgeClass}`} style={{ marginBottom: 12 }}>{di.label}</span>
          <h3>{destaque.titulo}</h3>
          <div className="fmeta">
            <span className="m"><Calendar /> {dataPtBr(destaque.data)}</span>
            <span className="m"><FileText /> {formatBytes(destaque.tamanho)}</span>
          </div>
          <a className="btn btn-primary btn-lg btn-block" href={destaque.url} target="_blank" rel="noopener noreferrer"><Download /> Baixar PDF</a>
        </aside>
        <div className="doc-list">
          {CATEGORIAS_BOLETIM.filter((c) => ordenados.some((b) => b.categoria === c.value)).map((c) => (
            <div key={c.value} style={{ display: 'contents' }}>
              <div className="doc-group-lbl">{c.grupo}</div>
              {ordenados.filter((b) => b.categoria === c.value).map((b) => {
                const info = categoriaInfo(b.categoria)
                return (
                  <div className="doc-card" key={b.numero}>
                    <div className="pdf"><FileText /></div>
                    <div className="dc-main">
                      <div className="dc-num">Nº {String(b.numero).padStart(3, '0')}</div>
                      <div className="dc-title">{b.titulo}</div>
                      <div className="dc-meta"><span className={`badge ${info.badgeClass}`}>{info.label}</span><span className="sep" />{dataPtBr(b.data)}<span className="sep" />{formatBytes(b.tamanho)}</div>
                    </div>
                    <a className="dl" href={b.url} target="_blank" rel="noopener noreferrer"><Download /> Baixar</a>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
})()}
```

- [ ] **Step 4: Rodar (deve passar) + builds**

Run: `cd frontend && npx vitest run src/site-publico && npm run build:site && npm run build`
Expected: testes PASS; ambos os builds sem erro.

- [ ] **Step 5: Commit**

```
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" add frontend/src/site-publico/pages/EventoPage.tsx frontend/src/site-publico/EventoPage-boletins.test.tsx
git -C "C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2" -c user.name="Wagner Marrane" -c user.email="wmarrane@gmail.com" commit -m "feat(site-publico): secao Boletins & documentos (destaque + grupos por tipo)"
```

---

### Task 8: Verificação integrada + demonstração (antes da develop)

**Files:** nenhum.

- [ ] **Step 1: Suites e builds**

Run: `cd backend && npx vitest run && npx tsc --noEmit`
Run: `cd frontend && npm run build && npm run build:site`
Expected: tudo verde.

- [ ] **Step 2: Demonstração com screenshots**

Gerar o site público local com um snapshot de exemplo (vários tipos de boletim) e capturar screenshots (desktop e mobile ~390px) da seção "Boletins & documentos" (destaque + grupos). Para o admin, capturar o painel + o modal aberto (dropdown de tipo com swatches + dropzone). Entregar os screenshots ao Wagner. Após OK, mergear na `develop` (a publicação dinâmica em dev já reflete no `:8081`).

---

## Notas finais
- Sem status/rascunho, páginas ou auditoria (decorativo). Edição de boletim fora de escopo.
- Promoção `develop → main` só com confirmação do Wagner.
