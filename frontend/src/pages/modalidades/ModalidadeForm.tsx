import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { modalidadesService } from '../../services/modalidades'

export default function ModalidadeForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['modalidades', Number(id)],
    queryFn: () => modalidadesService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) { setNome(existing.nome); setDescricao(existing.descricao ?? '') }
  }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => isEdit
      ? modalidadesService.editar(Number(id), { nome, descricao: descricao || undefined })
      : modalidadesService.criar({ nome, descricao: descricao || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['modalidades'] }); navigate('/modalidades') },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  return (
    <div className="text-white">
      <PageHeader title={isEdit ? 'Editar Modalidade' : 'Nova Modalidade'} backTo="/modalidades" />
      <div className="p-6 max-w-lg">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); setErro(''); salvar() }} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} required
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Descrição (opcional)</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
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
