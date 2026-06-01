import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { participantesService } from '../services/participantes'
import { Check, X } from '../lib/icons'

type Props = {
  selectedIds: number[]
  onChange: (ids: number[]) => void
  excludeIds?: number[]
  subtituloLine?: (p: any) => string | null
}

export default function ParticipantesMultiSelect({
  selectedIds,
  onChange,
  excludeIds = [],
  subtituloLine,
}: Props) {
  const [query, setQuery] = useState('')

  const { data: all = [], isLoading } = useQuery({
    queryKey: ['participantes'],
    queryFn: participantesService.listar,
  })

  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    return all
      .filter(p => !excludeSet.has(p.id))
      .filter(p => q.length === 0 ? true : (
        p.nome.toLowerCase().includes(q) ||
        (p.subtitulo?.toLowerCase().includes(q) ?? false) ||
        (p.municipio?.nome.toLowerCase().includes(q) ?? false)
      ))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
  }, [all, excludeSet, q])

  function toggle(id: number) {
    const next = new Set(selectedSet)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(Array.from(next))
  }

  function toggleVisibleAll() {
    const visibleIds = filtered.map(p => p.id)
    const allSelected = visibleIds.every(id => selectedSet.has(id))
    if (allSelected) {
      const visibleSet = new Set(visibleIds)
      onChange(selectedIds.filter(id => !visibleSet.has(id)))
    } else {
      const next = new Set(selectedSet)
      for (const id of visibleIds) next.add(id)
      onChange(Array.from(next))
    }
  }

  const visibleAllSelected = filtered.length > 0 && filtered.every(p => selectedSet.has(p.id))

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por nome, subtítulo ou município..."
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
        />
        <button
          type="button"
          onClick={toggleVisibleAll}
          disabled={filtered.length === 0}
          className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)] font-semibold whitespace-nowrap disabled:opacity-50"
        >
          {visibleAllSelected ? 'Desmarcar visíveis' : 'Marcar visíveis'}
        </button>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-[var(--t3)] hover:text-[var(--t1)] font-semibold whitespace-nowrap"
          >
            Limpar ({selectedIds.length})
          </button>
        )}
      </div>

      <div
        style={{
          background: 'var(--card-bg-2)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-lg)',
          maxHeight: 320,
          overflowY: 'auto',
        }}
      >
        {isLoading ? (
          <p className="px-3 py-3 text-xs text-[var(--t3)]">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-[var(--t3)]">
            {q ? 'Nenhum participante encontrado para esta busca.' : 'Nenhum participante disponível.'}
          </p>
        ) : (
          filtered.map(p => {
            const checked = selectedSet.has(p.id)
            const sub = subtituloLine?.(p) ?? p.subtitulo ?? null
            const mun = p.municipio ? `${p.municipio.nome}/${p.municipio.uf}` : ''
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '8px 12px',
                  background: checked ? 'var(--brand-50, rgba(16,97,216,0.08))' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--card-border)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    width: 18, height: 18, borderRadius: 4,
                    background: checked ? 'var(--brand-500)' : 'transparent',
                    border: `1px solid ${checked ? 'var(--brand-500)' : 'var(--card-border)'}`,
                    display: 'grid', placeItems: 'center', flexShrink: 0,
                  }}
                >
                  {checked && <Check size={12} style={{ color: '#fff', strokeWidth: 3 }} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{p.nome}</div>
                  {(sub || mun) && (
                    <div className="text-[var(--t4)] mt-0.5" style={{ fontSize: 11 }}>
                      {[sub, mun].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>

      <div className="text-xs text-[var(--t3)] mt-2 flex items-center gap-2">
        <span>
          <b style={{ color: 'var(--t1)' }}>{selectedIds.length}</b> selecionado(s)
          {filtered.length > 0 && (
            <> · {filtered.length} disponível(is)</>
          )}
        </span>
        {selectedIds.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[var(--t4)]">
            <X size={11} /> Clique no item para desmarcar
          </span>
        )}
      </div>
    </div>
  )
}
