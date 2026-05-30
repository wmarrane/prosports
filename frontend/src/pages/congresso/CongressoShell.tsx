import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CongressoStep } from '../../types/congresso-step'
import { Maximize, Minimize, X, Trophy } from '../../lib/icons'

const STEP_LABELS: Record<CongressoStep, string> = {
  evento: 'Selecione o Evento',
  modalidade: 'Selecione a Modalidade',
  participantes: 'Participantes Confirmados',
  sorteio: 'Sorteio',
}

const STEP_INDEX: Record<CongressoStep, number> = {
  evento: 1,
  modalidade: 2,
  participantes: 3,
  sorteio: 4,
}

type Props = {
  step: CongressoStep
  onBack?: () => void
  children: React.ReactNode
}

const SHELL_BG = '#0a0e16'
const SHELL_FG = '#f1f5fb'
const SHELL_DIM = '#94a3b8'
const SHELL_LINE = 'rgba(255,255,255,.1)'

export default function CongressoShell({ step, onBack, children }: Props) {
  const navigate = useNavigate()
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement)

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      // negado pelo browser
    }
  }

  async function handleSair() {
    try { if (document.fullscreenElement) await document.exitFullscreen() } catch {}
    navigate('/eventos')
  }

  return (
    <div
      className="congresso-shell"
      style={{ background: SHELL_BG, color: SHELL_FG, height: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <header
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '0 24px',
          borderBottom: `1px solid ${SHELL_LINE}`,
          flex: '0 0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Trophy size={22} />
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.02em' }}>Congresso</span>
        </div>
        {onBack && (
          <button
            onClick={onBack}
            style={{ marginLeft: 16, color: SHELL_DIM, fontSize: 14, background: 'transparent', border: 'none', cursor: 'pointer' }}
          >← Voltar</button>
        )}
        <div style={{ flex: 1, textAlign: 'center', color: SHELL_DIM, fontSize: 14 }}>
          Passo {STEP_INDEX[step]} de 4 · {STEP_LABELS[step]}
        </div>
        <button
          onClick={toggleFullscreen}
          style={{ color: SHELL_FG, background: 'transparent', border: 'none', cursor: 'pointer', padding: 6 }}
          title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
        >
          {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>
        <button
          onClick={handleSair}
          style={{ color: SHELL_FG, background: 'transparent', border: `1px solid ${SHELL_LINE}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <X size={16} /> Sair
        </button>
      </header>
      <main style={{ flex: 1, overflow: 'auto', padding: 32, minHeight: 0 }}>
        {children}
      </main>
    </div>
  )
}
