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

  const inputClass = 'w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <div className="relative" ref={containerRef}>
      {selected && !open ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm">
          <span>{selected.nome} — {selected.uf}</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(true)} className="text-xs text-indigo-400 hover:text-indigo-300">Trocar</button>
            <button type="button" onClick={clear} className="text-xs text-red-400 hover:text-red-300">Remover</button>
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
        <div className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
          {debouncedQuery.length < 2 && (
            <p className="px-3 py-2 text-xs text-gray-500">Digite ao menos 2 caracteres...</p>
          )}
          {debouncedQuery.length >= 2 && isFetching && (
            <p className="px-3 py-2 text-xs text-gray-500">Buscando...</p>
          )}
          {debouncedQuery.length >= 2 && !isFetching && data?.data.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-500">Nenhum município encontrado.</p>
          )}
          {data?.data.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => pick(m)}
              className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
            >
              {m.nome} — {m.uf}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
