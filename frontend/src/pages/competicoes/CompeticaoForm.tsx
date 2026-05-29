import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { competicoesService } from '../../services/competicoes'
import { UFS } from '../../lib/ufs'

export default function CompeticaoForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [nome, setNome] = useState('')
  const [estados, setEstados] = useState<string[]>([])
  const [adicionarSubtitulo, setAdicionarSubtitulo] = useState(false)
  const [erro, setErro] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['competicoes', Number(id)],
    queryFn: () => competicoesService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setNome(existing.nome)
      setEstados(existing.estados)
      setAdicionarSubtitulo(existing.adicionar_subtitulo)
    }
  }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      const payload = { nome, estados, adicionar_subtitulo: adicionarSubtitulo }
      return isEdit
        ? competicoesService.editar(Number(id), payload)
        : competicoesService.criar(payload)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['competicoes'] }); navigate('/competicoes') },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  function toggleUf(uf: string) {
    setEstados(prev => prev.includes(uf) ? prev.filter(x => x !== uf) : [...prev, uf])
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (estados.length === 0) {
      setErro('Selecione ao menos uma UF.')
      return
    }
    salvar()
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="text-white">
      <PageHeader title={isEdit ? 'Editar Competição' : 'Nova Competição'} backTo="/competicoes" />
      <div className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} required className={inputClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Estados (selecione ao menos uma UF)</label>
            <div className="grid grid-cols-4 gap-2">
              {UFS.map(uf => (
                <label key={uf} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={estados.includes(uf)}
                    onChange={() => toggleUf(uf)}
                    className="rounded border-gray-600 bg-gray-900 text-indigo-500 focus:ring-indigo-500"
                  />
                  <span className="text-gray-200">{uf}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={adicionarSubtitulo}
                onChange={e => setAdicionarSubtitulo(e.target.checked)}
                className="rounded border-gray-600 bg-gray-900 text-indigo-500 focus:ring-indigo-500"
              />
              Adicionar subtítulo aos participantes
            </label>
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
