import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { participantesService } from '../services/participantes'
import type { Participante } from '../types/participante'

type Props = {
  value: number | null
  onChange: (id: number | null, participante: Participante | null) => void
  excludeIds?: number[]
  placeholder?: string
}

export default function ParticipanteSelect({
  value,
  onChange,
  excludeIds = [],
  placeholder = 'Busque pelo nome do participante...',
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: all = [], isLoading } = useQuery({
    queryKey: ['participantes'],
    queryFn: participantesService.listar,
  })

  const selected = value != null ? all.find(p => p.id === value) ?? null : null

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const q = query.trim().toLowerCase()
  const excludeSet = new Set(excludeIds)
  const filtered = all
    .filter(p => !excludeSet.has(p.id))
    .filter(p => q.length === 0 ? true : (
      p.nome.toLowerCase().includes(q) ||
      (p.subtitulo?.toLowerCase().includes(q) ?? false)
    ))
    .slice(0, 30)

  function pick(p: Participante) {
    onChange(p.id, p)
    setQuery('')
    setOpen(false)
  }

  function clear() {
    onChange(null, null)
    setQuery('')
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]'

  return (
    <div className="relative" ref={containerRef}>
      {selected && !open ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm">
          <span>{selected.nome}{selected.subtitulo ? ` — ${selected.subtitulo}` : ''}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(true)} className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)]">Trocar</button>
            <button type="button" onClick={clear} className="text-xs text-[var(--danger)] hover:text-[var(--danger-700)]">Remover</button>
          </div>
        </div>
      ) : (
        <input
          autoFocus={open}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={inputClass}
        />
      )}
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg shadow-lg max-h-60 overflow-auto">
          {isLoading && <p className="px-3 py-2 text-xs text-[var(--t3)]">Carregando...</p>}
          {!isLoading && filtered.length === 0 && (
            <p className="px-3 py-2 text-xs text-[var(--t3)]">Nenhum participante encontrado.</p>
          )}
          {filtered.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p)}
              className="w-full text-left px-3 py-2 text-sm text-[var(--t1)] hover:bg-[var(--card-bg-2)]"
            >
              {p.nome}{p.subtitulo ? ` — ${p.subtitulo}` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
