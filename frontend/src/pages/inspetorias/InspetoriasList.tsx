import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import { inspetoriasService } from '../../services/inspetorias'
import type { Inspetoria } from '../../types/participante'

export default function InspetoriasList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['inspetorias'],
    queryFn: inspetoriasService.listar,
  })

  const { mutate: remover } = useMutation({
    mutationFn: inspetoriasService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inspetorias'] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const columns = [
    { header: 'Nome', accessor: (row: Inspetoria) => row.nome },
    {
      header: 'Ações',
      accessor: (row: Inspetoria) => (
        <div className="flex gap-2">
          <button onClick={() => navigate(`/inspetorias/${row.id}/editar`)} className="text-[var(--brand-500)] hover:text-[var(--brand-400)] text-xs">Editar</button>
          <button onClick={() => { if (confirm(`Remover "${row.nome}"?`)) remover(row.id) }} className="text-[var(--danger)] hover:text-[var(--danger-700)] text-xs">Remover</button>
        </div>
      ),
      className: 'w-28',
    },
  ]

  return (
    <div className="text-[var(--t1)]">
      <PageHeader title="Inspetorias" actionLabel="+ Nova Inspetoria" actionTo="/inspetorias/novo" />
      <div className="p-6">
        {isLoading ? <p className="text-[var(--t3)] text-sm">Carregando...</p>
          : <DataTable columns={columns} data={data} keyExtractor={r => r.id} emptyMessage="Nenhuma inspetoria cadastrada." />}
      </div>
    </div>
  )
}
