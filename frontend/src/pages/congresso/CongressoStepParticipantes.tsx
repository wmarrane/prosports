import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inscricoesService } from '../../services/inscricoes'
import { modalidadesService } from '../../services/modalidades'
import { competicoesService } from '../../services/competicoes'
import ParticipanteSelect from '../../components/ParticipanteSelect'
import { Plus, X, ArrowRight } from '../../lib/icons'

type Props = {
  eventoId: number
  modalidadeId: number
  competicaoId: number | undefined
  onNext: () => void
}

const FG = 'var(--cw-fg)'
const DIM = 'var(--cw-dim)'
const DANGER = 'var(--danger)'

export default function CongressoStepParticipantes({ eventoId, modalidadeId, competicaoId, onNext }: Props) {
  const queryClient = useQueryClient()
  const [inscreverOpen, setInscreverOpen] = useState(false)
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [erroModal, setErroModal] = useState('')

  const { data: inscricoesRaw = [], isLoading } = useQuery({
    queryKey: ['inscricoes', eventoId, modalidadeId],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId, modalidade_id: modalidadeId }),
  })

  // Ordenar alfabeticamente pelo nome do participante (pt-BR, ignorando acentos/caixa)
  const inscricoes = [...inscricoesRaw].sort((a, b) =>
    a.participante.nome.localeCompare(b.participante.nome, 'pt-BR', { sensitivity: 'base' })
  )

  const { data: modalidades = [] } = useQuery({
    queryKey: ['modalidades', competicaoId],
    queryFn: () => modalidadesService.listar({ competicao_id: competicaoId! }),
    enabled: !!competicaoId,
  })

  const modalidade = modalidades.find(m => m.id === modalidadeId)

  const { data: competicao } = useQuery({
    queryKey: ['competicoes', competicaoId],
    queryFn: () => competicoesService.buscar(competicaoId!),
    enabled: !!competicaoId,
  })
  const mostrarSubtitulo = competicao?.adicionar_subtitulo ?? false

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
    <>
      <div className="cw-parts-head">
        <div>
          <h1 className="cw-h1" style={{ marginBottom: 6 }}>Participantes confirmados</h1>
          <p className="cw-sub" style={{ margin: 0 }}>
            {modalidade?.nome} · <b style={{ color: FG }}>{inscricoes.length}</b> {inscricoes.length === 1 ? 'confirmado' : 'confirmados'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="cw-btn cw-btn-accent"
            onClick={() => { setInscreverOpen(true); setPickedId(null); setErroModal('') }}
          >
            <Plus size={20} /> Incluir participante
          </button>
        </div>
      </div>

      {isLoading ? (
        <p style={{ color: DIM, fontSize: 18 }}>Carregando inscritos...</p>
      ) : inscricoes.length === 0 ? (
        <div style={{
          padding: '60px 20px',
          textAlign: 'center',
          color: DIM,
          background: 'var(--cw-card)',
          border: '1px dashed var(--cw-card-bd)',
          borderRadius: 'var(--radius-xl)',
        }}>
          <p style={{ fontSize: 18, marginBottom: 8 }}>Nenhum inscrito nesta modalidade.</p>
          <p style={{ fontSize: 14 }}>Clique em "Incluir participante" para adicionar.</p>
        </div>
      ) : (
        <div className="cw-plist cw-plist-full">
          {inscricoes.map((i, idx) => {
            const nome = i.participante.nome
            const displayNome = nome.length > 50 ? nome.slice(0, 50) + '…' : nome
            return (
              <div className="cw-prow" key={i.id}>
                <span className="cw-prow-n">{String(idx + 1).padStart(2, '0')}</span>
                <div className="cw-prow-main">
                  <span className="cw-prow-name">{displayNome}</span>
                  {mostrarSubtitulo && i.participante.subtitulo && (
                    <span className="cw-prow-club">{i.participante.subtitulo}</span>
                  )}
                </div>
                <button
                  className="cw-prow-rm"
                  onClick={() => { if (confirm(`Remover inscrição de "${i.participante.nome}"?`)) remover(i.id) }}
                  title="Remover"
                >
                  <X size={18} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 28 }}>
        <button onClick={onNext} className="cw-btn cw-btn-primary">
          Próximo <ArrowRight size={20} />
        </button>
      </div>

      {/* Modal Incluir Participante */}
      {inscreverOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
          }}
          onClick={() => setInscreverOpen(false)}
        >
          <div
            style={{
              background: 'var(--cw-card)',
              border: '1px solid var(--cw-card-bd)',
              borderRadius: 'var(--radius-2xl)',
              padding: 28,
              maxWidth: 520,
              width: '100%',
              margin: '0 16px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="cw-h2" style={{ marginBottom: 16, fontSize: 'clamp(20px, 2.2vw, 26px)' }}>
              Incluir participante
            </h3>
            <ParticipanteSelect value={pickedId} onChange={(id) => setPickedId(id)} excludeIds={excludeIds} />
            {erroModal && <p style={{ color: DANGER, fontSize: 14, marginTop: 12 }}>{erroModal}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button
                onClick={() => setInscreverOpen(false)}
                className="cw-btn cw-btn-ghost"
              >Cancelar</button>
              <button
                onClick={() => criar()}
                disabled={!pickedId || salvando}
                className="cw-btn cw-btn-primary"
                style={{ opacity: (!pickedId || salvando) ? 0.5 : 1 }}
              >{salvando ? 'Salvando...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
