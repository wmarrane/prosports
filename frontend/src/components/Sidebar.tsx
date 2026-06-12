import { useState, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { APP_VERSION, APP_COMMIT } from '../lib/version'
import { useNovidades } from '../lib/use-novidades'
import {
  Panel, Trophy, Cadastro, Evento, Report, Admin,
  ChevR, ChevronDown,
} from '../lib/icons'
import UserMenuPopover from './UserMenuPopover'
import LogoMontana from './LogoMontana'

type NavLeaf = { id: string; label: string; icon: LucideIcon; path: string }
type NavExpandable = { id: string; label: string; icon: LucideIcon; expandable: true; children: { id: string; label: string; path: string }[] }
type NavCat = { cat: string }
type NavItem = NavLeaf | NavExpandable | NavCat

const NAV: NavItem[] = [
  { id: 'painel', label: 'Painel', icon: Panel, path: '/painel' },
  { cat: 'Operação' },
  { id: 'competicoes', label: 'Competições', icon: Trophy, path: '/competicoes' },
  { id: 'eventos', label: 'Eventos', icon: Evento, path: '/eventos' },
  { id: 'congresso', label: 'Modo Congresso', icon: Trophy, path: '/congresso' },
  { id: 'participantes', label: 'Participantes', icon: Cadastro, path: '/participantes' },
  { cat: 'Gestão' },
  {
    id: 'relatorios', label: 'Relatórios', icon: Report, expandable: true,
    children: [
      { id: 'relatorio-painel', label: 'Visão geral', path: '/relatorio' },
      { id: 'relatorio-congresso', label: 'Congresso técnico', path: '/relatorios/congresso' },
    ],
  },
  {
    id: 'admin', label: 'Administração', icon: Admin, expandable: true,
    children: [
      { id: 'usuarios', label: 'Usuários', path: '/usuarios' },
      { id: 'municipios', label: 'Municípios', path: '/municipios' },
      { id: 'inspetorias', label: 'Inspetorias', path: '/inspetorias' },
      { id: 'delegacias', label: 'Delegacias', path: '/delegacias' },
      { id: 'tipos-modalidade', label: 'Tipos de Modalidade', path: '/tipos-modalidade' },
      { id: 'modalidades', label: 'Modalidades', path: '/modalidades' },
      { id: 'sistemas-disputa', label: 'Sistemas de disputa', path: '/sistemas-disputa' },
    ],
  },
]

type Props = {
  collapsed: boolean
  onToggleCollapse: () => void
}

export default function Sidebar({ collapsed, onToggleCollapse }: Props) {
  const { user } = useAuthStore()
  const isCT = user?.role === 'COMISSAO_TECNICA'
  const CT_VISIBLE = new Set(['eventos', 'congresso', 'relatorios'])
  const navItems = NAV.filter(item => {
    if (!isCT) return true
    if ('cat' in item) return false
    return CT_VISIBLE.has((item as any).id)
  })
  const { temNovidade } = useNovidades()
  const location = useLocation()

  // Cada grupo expansível tem seu próprio estado aberto/fechado (por id).
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    for (const item of NAV) {
      if (!('expandable' in item)) continue
      const stored = sessionStorage.getItem(`prosports:nav-expanded:${item.id}`)
      map[item.id] = stored !== null
        ? stored === 'true'
        : item.children.some((c) => location.pathname.startsWith(c.path))
    }
    return map
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const userBtnRef = useRef<HTMLButtonElement>(null)

  function toggleGroup(id: string) {
    setExpanded((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      sessionStorage.setItem(`prosports:nav-expanded:${id}`, String(next[id]))
      return next
    })
  }

  const userInitials = (user?.nome ?? user?.email ?? 'U').slice(0, 2).toUpperCase()

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
        <div className="glyph" style={{ padding: 0, background: 'transparent', display: 'grid', placeItems: 'center' }}>
          <LogoMontana variant="simbolo" height={36} />
        </div>
        <div className="name">
          ProSports<small>Sorteios &amp; Competições</small>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navItems.map((item, i) => {
          if ('cat' in item) {
            return <div className="cat" key={'c' + i}>{item.cat}</div>
          }
          if ('expandable' in item) {
            const Icon = item.icon
            return (
              <div key={item.id}>
                <button
                  className="nav w-full"
                  onClick={() => toggleGroup(item.id)}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon size={18} />
                  <span className="label">{item.label}</span>
                  {!collapsed && (
                    <ChevronDown
                      size={14}
                      style={{
                        marginLeft: 'auto',
                        transform: expanded[item.id] ? 'rotate(0deg)' : 'rotate(-90deg)',
                        transition: 'transform 200ms',
                      }}
                    />
                  )}
                </button>
                {expanded[item.id] && !collapsed && (
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
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.35 }}>
              <span>v{APP_VERSION}</span>
              <span
                style={{
                  opacity: 0.6,
                  fontSize: '0.85em',
                  wordBreak: 'break-all',
                }}
              >
                ({APP_COMMIT})
              </span>
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
        <div style={{ position: 'relative' }}>
          <button
            ref={userBtnRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="sb-user"
            style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            <div className="av">{userInitials}</div>
            {!collapsed && (
              <div className="who">
                <b>{user?.nome ?? user?.email ?? '—'}</b>
                <span>{user?.role === 'ADMIN' ? 'Administrador' : user?.role === 'COMISSAO_TECNICA' ? 'Comissão Técnica' : user?.role === 'PARTICIPANTE' ? 'Participante' : 'Viewer'}</span>
              </div>
            )}
          </button>
          <UserMenuPopover
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            anchorRef={userBtnRef}
          />
        </div>
      </div>
    </aside>
  )
}
