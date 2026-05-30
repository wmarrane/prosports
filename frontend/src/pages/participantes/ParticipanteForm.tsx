import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import MunicipioSelect from '../../components/MunicipioSelect'
import { participantesService } from '../../services/participantes'
import { inspetoriasService } from '../../services/inspetorias'
import { delegaciasService } from '../../services/delegacias'

export default function ParticipanteForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [nome, setNome] = useState('')
  const [subtitulo, setSubtitulo] = useState('')
  const [inspetoriaId, setInspetoriaId] = useState<number | ''>('')
  const [delegaciaId, setDelegaciaId] = useState<number | ''>('')
  const [municipioId, setMunicipioId] = useState<number | null>(null)
  const [erro, setErro] = useState('')

  const { data: inspetorias = [] } = useQuery({
    queryKey: ['inspetorias'],
    queryFn: inspetoriasService.listar,
  })

  const { data: delegacias = [] } = useQuery({
    queryKey: ['delegacias'],
    queryFn: delegaciasService.listar,
  })

  const { data: existing } = useQuery({
    queryKey: ['participantes', Number(id)],
    queryFn: () => participantesService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setNome(existing.nome)
      setSubtitulo(existing.subtitulo ?? '')
      setInspetoriaId(existing.inspetoria_id ?? '')
      setDelegaciaId(existing.delegacia_id ?? '')
      setMunicipioId(existing.municipio_id)
    }
  }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      const payload = {
        nome,
        subtitulo: subtitulo || undefined,
        inspetoria_id: inspetoriaId === '' ? null : Number(inspetoriaId),
        delegacia_id: delegaciaId === '' ? null : Number(delegaciaId),
        municipio_id: municipioId!,
      }
      return isEdit
        ? participantesService.editar(Number(id), payload)
        : participantesService.criar(payload as any)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['participantes'] }); navigate('/participantes') },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!municipioId) {
      setErro('Selecione um município.')
      return
    }
    salvar()
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]'

  return (
    <div className="text-[var(--t1)]">
      <PageHeader title={isEdit ? 'Editar Participante' : 'Novo Participante'} backTo="/participantes" />
      <div className="p-6 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} required className={inputClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Subtítulo (opcional)</label>
            <input value={subtitulo} onChange={e => setSubtitulo(e.target.value)} className={inputClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Inspetoria (opcional)</label>
            <select value={inspetoriaId} onChange={e => setInspetoriaId(e.target.value === '' ? '' : Number(e.target.value))} className={inputClass}>
              <option value="">— Sem inspetoria —</option>
              {inspetorias.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Delegacia (opcional)</label>
            <select value={delegaciaId} onChange={e => setDelegaciaId(e.target.value === '' ? '' : Number(e.target.value))} className={inputClass}>
              <option value="">— Sem delegacia —</option>
              {delegacias.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Município</label>
            <MunicipioSelect value={municipioId} onChange={setMunicipioId} />
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
