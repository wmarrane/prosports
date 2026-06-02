import { useQuery } from '@tanstack/react-query'
import { eventosService } from '../../services/eventos'
import { Trophy, Calendar } from 'lucide-react'

function formatDateBR(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

type Props = {
  onSelect: (eventoId: number) => void
}

export default function CongressoStepEvento({ onSelect }: Props) {
  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ['eventos'],
    queryFn: () => eventosService.listar(),
  })

  const ativos = eventos.filter(e => e.status !== 'rascunho')

  if (isLoading) {
    return (
      <>
        <h1 className="cw-h1">Selecione o evento</h1>
        <p className="cw-sub">Carregando eventos...</p>
      </>
    )
  }

  if (ativos.length === 0) {
    return (
      <>
        <h1 className="cw-h1">Selecione o evento</h1>
        <p className="cw-sub">
          Nenhum evento ativo. Crie um evento e mude o status para "Inscrições" no painel administrativo.
        </p>
      </>
    )
  }

  return (
    <>
      <h1 className="cw-h1">Selecione o evento</h1>
      <p className="cw-sub">
        {ativos.length} {ativos.length === 1 ? 'evento ativo' : 'eventos ativos'}. O congresso inicia ao selecionar um evento.
      </p>
      <div className="cw-grid">
        {ativos.map(e => (
          <button key={e.id} className="cw-card" onClick={() => onSelect(e.id)}>
            <div className="cw-card-top">
              {e.logo_url ? (
                <span
                  className="cw-card-ic"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--cw-card-bd)',
                    display: 'grid', placeItems: 'center',
                    padding: 6, overflow: 'hidden',
                  }}
                >
                  <img
                    src={e.logo_url}
                    alt={`Logo ${e.nome}`}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </span>
              ) : (
                <span className="cw-card-ic" style={{ background: 'var(--grad-brand)' }}>
                  <Trophy size={28} />
                </span>
              )}
              <span className="cw-badge b-info">#{e.id}</span>
            </div>
            <div className="cw-card-title">{e.nome}</div>
            <div className="cw-card-meta">{e.competicao.nome} · {e.municipio.nome}/{e.municipio.uf}</div>
            <div className="cw-card-stats">
              <Calendar size={14} />
              <span>{formatDateBR(e.data_hora)}</span>
              {e.local && <><b>·</b><span>{e.local}</span></>}
            </div>
          </button>
        ))}
      </div>
    </>
  )
}
