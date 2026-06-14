import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { keyAccessService } from '../../services/key-access'
import { getDeviceFingerprint, getDeviceLabel } from '../../lib/device'
import { setKeyToken } from '../../lib/api-key'
import LogoMontana from '../../components/LogoMontana'

export default function MobileLogin() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) { setErro('Link inválido.'); return }
    if (!email.trim()) { setErro('Informe o email.'); return }
    setErro('')
    setEnviando(true)
    keyAccessService.login({
      token,
      email: email.trim(),
      device_fp: getDeviceFingerprint(),
      device_label: getDeviceLabel(),
    })
      .then(r => {
        setKeyToken(r.keyToken)
        navigate('/m', { replace: true })
      })
      .catch((err: any) => {
        const code = err?.response?.data?.code
        const msg = err?.response?.data?.message
        if (code === 'email_mismatch') setErro(msg ?? 'Email não confere com o desta chave.')
        else if (code === 'event_expired') setErro(msg ?? 'Acesso ao evento encerrado.')
        else if (code === 'invalid_or_revoked') setErro(msg ?? 'Chave inválida ou revogada.')
        else if (code === 'device_mismatch') setErro(msg ?? 'Esta chave já está em uso em outro aparelho. Solicite ao organizador o reset.')
        else setErro(msg ?? 'Não foi possível acessar. Tente novamente.')
        setEnviando(false)
      })
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--grad-brand-deep)', color: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 20, gap: 24,
    }}>
      <div style={{ background: 'rgba(255,255,255,0.96)', borderRadius: 18, padding: 16, boxShadow: '0 12px 28px rgba(0,0,0,0.3)' }}>
        <LogoMontana variant="simbolo" height={64} />
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14,
          background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: 16, padding: 20,
        }}
      >
        <p style={{ fontSize: 16, fontWeight: 600, textAlign: 'center', margin: 0 }}>
          Confirme seu email para acessar
        </p>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          aria-label="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="seu@email.com"
          disabled={enviando}
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.95)',
            color: '#111', fontSize: 16,
          }}
        />
        <button
          type="submit"
          disabled={enviando}
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 10, border: 'none',
            background: '#fff', color: 'var(--brand-700, #0b3d91)', fontSize: 16, fontWeight: 700,
            cursor: enviando ? 'wait' : 'pointer', opacity: enviando ? 0.6 : 1,
          }}
        >
          {enviando ? 'Acessando...' : 'Acessar'}
        </button>
        {erro && (
          <div role="alert" style={{
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)',
            padding: '12px 14px', borderRadius: 12, textAlign: 'center', fontSize: 14,
          }}>
            {erro}
          </div>
        )}
      </form>
    </div>
  )
}
