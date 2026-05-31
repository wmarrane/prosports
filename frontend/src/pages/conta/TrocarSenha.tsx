import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { useAuthStore } from '../../store/authStore'
import { usersService } from '../../services/users'
import { Check, X, Key } from '../../lib/icons'

export default function TrocarSenha() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: () => usersService.alterarSenha(atual, nova),
    onSuccess: async () => {
      alert('Senha alterada. Por segurança, faça login novamente.')
      await logout()
      navigate('/login', { replace: true })
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao alterar.'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (nova.length < 8) return setErro('A nova senha deve ter no mínimo 8 caracteres.')
    if (nova !== confirma) return setErro('As novas senhas não conferem.')
    if (nova === atual) return setErro('A nova senha deve ser diferente da atual.')
    mutate()
  }

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:border-transparent'

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Conta"
        title="Trocar senha"
        sub="Após salvar, suas sessões ativas serão encerradas e você precisará entrar novamente."
        backTo="/conta"
      />
      <div className="p-6" style={{ maxWidth: 560 }}>
        <form onSubmit={handleSubmit}>
          <section style={{
            background: 'var(--card-bg)', border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-xl)', padding: 24, boxShadow: 'var(--shadow-card)',
          }}>
            <div className="flex items-center gap-3 mb-5">
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                color: '#fff', display: 'grid', placeItems: 'center',
              }}>
                <Key size={18} />
              </div>
              <div>
                <div className="eyebrow">Segurança</div>
                <h3 className="sec-title" style={{ fontSize: 17 }}>Nova senha</h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Senha atual <span className="text-[var(--danger)]">*</span>
                </label>
                <input type="password" value={atual} onChange={(e) => setAtual(e.target.value)}
                  required className={inputClass} autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Nova senha <span className="text-[var(--danger)]">*</span>
                  <span className="text-[var(--t4)] font-normal text-xs ml-2">(mín. 8 caracteres)</span>
                </label>
                <input type="password" value={nova} onChange={(e) => setNova(e.target.value)}
                  required minLength={8} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Confirmar nova senha <span className="text-[var(--danger)]">*</span>
                </label>
                <input type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)}
                  required minLength={8} className={inputClass} />
              </div>
            </div>

            {erro && (
              <div style={{
                background: 'var(--danger-soft)', color: 'var(--danger)',
                border: '1px solid var(--danger)', borderRadius: 'var(--radius-lg)',
                padding: '10px 14px', fontSize: 13, marginTop: 14,
              }}>{erro}</div>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => navigate('/conta')} className="btn btn-ghost"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <X size={16} /> Cancelar
              </button>
              <button type="submit" disabled={isPending} className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: isPending ? 0.5 : 1 }}>
                <Check size={16} /> {isPending ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </div>
          </section>
        </form>
      </div>
    </div>
  )
}
