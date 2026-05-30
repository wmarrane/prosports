import { useQuery } from '@tanstack/react-query'
import { eventosService } from '../../services/eventos'

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

const CARD_BG = 'rgba(255,255,255,.04)'
const CARD_BORDER = 'rgba(255,255,255,.1)'
const FG = '#f1f5fb'
const DIM = '#94a3b8'

export default function CongressoStepEvento({ onSelect }: Props) {
  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ['eventos'],
    queryFn: () => eventosService.listar(),
  })

  const ativos = eventos.filter(e => e.status !== 'rascunho')

  if (isLoading) {
    return <p style={{ color: DIM, fontSize: 18 }}>Carregando eventos...</p>
  }

  if (ativos.length === 0) {
    return (
      <p style={{ color: DIM, fontSize: 18 }}>
        Nenhum evento ativo. Crie um evento e mude status para "Inscrições" no painel administrativo.
      </p>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
      {ativos.map(e => (
        <button
          key={e.id}
          onClick={() => onSelect(e.id)}
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 16,
            padding: 24,
            textAlign: 'left',
            cursor: 'pointer',
            color: FG,
            transition: 'border-color 150ms ease',
          }}
          onMouseEnter={e2 => (e2.currentTarget.style.borderColor = '#1061d8')}
          onMouseLeave={e2 => (e2.currentTarget.style.borderColor = CARD_BORDER)}
        >
          <div style={{ fontSize: 12, color: DIM, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            #{e.id} · {e.municipio.nome} — {e.municipio.uf}
          </div>
          <h3 style={{ fontSize: 26, fontWeight: 700, marginTop: 8, marginBottom: 12, lineHeight: 1.2 }}>
            {e.nome}
          </h3>
          <div style={{ fontSize: 14, color: DIM, marginBottom: 4 }}>
            🏆 {e.competicao.nome}
          </div>
          <div style={{ fontSize: 14, color: DIM }}>
            📅 {formatDateBR(e.data_hora)} · {e.local}
          </div>
        </button>
      ))}
    </div>
  )
}
