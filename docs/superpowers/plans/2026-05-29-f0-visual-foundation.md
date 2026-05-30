# F0 — Visual foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar o Design System R2P do handoff (tokens, fontes Inter + JetBrains Mono, tema claro/escuro), reescrever app shell (Sidebar + Topbar) e Login, repintar as 6 páginas existentes com tokens semânticos, criar placeholders para Painel/Eventos/Relatório/Administração e bumpar para 1.5.0.

**Architecture:** Tokens R2P em CSS vars + camada theme-aware com `data-theme` no `<html>`. Zustand store persistido controla tema claro/escuro com toggle na topbar. Sidebar nova categorizada (Painel/Operação/Gestão) com sub-menu expansível em "Administração" que agrupa os CRUDs atuais. Páginas existentes recebem repintura drop-in trocando classes Tailwind hardcoded (`bg-gray-800` etc.) por CSS vars semânticas (`bg-[var(--card-bg)]` etc.); lógica intocada. Zero mudança de domínio.

**Tech Stack:** React 18 + Vite 5 + Tailwind v4 (@tailwindcss/vite), React Query, React Router 6, Zustand, lucide-react (upgrade para latest), CSS vars + tokens R2P.

**Spec:** `docs/superpowers/specs/2026-05-29-f0-visual-foundation-design.md`

**Handoff source:** `claudedesign/desgn_v1/design_handoff_prosports/`

---

## File Structure

**Frontend — Create:**
- `frontend/src/styles/tokens.css` (copiado do handoff)
- `frontend/src/styles/prosports-theme.css` (copiado do handoff + `@import "tailwindcss";` prepended)
- `frontend/src/store/themeStore.ts`
- `frontend/src/lib/icons.ts`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/components/Topbar.tsx`
- `frontend/src/components/EmConstrucao.tsx`
- `frontend/src/pages/Painel.tsx`
- `frontend/src/pages/Eventos.tsx`
- `frontend/src/pages/Relatorio.tsx`
- `frontend/src/pages/Admin.tsx`

**Frontend — Modify:**
- `frontend/src/main.tsx` (importa tokens.css + prosports-theme.css; inicializa tema sync)
- `frontend/src/index.css` (DELETE — substitui pelo prosports-theme.css com tailwind dentro)
- `frontend/src/components/Layout.tsx` (reescrito; consome Sidebar + Topbar)
- `frontend/src/components/PageHeader.tsx` (estende com eyebrow/sub/actions, mantém compatibilidade)
- `frontend/src/components/DataTable.tsx` (token swap)
- `frontend/src/components/MunicipioSelect.tsx` (token swap)
- `frontend/src/pages/Login.tsx` (rewrite split-pane)
- `frontend/src/pages/Novidades.tsx` (token swap)
- `frontend/src/App.tsx` (4 novas rotas placeholder + redirect raiz)
- `frontend/src/pages/municipios/{MunicipiosList,MunicipioForm,MunicipiosImport}.tsx` (token swap)
- `frontend/src/pages/inspetorias/{InspetoriasList,InspetoriaForm}.tsx` (token swap)
- `frontend/src/pages/delegacias/{DelegaciasList,DelegaciaForm}.tsx` (token swap)
- `frontend/src/pages/participantes/{ParticipantesList,ParticipanteForm}.tsx` (token swap)
- `frontend/src/pages/tipos-modalidade/{TiposModalidadeList,TipoModalidadeForm}.tsx` (token swap)
- `frontend/src/pages/modalidades/{ModalidadesList,ModalidadeForm}.tsx` (token swap)
- `frontend/src/pages/competicoes/{CompeticoesList,CompeticaoForm}.tsx` (token swap)
- `frontend/package.json` (lucide-react upgrade)

**Release:**
- `package.json` (root): `1.4.1` → `1.5.0`
- `CHANGELOG.md`

---

## Task 1: Foundation CSS + main.tsx wiring

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\styles\tokens.css`
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\styles\prosports-theme.css`
- Delete: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\index.css`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\main.tsx`

- [ ] **Step 1: Copiar `tokens.css`**

Copia o arquivo `claudedesign/desgn_v1/design_handoff_prosports/tokens.css` (280 linhas) para `frontend/src/styles/tokens.css` **sem modificações**. O arquivo importa Inter + JetBrains Mono do Google Fonts no topo via `@import url(...)`.

Comando (do root do repo):
```
mkdir -p frontend/src/styles && cp "claudedesign/desgn_v1/design_handoff_prosports/tokens.css" frontend/src/styles/tokens.css
```

- [ ] **Step 2: Copiar `prosports-theme.css` + prepend `@import "tailwindcss";`**

Copia `prosports-theme.css` (658 linhas) para `frontend/src/styles/prosports-theme.css`. Depois, **prepend** a linha `@import "tailwindcss";` no topo (antes de qualquer outra regra) — isto faz o Tailwind v4 gerar suas utilidades nesse import point.

Comando:
```
cp "claudedesign/desgn_v1/design_handoff_prosports/prosports-theme.css" frontend/src/styles/prosports-theme.css
```

Em seguida, edite `frontend/src/styles/prosports-theme.css` adicionando como **primeira linha**:
```css
@import "tailwindcss";
```

- [ ] **Step 3: Deletar `frontend/src/index.css`**

O arquivo atual é o boilerplate do Vite (com `#root { width: 1126px; ... }` e `h1 { font-size: 56px }` etc.) e conflita com o layout novo. Remover:
```
rm frontend/src/index.css
```

- [ ] **Step 4: Substituir o conteúdo de `frontend/src/main.tsx`** por:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './styles/tokens.css'
import './styles/prosports-theme.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
```

(Tema sync init é adicionado em Task 2.)

- [ ] **Step 5: Build sanity**

```
cd frontend && npx tsc --noEmit && npm run build
```
Esperado: build passa, sem erros de import.

- [ ] **Step 6: Commit**

```
git add frontend/src/styles frontend/src/main.tsx
git rm frontend/src/index.css
git commit -m "feat(frontend): add R2P design tokens and theme CSS; drop Vite boilerplate"
```

---

## Task 2: Theme store + sync init

**Files:**
- Create: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\frontend\src\store\themeStore.ts`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Criar `frontend/src/store/themeStore.ts`** com conteúdo exato:

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light'

type State = {
  theme: Theme
  toggle: () => void
  set: (t: Theme) => void
}

export const useThemeStore = create<State>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      toggle: () => {
        const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
        document.documentElement.dataset.theme = next
        set({ theme: next })
      },
      set: (t) => {
        document.documentElement.dataset.theme = t
        set({ theme: t })
      },
    }),
    { name: 'prosports:theme' }
  )
)
```

- [ ] **Step 2: Adicionar sync init no `main.tsx`**

No `frontend/src/main.tsx`, **antes** do `createRoot(...)`, adicionar:

```tsx
import { useThemeStore } from './store/themeStore'

// Aplicar tema antes do render — evita flash
document.documentElement.dataset.theme = useThemeStore.getState().theme
```

(Coloque o import junto aos outros e o uso após os imports de CSS, antes do `const queryClient`.)

- [ ] **Step 3: Build sanity**

```
cd frontend && npx tsc --noEmit && npm run build
```
Esperado: build passa.

- [ ] **Step 4: Commit**

```
git add frontend/src/store/themeStore.ts frontend/src/main.tsx
git commit -m "feat(frontend): add theme store with localStorage persistence and sync init"
```

---

## Task 3: Upgrade lucide-react + icons mapping

**Files:**
- Modify: `frontend/package.json` (via npm)
- Create: `frontend/src/lib/icons.ts`

- [ ] **Step 1: Atualizar `lucide-react`**

De `frontend/`:
```
npm install lucide-react@latest
```

Verificar o `package.json` — `"lucide-react": "^0.46x.x"` (ou versão atual). Antes era `^1.16.0` (muito antigo; convenção npm: 1.16 ≠ semver moderno do lucide).

- [ ] **Step 2: Criar `frontend/src/lib/icons.ts`** com conteúdo exato:

```ts
export {
  LayoutDashboard as Panel,
  Trophy,
  Users as Cadastro,
  Brackets as Bracket,
  Group as Groups,
  ListOrdered as Order,
  Calendar as Evento,
  FileText as Report,
  Settings,
  ShieldCheck as Admin,
  ChevronRight as ChevR,
  ChevronDown,
  PanelLeftClose as Collapse,
  Search,
  Bell,
  Sun,
  Moon,
  Lock,
  Check,
  ArrowRight,
  Maximize,
  Minimize,
  Save,
  Pin,
  Construction,
  Plus,
  X,
  Dices as Dice,
  Shuffle,
} from 'lucide-react'
```

(`ShieldCheck` para Admin — variação visual do handoff; `ChevronDown` adicional pra acordeão de sub-menu.)

- [ ] **Step 3: Build sanity**

```
cd frontend && npx tsc --noEmit && npm run build
```
Esperado: clean. Os nomes acima existem na versão recente do `lucide-react`.

- [ ] **Step 4: Commit**

```
git add frontend/package.json frontend/package-lock.json frontend/src/lib/icons.ts
git commit -m "feat(frontend): upgrade lucide-react to latest; add centralized icons module"
```

---

## Task 4: Extend PageHeader (backward compatible)

**Files:**
- Modify: `frontend/src/components/PageHeader.tsx`

- [ ] **Step 1: Substituir o conteúdo de `frontend/src/components/PageHeader.tsx`** por:

```tsx
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

type Props = {
  title: string
  eyebrow?: string
  sub?: string
  actionLabel?: string
  actionTo?: string
  actions?: ReactNode
  backTo?: string
}

export default function PageHeader({ title, eyebrow, sub, actionLabel, actionTo, actions, backTo }: Props) {
  const navigate = useNavigate()
  return (
    <div className="flex items-end justify-between gap-5 flex-wrap px-6 py-5 border-b border-[var(--card-border)]">
      <div className="flex items-start gap-3">
        {backTo && (
          <button
            onClick={() => navigate(backTo)}
            className="text-[var(--t3)] hover:text-[var(--t1)] text-sm transition-colors mt-1"
          >
            ← Voltar
          </button>
        )}
        <div>
          {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
          <h1 className="page-h1">{title}</h1>
          {sub && <p className="muted mt-2 text-sm max-w-[560px]">{sub}</p>}
        </div>
      </div>
      <div className="flex gap-2.5">
        {actions}
        {actionLabel && actionTo && (
          <button
            onClick={() => navigate(actionTo)}
            className="btn btn-primary"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}
```

Compatibilidade: todos os usos atuais (`title`, `actionLabel`, `actionTo`, `backTo`) continuam funcionando. Novos: `eyebrow`, `sub`, `actions`.

- [ ] **Step 2: Build sanity**

```
cd frontend && npx tsc --noEmit && npm run build
```
Esperado: clean.

- [ ] **Step 3: Commit**

```
git add frontend/src/components/PageHeader.tsx
git commit -m "feat(frontend): extend PageHeader with eyebrow/sub/actions (backward compatible)"
```

---

## Task 5: EmConstrucao + 4 placeholder pages

**Files:**
- Create: `frontend/src/components/EmConstrucao.tsx`
- Create: `frontend/src/pages/Painel.tsx`
- Create: `frontend/src/pages/Eventos.tsx`
- Create: `frontend/src/pages/Relatorio.tsx`
- Create: `frontend/src/pages/Admin.tsx`

- [ ] **Step 1: Criar `frontend/src/components/EmConstrucao.tsx`**

```tsx
import PageHeader from './PageHeader'
import { Construction } from '../lib/icons'

type Props = {
  titulo: string
  eyebrow?: string
  sub?: string
  fase?: string
}

export default function EmConstrucao({ titulo, eyebrow, sub, fase }: Props) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={titulo} sub={sub} />
      <div className="p-6">
        <div className="card mx-auto max-w-[560px] p-10 text-center">
          <Construction size={48} className="mx-auto" style={{ color: 'var(--brand-500)' }} />
          <h2 className="mt-4 text-xl font-bold text-[var(--t1)]">Em construção</h2>
          <p className="mt-2 text-sm text-[var(--t3)]">
            Esta seção será implementada na próxima fase do roadmap.
          </p>
          {fase && <span className="eyebrow mt-4 inline-block">Fase {fase}</span>}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Criar `frontend/src/pages/Painel.tsx`**

```tsx
import EmConstrucao from '../components/EmConstrucao'

export default function Painel() {
  return (
    <EmConstrucao
      eyebrow="VISÃO GERAL"
      titulo="Painel"
      sub="Hero, KPIs, gráficos e atividade. Em construção."
      fase="F1"
    />
  )
}
```

- [ ] **Step 3: Criar `frontend/src/pages/Eventos.tsx`**

```tsx
import EmConstrucao from '../components/EmConstrucao'

export default function Eventos() {
  return (
    <EmConstrucao
      eyebrow="OPERAÇÃO"
      titulo="Eventos"
      sub="Edições de competições. Em construção."
      fase="F2"
    />
  )
}
```

- [ ] **Step 4: Criar `frontend/src/pages/Relatorio.tsx`**

```tsx
import EmConstrucao from '../components/EmConstrucao'

export default function Relatorio() {
  return (
    <EmConstrucao
      eyebrow="GESTÃO"
      titulo="Relatório"
      sub="Exportações e auditoria. Em construção."
      fase="F7"
    />
  )
}
```

- [ ] **Step 5: Criar `frontend/src/pages/Admin.tsx`**

```tsx
import EmConstrucao from '../components/EmConstrucao'

export default function Admin() {
  return (
    <EmConstrucao
      eyebrow="GESTÃO"
      titulo="Administração"
      sub="Organizadores, usuários, cargas de dados. Em construção."
      fase="F7"
    />
  )
}
```

- [ ] **Step 6: tsc**

```
cd frontend && npx tsc --noEmit
```
Esperado: clean.

- [ ] **Step 7: Commit**

```
git add frontend/src/components/EmConstrucao.tsx frontend/src/pages/Painel.tsx frontend/src/pages/Eventos.tsx frontend/src/pages/Relatorio.tsx frontend/src/pages/Admin.tsx
git commit -m "feat(frontend): add EmConstrucao component and 4 placeholder pages"
```

---

## Task 6: Sidebar component

**Files:**
- Create: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Criar `frontend/src/components/Sidebar.tsx`** com conteúdo exato:

```tsx
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { APP_VERSION, APP_COMMIT } from '../lib/version'
import { useNovidades } from '../lib/use-novidades'
import {
  Panel, Trophy, Cadastro, Evento, Report, Admin,
  ChevR, ChevronDown,
} from '../lib/icons'

type NavLeaf = { id: string; label: string; icon: React.ComponentType<{ size?: number }>; path: string }
type NavExpandable = { id: string; label: string; icon: React.ComponentType<{ size?: number }>; expandable: true; children: { id: string; label: string; path: string }[] }
type NavCat = { cat: string }
type NavItem = NavLeaf | NavExpandable | NavCat

const NAV: NavItem[] = [
  { id: 'painel', label: 'Painel', icon: Panel, path: '/painel' },
  { cat: 'Operação' },
  { id: 'competicoes', label: 'Competições', icon: Trophy, path: '/competicoes' },
  { id: 'eventos', label: 'Eventos', icon: Evento, path: '/eventos' },
  { id: 'participantes', label: 'Participantes', icon: Cadastro, path: '/participantes' },
  { cat: 'Gestão' },
  { id: 'relatorio', label: 'Relatório', icon: Report, path: '/relatorio' },
  {
    id: 'admin', label: 'Administração', icon: Admin, expandable: true,
    children: [
      { id: 'municipios', label: 'Municípios', path: '/municipios' },
      { id: 'inspetorias', label: 'Inspetorias', path: '/inspetorias' },
      { id: 'delegacias', label: 'Delegacias', path: '/delegacias' },
      { id: 'tipos-modalidade', label: 'Tipos de Modalidade', path: '/tipos-modalidade' },
      { id: 'modalidades', label: 'Modalidades', path: '/modalidades' },
    ],
  },
]

type Props = {
  collapsed: boolean
  onToggleCollapse: () => void
}

export default function Sidebar({ collapsed, onToggleCollapse }: Props) {
  const { user } = useAuthStore()
  const { temNovidade } = useNovidades()
  const location = useLocation()

  const initialExpanded = sessionStorage.getItem('prosports:admin-expanded') === 'true'
    || NAV.some((i) => 'children' in i && i.children.some((c) => location.pathname.startsWith(c.path)))
  const [adminExpanded, setAdminExpanded] = useState(initialExpanded)

  function toggleAdmin() {
    const next = !adminExpanded
    setAdminExpanded(next)
    sessionStorage.setItem('prosports:admin-expanded', String(next))
  }

  const userInitials = (user?.email ?? 'U').slice(0, 2).toUpperCase()

  return (
    <aside className={'sidebar' + (collapsed ? ' collapsed' : '')}>
      <button
        className={'sb-toggle' + (collapsed ? ' is-collapsed' : '')}
        onClick={onToggleCollapse}
        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
      >
        <ChevR size={15} />
      </button>

      <div className="brand">
        <div className="glyph">PS</div>
        <div className="name">
          ProSports<small>Sorteios &amp; Competições</small>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV.map((item, i) => {
          if ('cat' in item) {
            return <div className="cat" key={'c' + i}>{item.cat}</div>
          }
          if ('expandable' in item) {
            const Icon = item.icon
            return (
              <div key={item.id}>
                <button
                  className="nav w-full"
                  onClick={toggleAdmin}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon size={18} />
                  <span className="label">{item.label}</span>
                  {!collapsed && (
                    <ChevronDown
                      size={14}
                      style={{
                        marginLeft: 'auto',
                        transform: adminExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                        transition: 'transform 200ms',
                      }}
                    />
                  )}
                </button>
                {adminExpanded && !collapsed && (
                  <div style={{ paddingLeft: 28 }}>
                    {item.children.map((c) => (
                      <NavLink
                        key={c.id}
                        to={c.path}
                        className={({ isActive }) => 'nav' + (isActive ? ' active' : '')}
                      >
                        <span className="label" style={{ fontSize: 13 }}>{c.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          }
          const Icon = item.icon
          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) => 'nav' + (isActive ? ' active' : '')}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} />
              <span className="label">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="sb-foot">
        <div style={{ height: 1, background: 'var(--sb-line)', margin: '12px 4px' }} />
        <NavLink
          to="/novidades"
          className="flex items-center justify-between text-xs text-[var(--sb-text-dim)] hover:text-[var(--sb-text)] transition-colors px-2 py-1.5"
        >
          {!collapsed && (
            <span>
              v{APP_VERSION} <span style={{ opacity: 0.6 }}>({APP_COMMIT})</span>
            </span>
          )}
          {temNovidade && (
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: 'var(--brand-400)' }}
              aria-label="Nova versão disponível"
            />
          )}
        </NavLink>
        <div className="sb-user">
          <div className="av">{userInitials}</div>
          {!collapsed && (
            <div className="who">
              <b>{user?.email ?? '—'}</b>
              <span>Administrador</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: tsc**

```
cd frontend && npx tsc --noEmit
```
Esperado: clean.

- [ ] **Step 3: Commit**

```
git add frontend/src/components/Sidebar.tsx
git commit -m "feat(frontend): add new Sidebar with categories, collapsible, expandable Admin"
```

---

## Task 7: Topbar component

**Files:**
- Create: `frontend/src/components/Topbar.tsx`

- [ ] **Step 1: Criar `frontend/src/components/Topbar.tsx`** com conteúdo exato:

```tsx
import { useLocation, useNavigate } from 'react-router-dom'
import { useThemeStore } from '../store/themeStore'
import { useAuthStore } from '../store/authStore'
import {
  Collapse, Sun, Moon, Bell, Settings, Search, Trophy, ChevR,
} from '../lib/icons'

const PATH_LABELS: Record<string, string> = {
  painel: 'Painel',
  competicoes: 'Competições',
  eventos: 'Eventos',
  participantes: 'Participantes',
  relatorio: 'Relatório',
  admin: 'Administração',
  municipios: 'Municípios',
  inspetorias: 'Inspetorias',
  delegacias: 'Delegacias',
  'tipos-modalidade': 'Tipos de Modalidade',
  modalidades: 'Modalidades',
  novidades: 'Novidades',
  nova: 'Nova',
  novo: 'Novo',
  editar: 'Editar',
  importar: 'Importar',
}

function labelFor(seg: string): string {
  return PATH_LABELS[seg] ?? seg
}

type Props = {
  onToggleCollapse: () => void
}

export default function Topbar({ onToggleCollapse }: Props) {
  const { theme, toggle } = useThemeStore()
  const { user } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()

  const segments = location.pathname.split('/').filter(Boolean)
  const crumbs = segments.length > 0 ? segments.map(labelFor) : ['Painel']
  const userInitials = (user?.email ?? 'U').slice(0, 2).toUpperCase()

  function handleCongresso() {
    alert('Modo Congresso — em construção (fase F6)')
  }

  return (
    <div className="topbar">
      <button className="collapse-btn" onClick={onToggleCollapse} title="Recolher menu">
        <Collapse size={19} />
      </button>
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <ChevR size={13} />}
            {i === crumbs.length - 1 ? <b>{c}</b> : <span>{c}</span>}
          </span>
        ))}
      </div>
      <div className="grow" />
      <button className="btn btn-primary btn-sm" onClick={handleCongresso} title="Abrir Congresso em modo apresentação">
        <Trophy size={15} /> Modo Congresso
      </button>
      <div className="search">
        <Search size={15} />
        <input placeholder="Buscar eventos, atletas, times..." />
        <span className="kbd">⌘K</span>
      </div>
      <button
        className="icon-btn"
        onClick={toggle}
        title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
      >
        {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
      </button>
      <button className="icon-btn" style={{ position: 'relative' }} title="Notificações">
        <Bell size={19} />
        <span className="notif-dot" />
      </button>
      <button className="icon-btn" title="Configurações" onClick={() => navigate('/admin')}>
        <Settings size={19} />
      </button>
      <div className="av" title={user?.email ?? ''}>{userInitials}</div>
    </div>
  )
}
```

- [ ] **Step 2: tsc**

```
cd frontend && npx tsc --noEmit
```
Esperado: clean.

- [ ] **Step 3: Commit**

```
git add frontend/src/components/Topbar.tsx
git commit -m "feat(frontend): add new Topbar with breadcrumbs, theme toggle, congresso placeholder"
```

---

## Task 8: Layout rewrite

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

- [ ] **Step 1: Substituir o conteúdo de `frontend/src/components/Layout.tsx`** por:

```tsx
import { Outlet } from 'react-router-dom'
import { useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const toggle = () => setCollapsed((v) => !v)

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--app-bg)' }}>
      <Sidebar collapsed={collapsed} onToggleCollapse={toggle} />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar onToggleCollapse={toggle} />
        <div className="page-body" style={{ flex: 1, overflow: 'auto', color: 'var(--t1)' }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
```

(O CSS de `.sidebar`, `.topbar`, etc. já está no `prosports-theme.css`; este arquivo só compõe o layout.)

- [ ] **Step 2: Build + sanity visual**

```
cd frontend && npx tsc --noEmit && npm run build
```
Esperado: build OK. Se possível rodar `npm run dev` e abrir uma página existente — sidebar e topbar novas devem aparecer.

- [ ] **Step 3: Commit**

```
git add frontend/src/components/Layout.tsx
git commit -m "refactor(frontend): rewrite Layout to use new Sidebar + Topbar"
```

---

## Task 9: App.tsx — placeholders + root redirect

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Adicionar imports**

No bloco de imports de páginas em `frontend/src/App.tsx`, adicionar (após o último — `CompeticaoForm`):

```tsx
import Painel from './pages/Painel'
import Eventos from './pages/Eventos'
import Relatorio from './pages/Relatorio'
import Admin from './pages/Admin'
```

- [ ] **Step 2: Alterar redirect raiz e adicionar 4 rotas**

Dentro do `<Route element={<Layout />}>`, substituir a linha atual:
```tsx
<Route path="/" element={<Navigate to="/participantes" replace />} />
```
Por:
```tsx
<Route path="/" element={<Navigate to="/painel" replace />} />

<Route path="/painel"    element={<Painel />} />
<Route path="/eventos"   element={<Eventos />} />
<Route path="/relatorio" element={<Relatorio />} />
<Route path="/admin"     element={<Admin />} />
```

(Posicionar as 4 rotas novas logo após o `<Route path="/" ... />`, antes das rotas de `/inspetorias/*`.)

- [ ] **Step 3: tsc + build**

```
cd frontend && npx tsc --noEmit && npm run build
```
Esperado: clean.

- [ ] **Step 4: Commit**

```
git add frontend/src/App.tsx
git commit -m "feat(frontend): wire 4 placeholder routes and change root redirect to /painel"
```

---

## Task 10: Login redesign (split-pane)

**Files:**
- Modify: `frontend/src/pages/Login.tsx`

- [ ] **Step 1: Substituir o conteúdo de `frontend/src/pages/Login.tsx`** por:

```tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import {
  Sun, Moon, Bracket, Groups, Order, Lock, Check, Report, ArrowRight,
} from '../lib/icons'

export default function Login() {
  const navigate = useNavigate()
  const { login, loading } = useAuthStore()
  const { theme, toggle } = useThemeStore()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    try {
      await login({ email, senha })
      navigate('/painel', { replace: true })
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Não foi possível conectar. Tente novamente.')
    }
  }

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', background: 'var(--card-bg)', overflow: 'hidden' }}>
      {/* theme toggle, floating top-right */}
      <button
        className="icon-btn"
        onClick={toggle}
        title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
        style={{ position: 'absolute', top: 22, right: 26, zIndex: 30, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' }}
      >
        {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
      </button>

      {/* Left hero */}
      <div
        className="dotgrid login-hero"
        style={{
          flex: '0 0 52%',
          position: 'relative',
          background: 'var(--grad-brand-deep)',
          color: '#fff',
          padding: '54px 60px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', width: 440, height: 440, borderRadius: '50%', background: 'rgba(96,165,250,0.40)', filter: 'blur(85px)', top: -130, right: -90, animation: 'floaty 11s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', background: 'rgba(20,184,138,0.30)', filter: 'blur(75px)', bottom: -90, left: 60, animation: 'floaty 8s ease-in-out infinite' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 50, height: 50, borderRadius: 14, background: 'var(--grad-brand)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 900, fontSize: 19, letterSpacing: '-0.04em', boxShadow: '0 8px 26px rgba(16,97,216,0.5)' }}>PS</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.01em' }}>ProSports</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', opacity: 0.55, marginTop: 3 }}>SORTEIOS&nbsp;&amp;&nbsp;COMPETIÇÕES</div>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.55)' }}>Plataforma · Sorteios esportivos</div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 40,
              letterSpacing: '-0.03em',
              lineHeight: 1.12,
              margin: '12px 0 16px',
              maxWidth: 480,
              color: '#fff',
              textWrap: 'balance',
            }}
          >
            Sorteios justos, aleatórios e auditáveis.
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.78)', lineHeight: 1.55, maxWidth: 460 }}>
            Receba os inscritos e conduza o sorteio de chaves, grupos ou ordem de entrada em segundos —
            cada resultado com semente registrada e reproduzível.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            {[
              { Icon: Bracket, label: 'Chaves' },
              { Icon: Groups, label: 'Grupos' },
              { Icon: Order, label: 'Ordem de entrada' },
            ].map(({ Icon, label }) => (
              <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 9999, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.16)', fontSize: 12.5, fontWeight: 600 }}>
                <Icon size={15} /> {label}
              </span>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', display: 'flex', gap: 30 }}>
          {[['1.482', 'Inscritos ativos'], ['47', 'Sorteios realizados'], ['100%', 'Auditados']].map(([v, l]) => (
            <div key={l}>
              <div className="tabular" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 23, letterSpacing: '-0.02em' }}>{v}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.18em', marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div style={{ flex: 1, padding: '56px 64px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'var(--card-bg)' }}>
        <form onSubmit={handleSubmit} style={{ maxWidth: 380, width: '100%' }}>
          <div className="eyebrow">Acesso administrativo</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 29, letterSpacing: '-0.025em', margin: '8px 0 6px', color: 'var(--t1)' }}>
            Entrar na plataforma
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--t3)', lineHeight: 1.55, margin: 0 }}>
            Use suas credenciais de administrador para gerenciar eventos e conduzir sorteios.
          </p>

          <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 15 }}>
            <div>
              <label className="field-label" style={{ color: 'var(--t3)' }}>E-mail corporativo</label>
              <input
                className="lg-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label className="field-label" style={{ color: 'var(--t3)', margin: 0 }}>Senha</label>
                <a style={{ fontSize: 11.5, color: 'var(--brand-500)', fontWeight: 600, cursor: 'pointer' }}>Esqueci a senha</a>
              </div>
              <input
                className="lg-input"
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: 'var(--t2)', marginTop: 2, cursor: 'pointer' }}>
              <span style={{ width: 17, height: 17, borderRadius: 5, background: 'var(--grad-brand)', display: 'grid', placeItems: 'center' }}>
                <Check size={11} style={{ color: '#fff', strokeWidth: 3 }} />
              </span>
              Manter conectado neste dispositivo
            </label>

            {erro && (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)', color: 'var(--danger)', fontSize: 13 }}>
                {erro}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ marginTop: 10, justifyContent: 'center', width: '100%' }}
            >
              {loading ? <>Entrando…</> : <>Entrar no ProSports <ArrowRight size={16} /></>}
            </button>
          </div>

          <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: 'var(--t4)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Lock size={12} /> Criptografado
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Check size={12} /> Acesso por JWT
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Report size={12} /> Logs de auditoria
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Adicionar media query mobile no `prosports-theme.css`**

No final do arquivo `frontend/src/styles/prosports-theme.css`, adicionar:

```css
@media (max-width: 900px) {
  .login-hero { display: none !important; }
}
```

- [ ] **Step 3: tsc + build**

```
cd frontend && npx tsc --noEmit && npm run build
```
Esperado: clean.

- [ ] **Step 4: Commit**

```
git add frontend/src/pages/Login.tsx frontend/src/styles/prosports-theme.css
git commit -m "feat(frontend): redesign Login as split-pane (hero + form) keeping real JWT auth"
```

---

## Task 11: Pages repaint — batch A (Municípios + Inspetorias + Delegacias + Participantes)

**Files (9):**
- Modify: `frontend/src/pages/municipios/MunicipiosList.tsx`
- Modify: `frontend/src/pages/municipios/MunicipioForm.tsx`
- Modify: `frontend/src/pages/municipios/MunicipiosImport.tsx`
- Modify: `frontend/src/pages/inspetorias/InspetoriasList.tsx`
- Modify: `frontend/src/pages/inspetorias/InspetoriaForm.tsx`
- Modify: `frontend/src/pages/delegacias/DelegaciasList.tsx`
- Modify: `frontend/src/pages/delegacias/DelegaciaForm.tsx`
- Modify: `frontend/src/pages/participantes/ParticipantesList.tsx`
- Modify: `frontend/src/pages/participantes/ParticipanteForm.tsx`

Aplique este **mapa de substituição** em cada arquivo (string-level replace; cada par é literal):

| Antes | Depois |
|---|---|
| `bg-gray-950` | `bg-[var(--app-bg)]` |
| `bg-gray-900` | `bg-[var(--card-bg)]` |
| `bg-gray-800` | `bg-[var(--card-bg-2)]` |
| `bg-gray-700` | `bg-[var(--card-bg-2)]` |
| `border-gray-800` | `border-[var(--card-border)]` |
| `border-gray-700` | `border-[var(--card-border)]` |
| `border-gray-600` | `border-[var(--card-border)]` |
| `text-white` | `text-[var(--t1)]` |
| `text-gray-200` | `text-[var(--t1)]` |
| `text-gray-300` | `text-[var(--t2)]` |
| `text-gray-400` | `text-[var(--t3)]` |
| `text-gray-500` | `text-[var(--t3)]` |
| `text-gray-600` | `text-[var(--t4)]` |
| `bg-indigo-600` | `bg-[var(--brand-500)]` |
| `bg-indigo-500` | `bg-[var(--brand-400)]` |
| `hover:bg-indigo-500` | `hover:bg-[var(--brand-400)]` |
| `text-indigo-400` | `text-[var(--brand-500)]` |
| `hover:text-indigo-300` | `hover:text-[var(--brand-400)]` |
| `text-indigo-500` | `text-[var(--brand-500)]` |
| `focus:ring-indigo-500` | `focus:ring-[var(--brand-500)]` |
| `text-red-400` | `text-[var(--danger)]` |
| `hover:text-red-300` | `hover:text-[var(--danger-700)]` |
| `text-red-300` | `text-[var(--danger)]` |
| `bg-red-950` | `bg-[var(--danger-soft)]` |
| `border-red-800` | `border-[var(--danger)]` |
| `text-emerald-400` | `text-[var(--success)]` |
| `text-amber-400` | `text-[var(--warn)]` |
| `text-sky-400` | `text-[var(--info)]` |

**NÃO alterar:** classes utilitárias de layout (`flex`, `grid`, `gap-*`, `px-*`, `py-*`, `w-*`, `max-w-*`, `rounded-*`, `text-xs/sm/base/lg/xl/2xl`, `font-bold/semibold/medium`, `space-y-*`, `divide-*`, `overflow-*`, etc.). Só trocar cores e backgrounds hardcoded.

- [ ] **Step 1: Aplicar o mapa em cada um dos 9 arquivos**

Use Edit com `replace_all: true` para cada par do mapa, arquivo por arquivo. Se um par não tiver ocorrência num arquivo, pula.

- [ ] **Step 2: Build + sanity**

```
cd frontend && npx tsc --noEmit && npm run build
```
Esperado: clean.

- [ ] **Step 3: Commit**

```
git add frontend/src/pages/municipios frontend/src/pages/inspetorias frontend/src/pages/delegacias frontend/src/pages/participantes
git commit -m "style(frontend): repaint Municipios/Inspetorias/Delegacias/Participantes pages with R2P tokens"
```

---

## Task 12: Pages repaint — batch B (Tipos + Modalidades + Competições + Novidades + DataTable + MunicipioSelect)

**Files (8):**
- Modify: `frontend/src/pages/tipos-modalidade/TiposModalidadeList.tsx`
- Modify: `frontend/src/pages/tipos-modalidade/TipoModalidadeForm.tsx`
- Modify: `frontend/src/pages/modalidades/ModalidadesList.tsx`
- Modify: `frontend/src/pages/modalidades/ModalidadeForm.tsx`
- Modify: `frontend/src/pages/competicoes/CompeticoesList.tsx`
- Modify: `frontend/src/pages/competicoes/CompeticaoForm.tsx`
- Modify: `frontend/src/pages/Novidades.tsx`
- Modify: `frontend/src/components/DataTable.tsx`
- Modify: `frontend/src/components/MunicipioSelect.tsx`

Aplicar o **mesmo mapa de substituição da Task 11** (idêntico).

- [ ] **Step 1: Aplicar o mapa em cada um dos 9 arquivos**

Mesma estratégia da Task 11.

- [ ] **Step 2: Build + sanity**

```
cd frontend && npx tsc --noEmit && npm run build
```
Esperado: clean.

- [ ] **Step 3: Commit**

```
git add frontend/src/pages/tipos-modalidade frontend/src/pages/modalidades frontend/src/pages/competicoes frontend/src/pages/Novidades.tsx frontend/src/components/DataTable.tsx frontend/src/components/MunicipioSelect.tsx
git commit -m "style(frontend): repaint Tipos/Modalidades/Competicoes/Novidades + shared components with R2P tokens"
```

---

## Task 13: Bump versão + CHANGELOG

**Files:**
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\package.json`
- Modify: `C:\Users\Wagner\OneDrive\Pessoal\Documentos\Projetos\prosports_v2\CHANGELOG.md`

- [ ] **Step 1: Bump version**

No `package.json` do root: trocar `"version": "1.4.1"` por `"version": "1.5.0"`.

- [ ] **Step 2: Adicionar bloco no CHANGELOG**

Inserir o bloco abaixo no `CHANGELOG.md` logo após o cabeçalho (linhas iniciais com `# Changelog` + parágrafo) e ANTES do `## [1.4.1] - 2026-05-29`:

```md
## [1.5.0] - 2026-05-29

### Added
- Design System R2P aplicado: tokens (cores, tipografia Inter + JetBrains Mono, sombras, motion) e tema claro/escuro com toggle na topbar.
- Login redesign split-pane (hero gradient + form), mantendo o JWT real.
- Novo app shell: sidebar com gradiente + categorias (Operação / Gestão), botão recolher, sub-menu expansível em "Administração", rodapé com user e versão.
- Topbar 64px sticky com breadcrumbs, busca, toggle de tema, botão "Modo Congresso" (placeholder).
- Páginas placeholder de "Em construção" para Painel, Eventos, Relatório e Administração — fases F1, F2 e F7.

### Changed
- Sidebar reorganizado: itens agrupados em Operação (Competições · Eventos · Participantes) e Gestão (Relatório · Administração ▾). CRUDs atuais (Municípios, Inspetorias, Delegacias, Tipos de Modalidade, Modalidades) viraram sub-itens de Administração.
- Redirect raiz de `/participantes` para `/painel`.
- Todas as páginas existentes (Municípios, Inspetorias, Delegacias, Participantes, Tipos de Modalidade, Modalidades, Competições, Novidades, MunicipioSelect, DataTable) repintadas com tokens semânticos — funcionam em tema claro e escuro.
- `lucide-react` atualizado para a versão mais recente.

### Removed
- Item raiz "Competições" desaparece (movido para dentro de Operação) — sem perda de funcionalidade.
```

- [ ] **Step 3: Commit**

```
git add package.json CHANGELOG.md
git commit -m "chore(release): v1.5.0 — F0 visual foundation (R2P design system + theme + new IA)"
```

---

## Task 14: End-to-end smoke test (manual, pós-deploy)

**Files:** (sem edição — verificação manual)

- [ ] **Step 1: Push e aguardar CI**

```
git push origin develop
```
CI sem migrations (não há mudança de schema) → reconstrói os 2 containers (~5 min).

- [ ] **Step 2: Validar rotas + bundle**

```bash
curl -s -m 5 -o /dev/null -w "/painel: %{http_code} (want 401)\n" http://192.168.56.113:3000/painel
# (essa rota não existe no backend — esperado 404 ou 401 dependendo do middleware; é frontend-only)

idx_js=$(curl -s -m 5 http://192.168.56.113:8080/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)
curl -s -m 10 "http://192.168.56.113:8080$idx_js" | grep -c "Em constru"
# Esperado: > 0 (placeholders no bundle)

curl -s -m 5 http://192.168.56.113:8080/ | grep -c "Inter"
# Esperado: > 0 (font import veio)
```

- [ ] **Step 3: Smoke test no browser (anônimo)**

Abrir http://192.168.56.113:8080. Login `admin@prosports.com` / `admin123`.

1. **Login novo:** split-pane carrega — hero à esquerda com gradiente + blobs animados + 3 chips + 3 stats; form à direita; submit chama backend real; navega pra `/painel`.
2. **Tema:** click no sol/lua da topbar alterna; F5 mantém a preferência (localStorage `prosports:theme`); re-login mantém.
3. **Sidebar:** colapsa com o botão chevron na borda + botão da topbar. Item ativo destaca com faixa azul + fundo translúcido.
4. **Sub-menu "Administração"** expande, mostra 5 itens (Municípios, Inspetorias, Delegacias, Tipos de Modalidade, Modalidades). Click em qualquer um navega corretamente.
5. **4 placeholders:** `/painel`, `/eventos`, `/relatorio`, `/admin` cada um mostra "Em construção" com badge da fase (F1, F2, F7, F7).
6. **Redirect raiz:** acessar `/` → vai pra `/painel`.
7. **CRUDs existentes funcionam:** abrir Municípios via Administração → lista, criar, editar, excluir. Importar CSV funciona. Mesma coisa em Modalidades, Competições.
8. **Tema em cada tela:** alternar claro↔escuro percorrendo as 6 páginas existentes + 4 placeholders + Novidades. Não pode haver texto invisível ou contraste quebrado em nenhum lugar.
9. **Botão "Modo Congresso"** na topbar: click mostra alert "em construção (fase F6)".
10. **Footer sidebar:** mostra `v1.5.0 (<sha>)` + badge novidades; click vai pra `/novidades` que renderiza no tema novo.

- [ ] **Step 4: Reportar**

Se passou tudo, fechar a sessão. Se algo falhar, capturar request/response (aba Network) e voltar para iteração.

---

## Self-review

Cobertura do spec:

| Spec | Coberto por |
|---|---|
| Tokens R2P + theme css | Task 1 |
| Tema claro/escuro com toggle + persistência | Tasks 2, 7 |
| Upgrade lucide-react + icon map | Task 3 |
| PageHeader estendido | Task 4 |
| EmConstrucao + 4 placeholders | Task 5 |
| Sidebar nova (categorias + sub-menu Admin + footer) | Task 6 |
| Topbar nova (breadcrumbs + tema + congresso + decorativos) | Task 7 |
| Layout shell rewrite | Task 8 |
| 4 rotas placeholder + redirect raiz | Task 9 |
| Login split-pane com JWT real | Task 10 |
| Repintura das 6 páginas + Novidades + DataTable + MunicipioSelect | Tasks 11+12 |
| Bump 1.5.0 + CHANGELOG | Task 13 |
| Smoke test 10 itens | Task 14 |

Riscos do spec (contraste quebrado, lucide breaking changes, flash de tema, login mismatch, sidebar quebrar layout, sub-menu não persistir, CSS sobrescrever Tailwind) são endereçados nas Tasks 1 (importação ordenada de CSS), 3 (build valida API do lucide), 2 (sync init antes do render), 10 (reutiliza authService), 6 (mesma largura expandida), 6 (sessionStorage), 1 (`@import "tailwindcss"` dentro do theme).
