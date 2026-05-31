import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { campeoesAnterioresService } from '../../services/campeoes-anteriores'
import { inscricoesService } from '../../services/inscricoes'
import { modalidadesService } from '../../services/modalidades'
import CampeaoBadge from '../../components/CampeaoBadge'
import CampeaoSlot from '../../components/CampeaoSlot'

type Props = {
  eventoId: number
  modalidadeId: number
  competicaoId: number | undefined
  onNext: () => void
}

const FG = 'var(--cw-fg)'
const DIM = 'var(--cw-dim)'
const SUCCESS = 'var(--success)'
const CARD_BG = 'var(--cw-card)'
const CARD_BORDER = 'var(--cw-card-bd)'
const MODAL_BG = 'var(--card-bg)'
const MODAL_BORDER = 'var(--card-border)'
const BTN_PRIMARY = {
  background: 'var(--brand-500)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius-lg)',
  padding: '12px 24px',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
} as const
const BTN_GHOST_OUTLINE = {
  background: 'transparent',
  color: 'var(--brand-500)',
  border: '1px solid var(--brand-500)',
  borderRadius: 'var(--radius-lg)',
  padding: '12px 24px',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
} as const

const POSICOES = Array.from({ length: 12 }, (_, i) => i + 1)

export default function CongressoStepCampeoes({ eventoId, modalidadeId, competicaoId, onNext }: Props) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)

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

  const { mutate: criarCampeao, isPending: salvandoCampeao } = useMutation({
    mutationFn: (data: { participante_id: number; posicao: number }) =>
      campeoesAnterioresService.criar({
        evento_id: eventoId,
        modalidade_id: modalidadeId,
        participante_id: data.participante_id,
        posicao: data.posicao,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campeoes-anteriores', eventoId, modalidadeId] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao salvar campeão.'),
  })

  const { mutate: removerCampeao } = useMutation({
    mutationFn: (cid: number) => campeoesAnterioresService.remover(cid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campeoes-anteriores', eventoId, modalidadeId] }),
    onError: (err: any) => alert(err?.response?.data?.message ?? 'Erro ao remover campeão.'),
  })

  const excludeCampeoesIds = campeoes.map(c => c.participante_id)

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

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, gap: 12 }}>
        <button onClick={() => setEditOpen(true)} style={BTN_GHOST_OUTLINE}>Editar campeões</button>
        <button onClick={onNext} style={BTN_PRIMARY}>Próximo →</button>
      </div>

      {editOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40,
          }}
          onClick={() => setEditOpen(false)}
        >
          <div
            style={{
              background: MODAL_BG, border: `1px solid ${MODAL_BORDER}`,
              borderRadius: 16, padding: 24, maxWidth: 960, width: '100%', margin: '0 16px',
              maxHeight: '85vh', overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 20, fontWeight: 600, color: FG, marginBottom: 4 }}>
              Editar campeões do ano anterior
            </h3>
            <p style={{ fontSize: 13, color: DIM, marginBottom: 16 }}>
              Cadastre até 12 colocados. Quem se inscrever neste evento recebe o badge correspondente.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {POSICOES.map(pos => {
                const c = ordenados.find(x => x.posicao === pos) ?? null
                return (
                  <CampeaoSlot
                    key={pos}
                    posicao={pos}
                    campeao={c}
                    excludeIds={excludeCampeoesIds}
                    onCriar={(participante_id) => criarCampeao({ participante_id, posicao: pos })}
                    onRemover={(cid) => removerCampeao(cid)}
                    salvando={salvandoCampeao}
                  />
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setEditOpen(false)} style={BTN_PRIMARY}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
