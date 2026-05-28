import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { municipiosService } from '../../services/municipios'

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export default function MunicipioForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [codigoIbge, setCodigoIbge] = useState('')
  const [nome, setNome] = useState('')
  const [uf, setUf] = useState('SP')
  const [erro, setErro] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['municipios', Number(id)],
    queryFn: () => municipiosService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setCodigoIbge(existing.codigo_ibge)
      setNome(existing.nome)
      setUf(existing.uf)
    }
  }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      const data = { codigo_ibge: codigoIbge, nome, uf }
      return isEdit ? municipiosService.editar(Number(id), data) : municipiosService.criar(data)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['municipios'] }); navigate('/municipios') },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="text-white">
      <PageHeader title={isEdit ? 'Editar Município' : 'Novo Município'} backTo="/municipios" />
      <div className="p-6 max-w-lg">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); setErro(''); salvar() }} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Código IBGE (7 dígitos)</label>
            <input value={codigoIbge} onChange={(e) => setCodigoIbge(e.target.value)} required pattern="\d{7}" maxLength={7} className={inputClass} placeholder="3550308" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nome</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">UF</label>
            <select value={uf} onChange={(e) => setUf(e.target.value)} className={`${inputClass} w-24`}>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          {erro && <p className="text-sm text-red-400">{erro}</p>}
          <button type="submit" disabled={isPending} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            {isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </div>
    </div>
  )
}
