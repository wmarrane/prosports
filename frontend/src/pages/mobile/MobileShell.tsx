import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Evento } from '../../types/evento'
import { clearKeyToken } from '../../lib/api-key'
import { assetUrl } from '../../lib/asset-url'
import LogoMontana from '../../components/LogoMontana'
import { LogOut, ArrowLeft, RefreshCw } from 'lucide-react'

type Props = {
  evento: Evento | null
  showBack?: boolean
  onBack?: () => void
  onRefresh?: () => void
  children: ReactNode
}

export default function MobileShell({ evento, showBack, onBack, onRefresh, children }: Props) {
  const navigate = useNavigate()

  function sair() {
    clearKeyToken()
    navigate('/login', { replace: true })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--card-bg-2)',
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{
        flexShrink: 0, zIndex: 50,
        background: 'var(--grad-brand-deep)', color: '#fff',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}>
        {showBack ? (
          <button onClick={onBack} aria-label="Voltar" style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}>
            <ArrowLeft size={22} />
          </button>
        ) : evento?.logo_url ? (
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.95)', padding: 4, display: 'grid', placeItems: 'center' }}>
            <img src={assetUrl(evento.logo_url)} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.95)', padding: 4, display: 'grid', placeItems: 'center' }}>
            <LogoMontana variant="simbolo" height={28} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {evento?.nome ?? '—'}
          </div>
          {evento && (
            <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>
              {evento.competicao?.nome ?? ''}
            </div>
          )}
        </div>
        {onRefresh && (
          <button onClick={onRefresh} aria-label="Atualizar" style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }} title="Atualizar">
            <RefreshCw size={20} />
          </button>
        )}
        <button onClick={sair} aria-label="Sair" style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }} title="Sair">
          <LogOut size={20} />
        </button>
      </header>

      <main style={{
        flex: 1, minHeight: 0,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: 12,
        width: '100%',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
