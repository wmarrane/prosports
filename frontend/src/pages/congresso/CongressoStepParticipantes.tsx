import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inscricoesService } from '../../services/inscricoes'
import { modalidadesService } from '../../services/modalidades'
import ParticipanteSelect from '../../components/ParticipanteSelect'

type Props = {
  eventoId: number
  modalidadeId: number
  competicaoId: number | undefined
  onNext: () => void
}

const FG = '#f1f5fb'
const DIM = '#94a3b8'
const LINE = 'rgba(255,255,255,.08)'
const DANGER = '#ef4444'
const MODAL_BG = '#0f1623'
const MODAL_BORDER = 'rgba(255,255,255,0.1)'
const BTN_PRIMARY = {
  background: '#1061d8',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '12px 24px',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
} as const
const BTN_PRIMARY_SM = {
  background: '#1061d8',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
} as const
const BTN_GHOST = {
  background: 'transparent',
  color: DIM,
  border: 'none',
  padding: '12px 20px',
  fontSize: 14,
  cursor: 'pointer',
} as const

export default function CongressoStepParticipantes({ eventoId, modalidadeId, competicaoId, onNext }: Props) {
  const queryClient = useQueryClient()
  const [inscreverOpen, setInscreverOpen] = useState(false)
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [erroModal, setErroModal] = useState('')

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

  const { mutate: criar, isPending: salvando } = useMutation({
    mutationFn: () => inscricoesService.criar({
      evento_id: eventoId,
      modalidade_id: modalidadeId,
      participante_id: pickedId!,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inscricoes', eventoId, modalidadeId] })
      setInscreverOpen(false)
      setPickedId(null)
      setErroModal('')
    },
    onError: (err: any) => setErroModal(err?.response?.data?.message ?? 'Erro ao inscrever.'),
  })

  const { mutate: remover } = useMutation({
    mutationFn: (id: number) => inscricoesService.remover(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inscricoes', eventoId, modalidadeId] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover.'),
  })

  const excludeIds = inscricoes.map(i => i.participante_id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {modalidade && (
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <div>
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
          <button
            onClick={() => { setInscreverOpen(true); setPickedId(null); setErroModal('') }}
            style={BTN_PRIMARY_SM}
          >+ Inscrever</button>
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
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span style={{ flex: 1 }}>
                  {i.participante.nome}
                  {i.participante.subtitulo && (
                    <span style={{ fontSize: 16, color: DIM, marginLeft: 12 }}>
                      — {i.participante.subtitulo}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => { if (confirm(`Remover inscrição de "${i.participante.nome}"?`)) remover(i.id) }}
                  style={{
                    color: DIM,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 22,
                    padding: '4px 10px',
                    lineHeight: 1,
                  }}
                  title="Remover inscrição"
                >×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12 }}>
        <button onClick={onNext} style={BTN_PRIMARY}>Próximo →</button>
      </div>

      {inscreverOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40,
          }}
          onClick={() => setInscreverOpen(false)}
        >
          <div
            style={{
              background: MODAL_BG, border: `1px solid ${MODAL_BORDER}`,
              borderRadius: 16, padding: 24, maxWidth: 480, width: '100%', margin: '0 16px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 20, fontWeight: 600, color: FG, marginBottom: 16 }}>
              Inscrever participante
            </h3>
            <ParticipanteSelect value={pickedId} onChange={(id) => setPickedId(id)} excludeIds={excludeIds} />
            {erroModal && <p style={{ color: DANGER, fontSize: 14, marginTop: 12 }}>{erroModal}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button onClick={() => setInscreverOpen(false)} style={BTN_GHOST}>Cancelar</button>
              <button
                onClick={() => criar()}
                disabled={!pickedId || salvando}
                style={{ ...BTN_PRIMARY_SM, opacity: (!pickedId || salvando) ? 0.5 : 1 }}
              >{salvando ? 'Salvando...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
