import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useThemeStore } from '../store/themeStore'
import { useAuthStore } from '../store/authStore'
import {
  Collapse, Sun, Moon, Settings, Search, Trophy, ChevR,
} from '../lib/icons'
import NotificationBell from './NotificationBell'
import CommandPalette from './CommandPalette'

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

  const [paletteOpen, setPaletteOpen] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const segments = location.pathname.split('/').filter(Boolean)
  const crumbs = segments.length > 0 ? segments.map(labelFor) : ['Painel']
  const userInitials = (user?.email ?? 'U').slice(0, 2).toUpperCase()

  async function handleCongresso() {
    try {
      await document.documentElement.requestFullscreen()
    } catch {
      // permissão negada ou contexto inseguro — segue sem fullscreen
    }
    navigate('/congresso')
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
      <button type="button" className="search" onClick={() => setPaletteOpen(true)} title="Buscar (Ctrl+K)" style={{ cursor: 'pointer' }}>
        <Search size={15} />
        <span style={{ flex: 1, textAlign: 'left', color: 'var(--t4)' }}>Buscar eventos, modalidades, competições...</span>
        <span className="kbd">⌘K</span>
      </button>
      <button
        className="icon-btn"
        onClick={toggle}
        title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
      >
        {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
      </button>
      <NotificationBell />
      <button className="icon-btn" title="Configurações" onClick={() => navigate('/admin')}>
        <Settings size={19} />
      </button>
      <div className="av" title={user?.email ?? ''}>{userInitials}</div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
