import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import { delegacoesService } from '../../services/delegacoes'
import type { Delegacao } from '../../types/fundacao'

export default function DelegacoesList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['delegacoes'],
    queryFn: delegacoesService.listar,
  })

  const { mutate: remover } = useMutation({
    mutationFn: delegacoesService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['delegacoes'] }),
  })

  function confirmarRemocao(id: number, nome: string) {
    if (confirm(`Remover delegação "${nome}"?`)) remover(id)
  }

  const columns = [
    {
      header: 'Logo',
      accessor: (row: Delegacao) =>
        row.logo_path
          ? <img src={`/uploads/delegacoes/${row.logo_path}`} alt={row.nome} className="w-8 h-8 rounded-full object-cover" />
          : <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400">{row.nome[0]}</div>,
      className: 'w-16',
    },
    { header: 'Nome', accessor: (row: Delegacao) => row.nome },
    { header: 'Município', accessor: (row: Delegacao) => row.municipio },
    { header: 'Estado', accessor: (row: Delegacao) => row.estado },
    {
      header: 'Ações',
      accessor: (row: Delegacao) => (
        <div className="flex gap-2">
          <button onClick={() => navigate(`/delegacoes/${row.id}/editar`)} className="text-indigo-400 hover:text-indigo-300 text-xs">Editar</button>
          <button onClick={() => confirmarRemocao(row.id, row.nome)} className="text-red-400 hover:text-red-300 text-xs">Remover</button>
        </div>
      ),
      className: 'w-28',
    },
  ]

  return (
    <div className="text-white">
      <PageHeader title="Delegações" actionLabel="+ Nova Delegação" actionTo="/delegacoes/nova" />
      <div className="p-6">
        {isLoading ? (
          <p className="text-gray-400 text-sm">Carregando...</p>
        ) : (
          <DataTable columns={columns} data={data} keyExtractor={(row) => row.id} emptyMessage="Nenhuma delegação cadastrada." />
        )}
      </div>
    </div>
  )
}
