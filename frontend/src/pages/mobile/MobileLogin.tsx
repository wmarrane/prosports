import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { keyAccessService } from '../../services/key-access'
import { getDeviceFingerprint, getDeviceLabel } from '../../lib/device'
import { setKeyToken } from '../../lib/api-key'
import LogoMontana from '../../components/LogoMontana'

export default function MobileLogin() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { setErro('Link inválido.'); setLoading(false); return }
    keyAccessService.login({
      token,
      device_fp: getDeviceFingerprint(),
      device_label: getDeviceLabel(),
    })
      .then(r => {
        setKeyToken(r.keyToken)
        navigate('/m', { replace: true })
      })
      .catch((e: any) => {
        const code = e?.response?.data?.code
        const msg = e?.response?.data?.message
        if (code === 'device_mismatch') {
          setErro(msg ?? 'Esta chave já está em uso em outro aparelho. Solicite ao organizador o reset.')
        } else {
          setErro(msg ?? 'Chave inválida ou revogada.')
        }
        setLoading(false)
      })
  }, [token, navigate])

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--grad-brand-deep)', color: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 20, gap: 24,
    }}>
      <div style={{ background: 'rgba(255,255,255,0.96)', borderRadius: 18, padding: 16, boxShadow: '0 12px 28px rgba(0,0,0,0.3)' }}>
        <LogoMontana variant="simbolo" height={64} />
      </div>
      {loading && <p style={{ fontSize: 16, opacity: 0.85 }}>Validando acesso...</p>}
      {erro && (
        <div style={{
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)',
          padding: '14px 18px', borderRadius: 12, maxWidth: 420, textAlign: 'center', fontSize: 14,
        }}>
          {erro}
        </div>
      )}
    </div>
  )
}
