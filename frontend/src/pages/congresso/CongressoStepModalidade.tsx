import { useQuery } from '@tanstack/react-query'
import { eventosService } from '../../services/eventos'
import { modalidadesService } from '../../services/modalidades'
import { sorteiosService } from '../../services/sorteios'
import { TIPO_DISPUTA_LABEL } from '../../lib/tipo-disputa'

type Props = {
  eventoId: number
  onSelect: (modalidadeId: number) => void
}

const CARD_BG = 'rgba(255,255,255,.04)'
const CARD_BORDER = 'rgba(255,255,255,.1)'
const FG = '#f1f5fb'
const DIM = '#94a3b8'
const SUCCESS = '#14b88a'

export default function CongressoStepModalidade({ eventoId, onSelect }: Props) {
  const { data: evento } = useQuery({
    queryKey: ['eventos', eventoId],
    queryFn: () => eventosService.buscar(eventoId),
  })

  const { data: modalidades = [], isLoading } = useQuery({
    queryKey: ['modalidades', evento?.competicao_id],
    queryFn: () => modalidadesService.listar({ competicao_id: evento!.competicao_id }),
    enabled: !!evento,
  })

  const { data: sorteios = [] } = useQuery({
    queryKey: ['sorteios', eventoId],
    queryFn: () => sorteiosService.listar({ evento_id: eventoId }),
  })

  const sorteadasIds = new Set(sorteios.map(s => s.modalidade_id))

  if (isLoading) {
    return <p style={{ color: DIM, fontSize: 18 }}>Carregando modalidades...</p>
  }

  return (
    <div>
      {evento && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, color: DIM, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Evento
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: FG, marginTop: 4 }}>{evento.nome}</h2>
          <div style={{ fontSize: 16, color: DIM, marginTop: 4 }}>{evento.competicao.nome}</div>
        </div>
      )}

      {modalidades.length === 0 ? (
        <p style={{ color: DIM, fontSize: 18 }}>Nenhuma modalidade cadastrada nesta competição.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {modalidades.map(m => {
            const sorteada = sorteadasIds.has(m.id)
            return (
              <button
                key={m.id}
                onClick={() => onSelect(m.id)}
                style={{
                  background: CARD_BG,
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: 12,
                  padding: 20,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: FG,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-500)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = CARD_BORDER)}
              >
                <div>
                  <div style={{ fontSize: 22, fontWeight: 600 }}>{m.nome} ({m.sigla})</div>
                  <div style={{ fontSize: 14, color: DIM, marginTop: 4 }}>
                    {m.tipo_modalidade ? TIPO_DISPUTA_LABEL[m.tipo_modalidade.tipo] : '—'}
                  </div>
                </div>
                {sorteada && (
                  <span style={{ color: SUCCESS, fontSize: 16, fontWeight: 600 }}>
                    ✓ Sorteado
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
