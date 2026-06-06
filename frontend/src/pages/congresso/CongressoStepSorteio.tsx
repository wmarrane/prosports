import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inscricoesService } from '../../services/inscricoes'
import { eventosService } from '../../services/eventos'
import { modalidadesService } from '../../services/modalidades'
import { sorteiosService } from '../../services/sorteios'
import { campeoesAnterioresService } from '../../services/campeoes-anteriores'
import { competicoesService } from '../../services/competicoes'
import SorteioGrupos from '../../components/sorteio-result/SorteioGrupos'
import SorteioChaves from '../../components/sorteio-result/SorteioChaves'
import SorteioOrdem from '../../components/sorteio-result/SorteioOrdem'
import CampeaoBadge from '../../components/CampeaoBadge'
import AnfitriaoBadge from '../../components/AnfitriaoBadge'
import CampeoesPanel from './CampeoesPanel'
import ModalityBadge from '../../components/modalities/ModalityBadge'
import { Shuffle, Crown, X, Report } from '../../lib/icons'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Participante } from '../../types/participante'
import { composeSubtituloLine } from '../../lib/compose-subtitulo'

// Espelho da regra do backend (applyAnfitriaoRule).
// Define quem sao os cabecas finais para chaves apos a regra anfitriao.
function applyAnfitriaoRuleFront(
  campeoesPidsInscritos: number[],
  anfitriaoPid: number | null,
  anfitriaoInscrito: boolean,
  consideraAnfitriao: boolean,
  tipo: 'chaves' | 'grupos',
  quantidadeGrupos?: number
): number[] {
  if (!consideraAnfitriao || anfitriaoPid === null || !anfitriaoInscrito) {
    return campeoesPidsInscritos
  }
  let targetIdx: number
  if (tipo === 'chaves') {
    targetIdx = 3
  } else {
    if (quantidadeGrupos === undefined || quantidadeGrupos < 3) return campeoesPidsInscritos
    targetIdx = quantidadeGrupos === 3 ? 2 : 3
  }
  const currentIdx = campeoesPidsInscritos.indexOf(anfitriaoPid)
  if (currentIdx >= 0 && currentIdx < targetIdx) return campeoesPidsInscritos
  const sem = campeoesPidsInscritos.filter((p) => p !== anfitriaoPid)
  const out = [...sem]
  out.splice(targetIdx, 0, anfitriaoPid)
  return out
}

type Props = {
  eventoId: number
  modalidadeId: number
  competicaoId: number | undefined
  onProxima: () => void
}

const FG = 'var(--cw-fg)'
const DIM = 'var(--cw-dim)'
const DANGER = 'var(--danger)'

const ANIM_MS = 1500

export default function CongressoStepSorteio({ eventoId, modalidadeId, competicaoId, onProxima }: Props) {
  const queryClient = useQueryClient()
  const [erro, setErro] = useState('')
  const [animating, setAnimating] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [grupoExpandido, setGrupoExpandido] = useState<string | null>(null)
  const [matchExpandido, setMatchExpandido] = useState<string | null>(null)

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
  const subtituloLine = (p: any) => composeSubtituloLine(p, camposSubtitulo)
  const tipo = modalidade?.tipo_modalidade?.tipo

  const { data: evento } = useQuery({
    queryKey: ['eventos', eventoId],
    queryFn: () => eventosService.buscar(eventoId),
  })
  const anfitriaoPid = evento?.anfitriao_id ?? null

  const { data: sorteios = [] } = useQuery({
    queryKey: ['sorteios', eventoId],
    queryFn: () => sorteiosService.listar({ evento_id: eventoId }),
  })
  const sorteio = sorteios.find(s => s.modalidade_id === modalidadeId) ?? null

  const { data: inscricoes = [] } = useQuery({
    queryKey: ['inscricoes', eventoId, modalidadeId],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId, modalidade_id: modalidadeId }),
  })

  const { data: campeoes = [] } = useQuery({
    queryKey: ['campeoes-anteriores', eventoId, modalidadeId],
    queryFn: () => campeoesAnterioresService.listar({ evento_id: eventoId, modalidade_id: modalidadeId }),
  })

  const participantesById = useMemo(() => {
    const m = new Map<number, Participante>()
    for (const i of inscricoes) m.set(i.participante_id, i.participante)
    return m
  }, [inscricoes])

  const campeoesByParticipanteId = useMemo(() => {
    const m = new Map<number, number>()
    for (const c of campeoes) m.set(c.participante_id, c.posicao)
    return m
  }, [campeoes])

  // Cabeças potenciais = TODOS os campeões cadastrados, por posição
  // (independente da inscrição). Os não-inscritos aparecem tachados.
  // - Grupos: todos visíveis são semeados.
  // - Chaves: apenas os 4 primeiros INSCRITOS viram cabeça no bracket
  //   (lógica do backend); o banner mostra todos pra contexto.
  const inscritosSet = useMemo(
    () => new Set(inscricoes.map(i => i.participante_id)),
    [inscricoes]
  )
  const cabecasInscritas = useMemo(() => {
    return [...campeoes]
      .sort((a, b) => a.posicao - b.posicao)
      .map(c => ({ ...c, inscrito: inscritosSet.has(c.participante_id) }))
  }, [campeoes, inscritosSet])

  // Set de pids que são cabeça (deriva direto do resultado do sorteio).
  // Em grupos: cabeça = 1o participante de cada grupo.
  // Em chaves: cabeças = pids ja consolidados pela regra anfitrião no
  // backend; pra UI usamos a heuristica top-N inscritos com regra
  // anfitrião aplicada client-side.
  const consideraAnfitriao = (competicao as any)?.considerar_anfitriao ?? false
  const anfitriaoInscrito = anfitriaoPid != null && inscritosSet.has(anfitriaoPid)

  const cabecasPids = useMemo(() => {
    if (!sorteio) return new Set<number>()
    if (sorteio.tipo === 'grupos') {
      const grupos: any[] = (sorteio.resultado as any).grupos ?? []
      return new Set<number>(grupos.map((g: any) => g.participantes?.[0]).filter((p: any) => p != null))
    }
    if (sorteio.tipo === 'chaves') {
      // Lista os top-4 com regra anfitriao (replica do backend).
      const campeoesInscritosPids = cabecasInscritas.filter(c => c.inscrito).map(c => c.participante_id)
      const cabecasFinais = applyAnfitriaoRuleFront(
        campeoesInscritosPids, anfitriaoPid, anfitriaoInscrito, consideraAnfitriao, 'chaves'
      )
      return new Set<number>(cabecasFinais.slice(0, 4))
    }
    return new Set<number>()
  }, [sorteio, cabecasInscritas, anfitriaoPid, anfitriaoInscrito, consideraAnfitriao])

  // Lista de "campeoes + anfitrião" pra apresentar no banner.
  // Sempre mostra todos campeoes do ano anterior, sorted by posicao.
  // Se anfitriao inscrito e nao eh campeao, adiciona ele no fim como
  // entrada sintetica (posicao = null). Cada item recebe slotLabel se
  // ele eh cabeça atribuida pelo sorteio.
  const cabecasComGrupo = useMemo(() => {
    type Item = {
      key: string
      participante_id: number
      participante: Participante | undefined
      posicao: number | null
      inscrito: boolean
      slotLabel: string | null
    }
    const items: Item[] = cabecasInscritas.map(c => ({
      key: `c-${c.id}`,
      participante_id: c.participante_id,
      participante: c.participante,
      posicao: c.posicao,
      inscrito: c.inscrito,
      slotLabel: null,
    }))
    // Adiciona o anfitrião como entrada sintetica se ele se aplica
    // pela regra mas nao eh campeao.
    if (
      consideraAnfitriao && anfitriaoInscrito && anfitriaoPid != null &&
      !cabecasInscritas.some(c => c.participante_id === anfitriaoPid)
    ) {
      const pAnf = participantesById.get(anfitriaoPid)
      items.push({
        key: `anf-${anfitriaoPid}`,
        participante_id: anfitriaoPid,
        participante: pAnf,
        posicao: null,
        inscrito: true,
        slotLabel: null,
      })
    }
    // Computa slotLabel
    if (!sorteio) return items
    if (sorteio.tipo === 'grupos') {
      const grupos: any[] = (sorteio.resultado as any).grupos ?? []
      for (const it of items) {
        const g = grupos.find((g: any) => g.participantes?.[0] === it.participante_id)
        if (g) it.slotLabel = `Grupo ${g.letra}`
      }
    } else if (sorteio.tipo === 'chaves') {
      // Ordem dos chaves segue a regra anfitrião (mesma do cabecasPids).
      const campeoesInscritosPids = cabecasInscritas.filter(c => c.inscrito).map(c => c.participante_id)
      const cabecasFinais = applyAnfitriaoRuleFront(
        campeoesInscritosPids, anfitriaoPid, anfitriaoInscrito, consideraAnfitriao, 'chaves'
      ).slice(0, 4)
      for (const it of items) {
        const idx = cabecasFinais.indexOf(it.participante_id)
        if (idx !== -1) it.slotLabel = `${idx + 1}ª cabeça`
      }
    }
    return items
  }, [cabecasInscritas, sorteio, anfitriaoPid, anfitriaoInscrito, consideraAnfitriao, participantesById])

  const { mutate: executar, isPending: executando } = useMutation({
    mutationFn: () => sorteiosService.executar({ evento_id: eventoId, modalidade_id: modalidadeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sorteios', eventoId] })
      setErro('')
    },
    onError: (err: any) => setErro(err?.response?.data?.message ?? 'Erro ao sortear.'),
  })

  // Animação: mantém estado `animating` até mín ANIM_MS após mutate terminar
  useEffect(() => {
    if (executando) {
      setAnimating(true)
    } else if (animating) {
      const t = setTimeout(() => setAnimating(false), ANIM_MS)
      return () => clearTimeout(t)
    }
  }, [executando, animating])

  function handleSortear() {
    setErro('')
    executar()
  }

  function handleNovoSorteio() {
    setConfirmModalOpen(true)
  }

  function confirmarNovoSorteio() {
    setConfirmModalOpen(false)
    setErro('')
    executar()
  }

  function formatDateBR(iso: string): string {
    try { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) }
    catch { return iso }
  }

  const proximaBtn = (
    <button
      onClick={onProxima}
      style={{
        background: 'var(--brand-500)',
        color: '#fff',
        border: 'none',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 24px',
        fontSize: 16,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >Próxima modalidade →</button>
  )

  // Tipo específico: sem sorteio
  if (tipo === 'especifico') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', gap: 16 }}>
          <div style={{ fontSize: 48 }}>📋</div>
          <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, letterSpacing: '-0.02em', color: FG }}>{modalidade?.nome}</h2>
          <p style={{ fontSize: 'clamp(16px, 1.5vw, 20px)', color: DIM, maxWidth: 600 }}>
            Esta modalidade é do tipo "Específico" — sem sorteio automático.
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12 }}>{proximaBtn}</div>
      </div>
    )
  }

  // Estado animando
  if (animating) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center', gap: 24 }}>
          <div style={{
            width: 100, height: 100, borderRadius: '50%',
            background: 'var(--grad-brand)',
            display: 'grid', placeItems: 'center',
            animation: 'spin 1s linear infinite',
            boxShadow: 'var(--shadow-brand)',
          }}>
            <Shuffle size={48} color="#fff" />
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 800, letterSpacing: '-0.02em', color: FG }}>
            Sorteando...
          </h2>
          <p style={{ fontSize: 'clamp(16px, 1.4vw, 20px)', color: DIM }}>
            embaralhando {inscricoes.length} participantes
          </p>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Sem sorteio ainda: tela inicial com painel de campeões (grupos/chaves) + botão grande
  if (!sorteio) {
    const mostraCampeoes = tipo === 'grupos' || tipo === 'chaves'
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ marginBottom: 20, textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(28px, 3.4vw, 44px)', fontWeight: 800, letterSpacing: '-0.02em', color: FG, margin: '0 0 8px' }}>
            {modalidade?.nome}
          </h2>
          <p style={{ fontSize: 'clamp(16px, 1.4vw, 20px)', color: DIM, margin: 0 }}>
            {inscricoes.length} {inscricoes.length === 1 ? 'inscrito' : 'inscritos'}
          </p>
        </div>

        {mostraCampeoes && (
          <CampeoesPanel eventoId={eventoId} modalidadeId={modalidadeId} subtituloLine={subtituloLine} anfitriaoPid={anfitriaoPid} />
        )}

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24, minHeight: 200 }}>
          <div style={{
            width: 96, height: 96, borderRadius: 'var(--radius-2xl)',
            background: 'var(--grad-brand)',
            display: 'grid', placeItems: 'center',
            boxShadow: 'var(--shadow-brand)',
          }}>
            <Shuffle size={44} color="#fff" />
          </div>
          <button
            onClick={handleSortear}
            disabled={executando || inscricoes.length === 0}
            style={{
              background: 'var(--brand-500)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-xl)',
              padding: '20px 48px',
              fontSize: 'clamp(18px, 1.7vw, 24px)',
              fontWeight: 700,
              cursor: 'pointer',
              opacity: (executando || inscricoes.length === 0) ? 0.5 : 1,
              boxShadow: 'var(--shadow-brand)',
            }}
          >🎲 Realizar sorteio</button>
          {inscricoes.length === 0 && (
            <p style={{ color: DIM, fontSize: 14 }}>Adicione participantes antes de sortear.</p>
          )}
          {erro && <p style={{ color: DANGER, fontSize: 16 }}>{erro}</p>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          {modalidade && (
            <ModalityBadge name={modalidade.nome} size={64} showGender />
          )}
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 'clamp(22px, 2.6vw, 32px)', fontWeight: 800, letterSpacing: '-0.02em', color: FG }}>{modalidade?.nome}</h2>
            <div style={{ fontSize: 13, color: DIM, marginTop: 4 }}>
              seed: <span style={{ fontFamily: 'var(--font-mono)' }}>{sorteio.seed}</span> · gerado em {formatDateBR(sorteio.gerado_em)}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => window.print()}
            style={{
              background: 'transparent',
              color: 'var(--cw-fg)',
              border: '1px solid var(--cw-card-bd)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
            title="Imprimir / Exportar PDF"
          ><Report size={16} /> PDF</button>
          <button
            onClick={handleNovoSorteio}
            disabled={executando}
            style={{
              background: 'transparent',
              color: 'var(--brand-500)',
              border: '1px solid var(--brand-500)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              opacity: executando ? 0.5 : 1,
            }}
          >{executando ? 'Sorteando...' : 'Novo sorteio'}</button>
        </div>
      </div>

      {/* Banner de cabeças semeadas (grupos/chaves só, e só se houver campeões inscritos) */}
      {cabecasInscritas.length > 0 && (sorteio.tipo === 'grupos' || sorteio.tipo === 'chaves') && (
        <div style={{
          marginBottom: 20,
          padding: '14px 18px',
          background: 'var(--cw-card)',
          border: '1px solid var(--cw-card-bd)',
          borderRadius: 'var(--radius-xl)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--warn)', fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <Crown size={18} /> Cabeças
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-end' }}>
            {cabecasComGrupo.map(c => (
              <div
                key={c.key}
                style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: c.inscrito ? 1 : 0.55 }}
                title={c.inscrito ? undefined : 'Não está inscrito nesta modalidade — não será semeado como cabeça'}
              >
                {c.slotLabel && (
                  <span style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    color: 'var(--warn)',
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    background: 'var(--warn-soft)',
                    border: '1px solid var(--warn)',
                    borderRadius: 'var(--radius-pill)',
                    lineHeight: 1.2,
                  }}>{c.slotLabel}</span>
                )}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {c.posicao != null && <CampeaoBadge posicao={c.posicao} />}
                  <div style={{
                    display: 'inline-flex', flexDirection: 'column',
                    textDecoration: c.inscrito ? 'none' : 'line-through',
                    textDecorationThickness: '2px',
                  }}>
                    <span style={{ fontSize: 15, color: c.inscrito ? FG : DIM, fontWeight: 600 }}>
                      {c.participante?.nome ?? '—'}
                    </span>
                    {(() => {
                      const l = c.participante ? subtituloLine(c.participante) : null
                      return l ? <span style={{ fontSize: 11, color: DIM }}>{l}</span> : null
                    })()}
                  </div>
                  {anfitriaoPid != null && c.participante_id === anfitriaoPid && <AnfitriaoBadge />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {sorteio.tipo === 'grupos' && (
          <SorteioGrupos
            resultado={sorteio.resultado}
            participantesById={participantesById}
            large
            campeoesByParticipanteId={campeoesByParticipanteId}
            anfitriaoPid={anfitriaoPid}
            onGroupClick={(letra) => setGrupoExpandido(letra)}
            subtituloLine={subtituloLine}
          />
        )}
        {sorteio.tipo === 'chaves' && (
          <SorteioChaves
            resultado={sorteio.resultado}
            participantesById={participantesById}
            large
            campeoesByParticipanteId={campeoesByParticipanteId}
            anfitriaoPid={anfitriaoPid}
            subtituloLine={subtituloLine}
            onMatchClick={(matchId) => setMatchExpandido(matchId)}
            cabecasPids={cabecasPids}
          />
        )}
        {sorteio.tipo === 'ordem_entrada' && (
          <SorteioOrdem resultado={sorteio.resultado} participantesById={participantesById} large anfitriaoPid={anfitriaoPid} subtituloLine={subtituloLine} />
        )}
        {erro && <p style={{ color: DANGER, fontSize: 16, marginTop: 12 }}>{erro}</p>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16 }}>{proximaBtn}</div>

      {/* Modal de confirmação de novo sorteio */}
      {confirmModalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}
          onClick={() => setConfirmModalOpen(false)}
        >
          <div
            style={{
              background: 'var(--cw-card)',
              border: '1px solid var(--cw-card-bd)',
              borderRadius: 'var(--radius-2xl)',
              padding: 32,
              maxWidth: 480,
              width: '100%',
              margin: '0 16px',
              textAlign: 'center',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              width: 72, height: 72, margin: '0 auto 16px',
              borderRadius: '50%', background: 'var(--warn-soft)',
              display: 'grid', placeItems: 'center', color: 'var(--warn)',
            }}>
              <Shuffle size={36} />
            </div>
            <h3 style={{ fontSize: 'clamp(20px, 2.2vw, 26px)', fontWeight: 800, letterSpacing: '-0.02em', color: FG, marginBottom: 8 }}>
              Realizar novo sorteio?
            </h3>
            <p style={{ fontSize: 15, color: DIM, marginBottom: 24 }}>
              Isso vai sobrescrever o resultado atual com uma nova seed. Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => setConfirmModalOpen(false)}
                style={{
                  background: 'transparent',
                  color: FG,
                  border: '1px solid var(--cw-card-bd)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px 24px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              ><X size={16} /> Cancelar</button>
              <button
                onClick={confirmarNovoSorteio}
                style={{
                  background: 'var(--brand-500)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px 24px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              ><Shuffle size={16} /> Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de grupo expandido (apenas grupos) */}
      {grupoExpandido !== null && sorteio?.tipo === 'grupos' && (() => {
        const grupos: any[] = (sorteio.resultado as any).grupos ?? []
        const idx = grupos.findIndex((g: any) => g.letra === grupoExpandido)
        if (idx === -1) return null
        const grupo = grupos[idx]
        const goPrev = idx > 0 ? () => setGrupoExpandido(grupos[idx - 1].letra) : null
        const goNext = idx < grupos.length - 1 ? () => setGrupoExpandido(grupos[idx + 1].letra) : null
        return (
          <ExpandedGrupoModal
            modalidadeNome={modalidade?.nome ?? ''}
            grupo={grupo}
            indice={idx}
            total={grupos.length}
            participantesById={participantesById}
            campeoesByParticipanteId={campeoesByParticipanteId}
            anfitriaoPid={anfitriaoPid ?? null}
            subtituloLine={subtituloLine}
            cabecasPids={cabecasPids}
            onClose={() => setGrupoExpandido(null)}
            onPrev={goPrev}
            onNext={goNext}
          />
        )
      })()}

      {matchExpandido !== null && sorteio?.tipo === 'chaves' && (() => {
        const graph = (sorteio.resultado as any).matchesGraph
        if (!graph) return null
        const current = graph.matches.find((m: any) => m.id === matchExpandido)
        if (!current) return null
        // Proximo match: aquele cuja referencia (top ou bottom) eh "V:<currentId>"
        const next = graph.matches.find(
          (m: any) => m.top === `V:${current.id}` || m.bottom === `V:${current.id}`
        )
        return (
          <ExpandedChavesMatchModal
            modalidadeNome={modalidade?.nome ?? ''}
            current={current}
            next={next ?? null}
            slots={(sorteio.resultado as any).slots ?? []}
            participantesById={participantesById}
            campeoesByParticipanteId={campeoesByParticipanteId}
            anfitriaoPid={anfitriaoPid ?? null}
            subtituloLine={subtituloLine}
            isFinal={current.id === graph.final}
            isThirdPlace={current.id === graph.thirdPlace}
            onClose={() => setMatchExpandido(null)}
          />
        )
      })()}
    </div>
  )
}

// ── Modal: grupo expandido com carrousel (prev/next) ─────────────────

type ExpandedGrupoModalProps = {
  modalidadeNome: string
  grupo: { letra: string; participantes: number[] }
  indice: number
  total: number
  participantesById: Map<number, Participante>
  campeoesByParticipanteId?: Map<number, number>
  anfitriaoPid: number | null
  subtituloLine: (p: Participante) => string | null
  cabecasPids: Set<number>
  onClose: () => void
  onPrev: (() => void) | null
  onNext: (() => void) | null
}

function ExpandedGrupoModal({
  modalidadeNome,
  grupo,
  indice,
  total,
  participantesById,
  campeoesByParticipanteId,
  anfitriaoPid,
  subtituloLine,
  cabecasPids,
  onClose,
  onPrev,
  onNext,
}: ExpandedGrupoModalProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && onPrev) onPrev()
      else if (e.key === 'ArrowRight' && onNext) onNext()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, onPrev, onNext])

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 350, padding: 40,
      }}
    >
      {onPrev && (
        <button
          type="button"
          onClick={onPrev}
          className="cw-iconbtn"
          title="Grupo anterior (←)"
          style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', width: 56, height: 56 }}
        ><ChevronLeft size={32} /></button>
      )}
      <div
        style={{
          background: 'var(--cw-card)',
          border: '1.5px solid var(--t2)',
          borderRadius: 'var(--radius-3xl)',
          padding: 'clamp(24px, 4vw, 56px)',
          maxWidth: 900,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 12, color: DIM, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 4 }}>
              {modalidadeNome} · {indice + 1} de {total}
            </div>
            <h2 style={{ fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--warn)', lineHeight: 1 }}>
              Grupo {grupo.letra}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="cw-iconbtn" title="Fechar (Esc)">
            <X size={22} />
          </button>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {grupo.participantes.map((pid: number, i: number) => {
            const p = participantesById.get(pid)
            const cp = campeoesByParticipanteId?.get(pid)
            const ehCabeca = cabecasPids.has(pid)
            return (
              <li
                key={pid}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '16px 20px',
                  background: ehCabeca ? 'var(--warn-soft)' : 'var(--cw-soft)',
                  border: ehCabeca ? '2px solid var(--warn)' : '1px solid var(--t3)',
                  borderRadius: 'var(--radius-xl)',
                  fontSize: 'clamp(20px, 2.2vw, 28px)',
                  boxShadow: ehCabeca ? '0 0 0 4px rgba(245, 158, 11, 0.18)' : 'none',
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', color: DIM, fontSize: '0.7em', minWidth: 32 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {cp && <CampeaoBadge posicao={cp} large />}
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <span style={{ color: ehCabeca ? 'var(--warn)' : FG, fontWeight: ehCabeca ? 800 : 600, lineHeight: 1.15 }}>
                    {p ? p.nome : '—'}
                  </span>
                  {(() => { const l = p ? subtituloLine(p) : null; return l ? <span style={{ fontSize: '0.55em', color: DIM, marginTop: 4 }}>{l}</span> : null })()}
                </div>
                {ehCabeca && (
                  <span style={{
                    fontSize: '0.45em',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    color: 'var(--warn)',
                    textTransform: 'uppercase',
                    padding: '4px 10px',
                    background: 'var(--cw-card)',
                    border: '1.5px solid var(--warn)',
                    borderRadius: 'var(--radius-pill)',
                  }}>👑 Cabeça</span>
                )}
                {anfitriaoPid != null && pid === anfitriaoPid && <AnfitriaoBadge large />}
              </li>
            )
          })}
        </ul>
      </div>
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          className="cw-iconbtn"
          title="Próximo grupo (→)"
          style={{ position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', width: 56, height: 56 }}
        ><ChevronRight size={32} /></button>
      )}
    </div>
  )
}

// ── Modal: jogo expandido (chaves) + proxima rodada ────────────────

type ExpandedChavesMatchModalProps = {
  modalidadeNome: string
  current: { id: string; round: number; top: string; bottom: string }
  next: { id: string; round: number; top: string; bottom: string } | null
  slots: (number | null)[]
  participantesById: Map<number, Participante>
  campeoesByParticipanteId?: Map<number, number>
  anfitriaoPid: number | null
  subtituloLine: (p: Participante) => string | null
  isFinal: boolean
  isThirdPlace: boolean
  onClose: () => void
}

function ExpandedChavesMatchModal({
  modalidadeNome,
  current,
  next,
  slots,
  participantesById,
  campeoesByParticipanteId,
  anfitriaoPid,
  subtituloLine,
  isFinal,
  isThirdPlace,
  onClose,
}: ExpandedChavesMatchModalProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function resolveLabel(ref: string): { pid: number | null; label?: string } {
    if (ref.startsWith('P')) {
      const pos = parseInt(ref.slice(1), 10)
      const pid = slots[pos - 1] ?? null
      return { pid }
    }
    if (ref.startsWith('V:')) return { pid: null, label: `Vencedor ${ref.slice(2).toUpperCase()}` }
    if (ref.startsWith('L:')) return { pid: null, label: `Perdedor ${ref.slice(2).toUpperCase()}` }
    return { pid: null, label: ref }
  }

  function renderSlot(ref: string) {
    const { pid, label } = resolveLabel(ref)
    if (pid != null) {
      const p = participantesById.get(pid)
      const cp = campeoesByParticipanteId?.get(pid)
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {cp && <CampeaoBadge posicao={cp} large />}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
            <span style={{ color: FG, fontWeight: 700, lineHeight: 1.15, fontSize: 'clamp(20px, 2.2vw, 28px)' }}>
              {p ? p.nome : '—'}
            </span>
            {(() => { const l = p ? subtituloLine(p) : null; return l ? <span style={{ fontSize: '0.7em', color: DIM, marginTop: 4 }}>{l}</span> : null })()}
          </div>
          {anfitriaoPid != null && pid === anfitriaoPid && <AnfitriaoBadge large />}
        </div>
      )
    }
    return (
      <span style={{ color: DIM, fontStyle: 'italic', fontSize: 'clamp(18px, 2vw, 24px)' }}>{label}</span>
    )
  }

  function MatchCard({ matchId, top, bottom, eyebrow }: { matchId: string; top: string; bottom: string; eyebrow: string }) {
    return (
      <div
        style={{
          background: 'var(--cw-soft)',
          border: '1.5px solid var(--t3)',
          borderRadius: 'var(--radius-xl)',
          padding: '20px 24px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, gap: 12 }}>
          <span style={{ fontSize: 12, color: DIM, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
            {eyebrow}
          </span>
          <span style={{
            fontSize: 'clamp(22px, 2.4vw, 32px)',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            color: 'var(--warn)',
            fontFamily: 'var(--font-mono)',
            lineHeight: 1,
          }}>
            {matchId.toUpperCase()}
          </span>
        </div>
        <div style={{ padding: '12px 0' }}>{renderSlot(top)}</div>
        <div style={{ borderTop: '1px dashed var(--t3)', margin: '4px 0' }} />
        <div style={{ padding: '12px 0' }}>{renderSlot(bottom)}</div>
      </div>
    )
  }

  const eyebrowAtual = isFinal ? '🏆 Final' : isThirdPlace ? '🥉 3º lugar' : `Rodada ${current.round}`

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 350, padding: 40,
      }}
    >
      <div
        style={{
          background: 'var(--cw-card)',
          border: '1.5px solid var(--t2)',
          borderRadius: 'var(--radius-3xl)',
          padding: 'clamp(24px, 4vw, 48px)',
          maxWidth: 720,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: DIM, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
            {modalidadeNome}
          </div>
          <button type="button" onClick={onClose} className="cw-iconbtn" title="Fechar (Esc)">
            <X size={22} />
          </button>
        </div>

        <MatchCard matchId={current.id} top={current.top} bottom={current.bottom} eyebrow={eyebrowAtual} />

        {next ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0', color: DIM }}>
              <div style={{ width: 2, height: 24, background: 'var(--t3)' }} />
            </div>
            <MatchCard matchId={next.id} top={next.top} bottom={next.bottom} eyebrow={`Próxima rodada · Rodada ${next.round}`} />
          </>
        ) : (
          <div style={{ marginTop: 16, padding: 12, textAlign: 'center', fontSize: 13, color: DIM, fontStyle: 'italic' }}>
            Sem próxima rodada (jogo final).
          </div>
        )}
      </div>
    </div>
  )
}
