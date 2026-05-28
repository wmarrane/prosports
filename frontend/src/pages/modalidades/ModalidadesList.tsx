import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import { modalidadesService } from '../../services/modalidades'
import type { Modalidade } from '../../types/fundacao'

export default function ModalidadesList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['modalidades'],
    queryFn: modalidadesService.listar,
  })

  const { mutate: remover } = useMutation({
    mutationFn: modalidadesService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['modalidades'] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const columns = [
    { header: 'Nome', accessor: (row: Modalidade) => row.nome },
    { header: 'Descrição', accessor: (row: Modalidade) => row.descricao ?? '—' },
    { header: 'Categorias', accessor: (row: Modalidade) => row._count?.categorias ?? 0, className: 'w-24 text-center' },
    {
      header: 'Ações',
      accessor: (row: Modalidade) => (
        <div className="flex gap-2">
          <button onClick={() => navigate(`/modalidades/${row.id}/editar`)} className="text-indigo-400 hover:text-indigo-300 text-xs">Editar</button>
          <button onClick={() => { if (confirm(`Remover "${row.nome}"?`)) remover(row.id) }} className="text-red-400 hover:text-red-300 text-xs">Remover</button>
        </div>
      ),
      className: 'w-28',
    },
  ]

  return (
    <div className="text-white">
      <PageHeader title="Modalidades" actionLabel="+ Nova Modalidade" actionTo="/modalidades/nova" />
      <div className="p-6">
        {isLoading ? <p className="text-gray-400 text-sm">Carregando...</p>
          : <DataTable columns={columns} data={data} keyExtractor={r => r.id} emptyMessage="Nenhuma modalidade cadastrada." />}
      </div>
    </div>
  )
}
