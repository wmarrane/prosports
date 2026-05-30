import { useQuery } from '@tanstack/react-query'
import { campeoesAnterioresService } from '../../services/campeoes-anteriores'
import { inscricoesService } from '../../services/inscricoes'
import { modalidadesService } from '../../services/modalidades'
import CampeaoBadge from '../../components/CampeaoBadge'

type Props = {
  eventoId: number
  modalidadeId: number
  competicaoId: number | undefined
  onNext: () => void
}

const FG = '#f1f5fb'
const DIM = '#94a3b8'
const SUCCESS = '#14b88a'
const CARD_BG = 'rgba(255,255,255,.04)'
const CARD_BORDER = 'rgba(255,255,255,.1)'

export default function CongressoStepCampeoes({ eventoId, modalidadeId, competicaoId, onNext }: Props) {
  const { data: campeoes = [], isLoading } = useQuery({
    queryKey: ['campeoes-anteriores', eventoId, modalidadeId],
    queryFn: () => campeoesAnterioresService.listar({ evento_id: eventoId, modalidade_id: modalidadeId }),
  })

  const { data: inscricoes = [] } = useQuery({
    queryKey: ['inscricoes', eventoId, modalidadeId],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId, modalidade_id: modalidadeId }),
  })

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades', competicaoId],
    queryFn: () => modalidadesService.listar({ competicao_id: competicaoId! }),
    enabled: !!competicaoId,
  })

  const modalidade = modalidades.find(m => m.id === modalidadeId)
  const inscritosSet = new Set(inscricoes.map(i => i.participante_id))
  const ordenados = [...campeoes].sort((a, b) => a.posicao - b.posicao)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {modalidade && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, color: DIM, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Modalidade
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: FG, marginTop: 4 }}>
            {modalidade.nome} ({modalidade.sigla})
          </h2>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, marginBottom: 16 }}>
        {isLoading ? (
          <p style={{ color: DIM, fontSize: 18 }}>Carregando campeões...</p>
        ) : ordenados.length === 0 ? (
          <p style={{ color: DIM, fontSize: 18 }}>Nenhum campeão cadastrado para esta modalidade.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ordenados.map(c => {
              const inscrito = inscritosSet.has(c.participante_id)
              return (
                <li
                  key={c.id}
                  style={{
                    background: CARD_BG,
                    border: `1px solid ${CARD_BORDER}`,
                    borderRadius: 12,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <CampeaoBadge posicao={c.posicao} large />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 22, color: FG, fontWeight: 600 }}>{c.participante.nome}</div>
                    {c.participante.subtitulo && (
                      <div style={{ fontSize: 14, color: DIM, marginTop: 4 }}>{c.participante.subtitulo}</div>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      padding: '6px 14px',
                      borderRadius: 999,
                      background: inscrito ? 'rgba(20, 184, 138, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                      color: inscrito ? SUCCESS : DIM,
                      border: `1px solid ${inscrito ? SUCCESS : DIM}`,
                    }}
                  >
                    {inscrito ? '✓ Inscrito neste evento' : 'Não inscrito'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12 }}>
        <button
          onClick={onNext}
          style={{
            background: '#1061d8',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '12px 24px',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >Próximo →</button>
      </div>
    </div>
  )
}
