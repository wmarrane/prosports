import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import { participantesService } from '../../services/participantes'
import type { Participante } from '../../types/participante'

export default function ParticipantesList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['participantes'],
    queryFn: participantesService.listar,
  })

  const { mutate: remover } = useMutation({
    mutationFn: participantesService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['participantes'] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const columns = [
    { header: 'Nome', accessor: (row: Participante) => row.nome },
    { header: 'Subtítulo', accessor: (row: Participante) => row.subtitulo ?? '—' },
    { header: 'Inspetoria', accessor: (row: Participante) => row.inspetoria?.nome ?? '—' },
    { header: 'Delegacia', accessor: (row: Participante) => row.delegacia?.nome ?? '—' },
    { header: 'Município', accessor: (row: Participante) => `${row.municipio.nome} — ${row.municipio.uf}` },
    {
      header: 'Ações',
      accessor: (row: Participante) => (
        <div className="flex gap-2">
          <button onClick={() => navigate(`/participantes/${row.id}/editar`)} className="text-indigo-400 hover:text-indigo-300 text-xs">Editar</button>
          <button onClick={() => { if (confirm(`Remover "${row.nome}"?`)) remover(row.id) }} className="text-red-400 hover:text-red-300 text-xs">Remover</button>
        </div>
      ),
      className: 'w-28',
    },
  ]

  return (
    <div className="text-white">
      <PageHeader title="Participantes" actionLabel="+ Novo Participante" actionTo="/participantes/novo" />
      <div className="p-6">
        {isLoading ? <p className="text-gray-400 text-sm">Carregando...</p>
          : <DataTable columns={columns} data={data} keyExtractor={r => r.id} emptyMessage="Nenhum participante cadastrado." />}
      </div>
    </div>
  )
}
