import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import MunicipioSelect from '../../components/MunicipioSelect'
import { eventosService } from '../../services/eventos'
import { competicoesService } from '../../services/competicoes'
import { STATUS_LABEL } from '../../lib/evento-status'
import type { EventoStatus } from '../../types/evento'

const STATUS_VALUES: EventoStatus[] = ['rascunho', 'inscricoes', 'pronto', 'sorteado', 'parcial']

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EventoForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [competicaoId, setCompeticaoId] = useState<number | ''>('')
  const [municipioId, setMunicipioId] = useState<number | null>(null)
  const [nome, setNome] = useState('')
  const [dataHora, setDataHora] = useState('')
  const [local, setLocal] = useState('')
  const [organizador, setOrganizador] = useState('')
  const [status, setStatus] = useState<EventoStatus>('rascunho')
  const [erro, setErro] = useState('')

  const { data: competicoes = [] } = useQuery({
    queryKey: ['competicoes'],
    queryFn: competicoesService.listar,
  })

  const { data: existing } = useQuery({
    queryKey: ['eventos', Number(id)],
    queryFn: () => eventosService.buscar(Number(id)),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existing) {
      setCompeticaoId(existing.competicao_id)
      setMunicipioId(existing.municipio_id)
      setNome(existing.nome)
      setDataHora(toLocalInput(existing.data_hora))
      setLocal(existing.local)
      setOrganizador(existing.organizador ?? '')
      setStatus(existing.status)
    }
  }, [existing])

  const { mutate: salvar, isPending } = useMutation({
    mutationFn: () => {
      const payload = {
        nome: nome.trim(),
        data_hora: new Date(dataHora).toISOString(),
        local: local.trim(),
        organizador: organizador.trim() || undefined,
        status,
        competicao_id: Number(competicaoId),
        municipio_id: municipioId!,
      }
      return isEdit
        ? eventosService.editar(Number(id), payload)
        : eventosService.criar(payload)
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['eventos'] }); navigate('/eventos') },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!competicaoId) return setErro('Selecione uma competição.')
    if (!municipioId) return setErro('Selecione um município.')
    if (!nome.trim()) return setErro('Informe o nome do evento.')
    if (!dataHora) return setErro('Informe a data e hora.')
    if (!local.trim()) return setErro('Informe o local.')
    salvar()
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]'

  return (
    <div className="text-[var(--t1)]">
      <PageHeader title={isEdit ? 'Editar Evento' : 'Novo Evento'} backTo="/eventos" />
      <div className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Competição</label>
            <select value={competicaoId} onChange={(e) => setCompeticaoId(e.target.value === '' ? '' : Number(e.target.value))} required className={inputClass}>
              <option value="">— Selecione —</option>
              {competicoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Município</label>
            <MunicipioSelect value={municipioId} onChange={setMunicipioId} />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} required className={inputClass} placeholder="Ex.: Etapa Inaugural" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--t2)] mb-1">Data e hora</label>
              <input type="datetime-local" value={dataHora} onChange={e => setDataHora(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--t2)] mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as EventoStatus)} className={inputClass}>
                {STATUS_VALUES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Local</label>
            <input value={local} onChange={e => setLocal(e.target.value)} required className={inputClass} placeholder="Ex.: Ginásio Tancredão" />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--t2)] mb-1">Organizador (opcional)</label>
            <input value={organizador} onChange={e => setOrganizador(e.target.value)} className={inputClass} placeholder="Ex.: SEJEL" />
          </div>

          {erro && <p className="text-sm text-[var(--danger)]">{erro}</p>}
          <button type="submit" disabled={isPending} className="btn btn-primary btn-lg" style={{ marginTop: 10 }}>
            {isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </div>
    </div>
  )
}
