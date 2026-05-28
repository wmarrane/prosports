import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import DataTable from '../../components/DataTable'
import { categoriasService } from '../../services/categorias'
import type { Categoria } from '../../types/fundacao'

const GENERO_LABEL: Record<string, string> = {
  MASCULINO: 'Masculino', FEMININO: 'Feminino', MISTO: 'Misto', LIVRE: 'Livre',
}

function faixaEtaria(cat: Categoria) {
  if (cat.idade_min && cat.idade_max) return `${cat.idade_min}–${cat.idade_max} anos`
  if (cat.idade_min) return `${cat.idade_min}+ anos`
  if (cat.idade_max) return `até ${cat.idade_max} anos`
  return '—'
}

export default function CategoriasList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => categoriasService.listar(),
  })

  const { mutate: remover } = useMutation({
    mutationFn: categoriasService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categorias'] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const columns = [
    { header: 'Modalidade', accessor: (row: Categoria) => row.modalidade.nome },
    { header: 'Nome', accessor: (row: Categoria) => row.nome },
    { header: 'Gênero', accessor: (row: Categoria) => GENERO_LABEL[row.genero] },
    { header: 'Faixa Etária', accessor: (row: Categoria) => faixaEtaria(row) },
    {
      header: 'Ações',
      accessor: (row: Categoria) => (
        <div className="flex gap-2">
          <button onClick={() => navigate(`/categorias/${row.id}/editar`)} className="text-indigo-400 hover:text-indigo-300 text-xs">Editar</button>
          <button onClick={() => { if (confirm(`Remover "${row.nome}"?`)) remover(row.id) }} className="text-red-400 hover:text-red-300 text-xs">Remover</button>
        </div>
      ),
      className: 'w-28',
    },
  ]

  return (
    <div className="text-white">
      <PageHeader title="Categorias" actionLabel="+ Nova Categoria" actionTo="/categorias/nova" />
      <div className="p-6">
        {isLoading ? <p className="text-gray-400 text-sm">Carregando...</p>
          : <DataTable columns={columns} data={data} keyExtractor={r => r.id} emptyMessage="Nenhuma categoria cadastrada." />}
      </div>
    </div>
  )
}
