import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import { delegaciasService } from '../../services/delegacias'
import type { Delegacia } from '../../types/participante'

export default function DelegaciasList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['delegacias'],
    queryFn: delegaciasService.listar,
  })

  const { mutate: remover } = useMutation({
    mutationFn: delegaciasService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['delegacias'] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const columns = [
    { header: 'Nome', accessor: (row: Delegacia) => row.nome },
    {
      header: 'Ações',
      accessor: (row: Delegacia) => (
        <div className="flex gap-2">
          <button onClick={() => navigate(`/delegacias/${row.id}/editar`)} className="text-indigo-400 hover:text-indigo-300 text-xs">Editar</button>
          <button onClick={() => { if (confirm(`Remover "${row.nome}"?`)) remover(row.id) }} className="text-red-400 hover:text-red-300 text-xs">Remover</button>
        </div>
      ),
      className: 'w-28',
    },
  ]

  return (
    <div className="text-white">
      <PageHeader title="Delegacias" actionLabel="+ Nova Delegacia" actionTo="/delegacias/nova" />
      <div className="p-6">
        {isLoading ? <p className="text-gray-400 text-sm">Carregando...</p>
          : <DataTable columns={columns} data={data} keyExtractor={r => r.id} emptyMessage="Nenhuma delegacia cadastrada." />}
      </div>
    </div>
  )
}
