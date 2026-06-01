import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../components/PageHeader'
import ParticipantesMultiSelect from '../../components/ParticipantesMultiSelect'
import ImportInscricoesModal from '../../components/import/ImportInscricoesModal'
import CampeaoBadge from '../../components/CampeaoBadge'
import CampeaoSlot from '../../components/CampeaoSlot'
import SorteioGrupos from '../../components/sorteio-result/SorteioGrupos'
import SorteioChaves from '../../components/sorteio-result/SorteioChaves'
import SorteioOrdem from '../../components/sorteio-result/SorteioOrdem'
import { eventosService } from '../../services/eventos'
import { modalidadesService } from '../../services/modalidades'
import { inscricoesService } from '../../services/inscricoes'
import { sorteiosService } from '../../services/sorteios'
import { campeoesAnterioresService } from '../../services/campeoes-anteriores'
import type { Participante } from '../../types/participante'
import type { TipoDisputa } from '../../types/modalidade'
import { Plus, X, Check, Trophy, Shuffle } from '../../lib/icons'
import { Brackets, Group, ListOrdered, FileText, Users, Crown, Download, Calendar, MapPin } from 'lucide-react'
import { composeSubtituloLine } from '../../lib/compose-subtitulo'

function formatDateBR(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

const TIPO_ICON: Record<TipoDisputa, typeof Brackets> = {
  chaves: Brackets,
  grupos: Group,
  ordem_entrada: ListOrdered,
  especifico: FileText,
}

const TIPO_GRAD: Record<TipoDisputa, string> = {
  chaves: 'linear-gradient(135deg, #1061d8 0%, #4f8ef7 100%)',
  grupos: 'linear-gradient(135deg, #0d9488 0%, #14b88a 100%)',
  ordem_entrada: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
  especifico: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
}

const TIPO_LABEL: Record<TipoDisputa, string> = {
  chaves: 'Chaves',
  grupos: 'Grupos',
  ordem_entrada: 'Ordem de entrada',
  especifico: 'Específico',
}

const NUM_POSICOES = 12
const POSICOES = Array.from({ length: NUM_POSICOES }, (_, i) => i + 1)

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--card-border)',
      borderRadius: 'var(--radius-md)',
      padding: 12,
      textAlign: 'center',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 22, color }}>{value}</div>
      <div className="text-[var(--t3)] mt-1 uppercase tracking-wider font-semibold" style={{ fontSize: 10 }}>{label}</div>
    </div>
  )
}

export default function EventoInscricoes() {
  const { id } = useParams()
  const eventoId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [modalidadeId, setModalidadeId] = useState<number | null>(null)
  const [inscreverOpen, setInscreverOpen] = useState(false)
  const [pickedIds, setPickedIds] = useState<number[]>([])
  const [erroModal, setErroModal] = useState('')
  const [resumoBulk, setResumoBulk] = useState<{ criadas: number; duplicadas: number; erros: number } | null>(null)
  const [erroSorteio, setErroSorteio] = useState('')
  const [importOpen, setImportOpen] = useState(false)

  const { data: evento } = useQuery({
    queryKey: ['eventos', eventoId],
    queryFn: () => eventosService.buscar(eventoId),
  })

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades', evento?.competicao_id],
    queryFn: () => modalidadesService.listar({ competicao_id: evento!.competicao_id }),
    enabled: !!evento,
  })

  const { data: inscricoesRaw = [], isLoading: loadingInscricoes } = useQuery({
    queryKey: ['inscricoes', eventoId, modalidadeId],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId, modalidade_id: modalidadeId! }),
    enabled: modalidadeId != null,
  })

  // Ordenar alfabeticamente
  const inscricoes = useMemo(
    () => [...inscricoesRaw].sort((a, b) =>
      a.participante.nome.localeCompare(b.participante.nome, 'pt-BR', { sensitivity: 'base' })
    ),
    [inscricoesRaw]
  )

  const { data: sorteios = [] } = useQuery({
    queryKey: ['sorteios', eventoId],
    queryFn: () => sorteiosService.listar({ evento_id: eventoId }),
  })

  const { data: countsByModalidade = {} } = useQuery({
    queryKey: ['inscricoes-counts', eventoId],
    queryFn: () => inscricoesService.counts(eventoId),
  })

  const { data: campeoes = [] } = useQuery({
    queryKey: ['campeoes-anteriores', eventoId, modalidadeId],
    queryFn: () => campeoesAnterioresService.listar({ evento_id: eventoId, modalidade_id: modalidadeId! }),
    enabled: modalidadeId != null,
  })

  const sorteioDaModalidade = modalidadeId != null
    ? sorteios.find(s => s.modalidade_id === modalidadeId) ?? null
    : null

  const modalidadesSorteadasIds = useMemo(
    () => new Set(sorteios.map(s => s.modalidade_id)),
    [sorteios]
  )

  const participantesById = useMemo(() => {
    const m = new Map<number, Participante>()
    for (const i of inscricoes) m.set(i.participante_id, i.participante)
    return m
  }, [inscricoes])

  const campeoesByParticipanteId = useMemo(() => {
    const m = new Map<number, number>()
    for (const c of campeoes) m.set(c.participante_id, c.posicao)
    return m
  }, [campeoes])

  const modalidadeAtual = modalidades.find(m => m.id === modalidadeId)
  const tipoDaModalidade = modalidadeAtual?.tipo_modalidade?.tipo
  const camposSubtitulo = evento?.competicao?.subtitulo_campos ?? []
  const subtituloLine = (p: any) => composeSubtituloLine(p, camposSubtitulo)

  const { mutate: criarBulk, isPending: salvando } = useMutation({
    mutationFn: () => inscricoesService.criarBulk({
      evento_id: eventoId,
      modalidade_id: modalidadeId!,
      participante_ids: pickedIds,
    }),
    onSuccess: r => {
      queryClient.invalidateQueries({ queryKey: ['inscricoes', eventoId, modalidadeId] })
      queryClient.invalidateQueries({ queryKey: ['inscricoes-counts', eventoId] })
      setResumoBulk({ criadas: r.criadas, duplicadas: r.duplicadas, erros: r.erros.length })
      setPickedIds([])
    },
    onError: (err: any) => setErroModal(err?.response?.data?.message ?? 'Erro ao inscrever.'),
  })

  const { mutate: removerInscricao } = useMutation({
    mutationFn: inscricoesService.remover,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inscricoes', eventoId, modalidadeId] })
      queryClient.invalidateQueries({ queryKey: ['inscricoes-counts', eventoId] })
    },
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const { mutate: executarSorteio, isPending: executandoSorteio } = useMutation({
    mutationFn: () => sorteiosService.executar({ evento_id: eventoId, modalidade_id: modalidadeId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sorteios', eventoId] })
      setErroSorteio('')
    },
    onError: (err: any) => setErroSorteio(err?.response?.data?.message ?? 'Erro ao sortear.'),
  })

  const { mutate: apagarSorteio } = useMutation({
    mutationFn: (sid: number) => sorteiosService.remover(sid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sorteios', eventoId] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao apagar sorteio.'),
  })

  const { mutate: criarCampeao, isPending: salvandoCampeao } = useMutation({
    mutationFn: (data: { participante_id: number; posicao: number }) =>
      campeoesAnterioresService.criar({
        evento_id: eventoId,
        modalidade_id: modalidadeId!,
        participante_id: data.participante_id,
        posicao: data.posicao,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campeoes-anteriores', eventoId, modalidadeId] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao salvar campeão.'),
  })

  const { mutate: removerCampeao } = useMutation({
    mutationFn: (cid: number) => campeoesAnterioresService.remover(cid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campeoes-anteriores', eventoId, modalidadeId] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover campeão.'),
  })

  function handleSortear() { setErroSorteio(''); executarSorteio() }
  function handleResortear() {
    if (confirm('Re-sortear esta modalidade? Isso vai sobrescrever o resultado atual com uma nova seed.')) {
      setErroSorteio(''); executarSorteio()
    }
  }
  function handleApagarSorteio(sid: number) {
    if (confirm('Apagar o sorteio? A próxima execução vai gerar um novo do zero.')) apagarSorteio(sid)
  }

  const excludeIds = inscricoes.map(i => i.participante_id)
  const excludeCampeoesIds = campeoes.map(c => c.participante_id)
  const totalModalidades = modalidades.length
  const sorteadas = modalidadesSorteadasIds.size
  const pct = totalModalidades > 0 ? Math.round((sorteadas / totalModalidades) * 100) : 0

  const cardStyle = {
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: 'var(--radius-xl)',
    padding: 24,
    boxShadow: 'var(--shadow-card)',
  } as const

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Operação"
        title={evento ? evento.nome : 'Inscrições'}
        sub={evento?.competicao?.nome}
        backTo="/eventos"
      />

      {/* Banner do evento + progresso */}
      {evento && (
        <div className="px-6 pt-4">
          <div
            style={{
              ...cardStyle,
              padding: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 280 }}>
              <div className="text-xs text-[var(--t3)] flex items-center gap-1.5">
                <Calendar size={14} className="text-[var(--brand-500)]" />
                {formatDateBR(evento.data_hora)}
              </div>
              <div className="text-xs text-[var(--t3)] flex items-center gap-1.5">
                <MapPin size={14} className="text-[var(--brand-500)]" />
                {evento.local} · {evento.municipio.nome}/{evento.municipio.uf}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div className="text-xs text-[var(--t3)]">
                <b style={{ color: 'var(--t1)' }}>{sorteadas}</b> de {totalModalidades} sorteadas
              </div>
              <div
                style={{
                  width: 180,
                  height: 6,
                  background: 'var(--card-bg-2)',
                  borderRadius: 'var(--radius-pill)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: 'var(--grad-brand)',
                    transition: 'width 300ms ease',
                  }}
                />
              </div>
              <span className="text-xs text-[var(--t4)] font-mono">{pct}%</span>
              <button
                onClick={() => navigate(`/eventos/${eventoId}/editar`)}
                className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)] font-semibold ml-2"
              >
                Editar evento
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-6">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 320px) minmax(0, 1fr)',
            gap: 16,
            alignItems: 'start',
          }}
          className="ei-grid"
        >
          {/* Sidebar: modalidades — sticky com scroll interno */}
          <aside style={{
            ...cardStyle,
            padding: 16,
            position: 'sticky',
            top: 16,
            maxHeight: 'calc(100vh - 32px)',
            overflowY: 'auto',
            alignSelf: 'start',
          }}>
            <div className="eyebrow mb-3">Modalidades</div>
            {modalidades.length === 0 ? (
              <p className="text-sm text-[var(--t3)]">Nenhuma modalidade nesta competição.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {modalidades.map(m => {
                  const active = m.id === modalidadeId
                  const sorteada = modalidadesSorteadasIds.has(m.id)
                  const tipo = (m.tipo_modalidade?.tipo as TipoDisputa | undefined) ?? 'especifico'
                  const Icon = TIPO_ICON[tipo] ?? FileText
                  const grad = TIPO_GRAD[tipo]
                  return (
                    <button
                      key={m.id}
                      onClick={() => { setModalidadeId(m.id); setErroSorteio('') }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-lg)',
                        background: active ? 'var(--brand-50)' : 'transparent',
                        border: `1px solid ${active ? 'var(--brand-500)' : 'transparent'}`,
                        color: 'var(--t1)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 120ms ease',
                        width: '100%',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--card-bg-2)' }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                    >
                      <span
                        style={{
                          width: 32, height: 32, borderRadius: 9,
                          background: grad, color: '#fff',
                          display: 'grid', placeItems: 'center', flexShrink: 0,
                        }}
                      >
                        <Icon size={16} />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{m.nome}</div>
                        <div
                          className="text-[var(--t4)] mt-0.5"
                          style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}
                        >
                          {m.sigla}
                        </div>
                      </div>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-pill)',
                          background: 'var(--card-bg-2)',
                          color: 'var(--t2)',
                          fontSize: 11,
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                        title={`${countsByModalidade[m.id] ?? 0} inscrito(s)`}
                      >
                        <Users size={11} /> {countsByModalidade[m.id] ?? 0}
                      </span>
                      {sorteada && (
                        <span
                          style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: 'var(--success)', color: '#fff',
                            display: 'grid', placeItems: 'center', flexShrink: 0,
                          }}
                          title="Sorteada"
                        >
                          <Check size={13} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </aside>

          {/* Conteúdo principal — sticky com scroll interno */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            minWidth: 0,
            position: 'sticky',
            top: 16,
            maxHeight: 'calc(100vh - 32px)',
            overflowY: 'auto',
            alignSelf: 'start',
          }}>
            {modalidadeId == null ? (
              <div
                style={{
                  ...cardStyle,
                  padding: 56,
                  textAlign: 'center',
                  color: 'var(--t3)',
                  border: '1px dashed var(--card-border)',
                  background: 'var(--card-bg-2)',
                }}
              >
                <Trophy size={40} className="mx-auto mb-3 text-[var(--t4)]" />
                <p className="text-base mb-1">Selecione uma modalidade</p>
                <p className="text-sm">Escolha uma modalidade ao lado para gerenciar inscrições, sorteio e campeões.</p>
              </div>
            ) : (
              <>
                {/* Card: header da modalidade selecionada */}
                {modalidadeAtual && (() => {
                  const tipo = (modalidadeAtual.tipo_modalidade?.tipo as TipoDisputa | undefined) ?? 'especifico'
                  const Icon = TIPO_ICON[tipo] ?? FileText
                  const grad = TIPO_GRAD[tipo]
                  return (
                    <section style={{ ...cardStyle, padding: 18 }}>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span
                          style={{
                            width: 52, height: 52, borderRadius: 13,
                            background: grad, color: '#fff',
                            display: 'grid', placeItems: 'center', flexShrink: 0,
                          }}
                        >
                          <Icon size={26} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', margin: 0 }}>
                            {modalidadeAtual.nome}
                            <span
                              className="font-mono"
                              style={{
                                fontSize: 11, fontWeight: 600,
                                color: 'var(--t3)', background: 'var(--card-bg-2)',
                                padding: '2px 7px', borderRadius: 'var(--radius-sm)',
                                marginLeft: 8, verticalAlign: 'middle',
                              }}
                            >
                              {modalidadeAtual.sigla}
                            </span>
                          </h2>
                          <div className="text-xs text-[var(--t3)] mt-1">
                            Disputa por <b>{TIPO_LABEL[tipo]}</b>
                          </div>
                        </div>
                      </div>
                    </section>
                  )
                })()}

                {/* Card: Inscritos */}
                <section style={cardStyle}>
                  <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div
                        style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: 'var(--grad-brand-deep)', color: '#fff',
                          display: 'grid', placeItems: 'center',
                        }}
                      >
                        <Users size={18} />
                      </div>
                      <div>
                        <div className="eyebrow">Operação</div>
                        <h3 className="sec-title" style={{ fontSize: 17 }}>
                          Inscritos
                          <span className="text-[var(--t4)] font-normal text-sm ml-2">
                            ({inscricoes.length})
                          </span>
                        </h3>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => setImportOpen(true)}
                        className="btn btn-ghost btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <Download size={14} /> Importar CSV
                      </button>
                      <button
                        onClick={() => { setInscreverOpen(true); setPickedIds([]); setResumoBulk(null); setErroModal('') }}
                        className="btn btn-primary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <Plus size={14} /> Inscrever
                      </button>
                    </div>
                  </div>

                  {loadingInscricoes ? (
                    <p className="text-sm text-[var(--t3)]">Carregando inscritos...</p>
                  ) : inscricoes.length === 0 ? (
                    <div
                      className="text-center text-[var(--t3)] py-10"
                      style={{
                        background: 'var(--card-bg-2)',
                        border: '1px dashed var(--card-border)',
                        borderRadius: 'var(--radius-lg)',
                      }}
                    >
                      <Users size={36} className="mx-auto mb-3 text-[var(--t4)]" />
                      <p className="text-sm mb-1">Nenhum inscrito nesta modalidade.</p>
                      <p className="text-xs text-[var(--t4)]">
                        Use "Inscrever" ou "Importar CSV" para adicionar participantes.
                      </p>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: 8,
                      }}
                    >
                      {inscricoes.map((i, idx) => {
                        const pos = campeoesByParticipanteId.get(i.participante_id)
                        return (
                          <div
                            key={i.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '10px 12px',
                              background: 'var(--card-bg-2)',
                              border: '1px solid var(--card-border)',
                              borderRadius: 'var(--radius-lg)',
                            }}
                          >
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 11,
                                color: 'var(--t4)',
                                minWidth: 28,
                              }}
                            >
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            {pos && <CampeaoBadge posicao={pos} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 13.5,
                                  fontWeight: 600,
                                  color: 'var(--t1)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {i.participante.nome}
                              </div>
                              {(() => {
                                const linha = subtituloLine(i.participante)
                                const mun = i.participante.municipio ? `${i.participante.municipio.nome}/${i.participante.municipio.uf}` : ''
                                // Se a linha já inclui municipio (campo selecionado), não duplicar.
                                const incluiMunicipio = camposSubtitulo.includes('municipio')
                                const partes = [linha, !incluiMunicipio ? mun : ''].filter(Boolean)
                                return partes.length > 0 ? (
                                  <div
                                    className="text-[var(--t4)] mt-0.5"
                                    style={{
                                      fontSize: 11,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {partes.join(' · ')}
                                  </div>
                                ) : null
                              })()}
                            </div>
                            <button
                              onClick={() => {
                                if (confirm(`Remover inscrição de "${i.participante.nome}"?`)) {
                                  removerInscricao(i.id)
                                }
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--t4)',
                                cursor: 'pointer',
                                padding: 6,
                                borderRadius: 6,
                                lineHeight: 0,
                                flexShrink: 0,
                              }}
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'var(--t4)')}
                              title="Remover"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>

                {/* Card: Sorteio */}
                <section style={cardStyle}>
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                        color: '#fff', display: 'grid', placeItems: 'center',
                      }}
                    >
                      <Shuffle size={18} />
                    </div>
                    <div>
                      <div className="eyebrow">Sorteio</div>
                      <h3 className="sec-title" style={{ fontSize: 17 }}>
                        {tipoDaModalidade === 'especifico'
                          ? 'Modalidade específica'
                          : sorteioDaModalidade
                          ? 'Resultado'
                          : 'Aguardando sorteio'}
                      </h3>
                    </div>
                  </div>

                  {tipoDaModalidade === 'especifico' ? (
                    <p className="text-sm text-[var(--t3)] italic">
                      Esta modalidade é do tipo "Específico" e não possui sorteio automático.
                    </p>
                  ) : sorteioDaModalidade ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 10,
                          padding: '10px 14px',
                          background: 'var(--card-bg-2)',
                          border: '1px solid var(--card-border)',
                          borderRadius: 'var(--radius-lg)',
                          fontSize: 12,
                          color: 'var(--t3)',
                        }}
                      >
                        <span>
                          seed:{' '}
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--t1)',
                              fontWeight: 700,
                            }}
                          >
                            {sorteioDaModalidade.seed}
                          </span>{' '}
                          · gerado em {formatDateBR(sorteioDaModalidade.gerado_em)}
                        </span>
                        <div className="flex gap-3">
                          <button
                            onClick={handleResortear}
                            disabled={executandoSorteio}
                            className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)] disabled:opacity-50 font-semibold"
                          >
                            {executandoSorteio ? 'Sorteando...' : 'Re-sortear'}
                          </button>
                          <button
                            onClick={() => handleApagarSorteio(sorteioDaModalidade.id)}
                            className="text-xs text-[var(--danger)] hover:text-[var(--danger-700)] font-semibold"
                          >
                            Apagar
                          </button>
                        </div>
                      </div>
                      {sorteioDaModalidade.tipo === 'grupos' && (
                        <SorteioGrupos
                          resultado={sorteioDaModalidade.resultado}
                          participantesById={participantesById}
                          campeoesByParticipanteId={campeoesByParticipanteId}
                          subtituloLine={subtituloLine}
                        />
                      )}
                      {sorteioDaModalidade.tipo === 'chaves' && (
                        <SorteioChaves
                          resultado={sorteioDaModalidade.resultado}
                          participantesById={participantesById}
                          campeoesByParticipanteId={campeoesByParticipanteId}
                          subtituloLine={subtituloLine}
                        />
                      )}
                      {sorteioDaModalidade.tipo === 'ordem_entrada' && (
                        <SorteioOrdem
                          resultado={sorteioDaModalidade.resultado}
                          participantesById={participantesById}
                          subtituloLine={subtituloLine}
                        />
                      )}
                      {erroSorteio && (
                        <div
                          style={{
                            background: 'var(--danger-soft)',
                            color: 'var(--danger)',
                            border: '1px solid var(--danger)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '10px 14px',
                            fontSize: 13,
                          }}
                        >
                          {erroSorteio}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: 32,
                        background: 'var(--card-bg-2)',
                        border: '1px dashed var(--card-border)',
                        borderRadius: 'var(--radius-lg)',
                      }}
                    >
                      <Shuffle size={36} className="mx-auto mb-3 text-[var(--t4)]" />
                      <p className="text-sm text-[var(--t3)] mb-3">
                        {inscricoes.length === 0
                          ? 'Adicione participantes antes de sortear.'
                          : 'Sorteio ainda não realizado.'}
                      </p>
                      <button
                        onClick={handleSortear}
                        disabled={inscricoes.length === 0 || executandoSorteio}
                        className="btn btn-primary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          opacity: inscricoes.length === 0 || executandoSorteio ? 0.5 : 1,
                        }}
                      >
                        <Shuffle size={16} />
                        {executandoSorteio ? 'Sorteando...' : 'Realizar sorteio'}
                      </button>
                      {erroSorteio && (
                        <p
                          className="mt-3 text-sm"
                          style={{ color: 'var(--danger)' }}
                        >
                          {erroSorteio}
                        </p>
                      )}
                    </div>
                  )}
                </section>

                {/* Card: Campeões do ano anterior — só faz sentido para Chaves/Grupos (seeding por colocação) */}
                {(tipoDaModalidade === 'chaves' || tipoDaModalidade === 'grupos') && (
                <section style={cardStyle}>
                  <div className="flex items-center gap-3 mb-1">
                    <div
                      style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: 'linear-gradient(135deg, #d97706 0%, #facc15 100%)',
                        color: '#fff', display: 'grid', placeItems: 'center',
                      }}
                    >
                      <Crown size={18} />
                    </div>
                    <div>
                      <div className="eyebrow">Histórico</div>
                      <h3 className="sec-title" style={{ fontSize: 17 }}>
                        Campeões do ano anterior
                      </h3>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--t3)] mb-4 ml-12">
                    Cadastre até 12 colocados. Quem se inscrever neste evento recebe o badge correspondente — e, em Grupos/Chaves, é semeado como cabeça.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {POSICOES.map(pos => {
                      const c = campeoes.find(x => x.posicao === pos) ?? null
                      return (
                        <CampeaoSlot
                          key={pos}
                          posicao={pos}
                          campeao={c}
                          excludeIds={excludeCampeoesIds}
                          onCriar={participante_id => criarCampeao({ participante_id, posicao: pos })}
                          onRemover={cid => removerCampeao(cid)}
                          salvando={salvandoCampeao}
                          subtituloLine={subtituloLine}
                        />
                      )
                    })}
                  </div>
                </section>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Inscrever (multi) */}
      {inscreverOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
          }}
          onClick={() => {
            setInscreverOpen(false)
            setPickedIds([])
            setResumoBulk(null)
            setErroModal('')
          }}
        >
          <div
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-2xl)',
              padding: 28,
              maxWidth: 640,
              width: '100%',
              margin: '0 16px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="sec-title mb-4" style={{ fontSize: 'clamp(18px, 2vw, 24px)' }}>
              <Plus size={20} className="inline mr-2 text-[var(--brand-500)]" />
              Inscrever participantes
              {modalidadeAtual && (
                <span className="text-[var(--t3)] font-normal text-sm ml-2">
                  · {modalidadeAtual.nome}
                </span>
              )}
            </h3>

            {resumoBulk ? (
              <div style={{
                background: 'var(--card-bg-2)',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 16,
              }}>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <Stat label="Inscritos" value={resumoBulk.criadas} color="var(--success)" />
                  <Stat label="Já inscritos" value={resumoBulk.duplicadas} color="var(--t3)" />
                  <Stat label="Erros" value={resumoBulk.erros} color="var(--danger)" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    onClick={() => { setResumoBulk(null); setPickedIds([]) }}
                    className="btn btn-ghost"
                  >
                    Inscrever mais
                  </button>
                  <button
                    onClick={() => {
                      setInscreverOpen(false)
                      setResumoBulk(null)
                      setPickedIds([])
                    }}
                    className="btn btn-primary"
                  >
                    <Check size={16} /> Fechar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <ParticipantesMultiSelect
                  selectedIds={pickedIds}
                  onChange={setPickedIds}
                  excludeIds={excludeIds}
                  subtituloLine={subtituloLine}
                />
                {erroModal && (
                  <div
                    style={{
                      background: 'var(--danger-soft)',
                      color: 'var(--danger)',
                      border: '1px solid var(--danger)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '10px 14px',
                      fontSize: 13,
                      marginTop: 12,
                    }}
                  >
                    {erroModal}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                  <button
                    onClick={() => {
                      setInscreverOpen(false)
                      setPickedIds([])
                      setErroModal('')
                    }}
                    className="btn btn-ghost"
                  >
                    <X size={16} /> Cancelar
                  </button>
                  <button
                    onClick={() => criarBulk()}
                    disabled={pickedIds.length === 0 || salvando}
                    className="btn btn-primary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      opacity: pickedIds.length === 0 || salvando ? 0.5 : 1,
                    }}
                  >
                    <Check size={16} />
                    {salvando
                      ? 'Inscrevendo...'
                      : pickedIds.length === 0
                      ? 'Selecione participantes'
                      : `Inscrever ${pickedIds.length}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ImportInscricoesModal
        open={importOpen}
        eventoId={eventoId}
        modalidadeId={modalidadeId ?? 0}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          queryClient.invalidateQueries({ queryKey: ['inscricoes', eventoId, modalidadeId] })
          queryClient.invalidateQueries({ queryKey: ['inscricoes-counts', eventoId] })
        }}
      />

      {/* Responsive */}
      <style>{`
        @media (max-width: 1024px) {
          .ei-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
