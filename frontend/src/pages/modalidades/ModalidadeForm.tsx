import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import { modalidadesService } from '../../services/modalidades'
import { competicoesService } from '../../services/competicoes'
import { tiposModalidadeService } from '../../services/tipos-modalidade'

export default function ModalidadeForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [competicaoId, setCompeticaoId] = useState<number | ''>('')
  const [tipoModalidadeId, setTipoModalidadeId] = useState<number | ''>('')
  const [nome, setNome] = useState('')
  const [sigla, setSigla] = useState('')
  const [erro, setErro] = useState('')

  const { data: competicoes = [] } = useQuery({
    queryKey: ['competicoes'],
    queryFn: competicoesService.listar,
  })

  const { data: tipos = [] } = useQuery({
    queryKey: ['tipos-modalidade'],
    queryFn: tiposModalidadeService.listar,
  })

  const { data: existing } = useQuery({
    queryKey: ['modalidades', Number(id)],
    queryFn: () => modalidadesService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setCompeticaoId(existing.competicao_id)
      setTipoModalidadeId(existing.tipo_modalidade_id)
      setNome(existing.nome)
      setSigla(existing.sigla)
    }
  }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      const payload = {
        nome,
        sigla: sigla.trim().toUpperCase(),
        competicao_id: Number(competicaoId),
        tipo_modalidade_id: Number(tipoModalidadeId),
      }
      return isEdit
        ? modalidadesService.editar(Number(id), payload)
        : modalidadesService.criar(payload)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['modalidades'] }); navigate('/modalidades') },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!competicaoId) return setErro('Selecione uma competição.')
    if (!tipoModalidadeId) return setErro('Selecione um tipo de modalidade.')
    if (!nome.trim()) return setErro('Informe o nome.')
    if (sigla.trim().length < 2) return setErro('Sigla deve ter ao menos 2 caracteres.')
    salvar()
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]'

  return (
    <div className="text-[var(--t1)]">
      <PageHeader title={isEdit ? 'Editar Modalidade' : 'Nova Modalidade'} backTo="/modalidades" />
      <div className="p-6 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Competição</label>
            <select value={competicaoId} onChange={e => setCompeticaoId(e.target.value === '' ? '' : Number(e.target.value))} required className={inputClass}>
              <option value="">— Selecione —</option>
              {competicoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Tipo de Modalidade</label>
            <select value={tipoModalidadeId} onChange={e => setTipoModalidadeId(e.target.value === '' ? '' : Number(e.target.value))} required className={inputClass}>
              <option value="">— Selecione —</option>
              {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} required className={inputClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Sigla (2 a 6 caracteres)</label>
            <input value={sigla} onChange={e => setSigla(e.target.value)} required maxLength={6}
              className={`${inputClass} font-mono uppercase`} placeholder="Ex.: FUT" />
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
