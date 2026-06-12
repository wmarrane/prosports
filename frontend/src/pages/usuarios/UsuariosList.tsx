import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useToast } from '../../components/Toast'
import { usersService } from '../../services/users'
import type { User } from '../../types/user'
import { Plus, Key, Users, Search } from '../../lib/icons'
import ResetSenhaModal from './ResetSenhaModal'

const ROLE_PILL: Record<string, { label: string; bg: string; color: string }> = {
  ADMIN: { label: 'Admin', bg: 'var(--brand-deep)', color: '#fff' },
  PARTICIPANTE: { label: 'Participante', bg: 'var(--success-soft)', color: 'var(--success-700)' },
  VIEWER: { label: 'Viewer', bg: 'var(--brand-50)', color: 'var(--brand-700)' },
  COMISSAO_TECNICA: { label: 'Comissão Técnica', bg: 'var(--warn-soft)', color: 'var(--warn-700)' },
}

export default function UsuariosList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [resetTarget, setResetTarget] = useState<User | null>(null)
  const [alvo, setAlvo] = useState<User | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersService.listar,
  })

  const { mutateAsync: remover } = useMutation({
    mutationFn: usersService.remover,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Usuário removido.')
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const base = [...data].sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
    )
    if (!term) return base
    return base.filter((u) =>
      u.nome.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
    )
  }, [data, q])

  const columns = [
    {
      header: 'Nome',
      accessor: (row: User) => (
        <div>
          <div className="font-semibold text-[var(--t1)]">{row.nome}</div>
          <div className="text-xs text-[var(--t3)]">{row.email}</div>
        </div>
      ),
    },
    {
      header: 'Perfil',
      accessor: (row: User) => {
        const p = ROLE_PILL[row.role] ?? { label: row.role, bg: 'var(--card-bg-2)', color: 'var(--t2)' }
        return (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 9px',
            borderRadius: 'var(--radius-pill)',
            background: p.bg, color: p.color, display: 'inline-block',
          }}>{p.label}</span>
        )
      },
    },
    {
      header: 'Ativo',
      accessor: (row: User) => (
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 8px',
          borderRadius: 'var(--radius-pill)',
          background: row.ativo ? 'var(--success-soft)' : 'var(--danger-soft)',
          color: row.ativo ? 'var(--success-700)' : 'var(--danger)',
        }}>{row.ativo ? 'Sim' : 'Não'}</span>
      ),
    },
    {
      header: 'Último login',
      accessor: (row: User) =>
        row.ultimo_login ? (
          <span className="font-mono text-xs text-[var(--t2)]">
            {new Date(row.ultimo_login).toLocaleString('pt-BR')}
          </span>
        ) : (
          <span className="text-xs text-[var(--t4)]">Nunca</span>
        ),
    },
    {
      header: 'Ações',
      accessor: (row: User) => (
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/usuarios/${row.id}/editar`)}
            className="text-[var(--brand-500)] hover:text-[var(--brand-400)] text-xs font-semibold"
          >
            Editar
          </button>
          <button
            onClick={() => setResetTarget(row)}
            className="text-[var(--t2)] hover:text-[var(--t1)] text-xs font-semibold"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <Key size={12} /> Senha
          </button>
          <button
            onClick={() => setAlvo(row)}
            className="text-[var(--danger)] hover:text-[var(--danger-700)] text-xs font-semibold"
          >
            Remover
          </button>
        </div>
      ),
    },
  ]

  const inputClass =
    'px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:border-transparent'

  const totalLabel = data.length.toLocaleString('pt-BR')

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Administração"
        title="Usuários"
        sub="Gerencie quem tem acesso ao sistema e qual o papel de cada um."
        actions={
          <button onClick={() => navigate('/usuarios/novo')} className="btn btn-primary">
            <Plus size={16} /> Novo Usuário
          </button>
        }
      />

      <div className="p-6">
        {/* Card de filtros */}
        <section
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-xl)',
            padding: 18,
            marginBottom: 16,
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[280px]">
              <label className="block text-xs font-semibold text-[var(--t3)] uppercase tracking-wider mb-1.5">
                Buscar por nome ou email
              </label>
              <div style={{ position: 'relative' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--t4)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  className={`${inputClass} w-full`}
                  style={{ paddingLeft: 36 }}
                  placeholder="Ex.: João Silva, joao@email.com..."
                />
              </div>
            </div>
            <div className="text-xs text-[var(--t3)] flex items-center gap-2 self-end pb-2">
              <Users size={14} className="text-[var(--brand-500)]" />
              {q ? (
                <>
                  <b className="font-mono text-[var(--t1)]">{filtered.length}</b> de{' '}
                  <b className="font-mono text-[var(--t1)]">{totalLabel}</b>
                </>
              ) : (
                <>
                  <b className="font-mono text-[var(--t1)]">{totalLabel}</b>{' '}
                  {data.length === 1 ? 'usuário' : 'usuários'}
                </>
              )}
            </div>
          </div>
        </section>

        {/* Tabela */}
        {isLoading ? (
          <p className="text-[var(--t3)] text-sm">Carregando...</p>
        ) : (
          <section
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-card)',
              overflow: 'hidden',
            }}
          >
            <DataTable
              columns={columns}
              data={filtered}
              keyExtractor={r => r.id}
              emptyMessage={
                q
                  ? `Nenhum usuário encontrado com "${q}".`
                  : 'Nenhum usuário cadastrado.'
              }
            />
          </section>
        )}
      </div>

      {resetTarget && (
        <ResetSenhaModal user={resetTarget} onClose={() => setResetTarget(null)} />
      )}

      <ConfirmDialog
        open={alvo !== null}
        onClose={() => setAlvo(null)}
        onConfirm={() => alvo && remover(alvo.id)}
        eyebrow="Remover usuário"
        title={alvo?.nome ?? ''}
        description={`O acesso de ${alvo?.email ?? ''} será revogado imediatamente.`}
        confirmLabel="Remover"
        confirmVariant="danger"
        icon="trash"
      />
    </div>
  )
}
