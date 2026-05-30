import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import { municipiosService } from '../../services/municipios'
import type { Municipio } from '../../types/municipio'
import { UFS } from '../../lib/ufs'

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
    { header: 'Código IBGE', accessor: (row: Municipio) => row.codigo_ibge, className: 'w-32' },
    { header: 'Nome', accessor: (row: Municipio) => row.nome },
    { header: 'UF', accessor: (row: Municipio) => row.uf, className: 'w-16' },
    {
      header: 'Ações',
      accessor: (row: Municipio) => (
        <div className="flex gap-2">
          <button onClick={() => navigate(`/municipios/${row.id}/editar`)} className="text-[var(--brand-500)] hover:text-[var(--brand-400)] text-xs">Editar</button>
          <button onClick={() => confirmarRemocao(row.id, row.nome)} className="text-[var(--danger)] hover:text-[var(--danger-700)] text-xs">Remover</button>
        </div>
      ),
      className: 'w-28',
    },
  ]

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const inputClass = 'px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]'

  return (
    <div className="text-[var(--t1)]">
      <PageHeader title="Municípios" actionLabel="+ Novo Município" actionTo="/municipios/novo" />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-[var(--t3)] mb-1">UF</label>
            <select value={uf} onChange={(e) => { setUf(e.target.value); setPage(1) }} className={`${inputClass} w-24`}>
              <option value="">Todas</option>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs text-[var(--t3)] mb-1">Buscar por nome</label>
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className={`${inputClass} w-full`} placeholder="Ex.: São Paulo" />
          </div>
          <button onClick={() => navigate('/municipios/importar')} className="px-4 py-2 bg-[var(--card-bg-2)] hover:bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm rounded-lg">
            Importar CSV
          </button>
        </div>

        {isLoading ? (
          <p className="text-[var(--t3)] text-sm">Carregando...</p>
        ) : (
          <>
            <DataTable columns={columns} data={data?.data ?? []} keyExtractor={(row) => row.id} emptyMessage="Nenhum município encontrado." />
            {data && data.total > PAGE_SIZE && (
              <div className="flex items-center justify-between text-sm text-[var(--t3)]">
                <span>{data.total} resultados — página {page} de {totalPages}</span>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded bg-[var(--card-bg-2)] disabled:opacity-50">Anterior</button>
                  <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded bg-[var(--card-bg-2)] disabled:opacity-50">Próxima</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
