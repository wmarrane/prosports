import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import { tiposModalidadeService } from '../../services/tipos-modalidade'
import type { TipoModalidade } from '../../types/modalidade'

export default function TiposModalidadeList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['tipos-modalidade'],
    queryFn: tiposModalidadeService.listar,
  })

  const { mutate: remover } = useMutation({
    mutationFn: tiposModalidadeService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tipos-modalidade'] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const columns = [
    { header: 'Nome', accessor: (row: TipoModalidade) => row.nome },
    {
      header: 'Ações',
      accessor: (row: TipoModalidade) => (
        <div className="flex gap-2">
          <button onClick={() => navigate(`/tipos-modalidade/${row.id}/editar`)} className="text-[var(--brand-500)] hover:text-[var(--brand-400)] text-xs">Editar</button>
          <button onClick={() => { if (confirm(`Remover "${row.nome}"?`)) remover(row.id) }} className="text-[var(--danger)] hover:text-[var(--danger-700)] text-xs">Remover</button>
        </div>
      ),
      className: 'w-28',
    },
  ]

  return (
    <div className="text-[var(--t1)]">
      <PageHeader title="Tipos de Modalidade" actionLabel="+ Novo Tipo" actionTo="/tipos-modalidade/novo" />
      <div className="p-6">
        {isLoading ? <p className="text-[var(--t3)] text-sm">Carregando...</p>
          : <DataTable columns={columns} data={data} keyExtractor={r => r.id} emptyMessage="Nenhum tipo cadastrado." />}
      </div>
    </div>
  )
}
