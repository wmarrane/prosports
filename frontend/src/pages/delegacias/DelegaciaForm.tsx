import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { delegaciasService } from '../../services/delegacias'

export default function DelegaciaForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')

  const { data: existing } = useQuery({
    queryKey: ['delegacias', Number(id)],
    queryFn: () => delegaciasService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => { if (existing) setNome(existing.nome) }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => isEdit
      ? delegaciasService.editar(Number(id), { nome })
      : delegaciasService.criar({ nome }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['delegacias'] }); navigate('/delegacias') },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  return (
    <div className="text-[var(--t1)]">
      <PageHeader title={isEdit ? 'Editar Delegacia' : 'Nova Delegacia'} backTo="/delegacias" />
      <div className="p-6 max-w-lg">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); setErro(''); salvar() }} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} required
              className="w-full px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]" />
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
