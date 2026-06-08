import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { campeoesAnterioresService } from '../../services/campeoes-anteriores'
import { inscricoesService } from '../../services/inscricoes'
import { modalidadesService } from '../../services/modalidades'
import { competicoesService } from '../../services/competicoes'
import CampeaoBadge from '../../components/CampeaoBadge'
import CampeaoSlot from '../../components/CampeaoSlot'
import { Crown, Check, ArrowRight, X } from '../../lib/icons'
import { composeSubtituloLine } from '../../lib/compose-subtitulo'
import { useToast } from '../../components/Toast'

type Props = {
  eventoId: number
  modalidadeId: number
  competicaoId: number | undefined
  onNext: () => void
}

const FG = 'var(--cw-fg)'
const DIM = 'var(--cw-dim)'

const POSICOES = Array.from({ length: 12 }, (_, i) => i + 1)

export default function CongressoStepCampeoes({ eventoId, modalidadeId, competicaoId, onNext }: Props) {
  const queryClient = useQueryClient()
  const toast = useToast()
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

  const { data: competicao } = useQuery({
    queryKey: ['competicoes', competicaoId],
    queryFn: () => competicoesService.buscar(competicaoId!),
    enabled: !!competicaoId,
  })
  const camposSubtitulo = competicao?.subtitulo_campos ?? []
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
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao salvar campeão.'),
  })

  const { mutate: removerCampeao } = useMutation({
    mutationFn: (cid: number) => campeoesAnterioresService.remover(cid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campeoes-anteriores', eventoId, modalidadeId] }),
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Erro ao remover campeão.'),
  })

  const excludeCampeoesIds = campeoes.map(c => c.participante_id)

  return (
    <>
      <div className="cw-parts-head">
        <div>
          <h1 className="cw-h1" style={{ marginBottom: 6 }}>
            <Crown size={32} style={{ verticalAlign: '-4px', marginRight: 10, color: 'var(--warn)' }} />
            Campeões do ano anterior
          </h1>
          <p className="cw-sub" style={{ margin: 0 }}>
            {modalidade?.nome} · {ordenados.length} {ordenados.length === 1 ? 'cadastrado' : 'cadastrados'}
          </p>
        </div>
        <button onClick={() => setEditOpen(true)} className="cw-btn cw-btn-ghost">
          Editar campeões
        </button>
      </div>

      {isLoading ? (
        <p style={{ color: DIM, fontSize: 18 }}>Carregando campeões...</p>
      ) : ordenados.length === 0 ? (
        <div style={{
          padding: '60px 20px', textAlign: 'center', color: DIM,
          background: 'var(--cw-card)', border: '1px dashed var(--cw-card-bd)',
          borderRadius: 'var(--radius-xl)',
        }}>
          <Crown size={48} style={{ color: 'var(--warn)', marginBottom: 12 }} />
          <p style={{ fontSize: 18, marginBottom: 8 }}>Nenhum campeão cadastrado para esta modalidade.</p>
          <p style={{ fontSize: 14 }}>Cabeças não serão semeadas no sorteio.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          {ordenados.map(c => {
            const inscrito = inscritosSet.has(c.participante_id)
            return (
              <div
                key={c.id}
                style={{
                  background: 'var(--cw-card)',
                  border: '1px solid var(--cw-card-bd)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <CampeaoBadge posicao={c.posicao} large />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'clamp(18px, 1.6vw, 22px)', color: FG, fontWeight: 700 }}>{c.participante.nome}</div>
                  {(() => {
                    const l = composeSubtituloLine(c.participante, camposSubtitulo)
                    return l ? <div style={{ fontSize: 14, color: DIM, marginTop: 4 }}>{l}</div> : null
                  })()}
                </div>
                <span
                  className={`cw-badge ${inscrito ? 'b-success' : 'b-slate'}`}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {inscrito ? <><Check size={14} /> Inscrito</> : 'Não inscrito'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12 }}>
        <button onClick={onNext} className="cw-btn cw-btn-primary">
          Próximo <ArrowRight size={20} />
        </button>
      </div>

      {/* Modal Editar */}
      {editOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
          }}
          onClick={() => setEditOpen(false)}
        >
          <div
            style={{
              background: 'var(--cw-card)',
              border: '1px solid var(--cw-card-bd)',
              borderRadius: 'var(--radius-2xl)',
              padding: 28,
              maxWidth: 960,
              width: '100%',
              margin: '0 16px',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="cw-h2" style={{ marginBottom: 4, fontSize: 'clamp(20px, 2.2vw, 26px)' }}>
              <Crown size={26} style={{ verticalAlign: '-4px', marginRight: 8, color: 'var(--warn)' }} />
              Editar campeões do ano anterior
            </h3>
            <p style={{ fontSize: 13, color: DIM, marginBottom: 20 }}>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setEditOpen(false)} className="cw-btn cw-btn-primary">
                <X size={16} /> Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
