import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { usersService } from '../../services/users'
import type { User } from '../../types/user'
import { X, Check, Key } from '../../lib/icons'

type Props = {
  user: User
  onClose: () => void
}

export default function ResetSenhaModal({ user, onClose }: Props) {
  const [nova, setNova] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: () => usersService.resetarSenha(user.id, nova),
    onSuccess: () => {
      alert(`Senha de ${user.nome} redefinida. O usuário foi deslogado.`)
      onClose()
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao redefinir.'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (nova.length < 8) return setErro('A nova senha deve ter no mínimo 8 caracteres.')
    if (nova !== confirma) return setErro('As senhas não conferem.')
    mutate()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 24,
          maxWidth: 460,
          width: '92%',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
              color: '#fff', display: 'grid', placeItems: 'center',
            }}
          >
            <Key size={18} />
          </div>
          <div>
            <div className="eyebrow">Resetar senha</div>
            <h3 className="sec-title" style={{ fontSize: 17 }}>
              {user.nome}
            </h3>
          </div>
        </div>

        <p className="text-sm text-[var(--t2)] mb-4">
          Defina uma nova senha para este usuário. Ao salvar, as sessões ativas serão encerradas e ele precisará entrar novamente.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                Nova senha <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="password"
                value={nova}
                onChange={(e) => setNova(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                Confirmar nova senha <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                type="password"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
              />
            </div>
          </div>

          {erro && (
            <div
              style={{
                background: 'var(--danger-soft)',
                color: 'var(--danger)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-lg)',
                padding: '10px 14px',
                fontSize: 13,
                marginTop: 12,
              }}
            >
              {erro}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-5">
            <button type="button" onClick={onClose} className="btn btn-ghost"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <X size={16} /> Cancelar
            </button>
            <button type="submit" disabled={isPending} className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: isPending ? 0.5 : 1 }}>
              <Check size={16} /> {isPending ? 'Salvando...' : 'Redefinir senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
