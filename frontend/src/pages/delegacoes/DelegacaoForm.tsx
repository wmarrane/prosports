import { useState, useEffect } from 'react'
import type { FormEvent, ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { delegacoesService } from '../../services/delegacoes'

export default function DelegacaoForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [nome, setNome] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [estado, setEstado] = useState('')
  const [logo, setLogo] = useState<File | null>(null)
  const [erro, setErro] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['delegacoes', Number(id)],
    queryFn: () => delegacoesService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setNome(existing.nome)
      setMunicipio(existing.municipio)
      setEstado(existing.estado)
    }
  }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: (formData: FormData) =>
      isEdit ? delegacoesService.editar(Number(id), formData) : delegacoesService.criar(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegacoes'] })
      navigate('/delegacoes')
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    const formData = new FormData()
    formData.append('nome', nome)
    formData.append('municipio', municipio)
    formData.append('estado', estado.toUpperCase().slice(0, 2))
    if (logo) formData.append('logo', logo)
    salvar(formData)
  }

  return (
    <div className="text-white">
      <PageHeader title={isEdit ? 'Editar Delegação' : 'Nova Delegação'} backTo="/delegacoes" />
      <div className="p-6 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} required
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Município</label>
            <input value={municipio} onChange={e => setMunicipio(e.target.value)} required
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Estado (UF)</label>
            <input value={estado} onChange={e => setEstado(e.target.value)} required maxLength={2} placeholder="SP"
              className="w-24 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Logo (JPEG, PNG ou WebP — máx. 2MB)</label>
            <input type="file" accept="image/jpeg,image/png,image/webp"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setLogo(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-700 file:text-gray-300 hover:file:bg-gray-600" />
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
