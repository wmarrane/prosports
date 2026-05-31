import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { UserCog, Key, LogOut } from '../lib/icons'

type Props = {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement>
}

export default function UserMenuPopover({ open, onClose, anchorRef }: Props) {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (ref.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null

  async function handleLogout() {
    onClose()
    await logout()
    navigate('/login', { replace: true })
  }

  function go(path: string) {
    onClose()
    navigate(path)
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 6px)',
        left: 8,
        right: 8,
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
        padding: 6,
        zIndex: 40,
      }}
    >
      <MenuItem icon={<UserCog size={15} />} label="Minha conta" onClick={() => go('/conta')} />
      <MenuItem icon={<Key size={15} />} label="Trocar senha" onClick={() => go('/conta/senha')} />
      <div style={{ height: 1, background: 'var(--card-border)', margin: '4px 6px' }} />
      <MenuItem icon={<LogOut size={15} />} label="Sair" onClick={handleLogout} danger />
    </div>
  )
}

function MenuItem({
  icon, label, onClick, danger,
}: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', textAlign: 'left',
        padding: '8px 10px',
        borderRadius: 'var(--radius-md)',
        background: 'transparent',
        color: danger ? 'var(--danger)' : 'var(--t1)',
        fontSize: 13,
        fontWeight: 500,
        border: 'none',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--card-bg-2)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      {label}
    </button>
  )
}
