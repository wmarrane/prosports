import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import ParticipantesAssociadosPanel from '../../components/ParticipantesAssociadosPanel'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useToast } from '../../components/Toast'
import { inspetoriasService } from '../../services/inspetorias'
import type { Inspetoria } from '../../types/participante'
import { Plus, ChevronDown } from '../../lib/icons'
import { ShieldCheck, Building2 } from 'lucide-react'

export default function InspetoriasList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [selecionadaId, setSelecionadaId] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<Set<number | 'sem-delegacia'>>(new Set())
  const [alvo, setAlvo] = useState<{ id: number; nome: string } | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['inspetorias'],
    queryFn: () => inspetoriasService.listar(),
  })

  const { mutateAsync: remover } = useMutation({
    mutationFn: inspetoriasService.remover,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspetorias'] })
      toast.success('Inspetoria removida.')
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  type Grupo = { delegaciaId: number | 'sem-delegacia'; delegaciaNome: string; itens: Inspetoria[] }
  const grupos = useMemo(() => {
    const m = new Map<number | 'sem-delegacia', Grupo>()
    for (const i of data) {
      const key = (i.delegacia_id ?? 'sem-delegacia') as number | 'sem-delegacia'
      const nome = i.delegacia?.nome ?? 'Sem delegacia'
      if (!m.has(key)) m.set(key, { delegaciaId: key, delegaciaNome: nome, itens: [] })
      m.get(key)!.itens.push(i)
    }
    const arr = Array.from(m.values()).map(g => ({
      ...g,
      itens: g.itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })),
    }))
    arr.sort((a, b) => a.delegaciaNome.localeCompare(b.delegaciaNome, 'pt-BR', { sensitivity: 'base' }))
    return arr
  }, [data])

  function toggle(key: number | 'sem-delegacia') {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selecionada = data.find(i => i.id === selecionadaId) ?? null

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Cadastro"
        title="Inspetorias"
        sub="Unidades regionais de inspeção agrupadas por delegacia. Selecione uma inspetoria para ver os participantes associados."
        actions={
          <button onClick={() => navigate('/inspetorias/novo')} className="btn btn-primary">
            <Plus size={16} /> Nova Inspetoria
          </button>
        }
      />

      <div className="p-6">
        {isLoading ? (
          <p className="text-[var(--t3)] text-sm">Carregando...</p>
        ) : data.length === 0 ? (
          <div
            className="text-center text-[var(--t3)] py-16"
            style={{
              background: 'var(--card-bg-2)',
              border: '1px dashed var(--card-border)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <ShieldCheck size={40} className="mx-auto mb-3 text-[var(--t4)]" />
            <p className="text-base mb-1">Nenhuma inspetoria cadastrada.</p>
            <p className="text-sm">Clique em "+ Nova Inspetoria" para começar.</p>
          </div>
        ) : (
          <div
            className="il-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
              gap: 16,
              alignItems: 'start',
            }}
          >
            <div>
              {grupos.length > 1 && (
                <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => setExpanded(new Set(grupos.map(g => g.delegaciaId)))}
                    className="text-xs text-[var(--t3)] hover:text-[var(--t1)] font-semibold"
                  >
                    Expandir todas
                  </button>
                  <span className="text-xs text-[var(--t4)]">·</span>
                  <button
                    type="button"
                    onClick={() => setExpanded(new Set())}
                    className="text-xs text-[var(--t3)] hover:text-[var(--t1)] font-semibold"
                  >
                    Recolher todas
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {grupos.map(g => {
                  const aberto = expanded.has(g.delegaciaId)
                  return (
                    <section key={String(g.delegaciaId)}>
                      <button
                        type="button"
                        onClick={() => toggle(g.delegaciaId)}
                        className="w-full text-left flex items-center gap-2 mb-3"
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          paddingBottom: 8, borderBottom: '1px solid var(--card-border)',
                        }}
                        aria-expanded={aberto}
                      >
                        <ChevronDown
                          size={16}
                          className="text-[var(--t3)]"
                          style={{
                            transition: 'transform 160ms ease',
                            transform: aberto ? 'rotate(0deg)' : 'rotate(-90deg)',
                          }}
                        />
                        <Building2 size={15} className="text-[var(--brand-500)]" />
                        <h3 className="text-sm font-bold text-[var(--t1)]">{g.delegaciaNome}</h3>
                        <span className="text-xs text-[var(--t4)] font-mono">
                          · {g.itens.length} {g.itens.length === 1 ? 'inspetoria' : 'inspetorias'}
                        </span>
                      </button>
                      {aberto && (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                            gap: 10,
                          }}
                        >
                          {g.itens.map((i, idx) => (
                            <Item
                              key={i.id}
                              item={i}
                              index={idx}
                              selected={selecionadaId === i.id}
                              onSelect={() => setSelecionadaId(i.id)}
                              onEdit={() => navigate(`/inspetorias/${i.id}/editar`)}
                              onRemove={() => setAlvo({ id: i.id, nome: i.nome })}
                            />
                          ))}
                        </div>
                      )}
                    </section>
                  )
                })}
              </div>
            </div>

            <div style={{ position: 'sticky', top: 16, alignSelf: 'start' }}>
              <ParticipantesAssociadosPanel
                filtro={{ tipo: 'inspetoria', id: selecionadaId, nome: selecionada?.nome }}
              />
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .il-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <ConfirmDialog
        open={alvo !== null}
        onClose={() => setAlvo(null)}
        onConfirm={() => alvo && remover(alvo.id)}
        eyebrow="Remover inspetoria"
        title={alvo?.nome ?? ''}
        description="Participantes vinculados a esta inspetoria precisarão ser reatribuídos."
        confirmLabel="Remover"
        confirmVariant="danger"
        icon="trash"
      />
    </div>
  )
}

function Item({
  item, index, selected, onSelect, onEdit, onRemove,
}: {
  item: Inspetoria
  index: number
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  onRemove: () => void
}) {
  return (
    <div
      className="fade-in"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        background: 'var(--card-bg)',
        border: `1px solid ${selected ? 'var(--brand-500)' : 'var(--card-border)'}`,
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        cursor: 'pointer',
        transition: 'border-color 140ms ease',
        animationDelay: `${index * 20}ms`,
      }}
      onClick={onSelect}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--brand-400)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--card-border)' }}
    >
      <span
        style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--grad-brand-deep)', color: '#fff',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}
      >
        <ShieldCheck size={18} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }} className="truncate">{item.nome}</div>
        <div className="text-xs text-[var(--t4)] font-mono mt-0.5">#{String(item.id).padStart(3, '0')}</div>
      </div>
      <div className="flex gap-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
        <button
          onClick={onEdit}
          className="text-[var(--brand-500)] hover:text-[var(--brand-400)] text-xs font-semibold"
        >
          Editar
        </button>
        <button
          onClick={onRemove}
          className="text-[var(--danger)] hover:text-[var(--danger-700)] text-xs font-semibold"
        >
          Remover
        </button>
      </div>
    </div>
  )
}
