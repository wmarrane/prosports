import { useState, useEffect, useMemo } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import MunicipioSelect from '../../components/MunicipioSelect'
import ParticipanteSelect from '../../components/ParticipanteSelect'
import ConfirmDialog from '../../components/ConfirmDialog'
import { eventosService } from '../../services/eventos'
import { competicoesService } from '../../services/competicoes'
import { usersService } from '../../services/users'
import { modalidadesService } from '../../services/modalidades'
import { inscricoesService } from '../../services/inscricoes'
import { sorteiosService } from '../../services/sorteios'
import { STATUS_LABEL } from '../../lib/evento-status'
import type { EventoStatus } from '../../types/evento'
import type { TipoDisputa } from '../../types/modalidade'
import { Check, X, Trophy } from '../../lib/icons'
import { Calendar, MapPin, Users, Image as ImageIcon, Upload, List } from 'lucide-react'
import AcessoMobileCard from './AcessoMobileCard'
import EventoBoletins from './EventoBoletins'
import EventoCardPreview from './EventoCardPreview'
import ModalidadesDaEdicao, { type ModEdicaoItem } from './ModalidadesDaEdicao'
import { esporteBase } from '../../site-publico/lib/esporte'

const STATUS_VALUES: EventoStatus[] = ['rascunho', 'inscricoes', 'pronto', 'sorteado', 'parcial', 'suspenso']

const STATUS_DESC: Record<EventoStatus, string> = {
  rascunho: 'Em preparação. Não aparece para o público.',
  inscricoes: 'Aberto para inscrições de participantes.',
  pronto: 'Inscrições encerradas, pronto para sorteio.',
  sorteado: 'Sorteios concluídos para todas as modalidades.',
  parcial: 'Algumas modalidades já foram sorteadas.',
  suspenso: 'Evento pausado — ações bloqueadas até reativar.',
}

const STATUS_DOT: Record<EventoStatus, string> = {
  rascunho: 'var(--t4)',
  inscricoes: 'var(--info)',
  pronto: 'var(--warn)',
  sorteado: 'var(--success)',
  parcial: 'var(--info)',
  suspenso: 'var(--warn)',
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

  // ── existing state ──
  const [competicaoId, setCompeticaoId] = useState<number | ''>('')
  const [municipioId, setMunicipioId] = useState<number | null>(null)
  const [nome, setNome] = useState('')
  const [dataHora, setDataHora] = useState('')
  const [local, setLocal] = useState('')
  const [organizador, setOrganizador] = useState('')
  const [status, setStatus] = useState<EventoStatus>('rascunho')
  const [anfitriaoId, setAnfitriaoId] = useState<number | null>(null)
  const [comissaoIds, setComissaoIds] = useState<number[]>([])
  const [dataInicio, setDataInicio] = useState<string | null>(null)
  const [dataFim, setDataFim] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [erroLogo, setErroLogo] = useState('')

  // ── new state ──
  const [excluidas, setExcluidas] = useState<Set<number>>(new Set())
  const [salvo, setSalvo] = useState(false)
  const [confirmExcluir, setConfirmExcluir] = useState(false)

  // ── queries ──
  const { data: competicoes = [] } = useQuery({
    queryKey: ['competicoes'],
    queryFn: competicoesService.listar,
  })

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: usersService.listar,
  })
  const usuariosCT = usuarios.filter((u: any) => u.role === 'COMISSAO_TECNICA')

  const { data: existing } = useQuery({
    queryKey: ['eventos', Number(id)],
    queryFn: () => eventosService.buscar(Number(id)),
    enabled: isEdit,
  })

  // modalidades da competição (todas)
  const { data: modalidadesComp = [] } = useQuery({
    queryKey: ['modalidades', competicaoId],
    queryFn: () => modalidadesService.listar({ competicao_id: Number(competicaoId) }),
    enabled: !!competicaoId,
  })

  // exclusões atuais (edição)
  const { data: excluidasIniciais } = useQuery({
    queryKey: ['modalidades-excluidas', Number(id)],
    queryFn: () => eventosService.getModalidadesExcluidas(Number(id)),
    enabled: isEdit,
  })

  // inscrições (edição)
  const { data: inscricoesEvento = [] } = useQuery({
    queryKey: ['inscricoes', Number(id)],
    queryFn: () => inscricoesService.listar({ evento_id: Number(id) }),
    enabled: isEdit,
  })

  // progresso do sorteio (edição)
  const { data: progresso } = useQuery({
    queryKey: ['progresso-sorteio', Number(id)],
    queryFn: () => eventosService.progressoSorteio(Number(id)),
    enabled: isEdit,
  })

  // sorteios do evento (edição) — para bloquear desativação de modalidade sorteada
  const { data: sorteiosEvento = [] } = useQuery({
    queryKey: ['sorteios', Number(id)],
    queryFn: () => sorteiosService.listar({ evento_id: Number(id) }),
    enabled: isEdit,
  })

  // ── effects ──
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
      setComissaoIds(existing.comissao?.map((c: any) => c.usuario.id) ?? [])
      setDataInicio(existing.data_inicio ? existing.data_inicio.slice(0, 10) : null)
      setDataFim(existing.data_fim ? existing.data_fim.slice(0, 10) : null)
      setLogoUrl(existing.logo_url ?? null)
    }
  }, [existing])

  useEffect(() => {
    if (excluidasIniciais) setExcluidas(new Set(excluidasIniciais))
  }, [excluidasIniciais])

  // ── derivados ──
  const modsTodas: ModEdicaoItem[] = useMemo(
    () =>
      modalidadesComp
        .filter((m: any) => m.ativa === true)
        .map((m: any) => ({ id: m.id, nome: m.nome, tipo: m.tipo_modalidade.tipo as TipoDisputa })),
    [modalidadesComp],
  )

  // modalidades bloqueadas: têm inscritos ou sorteio neste evento
  const bloqueadas = useMemo<Set<number>>(() => {
    const s = new Set<number>()
    inscricoesEvento.forEach((i: any) => s.add(i.modalidade_id))
    sorteiosEvento.forEach((sv: any) => s.add(sv.modalidade_id))
    return s
  }, [inscricoesEvento, sorteiosEvento])
  const modsAtivos: ModEdicaoItem[] = useMemo(
    () => modsTodas.filter((m) => !excluidas.has(m.id)),
    [modsTodas, excluidas],
  )
  const tiposAtivos = useMemo(
    () => [...new Set(modsAtivos.map((m) => m.tipo))] as TipoDisputa[],
    [modsAtivos],
  )
  // "Modalidades" no padrão do app (card público/listagem) = esportes distintos,
  // não linhas de modalidade. O badge da lista abaixo segue contando linhas.
  const modalidadesDistintas = useMemo(
    () => new Set(modsAtivos.map((m) => esporteBase(m.nome))).size,
    [modsAtivos],
  )
  const inscritosDistintos = useMemo(
    () => new Set(inscricoesEvento.map((i: any) => i.participante_id)).size,
    [inscricoesEvento],
  )
  const cidade = '' // MunicipioSelect controla municipioId; nome não exposto — preview trata vazio com "—"
  const dataLabel = dataHora ? new Date(dataHora).toLocaleDateString('pt-BR') : ''
  const competicaoNome = competicoes.find((c: any) => c.id === Number(competicaoId))?.nome ?? ''
  const sorteadas = progresso?.sorteadas ?? 0
  const sorteaveis = progresso?.sorteaveis ?? 0
  const canSave = nome.trim().length > 0 && modsAtivos.length > 0

  function toggleModalidade(mid: number) {
    if (bloqueadas.has(mid)) return
    setExcluidas((prev) => {
      const n = new Set(prev)
      if (n.has(mid)) n.delete(mid)
      else n.add(mid)
      return n
    })
    setSalvo(false)
  }

  // ── mutations: logo ──
  const { mutate: uploadLogoMutate, isPending: salvandoLogo } = useMutation({
    mutationFn: (file: File) => eventosService.uploadLogo(Number(id), file),
    onSuccess: (r: any) => {
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

  // ── mutation: salvar ──
  const { mutate: salvar, isPending } = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: nome.trim(),
        data_hora: new Date(dataHora).toISOString(),
        local: local.trim(),
        organizador: organizador.trim() || undefined,
        status,
        competicao_id: Number(competicaoId),
        municipio_id: municipioId!,
        anfitriao_id: anfitriaoId,
        comissao_ids: comissaoIds,
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
      }
      if (isEdit) {
        await eventosService.setModalidadesExcluidas(Number(id), [...excluidas])
        await eventosService.editar(Number(id), payload)
        return { id: Number(id) }
      }
      const novo: any = await eventosService.criar(payload)
      if (excluidas.size > 0 && novo?.id) await eventosService.setModalidadesExcluidas(novo.id, [...excluidas])
      return novo
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['eventos'] })
      if (isEdit) {
        queryClient.invalidateQueries({ queryKey: ['eventos', Number(id)] })
        setSalvo(true)
      } else if (res?.id) {
        navigate(`/eventos/${res.id}/editar`)
      } else {
        navigate('/eventos')
      }
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao salvar.'),
  })

  // ── mutation: excluir ──
  const { mutate: excluirEvento, isPending: excluindo } = useMutation({
    mutationFn: () => eventosService.remover(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventos'] })
      navigate('/eventos')
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao excluir.'),
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (!competicaoId) return setErro('Selecione uma competição.')
    if (!municipioId) return setErro('Selecione um município.')
    if (!nome.trim()) return setErro('Informe o nome do evento.')
    if (!dataHora) return setErro('Informe a data e hora.')
    if (!local.trim()) return setErro('Informe o local.')
    if (!canSave) return setErro('Adicione pelo menos uma modalidade ativa.')
    salvar()
  }

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:border-transparent'

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

      <div className="p-6">
        <form onSubmit={handleSubmit}>
          <div className="evx-grid">
            {/* ── Coluna esquerda ── */}
            <div className="evx-col">

              {/* 1. Identificação */}
              <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="evx-sec-h">
                  <Trophy size={17} />
                  <h3 className="sec-title">Identificação</h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                    Competição <span className="text-[var(--danger)]">*</span>
                  </label>
                  <select
                    value={competicaoId}
                    onChange={(e) => setCompeticaoId(e.target.value === '' ? '' : Number(e.target.value))}
                    required
                    disabled={isEdit}
                    className={inputClass}
                    style={isEdit ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                  >
                    <option value="">— Selecione uma competição —</option>
                    {competicoes.map((c: any) => (
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
                    Nome do evento <span className="text-[var(--danger)]">*</span>
                  </label>
                  <input
                    value={nome}
                    onChange={(e) => { setNome(e.target.value); setSalvo(false) }}
                    required
                    className={inputClass}
                    placeholder="Ex.: Etapa Inaugural 2026"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                    Município <span className="text-[var(--danger)]">*</span>
                  </label>
                  <MunicipioSelect value={municipioId} onChange={setMunicipioId} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                    Organização responsável
                    <span className="text-[var(--t4)] font-normal text-xs ml-1">(opcional)</span>
                  </label>
                  <input
                    value={organizador}
                    onChange={(e) => { setOrganizador(e.target.value); setSalvo(false) }}
                    className={inputClass}
                    placeholder="Ex.: SEJEL"
                  />
                  <p className="text-xs text-[var(--t4)] mt-1.5">
                    Entidade responsável pela organização (federação, prefeitura, clube etc.).
                  </p>
                </div>
              </section>

              {/* 2. Congresso · data e local */}
              <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="evx-sec-h">
                  <Calendar size={17} />
                  <h3 className="sec-title">Congresso · data e local</h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                    Data e hora <span className="text-[var(--danger)]">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={dataHora}
                    onChange={(e) => { setDataHora(e.target.value); setSalvo(false) }}
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                    Local <span className="text-[var(--danger)]">*</span>
                  </label>
                  <input
                    value={local}
                    onChange={(e) => { setLocal(e.target.value); setSalvo(false) }}
                    required
                    className={inputClass}
                    placeholder="Ex.: Ginásio Tancredão"
                  />
                </div>

                <div className="evx-row2">
                  <div>
                    <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                      Início
                      <span className="text-[var(--t4)] font-normal text-xs ml-1">(opcional)</span>
                    </label>
                    <input
                      type="date"
                      value={dataInicio ?? ''}
                      onChange={(e) => { setDataInicio(e.target.value || null); setSalvo(false) }}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                      Fim
                      <span className="text-[var(--t4)] font-normal text-xs ml-1">(opcional)</span>
                    </label>
                    <input
                      type="date"
                      value={dataFim ?? ''}
                      onChange={(e) => { setDataFim(e.target.value || null); setSalvo(false) }}
                      className={inputClass}
                    />
                  </div>
                </div>
              </section>

              {/* 3. Anfitrião & Comissão Técnica */}
              <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="evx-sec-h">
                  <Users size={17} />
                  <h3 className="sec-title">Anfitrião &amp; Comissão Técnica</h3>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                    Participante anfitrião
                    <span className="text-[var(--t4)] font-normal text-xs ml-1">(opcional)</span>
                  </label>
                  <ParticipanteSelect
                    value={anfitriaoId}
                    onChange={(pid) => setAnfitriaoId(pid)}
                    placeholder="Buscar participante anfitrião... (opcional)"
                  />
                  {(() => {
                    const comp = competicoes.find((c: any) => c.id === Number(competicaoId))
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
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--t2)] mb-1.5">
                    Comissão Técnica (usuários que operam este evento)
                  </label>
                  {usuariosCT.length === 0 ? (
                    <p className="text-xs text-[var(--t4)]">Nenhum usuário com perfil "Comissão Técnica" cadastrado.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {usuariosCT.map((u: any) => (
                        <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--t1)' }}>
                          <input
                            type="checkbox"
                            checked={comissaoIds.includes(u.id)}
                            onChange={(e) =>
                              setComissaoIds((prev) =>
                                e.target.checked ? [...prev, u.id] : prev.filter((uid) => uid !== u.id),
                              )
                            }
                          />
                          {u.nome}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* 4. Modalidades desta edição */}
              <section className="card pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div className="evx-sec-h">
                    <List size={17} />
                    <h3 className="sec-title">Modalidades desta edição</h3>
                    <span className="badge b-slate">{modsAtivos.length}/{modsTodas.length}</span>
                  </div>
                  {competicaoNome && (
                    <span style={{ fontSize: 11.5, color: 'var(--t4)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Trophy size={13} /> herdadas de {competicaoNome}
                    </span>
                  )}
                </div>

                {modsTodas.length === 0 ? (
                  <p className="text-xs text-[var(--t4)]">
                    {competicaoId ? 'Nenhuma modalidade cadastrada nesta competição.' : 'Selecione uma competição para ver as modalidades.'}
                  </p>
                ) : (
                  <ModalidadesDaEdicao modalidades={modsTodas} excluidas={excluidas} onToggle={toggleModalidade} bloqueadas={bloqueadas} />
                )}

                <div className="evx-note">
                  <MapPin size={16} />
                  <p>As modalidades vêm da competição. Aqui você define quais entram <b>nesta edição</b>. Para criar ou renomear modalidades, edite a competição.</p>
                </div>
              </section>

              {/* Logo (edição) */}
              {isEdit && (
                <section className="card pad">
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
                      <h3 className="sec-title" style={{ fontSize: 17 }}>Logotipo do evento</h3>
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
                          title="Enviar uma imagem de logo do evento (JPG, PNG ou WebP)"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: salvandoLogo ? 'wait' : 'pointer', opacity: salvandoLogo ? 0.5 : 1 }}
                        >
                          <Upload size={14} /> {salvandoLogo ? 'Enviando...' : logoUrl ? 'Trocar logo' : 'Enviar logo'}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            disabled={salvandoLogo}
                            onChange={(e) => {
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
                            title="Remover o logo do evento"
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
            </div>

            {/* ── Coluna direita (apoio) ── */}
            <aside className="evx-aside evx-col">

              {/* Pré-visualização */}
              <section className="card pad">
                <div className="evx-prev-flag"><span className="d" /> Pré-visualização</div>
                <EventoCardPreview
                  nome={nome}
                  competicaoNome={competicaoNome}
                  cidade={cidade}
                  dataLabel={dataLabel}
                  status={status}
                  tipos={tiposAtivos}
                  totalModalidades={modalidadesDistintas}
                  inscritos={inscritosDistintos}
                  sorteadas={sorteadas}
                  sorteaveis={sorteaveis}
                />
              </section>

              {/* Resumo */}
              <section className="card pad">
                <div className="evx-stats">
                  <div className="evx-stat"><div className="v">{modalidadesDistintas}</div><div className="l">Modalidades</div></div>
                  <div className="evx-stat"><div className="v">{inscritosDistintos}</div><div className="l">Inscritos</div></div>
                  <div className="evx-stat"><div className="v">{tiposAtivos.length}</div><div className="l">Tipos de sorteio</div></div>
                  <div className="evx-stat"><div className="v accent">{sorteadas}</div><div className="l">Com sorteio</div></div>
                </div>
              </section>

              {/* Publicação */}
              <section className="card pad">
                <div className="eyebrow" style={{ marginBottom: 10 }}>Publicação</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {STATUS_VALUES.map((s) => (
                    <button
                      type="button"
                      key={s}
                      className="evx-status-opt"
                      data-on={status === s}
                      onClick={() => { setStatus(s); setSalvo(false) }}
                    >
                      <span className="sd" style={{ background: STATUS_DOT[s] }} />
                      <span className="st"><b>{STATUS_LABEL[s]}</b><span>{STATUS_DESC[s]}</span></span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Zona de perigo */}
              {isEdit && (
                <section className="card pad">
                  <div className="eyebrow" style={{ marginBottom: 10 }}>Zona de perigo</div>
                  <div className="evx-danger">
                    <div className="di"><X size={18} /></div>
                    <div className="dx">
                      <b>Excluir esta edição</b>
                      <p>Remove o evento, inscrições e sorteios vinculados. Não afeta a competição.</p>
                    </div>
                    <button
                      type="button"
                      className="btn evx-btn-danger"
                      disabled={excluindo}
                      onClick={() => setConfirmExcluir(true)}
                    >
                      Excluir
                    </button>
                  </div>
                </section>
              )}
            </aside>
          </div>

          {/* Erro */}
          {erro && (
            <div
              style={{
                background: 'var(--danger-soft)',
                color: 'var(--danger)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-lg)',
                padding: '10px 14px',
                fontSize: 13,
                marginTop: 16,
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
              marginTop: 16,
            }}
          >
            {isEdit ? (
              <button
                type="button"
                onClick={() => navigate(`/eventos/${id}/inscricoes`)}
                title="Abrir inscrições, sorteio e campeões deste evento"
                className="btn btn-ghost"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Users size={16} /> Gerenciar inscrições
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2.5 items-center">
              {isEdit && salvo && (
                <span className="badge b-success"><Check size={11} /> Salvo</span>
              )}
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
                disabled={isPending || !canSave}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, opacity: isPending || !canSave ? 0.5 : 1 }}
              >
                <Check size={16} />
                {isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar evento'}
              </button>
            </div>
          </div>
        </form>
        {isEdit && <EventoBoletins eventoId={Number(id)} eventoNome={nome} />}
      </div>

      <ConfirmDialog
        open={confirmExcluir}
        onClose={() => setConfirmExcluir(false)}
        onConfirm={() => { setConfirmExcluir(false); excluirEvento() }}
        eyebrow="Excluir evento"
        title={nome || 'Evento'}
        description="Essa ação não pode ser desfeita. Inscrições e sorteios vinculados serão perdidos."
        confirmLabel="Excluir"
        confirmVariant="danger"
        icon="trash"
      />
    </div>
  )
}
