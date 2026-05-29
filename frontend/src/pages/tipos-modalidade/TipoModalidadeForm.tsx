import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { tiposModalidadeService } from '../../services/tipos-modalidade'

export default function TipoModalidadeForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['tipos-modalidade', Number(id)],
    queryFn: () => tiposModalidadeService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => { if (existing) setNome(existing.nome) }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => isEdit
      ? tiposModalidadeService.editar(Number(id), { nome })
      : tiposModalidadeService.criar({ nome }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tipos-modalidade'] }); navigate('/tipos-modalidade') },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  return (
    <div className="text-white">
      <PageHeader title={isEdit ? 'Editar Tipo' : 'Novo Tipo de Modalidade'} backTo="/tipos-modalidade" />
      <div className="p-6 max-w-lg">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); setErro(''); salvar() }} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} required
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {erro && <p className="text-sm text-red-400">{erro}</p>}
          <button type="submit" disabled={isPending}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </div>
    </div>
  )
}
