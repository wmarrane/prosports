import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { campeoesAnterioresService } from '../../services/campeoes-anteriores'
import { inscricoesService } from '../../services/inscricoes'
import { sistemasDisputaService } from '../../services/sistemas-disputa'
import CampeaoBadge from '../../components/CampeaoBadge'
import AnfitriaoBadge from '../../components/AnfitriaoBadge'
import CampeaoSlot from '../../components/CampeaoSlot'
import { Crown, Check, X } from '../../lib/icons'
import { applyAnfitriaoRuleFront, grupoLetra } from '../../lib/anfitriao-rule'
import { participanteEfetivo } from '../../lib/compose-subtitulo'
import type { Participante } from '../../types/participante'
import { useToast } from '../../components/Toast'

type Props = {
  eventoId: number
  modalidadeId: number
  subtituloLine?: (p: any) => string | null
  anfitriaoPid?: number | null
  competicaoId?: number
  porModalidade?: boolean
  tipo?: 'grupos' | 'chaves'
  consideraAnfitriao?: boolean
}

const FG = 'var(--cw-fg)'
const DIM = 'var(--cw-dim)'

const POSICOES = Array.from({ length: 12 }, (_, i) => i + 1)

export default function CampeoesPanel({
  eventoId,
  modalidadeId,
  subtituloLine,
  anfitriaoPid,
  competicaoId,
  porModalidade = false,
  tipo,
  consideraAnfitriao = false,
}: Props) {
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

  // Regras de grupos da competição (para descobrir quantidade_grupos
  // que será usada quando o sorteio for executado, baseado no nº de inscritos).
  const { data: regrasGrupos = [] } = useQuery({
    queryKey: ['sistemas-disputa-grupos', competicaoId],
    queryFn: () => sistemasDisputaService.grupos.listar(competicaoId!),
    enabled: !!competicaoId && tipo === 'grupos',
  })

  const inscritosSet = useMemo(() => new Set(inscricoes.map(i => i.participante_id)), [inscricoes])
  const ordenados = useMemo(() => [...campeoes].sort((a, b) => a.posicao - b.posicao), [campeoes])

  // Mapeia participante_id -> Participante efetivo (escolar: override da inscrição).
  const participantesById = useMemo(() => {
    const m = new Map<number, Participante>()
    for (const i of inscricoes) m.set(i.participante_id, participanteEfetivo(i, porModalidade))
    return m
  }, [inscricoes, porModalidade])

  // Inscrição por participante (para aplicar o override no subtítulo dos campeões).
  const inscByPid = useMemo(() => {
    const m = new Map<number, (typeof inscricoes)[number]>()
    for (const i of inscricoes) m.set(i.participante_id, i)
    return m
  }, [inscricoes])

  // Quantidade de grupos prevista pra esse nº de inscritos (se aplicável).
  const quantidadeGrupos = useMemo(() => {
    if (tipo !== 'grupos') return undefined
    const r = regrasGrupos.find(r => r.quantidade_equipes === inscricoes.length)
    return r?.quantidade_grupos
  }, [tipo, regrasGrupos, inscricoes.length])

  const anfitriaoInscrito = anfitriaoPid != null && inscritosSet.has(anfitriaoPid)

  // Cabeças finais previstas (campeões inscritos + regra do anfitrião).
  // Limitadas a N (= qtd grupos ou 4 cabeças no chaves).
  const cabecasFinais = useMemo(() => {
    if (!tipo) return [] as number[]
    const campeoesInscritosPids = ordenados.filter(c => inscritosSet.has(c.participante_id)).map(c => c.participante_id)
    if (tipo === 'grupos') {
      if (quantidadeGrupos === undefined) return []
      return applyAnfitriaoRuleFront(
        campeoesInscritosPids, anfitriaoPid ?? null, anfitriaoInscrito, consideraAnfitriao, 'grupos', quantidadeGrupos,
      ).slice(0, quantidadeGrupos)
    }
    return applyAnfitriaoRuleFront(
      campeoesInscritosPids, anfitriaoPid ?? null, anfitriaoInscrito, consideraAnfitriao, 'chaves',
    ).slice(0, 4)
  }, [tipo, ordenados, inscritosSet, anfitriaoPid, anfitriaoInscrito, consideraAnfitriao, quantidadeGrupos])

  const cabecasPidSet = useMemo(() => new Set(cabecasFinais), [cabecasFinais])

  // Lista de itens pra renderizar no painel: todos campeões + anfitrião
  // sintético (quando aplica e ele não é campeão).
  type Item = {
    key: string
    participante_id: number
    participante: Participante | undefined
    posicao: number | null
    inscrito: boolean
    slotLabel: string | null
    campeaoId?: number
  }
  const itens = useMemo<Item[]>(() => {
    const items: Item[] = ordenados.map(c => ({
      key: `c-${c.id}`,
      participante_id: c.participante_id,
      participante: participanteEfetivo(
        inscByPid.get(c.participante_id) ?? { participante: c.participante as Participante },
        porModalidade,
      ),
      posicao: c.posicao,
      inscrito: inscritosSet.has(c.participante_id),
      slotLabel: null,
      campeaoId: c.id,
    }))
    if (
      consideraAnfitriao && anfitriaoInscrito && anfitriaoPid != null &&
      !ordenados.some(c => c.participante_id === anfitriaoPid)
    ) {
      items.push({
        key: `anf-${anfitriaoPid}`,
        participante_id: anfitriaoPid,
        participante: participantesById.get(anfitriaoPid),
        posicao: null,
        inscrito: true,
        slotLabel: null,
      })
    }
    // Anexa slotLabel para quem vai virar cabeça pela regra
    for (const it of items) {
      const idx = cabecasFinais.indexOf(it.participante_id)
      if (idx === -1) continue
      it.slotLabel = tipo === 'grupos' ? `Grupo ${grupoLetra(idx)}` : `${idx + 1}ª cabeça`
    }
    return items
  }, [ordenados, inscritosSet, consideraAnfitriao, anfitriaoInscrito, anfitriaoPid, participantesById, inscByPid, porModalidade, cabecasFinais, tipo])

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
      ) : itens.length === 0 ? (
        <p style={{ color: DIM, fontSize: 14, fontStyle: 'italic' }}>
          Nenhum campeão cadastrado. As cabeças não serão semeadas no sorteio.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
          {itens.map(it => {
            const ehCabeca = cabecasPidSet.has(it.participante_id)
            return (
              <li
                key={it.key}
                style={{
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  opacity: it.inscrito ? 1 : 0.55,
                }}
                title={it.inscrito ? undefined : 'Não está inscrito nesta modalidade — não será semeado como cabeça'}
              >
                {it.slotLabel && (
                  <span style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    color: 'var(--warn)',
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    background: 'var(--warn-soft)',
                    border: '1px solid var(--warn)',
                    borderRadius: 'var(--radius-pill)',
                    lineHeight: 1.2,
                  }}>{it.slotLabel}</span>
                )}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: ehCabeca ? 'var(--warn-soft)' : 'var(--cw-soft)',
                    border: ehCabeca ? '2px solid var(--warn)' : '1px solid var(--cw-card-bd)',
                    borderRadius: 'var(--radius-pill)',
                    boxShadow: ehCabeca ? '0 0 0 3px rgba(245, 158, 11, 0.18)' : 'none',
                  }}
                >
                  {it.posicao != null && <CampeaoBadge posicao={it.posicao} />}
                  <span
                    style={{
                      color: ehCabeca ? 'var(--warn)' : FG,
                      fontWeight: ehCabeca ? 800 : 600,
                      fontSize: 14,
                      textDecoration: it.inscrito ? 'none' : 'line-through',
                      textDecorationThickness: '2px',
                    }}
                  >{it.participante?.nome ?? '—'}</span>
                  {(() => {
                    const l = it.participante ? subtituloLine?.(it.participante) : null
                    return l ? <span style={{ color: DIM, fontSize: 12 }}>— {l}</span> : null
                  })()}
                  {it.inscrito ? (
                    <Check size={14} style={{ color: 'var(--success)' }} />
                  ) : (
                    <span style={{ color: DIM, fontSize: 11, fontStyle: 'italic' }}>(não inscrito)</span>
                  )}
                  {anfitriaoPid != null && it.participante_id === anfitriaoPid && <AnfitriaoBadge />}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editOpen && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.92)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
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
