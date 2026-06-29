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
import { Trophy, Plus } from '../../lib/icons'
import { Brackets, Group, ListOrdered, Layers, ChevronDown } from 'lucide-react'
import EventoAdminCard from './EventoAdminCard'

type FiltroId = 'todos' | TipoDisputa

const FILTROS: Array<{ id: FiltroId; label: string; icon: typeof Brackets }> = [
  { id: 'todos', label: 'Todos', icon: Layers },
  { id: 'chaves', label: 'Chaves', icon: Brackets },
  { id: 'grupos', label: 'Grupos', icon: Group },
  { id: 'ordem_entrada', label: 'Ordem de entrada', icon: ListOrdered },
]

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
                  {g.eventos.map(ev => (
                    <EventoAdminCard
                      key={ev.id}
                      evento={ev}
                      isAdmin={isAdmin}
                      publicando={publicandoSite}
                      despublicando={despublicandoSite}
                      onAbrir={e => navigate(`/eventos/${e.id}/${isAdmin ? 'editar' : 'inscricoes'}`)}
                      onInscricoes={e => navigate(`/eventos/${e.id}/inscricoes`)}
                      onPublicar={id => publicarSite(id)}
                      onDespublicar={id => despublicarSite(id)}
                      onRemover={e => setAlvo({ id: e.id, nome: e.nome })}
                    />
                  ))}
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

