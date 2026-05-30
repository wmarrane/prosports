# Spec: F0 — Visual foundation (Design System R2P + Tema + Nova IA)

Data: 2026-05-29
Status: aprovado para implementação
Backlog redesign: F0 é o primeiro de 7 sub-projetos do handoff `claudedesign/desgn_v1/design_handoff_prosports/README.md`.

## Objetivo

Aplicar o **Design System R2P** do handoff (tokens, tipografia Inter + JetBrains Mono, tema claro/escuro com toggle) ao prosports_v2, substituir o app shell (sidebar + topbar) pela versão do handoff, reescrever o Login com o layout split-pane, reorganizar a IA do sidebar (categorias Operação / Gestão + sub-menu "Administração"), criar 4 placeholders ("Em construção") para rotas das fases futuras, e repintar as 6 páginas existentes com tokens semânticos. **Zero mudança de domínio ou API.** Bump para `1.5.0`.

## Escopo

- Tokens CSS (`tokens.css`) + tema theme-aware (`prosports-theme.css`) copiados do handoff para `frontend/src/styles/`.
- Tema claro/escuro: store Zustand + persistência localStorage + atributo `data-theme` no `<html>`, default `dark`.
- `lucide-react` atualizado para latest (estava v1.16, muito antigo).
- Sidebar nova (256/76, gradiente, categorias, sub-menu expansível em Administração, rodapé com versão + user).
- Topbar nova (64px sticky, breadcrumbs, busca decorativa, botão "Modo Congresso" placeholder, toggle tema, sino/settings/avatar decorativos).
- PageHeader estendido (`eyebrow` + `title` + `sub` + `actions`).
- Login redesign split-pane com integração real ao `/auth/login` existente.
- 4 placeholders novos: `/painel`, `/eventos`, `/relatorio`, `/admin` — componente `EmConstrucao` compartilhado.
- Redirect raiz `/` muda de `/participantes` para `/painel`.
- Repintura visual de 6 páginas + DataTable + MunicipioSelect + Novidades (drop-in via tokens, sem mexer em lógica).
- Bump `1.5.0` + bloco CHANGELOG.

Fora de escopo:
- Qualquer mudança de schema/migration.
- Novas entidades (Evento, etc.) — fase F2.
- Funcionalidade real das páginas placeholder — fases F1, F2, F7.
- Refatoração de services/types/hooks/queries.
- Botão "Modo Congresso" funcional — fase F6.
- Tweaks panel do handoff (apenas ferramenta de protótipo, não portar).

## Decisões de design

| # | Decisão | Justificativa |
|---|---|---|
| 1 | Aplicar nova IA do sidebar com placeholders | Estabelece a estrutura visual final; placeholders sinalizam progresso. |
| 2 | Toggle de tema com default dark | Continuidade com o app atual; usuários já estão acostumados ao dark. |
| 3 | Tailwind + tokens via CSS vars | Migração gradual, sem reescrever utilitários existentes. |
| 4 | Sub-menu expansível para Administração | Não perde os CRUDs atuais; expõe IA nova sem regredir UX. |
| 5 | Login substituído agora (não defer) | É a porta de entrada; coerência visual desde o primeiro pixel. |
| 6 | Upgrade `lucide-react@latest` | v1.16 é muito antiga; novo ícones do handoff só existem em versões recentes. |
| 7 | Redirect raiz `/` → `/painel` | Coerente com a nova IA (Painel é o "home"). |
| 8 | Componente `EmConstrucao` compartilhado | DRY entre as 4 placeholders; sinaliza fase do backlog. |
| 9 | Versão `1.5.0` (MINOR) | Feature aditiva grande, sem mudança de contrato. |

## Stack visual

### `frontend/src/styles/tokens.css`

Copiar literalmente do handoff (`claudedesign/desgn_v1/design_handoff_prosports/tokens.css`). Contém:
- Paleta brand (50–950, hero `--brand-500 #1061d8`).
- Paleta sidebar dark, surfaces light, slate, semânticos (success/warn/danger/info/violet/pink/teal).
- Foregrounds semânticos `--fg-1..4`, `--link/--link-hover`.
- Gradientes (`--grad-brand`, `--grad-brand-deep`, `--grad-sidebar`, status, text).
- Tipografia: `--font-sans Inter`, `--font-display Inter`, `--font-mono JetBrains Mono`, escala `--text-2xs`..`--text-5xl`, features.
- Espaçamento `--space-1..12`, raios `--radius-lg/-xl/-pill`.
- Sombras (card, e1/e2/e3, glows por status), `--shadow-brand`.
- Motion (`--ease-out`, `--ease-spring`, durations).

Importa Inter e JetBrains Mono via `@import` Google Fonts no topo.

### `frontend/src/styles/prosports-theme.css`

Copiar literalmente do handoff. Contém:
- Camada semântica theme-aware (`:root { --app-bg, --card-bg, --card-bg-2, --card-border, --t1..4, ... }` para light; `[data-theme="dark"] :root { ... }` para dark).
- Classes componentes globais: `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-lg`, `.btn-sm`, `.card`, `.eyebrow`, `.tabular`, `.field-label`, `.lg-input`, `.dotgrid`, `.icon-btn`, `.kbd`, `.notif-dot`, etc.
- Componentes do app: `.sidebar`, `.brand`, `.glyph`, `.nav`, `.cat`, `.sb-foot`, `.sb-user`, `.av`, `.sb-toggle`, `.topbar`, `.collapse-btn`, `.crumbs`, `.search`, `.grow`, `.page-h1`, `.muted`.
- Keyframes: `floaty`, `popIn`, `fade-in`, `slide-up`, `shimmer`.

### `frontend/src/main.tsx`

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import './styles/tokens.css'
import './styles/prosports-theme.css'
import './index.css'
import App from './App.tsx'
import { useThemeStore } from './store/themeStore'

// Inicialização síncrona do tema antes do render (evita flash)
const theme = useThemeStore.getState().theme
document.documentElement.dataset.theme = theme

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
```

### Tema (Zustand)

`frontend/src/store/themeStore.ts`:
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

### Ícones

`npm install lucide-react@latest` (substitui `^1.16.0`).

`frontend/src/lib/icons.ts`:
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
  Settings as Admin,
  ChevronRight as ChevR,
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

Re-exports nomeados com aliases do handoff. Páginas importam de `'../lib/icons'` em vez de `'lucide-react'` direto — facilita reorganização futura.

## App shell

### `frontend/src/components/Sidebar.tsx`

- Largura 256px (expandida) / 76px (colapsada via `data-collapsed`).
- Background `var(--grad-sidebar)`.
- Botão circular `.sb-toggle` na borda direita (chevron rotaciona com `is-collapsed`).
- Marca: tile `.glyph` "PS" + label "ProSports / SORTEIOS & COMPETIÇÕES" (oculta quando colapsado).
- Categorias (label `.cat` em uppercase, letterSpacing .2em, cor `--t4`).
- Item `.nav` com ícone + label + `.count` opcional. Estado ativo: faixa lateral 3px `--brand-400` + background `rgba(59, 130, 246, 0.08)`.
- Sub-menu "Administração" controlado por estado local (`useState<boolean>`, persistido na sessão via `sessionStorage['prosports:admin-expanded']`); chevron rotaciona; sub-itens com indent + dot bullet.
- Footer `.sb-foot`: divisor + versão `v{APP_VERSION} ({APP_COMMIT})` com badge de novidades (preserva o que já existe), em seguida bloco user (`.av` + nome + role).

NAV final:
```ts
const NAV = [
  { id: 'painel', label: 'Painel', icon: 'Panel' },
  { cat: 'Operação' },
  { id: 'competicoes', label: 'Competições', icon: 'Trophy', path: '/competicoes' },
  { id: 'eventos', label: 'Eventos', icon: 'Evento', path: '/eventos' },
  { id: 'participantes', label: 'Participantes', icon: 'Cadastro', path: '/participantes' },
  { cat: 'Gestão' },
  { id: 'relatorio', label: 'Relatório', icon: 'Report', path: '/relatorio' },
  {
    id: 'admin', label: 'Administração', icon: 'Admin', expandable: true,
    children: [
      { id: 'municipios', label: 'Municípios', path: '/municipios' },
      { id: 'inspetorias', label: 'Inspetorias', path: '/inspetorias' },
      { id: 'delegacias', label: 'Delegacias', path: '/delegacias' },
      { id: 'tipos-modalidade', label: 'Tipos de Modalidade', path: '/tipos-modalidade' },
      { id: 'modalidades', label: 'Modalidades', path: '/modalidades' },
    ],
  },
]
```

`/admin` (a página) é separada (índice/hub); o item de sidebar com `expandable: true` NÃO navega quando clicado — só expande.

### `frontend/src/components/Topbar.tsx`

- 64px, `position: sticky; top: 0`, `backdrop-filter: blur(20px)`, fundo `rgba(var(--card-bg-rgb), .72)`.
- `.collapse-btn` (toggle sidebar) → breadcrumbs (derivados de `useLocation` + mapa pathSegment→label) → `.grow` → botão "Modo Congresso" (`.btn .btn-primary .btn-sm`, onClick mostra toast/alert "Em construção") → busca `.search` (input + `⌘K`, decorativo) → toggle tema (`.icon-btn` com Sun/Moon) → sino com `.notif-dot` (decorativo) → settings (decorativo) → avatar `.av` (iniciais do email).

### `frontend/src/components/Layout.tsx` (reescrito)

```tsx
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useState } from 'react'

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  // breadcrumbs derivados da rota...

  return (
    <div className="app-shell">
      <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(v => !v)} />
      <main className="main">
        <Topbar
          crumbs={breadcrumbs}
          onToggleCollapse={() => setCollapsed(v => !v)}
          onCongresso={() => alert('Modo Congresso — em construção (F6)')}
        />
        <div className="page-body">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
```

### `frontend/src/components/PageHeader.tsx` (estendido)

Props existentes preservadas (`title`, `actionLabel`, `actionTo`, `backTo`) — todas chamadas atuais seguem funcionando. Novas props opcionais: `eyebrow?: string`, `sub?: string`, `actions?: ReactNode` (alternativa ao par `actionLabel/actionTo` para múltiplas ações).

## Login redesign

`frontend/src/pages/Login.tsx` reescrito conforme handoff `login.jsx`. Bullets resumidos:

- Layout flex full-viewport, background `var(--card-bg)`.
- Toggle tema flutuante top-right (`position: absolute`).
- Esquerda 52% (oculta em <900px via media query):
  - `.dotgrid` + `var(--grad-brand-deep)` + 2 blobs `position: absolute` com `filter: blur()` e `animation: floaty ...`.
  - Marca PS + "ProSports / SORTEIOS & COMPETIÇÕES".
  - Eyebrow "Plataforma · Sorteios esportivos" + h1 ~40px weight 800 `text-wrap: balance` "Sorteios justos, aleatórios e auditáveis." + parágrafo.
  - 3 chips pill (Chaves, Grupos, Ordem de entrada) com ícones lucide.
  - 3 stats footer (números mockados: 1.482 / 47 / 100%).
- Direita 48% (cresce 100% em <900px):
  - Eyebrow "Acesso administrativo" + h2 "Entrar na plataforma" + microcopy.
  - Form com inputs `.lg-input`, labels `.field-label`.
  - Link decorativo "Esqueci a senha" (sem rota).
  - Checkbox custom "Manter conectado neste dispositivo" (decorativo).
  - Botão `.btn .btn-primary .btn-lg` full-width.
  - Microcopy footer: Criptografado · JWT · Logs de auditoria.

**Integração:** submit chama `authService.login({ email, senha })` (já existe); on success grava `accessToken` no `authStore` e navega para `/painel`; on error renderiza mensagem inline acima do botão.

## Placeholders

### `frontend/src/components/EmConstrucao.tsx`

```tsx
type Props = { titulo: string; eyebrow?: string; sub?: string; fase?: string }

export default function EmConstrucao({ titulo, eyebrow, sub, fase }: Props) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={titulo} sub={sub} />
      <div className="card" style={{ maxWidth: 560, margin: '40px auto', padding: 40, textAlign: 'center' }}>
        <Construction size={48} className="mx-auto" style={{ color: 'var(--brand-500)' }} />
        <h2 style={{ marginTop: 16 }}>Em construção</h2>
        <p style={{ color: 'var(--t3)', marginTop: 8 }}>
          Esta seção será implementada na próxima fase do roadmap.
        </p>
        {fase && <span className="eyebrow" style={{ marginTop: 16, display: 'inline-block' }}>Fase {fase}</span>}
      </div>
    </>
  )
}
```

### Páginas placeholder

| Arquivo | PageHeader (eyebrow / título / sub) | Fase |
|---|---|---|
| `pages/Painel.tsx` | "VISÃO GERAL" / "Painel" / "Hero, KPIs, gráficos e atividade. Em construção." | F1 |
| `pages/Eventos.tsx` | "OPERAÇÃO" / "Eventos" / "Edições de competições. Em construção." | F2 |
| `pages/Relatorio.tsx` | "GESTÃO" / "Relatório" / "Exportações e auditoria. Em construção." | F7 |
| `pages/Admin.tsx` | "GESTÃO" / "Administração" / "Organizadores, usuários, cargas de dados. Em construção." | F7 |

## Migração das páginas existentes

**Estratégia drop-in via tokens.** Cada página atual com classes Tailwind hardcoded recebe substituições para CSS vars do tema:

| Atual (Tailwind) | Novo |
|---|---|
| `bg-gray-800` | `bg-[var(--card-bg)]` |
| `bg-gray-900` | `bg-[var(--card-bg-2)]` |
| `border-gray-700` | `border-[var(--card-border)]` |
| `text-white` | `text-[var(--t1)]` |
| `text-gray-300` | `text-[var(--t2)]` |
| `text-gray-400` | `text-[var(--t3)]` |
| `text-gray-500` | `text-[var(--t4)]` |
| `bg-indigo-600 hover:bg-indigo-500` | classe `.btn .btn-primary` |
| `text-indigo-400 hover:text-indigo-300` | `text-[var(--brand-500)] hover:text-[var(--brand-600)]` |
| `text-red-400 hover:text-red-300` | `text-[var(--danger)] hover:text-[var(--danger-700)]` |

**Arquivos tocados (só visual, lógica intacta):**

- `pages/municipios/{MunicipiosList, MunicipioForm, MunicipiosImport}.tsx`
- `pages/inspetorias/{InspetoriasList, InspetoriaForm}.tsx`
- `pages/delegacias/{DelegaciasList, DelegaciaForm}.tsx`
- `pages/participantes/{ParticipantesList, ParticipanteForm}.tsx`
- `pages/tipos-modalidade/{TiposModalidadeList, TipoModalidadeForm}.tsx`
- `pages/modalidades/{ModalidadesList, ModalidadeForm}.tsx`
- `pages/competicoes/{CompeticoesList, CompeticaoForm}.tsx`
- `pages/Novidades.tsx`
- `components/DataTable.tsx`
- `components/MunicipioSelect.tsx`
- `components/PageHeader.tsx` (já reescrito na seção shell, mantém compatibilidade)

## Roteamento (`App.tsx`)

Adicionar imports dos 4 placeholders + `EmConstrucao` opcionalmente. Dentro do `<Route element={<Layout />}>`:

```tsx
<Route path="/" element={<Navigate to="/painel" replace />} />
<Route path="/painel"    element={<Painel />} />
<Route path="/eventos"   element={<Eventos />} />
<Route path="/relatorio" element={<Relatorio />} />
<Route path="/admin"     element={<Admin />} />
```

As rotas existentes (`/municipios/*`, `/inspetorias/*`, `/delegacias/*`, `/participantes/*`, `/tipos-modalidade/*`, `/modalidades/*`, `/competicoes/*`, `/novidades`) **permanecem inalteradas**.

## Release

### Bump
`package.json` root: `1.4.1` → `1.5.0`.

### CHANGELOG.md (novo bloco no topo)

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

### Deploy
Push em `develop` → CI sem migrations (não há mudança de schema) → reconstrói os 2 containers. ~5 min.

### Smoke test pós-deploy (manual, browser)

1. **Tema:** toggle (sol/lua) alterna; persiste após F5 e re-login (localStorage).
2. **Sidebar:** colapsar via botão central (chevron) e via topbar — labels somem, ícones permanecem. Item ativo destaca.
3. **Sub-menu "Administração"** expande, mostra 5 sub-itens, cada link leva ao CRUD.
4. **Login:** logout → split-pane carrega com blobs animados, chips, stats. Submit chama backend real; navega pra `/painel`.
5. **CRUDs existentes:** Municípios, Modalidades, Competições — visual novo, funcionalidade preservada (criar/editar/remover).
6. **Placeholders:** `/painel`, `/eventos`, `/relatorio`, `/admin` mostram "Em construção" com badge da fase.
7. **Redirect raiz:** `/` → `/painel`.
8. **Rodapé sidebar:** `v1.5.0 (<sha>)` + badge novidades funcionando; `/novidades` abre com tema novo.
9. **Performance:** bundle aumenta (Inter + lucide novo + CSS) mas sem regressão de render.
10. **Pares cromáticos:** alternar tema em cada página — sem texto invisível ou contraste quebrado.

## Riscos

| Risco | Mitigação |
|---|---|
| Contraste quebrado em alguma página em algum tema | Sanity walk nas 6 páginas + 4 placeholders nos 2 temas (smoke test item 10). |
| `lucide-react` v1.16 → latest breaking changes em imports | Mapeamento centralizado em `lib/icons.ts`; `npm run build` valida. |
| Flash do tema antes do localStorage | Inicialização síncrona no `main.tsx` antes do render. |
| Login real falhar por mismatch com nova UI | Reutiliza `authService.login` existente; só muda render do form. |
| Sidebar quebra layout (medidas) | Mesma largura expandida (256px); padding/margens do `<main>` recalculados. |
| Sub-menu Administração não persistir estado entre rotas | `sessionStorage` armazena o flag de expandido — sobrevive a navegação interna. |
| CSS global do tema sobrescrever Tailwind | Camadas: tokens → theme components → Tailwind utilities (já é a ordem padrão). `.btn` etc. ficam estáveis. |
