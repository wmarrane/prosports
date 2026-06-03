import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useToast } from '../../components/Toast'
import { modalidadesService } from '../../services/modalidades'
import type { Modalidade, TipoDisputa } from '../../types/modalidade'
import { Plus, Trophy, ChevronDown } from '../../lib/icons'
import { Brackets, Group, ListOrdered, FileText, Layers, Shapes } from 'lucide-react'

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
  { id: 'especifico', label: 'Específico', icon: FileText },
]

export default function ModalidadesList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [filtro, setFiltro] = useState<FiltroId>('todos')
  const [recolhidas, setRecolhidas] = useState<Set<number>>(new Set())
  const [alvo, setAlvo] = useState<{ id: number; nome: string } | null>(null)

  function toggleCompeticao(id: number) {
    setRecolhidas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const { data = [], isLoading } = useQuery({
    queryKey: ['modalidades'],
    queryFn: () => modalidadesService.listar(),
  })

  const { mutateAsync: remover } = useMutation({
    mutationFn: modalidadesService.remover,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modalidades'] })
      toast.success('Modalidade removida.')
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const countPorFiltro = useMemo(() => {
    const out: Record<FiltroId, number> = {
      todos: data.length, chaves: 0, grupos: 0, ordem_entrada: 0, especifico: 0,
    }
    for (const m of data) {
      const t = m.tipo_modalidade?.tipo
      if (t && t in out) out[t]++
    }
    return out
  }, [data])

  const lista = useMemo(
    () => (filtro === 'todos' ? data : data.filter(m => m.tipo_modalidade?.tipo === filtro)),
    [data, filtro]
  )

  // Agrupa por competição para display
  const agrupadasPorCompeticao = useMemo(() => {
    const map = new Map<number, { competicaoNome: string; modalidades: Modalidade[] }>()
    for (const m of lista) {
      const key = m.competicao_id
      if (!map.has(key)) {
        map.set(key, { competicaoNome: m.competicao?.nome ?? '—', modalidades: [] })
      }
      map.get(key)!.modalidades.push(m)
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].competicaoNome.localeCompare(b[1].competicaoNome, 'pt-BR'))
  }, [lista])

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Operação"
        title="Modalidades"
        sub="Esportes/categorias vinculadas a cada competição. Cada modalidade define o tipo de disputa do sorteio."
        actions={
          <button onClick={() => navigate('/modalidades/nova')} className="btn btn-primary">
            <Plus size={16} /> Nova Modalidade
          </button>
        }
      />

      <div className="p-6">
        {/* Filter chips */}
        {data.length > 0 && (
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 20 }}>
            {FILTROS.map(f => {
              const Icon = f.icon
              const ativo = filtro === f.id
              const count = countPorFiltro[f.id]
              return (
                <button
                  key={f.id}
                  onClick={() => setFiltro(f.id)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', borderRadius: 'var(--radius-pill)',
                    fontSize: 13, fontWeight: 600,
                    border: `1px solid ${ativo ? 'var(--brand-500)' : 'var(--card-border)'}`,
                    background: ativo ? 'var(--brand-500)' : 'var(--card-bg-2)',
                    color: ativo ? '#fff' : 'var(--t2)',
                    cursor: 'pointer', transition: 'all 140ms ease',
                  }}
                >
                  <Icon size={15} /> {f.label}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.75 }}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* States */}
        {isLoading ? (
          <p className="text-sm text-[var(--t3)]">Carregando...</p>
        ) : data.length === 0 ? (
          <div
            className="text-center text-[var(--t3)] py-16"
            style={{
              background: 'var(--card-bg-2)', border: '1px dashed var(--card-border)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <Shapes size={40} className="mx-auto mb-3 text-[var(--t4)]" />
            <p className="text-base mb-1">Nenhuma modalidade cadastrada.</p>
            <p className="text-sm">Clique em "+ Nova Modalidade" para começar.</p>
          </div>
        ) : lista.length === 0 ? (
          <div
            className="text-center text-[var(--t3)] py-12"
            style={{
              background: 'var(--card-bg-2)', border: '1px dashed var(--card-border)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <p className="text-sm">Nenhuma modalidade nesse filtro.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {agrupadasPorCompeticao.length > 1 && (
              <div style={{ display: 'flex', gap: 12, marginBottom: -8 }}>
                <button
                  type="button"
                  onClick={() => setRecolhidas(new Set(agrupadasPorCompeticao.map(([id]) => id)))}
                  className="text-xs text-[var(--t3)] hover:text-[var(--t1)] font-semibold"
                >
                  Recolher todas
                </button>
                <span className="text-xs text-[var(--t4)]">·</span>
                <button
                  type="button"
                  onClick={() => setRecolhidas(new Set())}
                  className="text-xs text-[var(--t3)] hover:text-[var(--t1)] font-semibold"
                >
                  Expandir todas
                </button>
              </div>
            )}
            {agrupadasPorCompeticao.map(([competicaoId, grupo]) => {
              const recolhida = recolhidas.has(competicaoId)
              return (
              <section key={competicaoId}>
                <button
                  type="button"
                  onClick={() => toggleCompeticao(competicaoId)}
                  className="flex items-center gap-2 mb-3 w-full text-left"
                  style={{
                    paddingBottom: 8,
                    borderBottom: '1px solid var(--card-border)',
                    background: 'transparent',
                    border: 'none',
                    borderBottomWidth: 1,
                    borderBottomStyle: 'solid',
                    borderBottomColor: 'var(--card-border)',
                    cursor: 'pointer',
                  }}
                  aria-expanded={!recolhida}
                >
                  <ChevronDown
                    size={16}
                    className="text-[var(--t3)]"
                    style={{
                      transition: 'transform 160ms ease',
                      transform: recolhida ? 'rotate(-90deg)' : 'rotate(0deg)',
                    }}
                  />
                  <Trophy size={15} className="text-[var(--brand-500)]" />
                  <h3 className="text-sm font-bold text-[var(--t1)]">{grupo.competicaoNome}</h3>
                  <span className="text-xs text-[var(--t4)] font-mono">
                    · {grupo.modalidades.length} {grupo.modalidades.length === 1 ? 'modalidade' : 'modalidades'}
                  </span>
                </button>
                {!recolhida && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: 12,
                  }}
                >
                  {grupo.modalidades.map(m => {
                    const tipo = m.tipo_modalidade?.tipo ?? 'especifico'
                    const Icon = TIPO_ICON[tipo] ?? FileText
                    const grad = TIPO_GRAD[tipo]
                    return (
                      <div
                        key={m.id}
                        className="fade-in"
                        style={{
                          background: 'var(--card-bg)',
                          border: '1px solid var(--card-border)',
                          borderRadius: 'var(--radius-xl)',
                          padding: 16,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          transition: 'border-color 140ms ease',
                          boxShadow: 'var(--shadow-card)',
                          cursor: 'pointer',
                        }}
                        onClick={() => navigate(`/modalidades/${m.id}/editar`)}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-400)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--card-border)')}
                      >
                        <span
                          style={{
                            width: 46, height: 46, borderRadius: 12,
                            background: grad, color: '#fff',
                            display: 'grid', placeItems: 'center', flexShrink: 0,
                            boxShadow: '0 6px 14px -6px rgba(0,0,0,0.3)',
                          }}
                        >
                          <Icon size={22} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', margin: 0 }}>
                              {m.nome}
                            </h4>
                            <span
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 11,
                                fontWeight: 700,
                                color: 'var(--t3)',
                                background: 'var(--card-bg-2)',
                                padding: '2px 7px',
                                borderRadius: 'var(--radius-sm)',
                                letterSpacing: '0.04em',
                              }}
                            >
                              {m.sigla}
                            </span>
                          </div>
                          <div className="text-xs text-[var(--t3)] mt-1">{TIPO_LABEL[tipo]}</div>
                        </div>
                        <div
                          className="flex gap-3 flex-shrink-0"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            onClick={() => navigate(`/modalidades/${m.id}/editar`)}
                            className="text-[var(--brand-500)] hover:text-[var(--brand-400)] text-xs font-semibold"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setAlvo({ id: m.id, nome: m.nome })}
                            className="text-[var(--danger)] hover:text-[var(--danger-700)] text-xs font-semibold"
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
        )}
      </div>

      <ConfirmDialog
        open={alvo !== null}
        onClose={() => setAlvo(null)}
        onConfirm={() => alvo && remover(alvo.id)}
        eyebrow="Remover modalidade"
        title={alvo?.nome ?? ''}
        description="Inscrições e sorteios vinculados a esta modalidade serão perdidos."
        confirmLabel="Remover"
        confirmVariant="danger"
        icon="trash"
      />
    </div>
  )
}
