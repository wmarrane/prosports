import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { municipiosService } from '../../services/municipios'
import { UFS } from '../../lib/ufs'

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

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]'

  return (
    <div className="text-[var(--t1)]">
      <PageHeader title={isEdit ? 'Editar Município' : 'Novo Município'} backTo="/municipios" />
      <div className="p-6 max-w-lg">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); setErro(''); salvar() }} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Código IBGE (7 dígitos)</label>
            <input value={codigoIbge} onChange={(e) => setCodigoIbge(e.target.value)} required pattern="\d{7}" maxLength={7} className={inputClass} placeholder="3550308" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Nome</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">UF</label>
            <select value={uf} onChange={(e) => setUf(e.target.value)} className={`${inputClass} w-24`}>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          {erro && <p className="text-sm text-[var(--danger)]">{erro}</p>}
          <button type="submit" disabled={isPending} className="px-6 py-2 bg-[var(--brand-500)] hover:bg-[var(--brand-400)] disabled:opacity-50 text-[var(--t1)] text-sm font-medium rounded-lg transition-colors">
            {isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </div>
    </div>
  )
}
