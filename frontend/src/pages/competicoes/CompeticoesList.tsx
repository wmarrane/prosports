import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import { competicoesService } from '../../services/competicoes'
import type { Competicao } from '../../types/competicao'

export default function CompeticoesList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['competicoes'],
    queryFn: competicoesService.listar,
  })

  const { mutate: remover } = useMutation({
    mutationFn: competicoesService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['competicoes'] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const columns = [
    { header: 'Nome', accessor: (row: Competicao) => row.nome },
    { header: 'Estados', accessor: (row: Competicao) => row.estados.slice().sort().join(', ') },
    {
      header: 'Subtítulo',
      accessor: (row: Competicao) => row.adicionar_subtitulo ? '✓' : '—',
      className: 'w-20 text-center',
    },
    {
      header: 'Ações',
      accessor: (row: Competicao) => (
        <div className="flex gap-2">
          <button onClick={() => navigate(`/competicoes/${row.id}/editar`)} className="text-indigo-400 hover:text-indigo-300 text-xs">Editar</button>
          <button onClick={() => { if (confirm(`Remover "${row.nome}"?`)) remover(row.id) }} className="text-red-400 hover:text-red-300 text-xs">Remover</button>
        </div>
      ),
      className: 'w-28',
    },
  ]

  return (
    <div className="text-white">
      <PageHeader title="Competições" actionLabel="+ Nova Competição" actionTo="/competicoes/nova" />
      <div className="p-6">
        {isLoading ? <p className="text-gray-400 text-sm">Carregando...</p>
          : <DataTable columns={columns} data={data} keyExtractor={r => r.id} emptyMessage="Nenhuma competição cadastrada." />}
      </div>
    </div>
  )
}
