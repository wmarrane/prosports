import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { tiposModalidadeService } from '../../services/tipos-modalidade'
import { TIPO_DISPUTA_LABEL, TIPO_DISPUTA_VALUES } from '../../lib/tipo-disputa'
import type { TipoDisputa } from '../../types/modalidade'

export default function TipoModalidadeForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoDisputa>('grupos')
  const [erro, setErro] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['tipos-modalidade', Number(id)],
    queryFn: () => tiposModalidadeService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setNome(existing.nome)
      setTipo(existing.tipo)
    }
  }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => isEdit
      ? tiposModalidadeService.editar(Number(id), { nome, tipo })
      : tiposModalidadeService.criar({ nome, tipo }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tipos-modalidade'] }); navigate('/tipos-modalidade') },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]'

  return (
    <div className="text-[var(--t1)]">
      <PageHeader title={isEdit ? 'Editar Tipo' : 'Novo Tipo de Modalidade'} backTo="/tipos-modalidade" />
      <div className="p-6 max-w-lg">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); setErro(''); salvar() }} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} required className={inputClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Tipo de disputa</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as TipoDisputa)} className={inputClass}>
              {TIPO_DISPUTA_VALUES.map(t => <option key={t} value={t}>{TIPO_DISPUTA_LABEL[t]}</option>)}
            </select>
          </div>

          {erro && <p className="text-sm text-[var(--danger)]">{erro}</p>}
          <button type="submit" disabled={isPending}
            className="px-6 py-2 bg-[var(--brand-500)] hover:bg-[var(--brand-400)] disabled:opacity-50 text-[var(--t1)] text-sm font-medium rounded-lg transition-colors">
            {isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </div>
    </div>
  )
}
