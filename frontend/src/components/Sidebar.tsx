import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { APP_VERSION, APP_COMMIT } from '../lib/version'
import { useNovidades } from '../lib/use-novidades'
import {
  Panel, Trophy, Cadastro, Evento, Report, Admin,
  ChevR, ChevronDown,
} from '../lib/icons'

type NavLeaf = { id: string; label: string; icon: LucideIcon; path: string }
type NavExpandable = { id: string; label: string; icon: LucideIcon; expandable: true; children: { id: string; label: string; path: string }[] }
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
