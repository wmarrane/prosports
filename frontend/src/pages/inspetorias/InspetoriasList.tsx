import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/PageHeader'
import { inspetoriasService } from '../../services/inspetorias'
import type { Inspetoria } from '../../types/participante'
import { Plus } from '../../lib/icons'
import { ShieldCheck } from 'lucide-react'

export default function InspetoriasList() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['inspetorias'],
    queryFn: () => inspetoriasService.listar(),
  })

  const { mutate: remover } = useMutation({
    mutationFn: inspetoriasService.remover,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inspetorias'] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const ordenadas = [...data].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))

  return (
    <div className="text-[var(--t1)]">
      <PageHeader
        eyebrow="Cadastro"
        title="Inspetorias"
        sub="Unidades regionais de inspeção vinculadas aos participantes."
        actions={
          <button onClick={() => navigate('/inspetorias/novo')} className="btn btn-primary">
            <Plus size={16} /> Nova Inspetoria
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
            <ShieldCheck size={40} className="mx-auto mb-3 text-[var(--t4)]" />
            <p className="text-base mb-1">Nenhuma inspetoria cadastrada.</p>
            <p className="text-sm">Clique em "+ Nova Inspetoria" para começar.</p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 12,
            }}
          >
            {ordenadas.map((i, idx) => (
              <Item
                key={i.id}
                item={i}
                index={idx}
                onEdit={() => navigate(`/inspetorias/${i.id}/editar`)}
                onRemove={() => { if (confirm(`Remover "${i.nome}"?`)) remover(i.id) }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Item({ item, index, onEdit, onRemove }: { item: Inspetoria; index: number; onEdit: () => void; onRemove: () => void }) {
  return (
    <div
      className="fade-in"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        cursor: 'pointer',
        transition: 'border-color 140ms ease',
        animationDelay: `${index * 25}ms`,
      }}
      onClick={onEdit}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-400)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--card-border)')}
    >
      <span
        style={{
          width: 42, height: 42, borderRadius: 11,
          background: 'var(--grad-brand-deep)', color: '#fff',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}
      >
        <ShieldCheck size={20} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{item.nome}</div>
        <div className="text-xs text-[var(--t3)] mt-0.5 truncate">
          {item.delegacia?.nome ?? '—'}
        </div>
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
