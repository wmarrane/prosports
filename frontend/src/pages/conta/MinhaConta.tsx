import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { useAuthStore } from '../../store/authStore'
import { usersService } from '../../services/users'
import { Key } from '../../lib/icons'

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  PARTICIPANTE: 'Participante',
  VIEWER: 'Viewer',
}

export default function MinhaConta() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const { data: detalhe } = useQuery({
    queryKey: ['users', user?.id, 'me'],
    queryFn: () => usersService.buscar(user!.id),
    enabled: Boolean(user?.id),
  })

  const ultimo = detalhe?.ultimo_login
    ? new Date(detalhe.ultimo_login).toLocaleString('pt-BR')
    : 'Nunca'

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Conta"
        title="Minha conta"
        sub="Informações do seu acesso ao sistema."
      />
      <div className="p-6" style={{ maxWidth: 640 }}>
        <section style={{
          background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-xl)', padding: 28, boxShadow: 'var(--shadow-card)',
        }}>
          <div className="flex items-center gap-4 mb-6">
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--grad-brand-deep)', color: '#fff',
              display: 'grid', placeItems: 'center',
              fontSize: 22, fontWeight: 800,
            }}>
              {(user?.email ?? 'U').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-xl font-bold text-[var(--t1)]">{user?.nome}</div>
              <div className="text-sm text-[var(--t3)]">{user?.email}</div>
            </div>
          </div>

          <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <dt className="text-xs text-[var(--t3)] uppercase tracking-wider mb-1">Perfil</dt>
              <dd className="text-sm text-[var(--t1)] font-semibold">
                {ROLE_LABEL[user?.role ?? ''] ?? user?.role}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--t3)] uppercase tracking-wider mb-1">Último login</dt>
              <dd className="text-sm text-[var(--t1)] font-mono">{ultimo}</dd>
            </div>
          </dl>

          <div className="flex gap-2 mt-6">
            <button onClick={() => navigate('/conta/senha')} className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Key size={14} /> Trocar senha
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
