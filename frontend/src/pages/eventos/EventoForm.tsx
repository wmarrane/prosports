import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import MunicipioSelect from '../../components/MunicipioSelect'
import ParticipanteSelect from '../../components/ParticipanteSelect'
import { eventosService } from '../../services/eventos'
import { competicoesService } from '../../services/competicoes'
import { STATUS_LABEL } from '../../lib/evento-status'
import type { EventoStatus } from '../../types/evento'
import { Check, X, Trophy } from '../../lib/icons'
import { Calendar, MapPin, Users, Image as ImageIcon, Upload } from 'lucide-react'
import AcessoMobileCard from './AcessoMobileCard'

const STATUS_VALUES: EventoStatus[] = ['rascunho', 'inscricoes', 'pronto', 'sorteado', 'parcial']

const STATUS_DESC: Record<EventoStatus, string> = {
  rascunho: 'Em preparação. Não aparece para o público.',
  inscricoes: 'Aberto para inscrições de participantes.',
  pronto: 'Inscrições encerradas, pronto para sorteio.',
  sorteado: 'Sorteios concluídos para todas as modalidades.',
  parcial: 'Algumas modalidades já foram sorteadas.',
}

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
  const [anfitriaoId, setAnfitriaoId] = useState<number | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [erroLogo, setErroLogo] = useState('')

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
      setAnfitriaoId(existing.anfitriao_id ?? null)
      setLogoUrl(existing.logo_url ?? null)
    }
  }, [existing])

  const { mutate: uploadLogoMutate, isPending: salvandoLogo } = useMutation({
    mutationFn: (file: File) => eventosService.uploadLogo(Number(id), file),
    onSuccess: r => {
      setLogoUrl(r.logo_url)
      setErroLogo('')
      queryClient.invalidateQueries({ queryKey: ['eventos', Number(id)] })
    },
    onError: (err: any) => setErroLogo(err?.response?.data?.message ?? 'Erro ao enviar logo.'),
  })

  const { mutate: removerLogoMutate, isPending: removendoLogo } = useMutation({
    mutationFn: () => eventosService.removerLogo(Number(id)),
    onSuccess: () => {
      setLogoUrl(null)
      setErroLogo('')
      queryClient.invalidateQueries({ queryKey: ['eventos', Number(id)] })
    },
    onError: (err: any) => setErroLogo(err?.response?.data?.message ?? 'Erro ao remover logo.'),
  })

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
        anfitriao_id: anfitriaoId,
      }
      return isEdit
        ? eventosService.editar(Number(id), payload)
        : eventosService.criar(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventos'] })
      navigate('/eventos')
    },
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

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:border-transparent'

  const cardStyle = {
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-xl)',
    padding: 24,
    marginBottom: 16,
    boxShadow: 'var(--shadow-card)',
  } as const

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Operação"
        title={isEdit ? 'Editar Evento' : 'Novo Evento'}
        sub={
          isEdit
            ? 'Atualize a competição vinculada, dados de agenda, local e status.'
            : 'Crie uma edição de competição. As modalidades cadastradas na competição estarão disponíveis automaticamente.'
        }
        backTo="/eventos"
      />

      <div className="p-6" style={{ maxWidth: 800 }}>
        <form onSubmit={handleSubmit}>
          {/* Card: Vinculação */}
          <section style={cardStyle}>
            <div className="flex items-center gap-3 mb-5">
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--grad-brand-deep)', color: '#fff',
                  display: 'grid', placeItems: 'center',
                }}
              >
                <Trophy size={18} />
              </div>
              <div>
                <div className="eyebrow">Vinculação</div>
                <h3 className="sec-title" style={{ fontSize: 17 }}>
                  Competição e localidade
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Competição <span className="text-[var(--danger)]">*</span>
                </label>
                <select
                  value={competicaoId}
                  onChange={e => setCompeticaoId(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                  disabled={isEdit}
                  className={inputClass}
                  style={isEdit ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                >
                  <option value="">— Selecione uma competição —</option>
                  {competicoes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
                <p className="text-xs text-[var(--t4)] mt-1.5">
                  {isEdit
                    ? 'A competição de um evento não pode ser alterada após criação.'
                    : 'O evento herda automaticamente as modalidades cadastradas na competição.'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Município <span className="text-[var(--danger)]">*</span>
                </label>
                <MunicipioSelect value={municipioId} onChange={setMunicipioId} />
              </div>
            </div>
          </section>

          {/* Card: Identificação */}
          <section style={cardStyle}>
            <div className="flex items-center gap-3 mb-5">
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: '#fff', display: 'grid', placeItems: 'center',
                }}
              >
                <MapPin size={18} />
              </div>
              <div>
                <div className="eyebrow">Identificação</div>
                <h3 className="sec-title" style={{ fontSize: 17 }}>
                  Nome, local e organizador
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Nome do evento <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="Ex.: Etapa Inaugural 2026"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Local <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  value={local}
                  onChange={e => setLocal(e.target.value)}
                  required
                  className={inputClass}
                  placeholder="Ex.: Ginásio Tancredão"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Organizador
                  <span className="text-[var(--t4)] font-normal text-xs ml-1">(opcional)</span>
                </label>
                <input
                  value={organizador}
                  onChange={e => setOrganizador(e.target.value)}
                  className={inputClass}
                  placeholder="Ex.: SEJEL"
                />
                <p className="text-xs text-[var(--t4)] mt-1.5">
                  Entidade responsável pela organização (federação, prefeitura, clube etc.).
                </p>
              </div>
            </div>
          </section>

          {/* Card: Anfitrião do evento */}
          <section style={cardStyle}>
            <div className="flex items-center gap-3 mb-5">
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg, #0d9488 0%, #14b88a 100%)',
                  color: '#fff', display: 'grid', placeItems: 'center',
                }}
              >
                <Users size={18} />
              </div>
              <div>
                <div className="eyebrow">Anfitrião</div>
                <h3 className="sec-title" style={{ fontSize: 17 }}>
                  Participante anfitrião do evento
                </h3>
              </div>
            </div>

            <ParticipanteSelect
              value={anfitriaoId}
              onChange={id => setAnfitriaoId(id)}
              placeholder="Buscar participante anfitrião... (opcional)"
            />
            {(() => {
              const comp = competicoes.find(c => c.id === Number(competicaoId))
              if (!competicaoId) return null
              return comp?.considerar_anfitriao ? (
                <p className="text-xs text-[var(--brand-500)] mt-2">
                  ⓘ Esta competição considera o anfitrião nos sorteios — se inscrito e fora dos 4 primeiros campeões, vira cabeça do grupo C (3 grupos) / grupo D (4+ grupos) ou 4º cabeça em chaves.
                </p>
              ) : (
                <p className="text-xs text-[var(--t4)] mt-2">
                  Esta competição <b>não</b> considera o anfitrião nos sorteios. O campo é registrado mas a regra não é aplicada.
                </p>
              )
            })()}
          </section>

          {/* Card: Logotipo do evento */}
          {isEdit && (
            <section style={cardStyle}>
              <div className="flex items-center gap-3 mb-5">
                <div
                  style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    color: '#fff', display: 'grid', placeItems: 'center',
                  }}
                >
                  <ImageIcon size={18} />
                </div>
                <div>
                  <div className="eyebrow">Identidade visual</div>
                  <h3 className="sec-title" style={{ fontSize: 17 }}>
                    Logotipo do evento
                  </h3>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div
                  style={{
                    width: 140, height: 140, borderRadius: 'var(--radius-lg)',
                    background: 'var(--card-bg-2)',
                    border: '1px dashed var(--card-border)',
                    display: 'grid', placeItems: 'center',
                    overflow: 'hidden', flexShrink: 0,
                  }}
                >
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo do evento" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  ) : (
                    <ImageIcon size={36} className="text-[var(--t4)]" />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p className="text-sm text-[var(--t2)] mb-2">
                    {logoUrl
                      ? 'Logo customizado deste evento. Aparece no Modo Congresso ao lado do título de cada etapa.'
                      : 'Sem logo customizado. O Modo Congresso usará o logo padrão do sistema.'}
                  </p>
                  <p className="text-xs text-[var(--t4)] mb-3">
                    JPEG, PNG ou WebP · máx 2MB · fundo transparente recomendado
                  </p>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <label
                      className="btn btn-primary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: salvandoLogo ? 'wait' : 'pointer', opacity: salvandoLogo ? 0.5 : 1 }}
                    >
                      <Upload size={14} /> {salvandoLogo ? 'Enviando...' : logoUrl ? 'Trocar logo' : 'Enviar logo'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={salvandoLogo}
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) uploadLogoMutate(f)
                          e.target.value = ''
                        }}
                        style={{ display: 'none' }}
                      />
                    </label>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={() => removerLogoMutate()}
                        disabled={removendoLogo}
                        className="btn btn-ghost btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: removendoLogo ? 0.5 : 1 }}
                      >
                        <X size={14} /> {removendoLogo ? 'Removendo...' : 'Remover'}
                      </button>
                    )}
                  </div>

                  {erroLogo && (
                    <div className="text-xs mt-2" style={{ color: 'var(--danger)' }}>
                      {erroLogo}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {isEdit && <AcessoMobileCard eventoId={Number(id)} />}

          {/* Card: Agenda + Status */}
          <section style={cardStyle}>
            <div className="flex items-center gap-3 mb-5">
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                  color: '#fff', display: 'grid', placeItems: 'center',
                }}
              >
                <Calendar size={18} />
              </div>
              <div>
                <div className="eyebrow">Agenda</div>
                <h3 className="sec-title" style={{ fontSize: 17 }}>
                  Data, hora e status
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                  Data e hora <span className="text-[var(--danger)]">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={dataHora}
                  onChange={e => setDataHora(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as EventoStatus)}
                  className={inputClass}
                >
                  {STATUS_VALUES.map(s => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
                <p className="text-xs text-[var(--t4)] mt-1.5">{STATUS_DESC[status]}</p>
              </div>
            </div>
          </section>

          {erro && (
            <div
              style={{
                background: 'var(--danger-soft)',
                color: 'var(--danger)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-lg)',
                padding: '10px 14px',
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              {erro}
            </div>
          )}

          {/* Action bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              paddingTop: 16,
              borderTop: '1px solid var(--card-border)',
              flexWrap: 'wrap',
            }}
          >
            {isEdit ? (
              <button
                type="button"
                onClick={() => navigate(`/eventos/${id}/inscricoes`)}
                className="btn btn-ghost"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Users size={16} /> Gerenciar inscrições
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => navigate('/eventos')}
                className="btn btn-ghost"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <X size={16} /> Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: isPending ? 0.5 : 1 }}
              >
                <Check size={16} />
                {isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar evento'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
