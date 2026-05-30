import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import { modalidadesService } from '../../services/modalidades'
import type { Modalidade } from '../../types/modalidade'

export default function ModalidadesList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['modalidades'],
    queryFn: () => modalidadesService.listar(),
  })

  const { mutate: remover } = useMutation({
    mutationFn: modalidadesService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['modalidades'] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const columns = [
    { header: 'Competição', accessor: (row: Modalidade) => row.competicao.nome },
    { header: 'Tipo', accessor: (row: Modalidade) => row.tipo_modalidade.nome },
    { header: 'Nome', accessor: (row: Modalidade) => row.nome },
    { header: 'Sigla', accessor: (row: Modalidade) => row.sigla, className: 'w-20 font-mono' },
    {
      header: 'Ações',
      accessor: (row: Modalidade) => (
        <div className="flex gap-2">
          <button onClick={() => navigate(`/modalidades/${row.id}/editar`)} className="text-[var(--brand-500)] hover:text-[var(--brand-400)] text-xs">Editar</button>
          <button onClick={() => { if (confirm(`Remover "${row.nome}"?`)) remover(row.id) }} className="text-[var(--danger)] hover:text-[var(--danger-700)] text-xs">Remover</button>
        </div>
      ),
      className: 'w-28',
    },
  ]

  return (
    <div className="text-[var(--t1)]">
      <PageHeader title="Modalidades" actionLabel="+ Nova Modalidade" actionTo="/modalidades/nova" />
      <div className="p-6">
        {isLoading ? <p className="text-[var(--t3)] text-sm">Carregando...</p>
          : <DataTable columns={columns} data={data} keyExtractor={r => r.id} emptyMessage="Nenhuma modalidade cadastrada." />}
      </div>
    </div>
  )
}
