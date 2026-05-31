import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import { municipiosService } from '../../services/municipios'
import type { Municipio } from '../../types/municipio'
import { UFS } from '../../lib/ufs'
import { Plus, Download } from '../../lib/icons'
import { Building2, Search } from 'lucide-react'

const PAGE_SIZE = 50

export default function MunicipiosList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [uf, setUf] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['municipios', { uf, q, page }],
    queryFn: () => municipiosService.listar({ uf: uf || undefined, q: q || undefined, page, limit: PAGE_SIZE }),
  })

  const { mutate: remover } = useMutation({
    mutationFn: municipiosService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['municipios'] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  function confirmarRemocao(id: number, nome: string) {
    if (confirm(`Remover município "${nome}"?`)) remover(id)
  }

  const columns = [
    {
      header: 'Código IBGE',
      accessor: (row: Municipio) => (
        <span className="font-mono text-[var(--t3)]">{row.codigo_ibge}</span>
      ),
      className: 'w-32',
    },
    {
      header: 'Nome',
      accessor: (row: Municipio) => (
        <span className="font-semibold text-[var(--t1)]">{row.nome}</span>
      ),
    },
    {
      header: 'UF',
      accessor: (row: Municipio) => (
        <span
          className="font-mono text-xs font-bold"
          style={{
            background: 'var(--brand-50)',
            color: 'var(--brand-700)',
            padding: '3px 8px',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {row.uf}
        </span>
      ),
      className: 'w-16',
    },
    {
      header: 'Ações',
      accessor: (row: Municipio) => (
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/municipios/${row.id}/editar`)}
            className="text-[var(--brand-500)] hover:text-[var(--brand-400)] text-xs font-semibold"
          >
            Editar
          </button>
          <button
            onClick={() => confirmarRemocao(row.id, row.nome)}
            className="text-[var(--danger)] hover:text-[var(--danger-700)] text-xs font-semibold"
          >
            Remover
          </button>
        </div>
      ),
      className: 'w-32',
    },
  ]

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const inputClass =
    'px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:border-transparent'

  const totalLabel = data ? data.total.toLocaleString('pt-BR') : '—'

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Cadastro"
        title="Municípios"
        sub="Cadastro nacional de municípios com código IBGE. Usado para vincular eventos e participantes."
        actions={
          <>
            <button
              onClick={() => navigate('/municipios/importar')}
              className="btn btn-ghost"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Download size={16} /> Importar CSV
            </button>
            <button
              onClick={() => navigate('/municipios/novo')}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={16} /> Novo Município
            </button>
          </>
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
            <div>
              <label className="block text-xs font-semibold text-[var(--t3)] uppercase tracking-wider mb-1.5">
                UF
              </label>
              <select
                value={uf}
                onChange={e => {
                  setUf(e.target.value)
                  setPage(1)
                }}
                className={`${inputClass} w-28`}
              >
                <option value="">Todas</option>
                {UFS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[240px]">
              <label className="block text-xs font-semibold text-[var(--t3)] uppercase tracking-wider mb-1.5">
                Buscar por nome
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
                  onChange={e => {
                    setQ(e.target.value)
                    setPage(1)
                  }}
                  className={`${inputClass} w-full`}
                  style={{ paddingLeft: 36 }}
                  placeholder="Ex.: São Paulo"
                />
              </div>
            </div>
            <div className="text-xs text-[var(--t3)] flex items-center gap-2 self-end pb-2">
              <Building2 size={14} className="text-[var(--brand-500)]" />
              <b className="font-mono text-[var(--t1)]">{totalLabel}</b>{' '}
              {data?.total === 1 ? 'município' : 'municípios'}
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
              data={data?.data ?? []}
              keyExtractor={row => row.id}
              emptyMessage="Nenhum município encontrado com esses filtros."
            />
            {data && data.total > PAGE_SIZE && (
              <div
                className="flex items-center justify-between text-sm text-[var(--t3)]"
                style={{
                  padding: '12px 18px',
                  borderTop: '1px solid var(--card-border)',
                  background: 'var(--card-bg-2)',
                }}
              >
                <span>
                  {Math.min((page - 1) * PAGE_SIZE + 1, data.total)}–
                  {Math.min(page * PAGE_SIZE, data.total)} de{' '}
                  <b className="text-[var(--t1)]">{totalLabel}</b>
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="btn btn-ghost btn-sm"
                    style={{ opacity: page === 1 ? 0.4 : 1 }}
                  >
                    ← Anterior
                  </button>
                  <span className="text-xs font-mono text-[var(--t4)] flex items-center px-2">
                    {page} / {totalPages}
                  </span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="btn btn-ghost btn-sm"
                    style={{ opacity: page >= totalPages ? 0.4 : 1 }}
                  >
                    Próxima →
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
