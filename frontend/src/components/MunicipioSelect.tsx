import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { municipiosService } from '../services/municipios'
import type { Municipio } from '../types/municipio'

type Props = {
  value: number | null
  onChange: (id: number | null) => void
  placeholder?: string
}

export default function MunicipioSelect({ value, onChange, placeholder = 'Busque por nome do município...' }: Props) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Municipio | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(id)
  }, [query])

  // Load the selected município label when value is provided externally
  useEffect(() => {
    if (value && (!selected || selected.id !== value)) {
      municipiosService.buscar(value).then(setSelected).catch(() => setSelected(null))
    }
    if (!value) setSelected(null)
  }, [value])

  // Close dropdown when clicking outside
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const { data, isFetching } = useQuery({
    queryKey: ['municipios', 'search', debouncedQuery],
    queryFn: () => municipiosService.listar({ q: debouncedQuery, limit: 20 }),
    enabled: open && debouncedQuery.length >= 2,
  })

  function pick(m: Municipio) {
    setSelected(m)
    onChange(m.id)
    setQuery('')
    setOpen(false)
  }

  function clear() {
    setSelected(null)
    onChange(null)
    setQuery('')
  }

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]'

  return (
    <div className="relative" ref={containerRef}>
      {selected && !open ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--card-bg-2)] border border-[var(--card-border)] text-[var(--t1)] text-sm">
          <span>{selected.nome} — {selected.uf}</span>
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
          {debouncedQuery.length < 2 && (
            <p className="px-3 py-2 text-xs text-[var(--t3)]">Digite ao menos 2 caracteres...</p>
          )}
          {debouncedQuery.length >= 2 && isFetching && (
            <p className="px-3 py-2 text-xs text-[var(--t3)]">Buscando...</p>
          )}
          {debouncedQuery.length >= 2 && !isFetching && data?.data.length === 0 && (
            <p className="px-3 py-2 text-xs text-[var(--t3)]">Nenhum município encontrado.</p>
          )}
          {data?.data.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => pick(m)}
              className="w-full text-left px-3 py-2 text-sm text-[var(--t1)] hover:bg-[var(--card-bg-2)]"
            >
              {m.nome} — {m.uf}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
