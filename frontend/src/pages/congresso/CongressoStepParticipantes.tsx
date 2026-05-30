import { useQuery } from '@tanstack/react-query'
import { inscricoesService } from '../../services/inscricoes'
import { modalidadesService } from '../../services/modalidades'

type Props = {
  eventoId: number
  modalidadeId: number
  competicaoId: number | undefined
  onNext: () => void
}

const FG = '#f1f5fb'
const DIM = '#94a3b8'
const LINE = 'rgba(255,255,255,.08)'

export default function CongressoStepParticipantes({ eventoId, modalidadeId, competicaoId, onNext }: Props) {
  const { data: inscricoes = [], isLoading } = useQuery({
    queryKey: ['inscricoes', eventoId, modalidadeId],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId, modalidade_id: modalidadeId }),
  })

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades', competicaoId],
    queryFn: () => modalidadesService.listar({ competicao_id: competicaoId! }),
    enabled: !!competicaoId,
  })

  const modalidade = modalidades.find(m => m.id === modalidadeId)

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
          <div style={{ fontSize: 16, color: DIM, marginTop: 4 }}>
            {inscricoes.length} {inscricoes.length === 1 ? 'inscrito' : 'inscritos'}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, marginBottom: 16 }}>
        {isLoading ? (
          <p style={{ color: DIM, fontSize: 18 }}>Carregando inscritos...</p>
        ) : inscricoes.length === 0 ? (
          <p style={{ color: DIM, fontSize: 18 }}>Nenhum inscrito nesta modalidade.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {inscricoes.map(i => (
              <li
                key={i.id}
                style={{
                  borderBottom: `1px solid ${LINE}`,
                  padding: '12px 8px',
                  fontSize: 22,
                  color: FG,
                }}
              >
                {i.participante.nome}
                {i.participante.subtitulo && (
                  <span style={{ fontSize: 16, color: DIM, marginLeft: 12 }}>
                    — {i.participante.subtitulo}
                  </span>
                )}
              </li>
            ))}
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
