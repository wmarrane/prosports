import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useToast } from '../../components/Toast'
import { participantesService } from '../../services/participantes'
import type { Participante } from '../../types/participante'
import { Plus } from '../../lib/icons'
import { Users, Search } from 'lucide-react'

export default function ParticipantesList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [removerAlvo, setRemoverAlvo] = useState<{ id: number; nome: string } | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['participantes'],
    queryFn: participantesService.listar,
  })

  const { mutate: remover } = useMutation({
    mutationFn: participantesService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['participantes'] }),
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  // Filtragem client-side por nome / subtitulo / municipio
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const base = [...data].sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
    )
    if (!term) return base
    return base.filter(p =>
      p.nome.toLowerCase().includes(term)
      || (p.subtitulo ?? '').toLowerCase().includes(term)
      || (p.municipio?.nome ?? '').toLowerCase().includes(term)
    )
  }, [data, q])

  const columns = [
    {
      header: 'Nome',
      accessor: (row: Participante) => (
        <span className="font-semibold text-[var(--t1)]">{row.nome}</span>
      ),
    },
    {
      header: 'Subtítulo',
      accessor: (row: Participante) =>
        row.subtitulo ? (
          <span className="text-[var(--t2)]">{row.subtitulo}</span>
        ) : (
          <span className="text-[var(--t4)]">—</span>
        ),
    },
    {
      header: 'Inspetoria',
      accessor: (row: Participante) =>
        row.inspetoria?.nome ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--brand-50)',
              color: 'var(--brand-700)',
              display: 'inline-block',
            }}
          >
            {row.inspetoria.nome}
          </span>
        ) : (
          <span className="text-[var(--t4)]">—</span>
        ),
    },
    {
      header: 'Delegacia',
      accessor: (row: Participante) =>
        row.delegacia?.nome ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              background: 'rgba(139, 92, 246, 0.12)',
              color: 'rgb(124, 58, 237)',
              display: 'inline-block',
            }}
          >
            {row.delegacia.nome}
          </span>
        ) : (
          <span className="text-[var(--t4)]">—</span>
        ),
    },
    {
      header: 'Município',
      accessor: (row: Participante) => (
        <span className="text-[var(--t2)]">
          {row.municipio.nome}{' '}
          <span
            className="font-mono text-xs font-bold"
            style={{
              background: 'var(--card-bg-2)',
              color: 'var(--t3)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              marginLeft: 4,
            }}
          >
            {row.municipio.uf}
          </span>
        </span>
      ),
    },
    {
      header: 'Ações',
      accessor: (row: Participante) => (
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/participantes/${row.id}/editar`)}
            className="text-[var(--brand-500)] hover:text-[var(--brand-400)] text-xs font-semibold"
          >
            Editar
          </button>
          <button
            onClick={() => setRemoverAlvo({ id: row.id, nome: row.nome })}
            className="text-[var(--danger)] hover:text-[var(--danger-700)] text-xs font-semibold"
          >
            Remover
          </button>
        </div>
      ),
      className: 'w-32',
    },
  ]

  const inputClass =
    'px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:border-transparent'

  const totalLabel = data.length.toLocaleString('pt-BR')

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Cadastro"
        title="Participantes"
        sub="Cadastro global de participantes — um cadastro serve para qualquer competição e evento."
        actions={
          <button onClick={() => navigate('/participantes/novo')} className="btn btn-primary">
            <Plus size={16} /> Novo Participante
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
                Buscar por nome, subtítulo ou município
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
                  placeholder="Ex.: João Silva, Clube XYZ, São Paulo..."
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
                  {data.length === 1 ? 'participante' : 'participantes'}
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
                  ? `Nenhum participante encontrado com "${q}".`
                  : 'Nenhum participante cadastrado.'
              }
            />
          </section>
        )}
      </div>

      <ConfirmDialog
        open={removerAlvo !== null}
        onClose={() => setRemoverAlvo(null)}
        onConfirm={() => { if (removerAlvo) remover(removerAlvo.id) }}
        title={removerAlvo ? `Remover "${removerAlvo.nome}"?` : ''}
        description="Esta ação não pode ser desfeita."
        confirmLabel="Remover"
      />
    </div>
  )
}
