import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { participantesService } from '../services/participantes'
import { Users } from 'lucide-react'

type Filtro =
  | { tipo: 'delegacia'; id: number | null; nome?: string }
  | { tipo: 'inspetoria'; id: number | null; nome?: string }

export default function ParticipantesAssociadosPanel({ filtro }: { filtro: Filtro }) {
  const navigate = useNavigate()

  const { data: all = [], isLoading } = useQuery({
    queryKey: ['participantes'],
    queryFn: participantesService.listar,
  })

  const lista = useMemo(() => {
    if (filtro.id == null) return []
    const filtered = all.filter(p =>
      filtro.tipo === 'delegacia' ? p.delegacia_id === filtro.id : p.inspetoria_id === filtro.id
    )
    return filtered.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
  }, [all, filtro])

  const titulo = filtro.tipo === 'delegacia' ? 'Participantes da delegacia' : 'Participantes da inspetoria'

  if (filtro.id == null) {
    return (
      <div
        style={{
          background: 'var(--card-bg-2)',
          border: '1px dashed var(--card-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 32,
          textAlign: 'center',
          color: 'var(--t3)',
        }}
      >
        <Users size={36} className="mx-auto mb-3 text-[var(--t4)]" />
        <p className="text-sm">
          Selecione {filtro.tipo === 'delegacia' ? 'uma delegacia' : 'uma inspetoria'} ao lado para ver os participantes associados.
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-xl)',
        padding: 16,
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-center gap-3 mb-3 pb-3" style={{ borderBottom: '1px solid var(--card-border)' }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--grad-brand-deep)', color: '#fff',
            display: 'grid', placeItems: 'center',
          }}
        >
          <Users size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="eyebrow">{titulo}</div>
          <div className="text-sm font-bold text-[var(--t1)] truncate">
            {filtro.nome ?? `#${filtro.id}`}
            <span className="text-[var(--t4)] font-normal ml-2">({lista.length})</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--t3)]">Carregando participantes...</p>
      ) : lista.length === 0 ? (
        <div className="text-center text-[var(--t3)] py-8">
          <p className="text-sm">Nenhum participante associado.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
          {lista.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => navigate(`/participantes/${p.id}/editar`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px',
                background: 'var(--card-bg-2)',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 120ms ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-400)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--card-border)')}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-sm font-semibold text-[var(--t1)] truncate">{p.nome}</div>
                <div className="text-xs text-[var(--t3)] truncate mt-0.5">
                  {p.municipio ? `${p.municipio.nome}/${p.municipio.uf}` : ''}
                  {p.subtitulo && <> · {p.subtitulo}</>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
