import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CongressoStep } from '../../types/congresso-step'
import { Maximize, Minimize, X, Sun, Moon } from '../../lib/icons'
import { useThemeStore } from '../../store/themeStore'
import LogoMontana from '../../components/LogoMontana'

const STEPS: Array<{ key: CongressoStep; label: string }> = [
  { key: 'evento', label: 'Evento' },
  { key: 'bemvindos', label: 'Bem-vindos' },
  { key: 'modalidade', label: 'Modalidade' },
  { key: 'participantes', label: 'Participantes' },
  { key: 'sorteio', label: 'Sorteio' },
]

const STEP_INDEX: Record<CongressoStep, number> = {
  evento: 0,
  bemvindos: 1,
  modalidade: 2,
  participantes: 3,
  campeoes: 4,
  sorteio: 4,
}

type ContextoCongresso = {
  evento?: string
  modalidade?: string
}

type Props = {
  step: CongressoStep
  onBack?: () => void
  contexto?: ContextoCongresso
  eventoLogoUrl?: string | null
  children: React.ReactNode
}

export default function CongressoShell({ step, onBack, contexto, eventoLogoUrl, children }: Props) {
  const navigate = useNavigate()
  const theme = useThemeStore(s => s.theme)
  const toggleTheme = useThemeStore(s => s.toggle)
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement)
  const currentIdx = STEP_INDEX[step]
  // No passo de sorteio, o passo gerencia o próprio scroll (header fixo + resultado
  // rolando); no bem-vindos a lista de participantes pagina conforme a altura
  // disponível. Ambos precisam que a altura seja propagada por toda a cadeia até o
  // conteúdo. Nos demais passos o scroll continua no .cw-main (altura natural).
  const fillHeight = step === 'sorteio' || step === 'bemvindos'

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch { /* negado */ }
  }

  async function handleSair() {
    try { if (document.fullscreenElement) await document.exitFullscreen() } catch {}
    navigate('/eventos')
  }

  const showBreadcrumb = !!(contexto?.evento || contexto?.modalidade)

  return (
    <div className="cw">
      <div className="cw-blob" style={{ background: 'var(--cw-blob1)', top: -180, right: -180 }} />
      <div className="cw-blob" style={{ background: 'var(--cw-blob2)', bottom: -220, left: -160, animationDelay: '4s' }} />

      <div className="cw-top">
        <div className="cw-brand">
          <div className="cw-glyph" style={{ padding: 0, background: 'transparent', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
            {eventoLogoUrl ? (
              <img
                src={eventoLogoUrl}
                alt="Logo do evento"
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            ) : (
              <LogoMontana variant="simbolo" height={40} />
            )}
          </div>
          <div>
            <div className="cw-brand-name">ProSports</div>
            <div className="cw-brand-sub">CONGRESSO</div>
          </div>
        </div>

        <div className="cw-steps">
          {STEPS.map((s, i) => {
            const state = i === currentIdx ? 'on' : i < currentIdx ? 'done' : ''
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div className={`cw-step ${state}`}>
                  <span className="cw-step-num">{i < currentIdx ? '✓' : i + 1}</span>
                  <span className="cw-step-label">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <span className={`cw-stepline ${i < currentIdx ? 'on' : ''}`} />
                )}
              </div>
            )
          })}
        </div>

        <div className="cw-actions">
          <button
            onClick={toggleTheme}
            className="cw-iconbtn"
            title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="cw-iconbtn"
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
          <button onClick={handleSair} className="cw-exit">
            <X size={16} /> Sair
          </button>
        </div>
      </div>

      {showBreadcrumb && (
        <div className="cw-ctx">
          {contexto?.evento && <span>{contexto.evento}</span>}
          {contexto?.evento && contexto?.modalidade && <span className="cw-ctx-sep">›</span>}
          {contexto?.modalidade && <span>{contexto.modalidade}</span>}
          {onBack && (
            <button
              onClick={onBack}
              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--cw-faint)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
            >← Voltar</button>
          )}
        </div>
      )}

      <div className="cw-main">
        <div className="cw-panel" style={{ position: 'relative', ...(fillHeight ? { height: '100%' } : null) }}>
          {eventoLogoUrl && (step === 'participantes' || step === 'sorteio') && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute', inset: 0,
                display: 'grid', placeItems: 'center',
                pointerEvents: 'none', zIndex: 0,
                overflow: 'hidden',
              }}
            >
              <img
                src={eventoLogoUrl}
                alt=""
                style={{
                  maxWidth: '55%', maxHeight: '60%',
                  objectFit: 'contain',
                  opacity: 0.06,
                  filter: 'grayscale(40%)',
                }}
              />
            </div>
          )}
          <div style={{ position: 'relative', zIndex: 1, ...(fillHeight ? { height: '100%' } : null) }}>{children}</div>
        </div>
      </div>
    </div>
  )
}
