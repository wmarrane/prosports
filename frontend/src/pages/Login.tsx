import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import {
  Sun, Moon, Bracket, Groups, Order, Lock, Check, Report, ArrowRight,
} from '../lib/icons'

export default function Login() {
  const navigate = useNavigate()
  const { login, loading } = useAuthStore()
  const { theme, toggle } = useThemeStore()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    try {
      await login({ email, senha })
      navigate('/painel', { replace: true })
    } catch (err: any) {
      setErro(err?.response?.data?.message ?? 'Não foi possível conectar. Tente novamente.')
    }
  }

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', background: 'var(--card-bg)', overflow: 'hidden' }}>
      {/* theme toggle, floating top-right */}
      <button
        className="icon-btn"
        onClick={toggle}
        title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
        style={{ position: 'absolute', top: 22, right: 26, zIndex: 30, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' }}
      >
        {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
      </button>

      {/* Left hero */}
      <div
        className="dotgrid login-hero"
        style={{
          flex: '0 0 52%',
          position: 'relative',
          background: 'var(--grad-brand-deep)',
          color: '#fff',
          padding: '54px 60px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', width: 440, height: 440, borderRadius: '50%', background: 'rgba(96,165,250,0.40)', filter: 'blur(85px)', top: -130, right: -90, animation: 'floaty 11s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', background: 'rgba(20,184,138,0.30)', filter: 'blur(75px)', bottom: -90, left: 60, animation: 'floaty 8s ease-in-out infinite' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 50, height: 50, borderRadius: 14, background: 'var(--grad-brand)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 900, fontSize: 19, letterSpacing: '-0.04em', boxShadow: '0 8px 26px rgba(16,97,216,0.5)' }}>PS</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-0.01em' }}>ProSports</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', opacity: 0.55, marginTop: 3 }}>SORTEIOS&nbsp;&amp;&nbsp;COMPETIÇÕES</div>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.55)' }}>Plataforma · Sorteios esportivos</div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 40,
              letterSpacing: '-0.03em',
              lineHeight: 1.12,
              margin: '12px 0 16px',
              maxWidth: 480,
              color: '#fff',
              textWrap: 'balance',
            }}
          >
            Sorteios justos, aleatórios e auditáveis.
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.78)', lineHeight: 1.55, maxWidth: 460 }}>
            Receba os inscritos e conduza o sorteio de chaves, grupos ou ordem de entrada em segundos —
            cada resultado com semente registrada e reproduzível.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            {[
              { Icon: Bracket, label: 'Chaves' },
              { Icon: Groups, label: 'Grupos' },
              { Icon: Order, label: 'Ordem de entrada' },
            ].map(({ Icon, label }) => (
              <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 9999, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.16)', fontSize: 12.5, fontWeight: 600 }}>
                <Icon size={15} /> {label}
              </span>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', display: 'flex', gap: 30 }}>
          {[['1.482', 'Inscritos ativos'], ['47', 'Sorteios realizados'], ['100%', 'Auditados']].map(([v, l]) => (
            <div key={l}>
              <div className="tabular" style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 23, letterSpacing: '-0.02em' }}>{v}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.18em', marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right form */}
      <div style={{ flex: 1, padding: '56px 64px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'var(--card-bg)' }}>
        <form onSubmit={handleSubmit} style={{ maxWidth: 380, width: '100%' }}>
          <div className="eyebrow">Acesso administrativo</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 29, letterSpacing: '-0.025em', margin: '8px 0 6px', color: 'var(--t1)' }}>
            Entrar na plataforma
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--t3)', lineHeight: 1.55, margin: 0 }}>
            Use suas credenciais de administrador para gerenciar eventos e conduzir sorteios.
          </p>

          <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 15 }}>
            <div>
              <label className="field-label" style={{ color: 'var(--t3)' }}>E-mail corporativo</label>
              <input
                className="lg-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <label className="field-label" style={{ color: 'var(--t3)', margin: 0 }}>Senha</label>
                <a style={{ fontSize: 11.5, color: 'var(--brand-500)', fontWeight: 600, cursor: 'pointer' }}>Esqueci a senha</a>
              </div>
              <input
                className="lg-input"
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, color: 'var(--t2)', marginTop: 2, cursor: 'pointer' }}>
              <span style={{ width: 17, height: 17, borderRadius: 5, background: 'var(--grad-brand)', display: 'grid', placeItems: 'center' }}>
                <Check size={11} style={{ color: '#fff', strokeWidth: 3 }} />
              </span>
              Manter conectado neste dispositivo
            </label>

            {erro && (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)', color: 'var(--danger)', fontSize: 13 }}>
                {erro}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ marginTop: 10, justifyContent: 'center', width: '100%' }}
            >
              {loading ? <>Entrando…</> : <>Entrar no ProSports <ArrowRight size={16} /></>}
            </button>
          </div>

          <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: 'var(--t4)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Lock size={12} /> Criptografado
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Check size={12} /> Acesso por JWT
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Report size={12} /> Logs de auditoria
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}
