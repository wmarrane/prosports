import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inscricoesService } from '../../services/inscricoes'
import { modalidadesService } from '../../services/modalidades'
import { sorteiosService } from '../../services/sorteios'
import { campeoesAnterioresService } from '../../services/campeoes-anteriores'
import { competicoesService } from '../../services/competicoes'
import SorteioGrupos from '../../components/sorteio-result/SorteioGrupos'
import SorteioChaves from '../../components/sorteio-result/SorteioChaves'
import SorteioOrdem from '../../components/sorteio-result/SorteioOrdem'
import CampeaoBadge from '../../components/CampeaoBadge'
import CampeoesPanel from './CampeoesPanel'
import { Shuffle, Crown, X, Report } from '../../lib/icons'
import type { Participante } from '../../types/participante'

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
  const tipo = modalidade?.tipo_modalidade?.tipo

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

  // Cabeças potenciais = top-4 campeões por posição (independente da inscrição).
  // Os que não estão inscritos aparecem tachados (não serão semeados como cabeça).
  const inscritosSet = useMemo(
    () => new Set(inscricoes.map(i => i.participante_id)),
    [inscricoes]
  )
  const cabecasInscritas = useMemo(() => {
    return [...campeoes]
      .sort((a, b) => a.posicao - b.posicao)
      .slice(0, 4) // top 4
      .map(c => ({ ...c, inscrito: inscritosSet.has(c.participante_id) }))
  }, [campeoes, inscritosSet])

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
          <CampeoesPanel eventoId={eventoId} modalidadeId={modalidadeId} />
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
        <div>
          <h2 style={{ fontSize: 'clamp(22px, 2.6vw, 32px)', fontWeight: 800, letterSpacing: '-0.02em', color: FG }}>{modalidade?.nome}</h2>
          <div style={{ fontSize: 13, color: DIM, marginTop: 4 }}>
            seed: <span style={{ fontFamily: 'var(--font-mono)' }}>{sorteio.seed}</span> · gerado em {formatDateBR(sorteio.gerado_em)}
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {cabecasInscritas.map(c => (
              <div
                key={c.id}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, opacity: c.inscrito ? 1 : 0.55 }}
                title={c.inscrito ? undefined : 'Não está inscrito nesta modalidade — não será semeado como cabeça'}
              >
                <CampeaoBadge posicao={c.posicao} />
                <span style={{
                  fontSize: 15,
                  color: c.inscrito ? FG : DIM,
                  fontWeight: 600,
                  textDecoration: c.inscrito ? 'none' : 'line-through',
                  textDecorationThickness: '2px',
                }}>{c.participante.nome}</span>
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
            onGroupClick={(letra) => setGrupoExpandido(letra)}
            mostrarSubtitulo={mostrarSubtitulo}
          />
        )}
        {sorteio.tipo === 'chaves' && (
          <SorteioChaves resultado={sorteio.resultado} participantesById={participantesById} large campeoesByParticipanteId={campeoesByParticipanteId} mostrarSubtitulo={mostrarSubtitulo} />
        )}
        {sorteio.tipo === 'ordem_entrada' && (
          <SorteioOrdem resultado={sorteio.resultado} participantesById={participantesById} large mostrarSubtitulo={mostrarSubtitulo} />
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
        const grupo = (sorteio.resultado as any).grupos?.find((g: any) => g.letra === grupoExpandido)
        if (!grupo) return null
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 350, padding: 40 }}
            onClick={() => setGrupoExpandido(null)}
          >
            <div
              style={{
                background: 'var(--cw-card)',
                border: '1px solid var(--cw-card-bd)',
                borderRadius: 'var(--radius-3xl)',
                padding: 'clamp(24px, 4vw, 56px)',
                maxWidth: 900,
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 12, color: DIM, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 4 }}>
                    {modalidade?.nome}
                  </div>
                  <h2 style={{ fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 900, letterSpacing: '-0.04em', color: FG, lineHeight: 1 }}>
                    Grupo {grupo.letra}
                  </h2>
                </div>
                <button
                  onClick={() => setGrupoExpandido(null)}
                  className="cw-iconbtn"
                  title="Fechar"
                ><X size={22} /></button>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {grupo.participantes.map((pid: number, i: number) => {
                  const p = participantesById.get(pid)
                  const cp = campeoesByParticipanteId?.get(pid)
                  return (
                    <li
                      key={pid}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        padding: '16px 20px',
                        background: 'var(--cw-soft)',
                        borderRadius: 'var(--radius-xl)',
                        fontSize: 'clamp(20px, 2.2vw, 28px)',
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', color: DIM, fontSize: '0.7em', minWidth: 32 }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {cp && <CampeaoBadge posicao={cp} large />}
                      <span style={{ color: FG, fontWeight: 600 }}>
                        {p ? p.nome : '—'}
                        {mostrarSubtitulo && p?.subtitulo && <span style={{ fontSize: '0.7em', color: DIM, marginLeft: 12 }}>— {p.subtitulo}</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
