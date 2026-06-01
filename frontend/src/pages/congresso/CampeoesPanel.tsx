import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { campeoesAnterioresService } from '../../services/campeoes-anteriores'
import { inscricoesService } from '../../services/inscricoes'
import CampeaoBadge from '../../components/CampeaoBadge'
import CampeaoSlot from '../../components/CampeaoSlot'
import { Crown, Check, X } from '../../lib/icons'

type Props = {
  eventoId: number
  modalidadeId: number
  subtituloLine?: (p: any) => string | null
}

const FG = 'var(--cw-fg)'
const DIM = 'var(--cw-dim)'

const POSICOES = Array.from({ length: 12 }, (_, i) => i + 1)

export default function CampeoesPanel({ eventoId, modalidadeId, subtituloLine }: Props) {
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
    <div
      style={{
        background: 'var(--cw-card)',
        border: '1px solid var(--cw-card-bd)',
        borderRadius: 'var(--radius-xl)',
        padding: 24,
        marginBottom: 28,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: FG, fontWeight: 700, fontSize: 16 }}>
          <Crown size={20} style={{ color: 'var(--warn)' }} />
          Campeões do ano anterior
          <span style={{ color: DIM, fontWeight: 500 }}>· {ordenados.length} {ordenados.length === 1 ? 'cadastrado' : 'cadastrados'}</span>
        </div>
        <button onClick={() => setEditOpen(true)} className="cw-btn cw-btn-ghost cw-btn-sm">
          Editar
        </button>
      </div>

      {isLoading ? (
        <p style={{ color: DIM, fontSize: 14 }}>Carregando…</p>
      ) : ordenados.length === 0 ? (
        <p style={{ color: DIM, fontSize: 14, fontStyle: 'italic' }}>
          Nenhum campeão cadastrado. As cabeças não serão semeadas no sorteio.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {ordenados.map(c => {
            const inscrito = inscritosSet.has(c.participante_id)
            return (
              <li
                key={c.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'var(--cw-soft)',
                  border: '1px solid var(--cw-card-bd)',
                  borderRadius: 'var(--radius-pill)',
                }}
              >
                <CampeaoBadge posicao={c.posicao} />
                <span style={{ color: FG, fontWeight: 600, fontSize: 14 }}>{c.participante.nome}</span>
                {(() => {
                  const l = subtituloLine?.(c.participante)
                  return l ? <span style={{ color: DIM, fontSize: 12 }}>— {l}</span> : null
                })()}
                {inscrito ? (
                  <Check size={14} style={{ color: 'var(--success)' }} />
                ) : (
                  <span style={{ color: DIM, fontSize: 11, fontStyle: 'italic' }}>(não inscrito)</span>
                )}
              </li>
            )
          })}
        </ul>
      )}

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
                    subtituloLine={subtituloLine}
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
    </div>
  )
}
