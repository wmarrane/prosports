import { useQuery } from '@tanstack/react-query'
import { eventosService } from '../../services/eventos'
import { inscricoesService } from '../../services/inscricoes'
import { competicoesService } from '../../services/competicoes'
import { composeSubtituloLine } from '../../lib/compose-subtitulo'
import { esporteBase } from '../../site-publico/lib/esporte'
import { ArrowRight } from 'lucide-react'

type Props = {
  eventoId: number
  onIniciar: () => void
}

const FG = 'var(--cw-fg)'
const DIM = 'var(--cw-dim)'

export default function CongressoStepBemvindos({ eventoId, onIniciar }: Props) {
  const { data: evento } = useQuery({
    queryKey: ['eventos', eventoId],
    queryFn: () => eventosService.buscar(eventoId),
  })

  const { data: modalidades = [] } = useQuery({
    queryKey: ['evento-modalidades', eventoId],
    queryFn: () => eventosService.getModalidadesDoEvento(eventoId),
  })

  const { data: inscricoes = [], isLoading } = useQuery({
    queryKey: ['inscricoes', eventoId],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId }),
  })

  const { data: competicao } = useQuery({
    queryKey: ['competicoes', evento?.competicao_id],
    queryFn: () => competicoesService.buscar(evento!.competicao_id),
    enabled: evento?.competicao_id != null,
  })
  const camposSubtitulo = competicao?.subtitulo_campos ?? []

  const nModalidades = new Set(modalidades.map(m => esporteBase(m.nome))).size

  const participantes = [...new Map(inscricoes.map((i: any) => [i.participante_id, i.participante])).values()]
    .sort((a: any, b: any) => (a?.nome ?? '').localeCompare(b?.nome ?? '', 'pt-BR', { sensitivity: 'base' }))
  const nInscritos = participantes.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Bloco 1: logo + nome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 20 }}>
        {evento?.logo_url && (
          <div style={{
            width: 96, height: 96, flexShrink: 0,
            display: 'grid', placeItems: 'center',
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--cw-card-bd)',
            borderRadius: 'var(--radius-lg)', padding: 8, overflow: 'hidden',
          }}>
            <img src={evento.logo_url} alt={`Logo ${evento.nome}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <h1 className="cw-h1" style={{ margin: 0 }}>Bem-vindos</h1>
          <p className="cw-sub" style={{ margin: '6px 0 0' }}>{evento?.nome ?? ''}</p>
        </div>
      </div>

      {/* Bloco 2: big numbers */}
      <div className="cw-md-card-stats" style={{ marginBottom: 28 }}>
        <div className="cw-md-stat"><b>{nModalidades}</b><span>Modalidades</span></div>
        <div className="cw-md-stat"><b>{nInscritos}</b><span>Inscritos</span></div>
      </div>

      {/* Bloco 3: participantes do evento */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <h2 className="cw-h2" style={{ fontSize: 'clamp(20px, 2vw, 26px)', marginBottom: 14 }}>
          Participantes <span style={{ color: DIM }}>({nInscritos})</span>
        </h2>
        {isLoading ? (
          <p className="cw-sub">Carregando participantes...</p>
        ) : participantes.length === 0 ? (
          <p className="cw-sub">Nenhum participante inscrito neste evento.</p>
        ) : (
          <div className="cw-plist">
            {participantes.map((p: any, idx: number) => {
              const nome = p?.nome ?? '—'
              const sub = p ? composeSubtituloLine(p, camposSubtitulo) : null
              return (
                <div className="cw-prow" key={p?.id ?? idx}>
                  <span className="cw-prow-n">{String(idx + 1).padStart(2, '0')}</span>
                  <div className="cw-prow-main">
                    <span className="cw-prow-name" style={{ color: FG }}>{nome}</span>
                    {sub && <span className="cw-prow-club">{sub}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 20 }}>
        <button onClick={onIniciar} className="cw-btn cw-btn-primary cw-btn-xl">
          Iniciar <ArrowRight size={22} />
        </button>
      </div>
    </div>
  )
}
