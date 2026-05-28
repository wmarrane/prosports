import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { categoriasService } from '../../services/categorias'
import { modalidadesService } from '../../services/modalidades'
import type { Genero } from '../../types/fundacao'

const GENEROS: Genero[] = ['MASCULINO', 'FEMININO', 'MISTO', 'LIVRE']
const GENERO_LABEL: Record<Genero, string> = {
  MASCULINO: 'Masculino', FEMININO: 'Feminino', MISTO: 'Misto', LIVRE: 'Livre',
}

export default function CategoriaForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [modalidade_id, setModalidadeId] = useState<number | ''>('')
  const [nome, setNome] = useState('')
  const [genero, setGenero] = useState<Genero>('MASCULINO')
  const [idadeMin, setIdadeMin] = useState('')
  const [idadeMax, setIdadeMax] = useState('')
  const [erro, setErro] = useState('')

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades'],
    queryFn: modalidadesService.listar,
  })

  const { data: existing } = useQuery({
    queryKey: ['categorias', Number(id)],
    queryFn: () => categoriasService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setModalidadeId(existing.modalidade_id)
      setNome(existing.nome)
      setGenero(existing.genero)
      setIdadeMin(existing.idade_min?.toString() ?? '')
      setIdadeMax(existing.idade_max?.toString() ?? '')
    }
  }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      const data = {
        modalidade_id: Number(modalidade_id),
        nome,
        genero,
        idade_min: idadeMin ? Number(idadeMin) : undefined,
        idade_max: idadeMax ? Number(idadeMax) : undefined,
      }
      return isEdit ? categoriasService.editar(Number(id), data) : categoriasService.criar(data as any)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categorias'] }); navigate('/categorias') },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="text-white">
      <PageHeader title={isEdit ? 'Editar Categoria' : 'Nova Categoria'} backTo="/categorias" />
      <div className="p-6 max-w-lg">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); setErro(''); salvar() }} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Modalidade</label>
            <select value={modalidade_id} onChange={e => setModalidadeId(Number(e.target.value))} required className={inputClass}>
              <option value="">Selecione...</option>
              {modalidades.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} required className={inputClass} placeholder="Ex: Sub-17, Adulto" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Gênero</label>
            <select value={genero} onChange={e => setGenero(e.target.value as Genero)} className={inputClass}>
              {GENEROS.map(g => <option key={g} value={g}>{GENERO_LABEL[g]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Idade mínima (opcional)</label>
              <input type="number" value={idadeMin} onChange={e => setIdadeMin(e.target.value)} min={1} max={99} className={inputClass} placeholder="ex: 14" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Idade máxima (opcional)</label>
              <input type="number" value={idadeMax} onChange={e => setIdadeMax(e.target.value)} min={1} max={99} className={inputClass} placeholder="ex: 17" />
            </div>
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
