import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import ParticipantesAssociadosPanel from '../../components/ParticipantesAssociadosPanel'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useToast } from '../../components/Toast'
import { delegaciasService } from '../../services/delegacias'
import type { Delegacia } from '../../types/participante'
import { Plus } from '../../lib/icons'
import { Building2 } from 'lucide-react'

export default function DelegaciasList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [selecionadaId, setSelecionadaId] = useState<number | null>(null)
  const [alvo, setAlvo] = useState<{ id: number; nome: string } | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['delegacias'],
    queryFn: delegaciasService.listar,
  })

  const { mutateAsync: remover } = useMutation({
    mutationFn: delegaciasService.remover,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegacias'] })
      toast.success('Delegacia removida.')
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const ordenadas = [...data].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
  const selecionada = ordenadas.find(d => d.id === selecionadaId) ?? null

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Cadastro"
        title="Delegacias"
        sub="Unidades regionais de delegação vinculadas aos participantes. Selecione uma delegacia para ver seus participantes."
        actions={
          <button onClick={() => navigate('/delegacias/nova')} className="btn btn-primary">
            <Plus size={16} /> Nova Delegacia
          </button>
        }
      />

      <div className="p-6">
        {isLoading ? (
          <p className="text-[var(--t3)] text-sm">Carregando...</p>
        ) : ordenadas.length === 0 ? (
          <div
            className="text-center text-[var(--t3)] py-16"
            style={{
              background: 'var(--card-bg-2)',
              border: '1px dashed var(--card-border)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <Building2 size={40} className="mx-auto mb-3 text-[var(--t4)]" />
            <p className="text-base mb-1">Nenhuma delegacia cadastrada.</p>
            <p className="text-sm">Clique em "+ Nova Delegacia" para começar.</p>
          </div>
        ) : (
          <div
            className="dl-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
              gap: 16,
              alignItems: 'start',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 12,
              }}
            >
              {ordenadas.map((d, idx) => (
                <Item
                  key={d.id}
                  item={d}
                  index={idx}
                  selected={selecionadaId === d.id}
                  onSelect={() => setSelecionadaId(d.id)}
                  onEdit={() => navigate(`/delegacias/${d.id}/editar`)}
                  onRemove={() => setAlvo({ id: d.id, nome: d.nome })}
                />
              ))}
            </div>

            <div style={{ position: 'sticky', top: 16, alignSelf: 'start' }}>
              <ParticipantesAssociadosPanel
                filtro={{ tipo: 'delegacia', id: selecionadaId, nome: selecionada?.nome }}
              />
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .dl-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <ConfirmDialog
        open={alvo !== null}
        onClose={() => setAlvo(null)}
        onConfirm={() => alvo && remover(alvo.id)}
        eyebrow="Remover delegacia"
        title={alvo?.nome ?? ''}
        description="Participantes vinculados a esta delegacia precisarão ser reatribuídos."
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
  item: Delegacia
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
        padding: 14,
        background: 'var(--card-bg)',
        border: `1px solid ${selected ? 'var(--brand-500)' : 'var(--card-border)'}`,
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        cursor: 'pointer',
        transition: 'border-color 140ms ease',
        animationDelay: `${index * 25}ms`,
      }}
      onClick={onSelect}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--brand-400)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--card-border)' }}
    >
      <span
        style={{
          width: 42, height: 42, borderRadius: 11,
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          color: '#fff',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}
      >
        <Building2 size={20} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{item.nome}</div>
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
