import { useMemo, useState } from 'react'
import { agruparEventosPorCompeticao } from '../../lib/agrupar-eventos'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import PageHeader from '../../components/PageHeader'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useToast } from '../../components/Toast'
import { eventosService } from '../../services/eventos'
import type { Evento } from '../../types/evento'
import type { TipoDisputa } from '../../types/modalidade'
import { STATUS_LABEL, STATUS_COLOR } from '../../lib/evento-status'
import { Trophy, Plus } from '../../lib/icons'
import { Brackets, Group, ListOrdered, FileText, Layers, MapPin, Users, Dices, ChevronDown } from 'lucide-react'

type FiltroId = 'todos' | TipoDisputa

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

const FILTROS: Array<{ id: FiltroId; label: string; icon: typeof Brackets }> = [
  { id: 'todos', label: 'Todos', icon: Layers },
  { id: 'chaves', label: 'Chaves', icon: Brackets },
  { id: 'grupos', label: 'Grupos', icon: Group },
  { id: 'ordem_entrada', label: 'Ordem de entrada', icon: ListOrdered },
]

function formatDateBR(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

function eventoTipos(ev: Evento): TipoDisputa[] {
  const mods = ev.competicao?.modalidades ?? []
  const set = new Set<TipoDisputa>()
  for (const m of mods) {
    if (m.tipo_modalidade?.tipo) set.add(m.tipo_modalidade.tipo)
  }
  return Array.from(set)
}

export default function EventosList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [filtro, setFiltro] = useState<FiltroId>('todos')
  const [alvo, setAlvo] = useState<{ id: number; nome: string } | null>(null)
  const [recolhidas, setRecolhidas] = useState<Set<number>>(new Set())
  const [sorteadosAberto, setSorteadosAberto] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('prosports.eventos.sorteadosAberto') === '1'
    } catch {
      return false
    }
  })
  function toggleSorteados() {
    setSorteadosAberto(prev => {
      const next = !prev
      try { sessionStorage.setItem('prosports.eventos.sorteadosAberto', next ? '1' : '0') } catch { /* ignora */ }
      return next
    })
  }
  const isAdmin = useAuthStore(s => s.user?.role === 'ADMIN')
  function toggleGrupo(id: number) {
    setRecolhidas(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ['eventos'],
    queryFn: () => eventosService.listar(),
  })

  const { mutateAsync: remover } = useMutation({
    mutationFn: eventosService.remover,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eventos'] })
      toast.success('Evento removido.')
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const { mutate: publicarSite, isPending: publicandoSite } = useMutation({
    mutationFn: (id: number) => eventosService.publicar(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['eventos'] }); toast.success('Publicação disparada. O site público será atualizado em ~1-2 min.') },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao publicar.'),
  })
  const { mutate: despublicarSite, isPending: despublicandoSite } = useMutation({
    mutationFn: (id: number) => eventosService.despublicar(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['eventos'] }); toast.success('Despublicação disparada.') },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Erro ao despublicar.'),
  })

  const lista = useMemo(
    () => (filtro === 'todos' ? eventos : eventos.filter(e => eventoTipos(e).includes(filtro))),
    [eventos, filtro]
  )

  const sorteados = useMemo(() => lista.filter(e => e.status === 'sorteado'), [lista])
  const demais = useMemo(() => lista.filter(e => e.status !== 'sorteado'), [lista])
  const gruposDemais = useMemo(() => agruparEventosPorCompeticao(demais), [demais])
  const gruposSorteados = useMemo(() => agruparEventosPorCompeticao(sorteados), [sorteados])

  const countPorFiltro = useMemo(() => {
    const out: Record<FiltroId, number> = { todos: eventos.length, chaves: 0, grupos: 0, ordem_entrada: 0, especifico: 0 }
    for (const e of eventos) {
      for (const t of eventoTipos(e)) {
        if (t in out) out[t]++
      }
    }
    return out
  }, [eventos])

  function handleRemove(e: React.MouseEvent, ev: Evento) {
    e.stopPropagation()
    setAlvo({ id: ev.id, nome: ev.nome })
  }

  function renderGrupos(grupos: ReturnType<typeof agruparEventosPorCompeticao>) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {grupos.map(g => {
          const recolhido = recolhidas.has(g.competicaoId)
          return (
            <section key={g.competicaoId}>
              <button
                type="button"
                onClick={() => toggleGrupo(g.competicaoId)}
                title="Recolher ou expandir os eventos desta competição"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  padding: '4px 2px', marginBottom: 12, color: 'var(--t1)',
                  borderBottom: '1px solid var(--card-border)',
                }}
              >
                <ChevronDown
                  size={18}
                  style={{ transition: 'transform 140ms ease', transform: recolhido ? 'rotate(-90deg)' : 'none', color: 'var(--t3)' }}
                />
                <span style={{ fontWeight: 700, fontSize: 15 }}>{g.competicaoNome}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--t3)' }}>{g.eventos.length}</span>
              </button>
              {!recolhido && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: 16,
                  }}
                >
                  {g.eventos.map((ev, i) => {
                    const tipos = eventoTipos(ev)
                    const totalModalidades = ev.competicao?.modalidades?.length ?? 0
                    const modalidadesCount = ev.modalidades_distintas ?? totalModalidades
                    const inscritos = ev.total_participantes ?? 0
                    const sorteadas = ev._count?.sorteios ?? 0
                    const sorteaveis = ev.modalidades_sorteaveis ?? totalModalidades
                    const ribbonGrad = tipos.length > 1
                      ? 'var(--grad-brand-deep)'
                      : tipos.length === 1
                      ? TIPO_GRAD[tipos[0]]
                      : 'var(--grad-brand)'
                    const suspenso = ev.status === 'suspenso'
                    return (
                      <div
                        key={ev.id}
                        onClick={() => navigate(`/eventos/${ev.id}/${isAdmin ? 'editar' : 'inscricoes'}`)}
                        className="fade-in"
                        style={{
                          position: 'relative',
                          background: suspenso ? 'var(--warn-soft)' : 'var(--card-bg)',
                          border: suspenso ? '1px solid var(--warn)' : '1px solid var(--card-border)',
                          borderRadius: 'var(--radius-xl)',
                          padding: 20,
                          cursor: 'pointer',
                          transition: 'border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease',
                          boxShadow: 'var(--shadow-card)',
                          animationDelay: `${i * 35}ms`,
                          overflow: 'hidden',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = 'var(--brand-400)'
                          e.currentTarget.style.transform = 'translateY(-2px)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = suspenso ? 'var(--warn)' : 'var(--card-border)'
                          e.currentTarget.style.transform = 'translateY(0)'
                        }}
                      >
                        {/* Ribbon */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: 4,
                            background: ribbonGrad,
                          }}
                        />

                        {/* Header: tipos stack + status */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, marginTop: 4 }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {tipos.length === 0 && (
                              <div
                                title="Sem modalidades"
                                style={{
                                  width: 38, height: 38, borderRadius: 11,
                                  background: 'var(--card-bg-2)', color: 'var(--t4)',
                                  border: '1px dashed var(--card-border)',
                                  display: 'grid', placeItems: 'center',
                                }}
                              >
                                <FileText size={18} />
                              </div>
                            )}
                            {tipos.map(t => {
                              const Icon = TIPO_ICON[t]
                              return (
                                <div
                                  key={t}
                                  title={TIPO_LABEL[t]}
                                  style={{
                                    width: 38, height: 38, borderRadius: 11,
                                    background: TIPO_GRAD[t], color: '#fff',
                                    display: 'grid', placeItems: 'center',
                                    boxShadow: '0 6px 14px -6px rgba(0,0,0,0.3)',
                                  }}
                                >
                                  <Icon size={19} />
                                </div>
                              )
                            })}
                          </div>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[ev.status]}`}>
                            {STATUS_LABEL[ev.status]}
                          </span>
                        </div>

                        {/* ID + município */}
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            color: 'var(--t4)',
                            marginBottom: 4,
                            letterSpacing: '0.04em',
                          }}
                        >
                          #{String(ev.id).padStart(3, '0')} ·{' '}
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle' }}>
                            <MapPin size={11} /> {ev.municipio.nome}/{ev.municipio.uf}
                          </span>
                        </div>

                        {/* Nome */}
                        <h3
                          style={{
                            fontSize: 16.5,
                            lineHeight: 1.25,
                            fontWeight: 700,
                            color: 'var(--t1)',
                            margin: '4px 0',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {ev.nome}
                        </h3>

                        {/* Competição */}
                        <div
                          style={{
                            fontSize: 12.5,
                            color: 'var(--t3)',
                            marginTop: 6,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Trophy size={13} style={{ color: 'var(--brand-500)' }} /> {ev.competicao.nome}
                        </div>

                        {/* Data + local */}
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--t3)',
                            marginTop: 4,
                          }}
                        >
                          {formatDateBR(ev.data_hora)} · {ev.local}
                        </div>

                        {/* Footer metas */}
                        <div
                          style={{
                            display: 'flex',
                            gap: 16,
                            marginTop: 16,
                            paddingTop: 16,
                            borderTop: '1px solid var(--card-border)',
                            flexWrap: 'wrap',
                          }}
                        >
                          <Meta icon={Layers} label={String(modalidadesCount)} sub="modalidades" />
                          <Meta icon={Users} label={inscritos.toLocaleString('pt-BR')} sub="inscritos" />
                          <Meta icon={Dices} label={`${sorteadas}/${sorteaveis}`} sub="sorteadas" />
                        </div>

                        {/* Actions */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: 12,
                            marginTop: 14,
                          }}
                        >
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              navigate(`/eventos/${ev.id}/inscricoes`)
                            }}
                            title="Abrir inscrições, sorteio e campeões do evento"
                            className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)] font-semibold"
                          >
                            Inscrições
                          </button>
                          {ev.site_publicado_em ? (
                            <button
                              onClick={e => { e.stopPropagation(); despublicarSite(ev.id) }}
                              disabled={despublicandoSite}
                              title="Remove o evento do site público (~1–2 min). Re-publicar atualiza/sobrescreve o snapshot."
                              className="text-xs text-[var(--t3)] hover:text-[var(--t1)] font-semibold"
                            >Despublicar</button>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); publicarSite(ev.id) }}
                              disabled={publicandoSite || ev.status !== 'sorteado'}
                              title={ev.status !== 'sorteado' ? 'Disponível apenas quando o evento estiver Sorteado' : 'Publica um retrato (snapshot) do evento no site público (~1–2 min). Para refletir mudanças depois, publique novamente.'}
                              className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)] font-semibold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[var(--brand-500)]"
                            >Publicar no site</button>
                          )}
                          <button
                            onClick={e => handleRemove(e, ev)}
                            title="Excluir o evento (inscrições e sorteios vinculados serão perdidos)"
                            className="text-xs text-[var(--danger)] hover:text-[var(--danger-700)] font-semibold"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>
    )
  }

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Operação"
        title="Eventos"
        sub="Gerencie edições de competições, datas, locais e inscrições."
        actions={
          <button onClick={() => navigate('/eventos/novo')} title="Criar um novo evento" className="btn btn-primary">
            <Plus size={16} /> Novo Evento
          </button>
        }
      />

      <div className="p-6">
        {/* Filter chips */}
        {eventos.length > 0 && (
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 20 }}>
            {FILTROS.map(f => {
              const Icon = f.icon
              const ativo = filtro === f.id
              const count = countPorFiltro[f.id]
              return (
                <button
                  key={f.id}
                  onClick={() => setFiltro(f.id)}
                  title={f.id === 'todos' ? 'Mostrar todos os eventos' : `Mostrar apenas eventos de ${f.label}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: 13,
                    fontWeight: 600,
                    border: `1px solid ${ativo ? 'var(--brand-500)' : 'var(--card-border)'}`,
                    background: ativo ? 'var(--brand-500)' : 'var(--card-bg-2)',
                    color: ativo ? '#fff' : 'var(--t2)',
                    cursor: 'pointer',
                    transition: 'all 140ms ease',
                  }}
                >
                  <Icon size={15} /> {f.label}
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      opacity: 0.75,
                    }}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Cards / states */}
        {isLoading ? (
          <p className="text-sm text-[var(--t3)]">Carregando...</p>
        ) : eventos.length === 0 ? (
          <div
            className="text-center text-[var(--t3)] py-16"
            style={{
              background: 'var(--card-bg-2)',
              border: '1px dashed var(--card-border)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <Trophy size={40} className="mx-auto mb-3 text-[var(--t4)]" />
            <p className="text-base mb-1">Nenhum evento cadastrado.</p>
            <p className="text-sm">Clique em "+ Novo Evento" para começar.</p>
          </div>
        ) : lista.length === 0 ? (
          <div
            className="text-center text-[var(--t3)] py-12"
            style={{
              background: 'var(--card-bg-2)',
              border: '1px dashed var(--card-border)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <p className="text-sm">Nenhum evento nesse filtro.</p>
          </div>
        ) : (
          <>
            {demais.length > 0 && renderGrupos(gruposDemais)}
            {sorteados.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <button
                  type="button"
                  onClick={toggleSorteados}
                  title="Recolher ou expandir os eventos já sorteados"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: '4px 2px', marginBottom: 12, color: 'var(--t1)',
                    borderBottom: '1px solid var(--card-border)',
                  }}
                >
                  <ChevronDown
                    size={18}
                    style={{ transition: 'transform 140ms ease', transform: sorteadosAberto ? 'none' : 'rotate(-90deg)', color: 'var(--t3)' }}
                  />
                  <span style={{ fontWeight: 700, fontSize: 15 }}>Sorteados</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--t3)' }}>{sorteados.length}</span>
                </button>
                {sorteadosAberto && renderGrupos(gruposSorteados)}
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={alvo !== null}
        onClose={() => setAlvo(null)}
        onConfirm={() => alvo && remover(alvo.id)}
        eyebrow="Remover evento"
        title={alvo?.nome ?? ''}
        description="Essa ação não pode ser desfeita. Inscrições e sorteios vinculados serão perdidos."
        confirmLabel="Remover"
        confirmVariant="danger"
        icon="trash"
      />
    </div>
  )
}

function Meta({ icon: Icon, label, sub }: { icon: typeof Brackets; label: string; sub: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          background: 'var(--card-bg-2)',
          border: '1px solid var(--card-border)',
          color: 'var(--t3)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Icon size={15} />
      </div>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t1)', lineHeight: 1.1 }}>{label}</div>
        <div
          style={{
            fontSize: 10,
            color: 'var(--t4)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginTop: 1,
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  )
}
