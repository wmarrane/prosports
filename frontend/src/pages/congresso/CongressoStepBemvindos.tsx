import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { eventosService } from '../../services/eventos'
import { inscricoesService } from '../../services/inscricoes'
import { competicoesService } from '../../services/competicoes'
import { composeSubtituloLine, type CampoSubtitulo } from '../../lib/compose-subtitulo'
import { esporteBase } from '../../site-publico/lib/esporte'
import { ArrowRight } from 'lucide-react'

type Props = {
  eventoId: number
  onIniciar: () => void
}

const FG = 'var(--cw-fg)'
const DIM = 'var(--cw-dim)'
const ROTATE_MS = 7000

function ParticipanteRow({ p, n, campos }: { p: any; n: number; campos: CampoSubtitulo[] }) {
  const nome = p?.nome ?? '—'
  const sub = p ? composeSubtituloLine(p, campos) : null
  return (
    <div className="cw-prow">
      <span className="cw-prow-n">{String(n).padStart(2, '0')}</span>
      <div className="cw-prow-main">
        <span className="cw-prow-name" style={{ color: FG }}>{nome}</span>
        {sub && <span className="cw-prow-club">{sub}</span>}
      </div>
    </div>
  )
}

export default function CongressoStepBemvindos({ eventoId, onIniciar }: Props) {
  const { data: evento } = useQuery({
    queryKey: ['eventos', eventoId],
    queryFn: () => eventosService.buscar(eventoId),
  })

  const { data: modalidades = [] } = useQuery({
    queryKey: ['evento-modalidades', eventoId],
    queryFn: () => eventosService.getModalidadesDoEvento(eventoId),
  })

  const { data: inscricoes = [], isLoading } = useQuery({
    queryKey: ['inscricoes', eventoId],
    queryFn: () => inscricoesService.listar({ evento_id: eventoId }),
  })

  const { data: competicao } = useQuery({
    queryKey: ['competicoes', evento?.competicao_id],
    queryFn: () => competicoesService.buscar(evento!.competicao_id),
    enabled: evento?.competicao_id != null,
  })
  const camposSubtitulo = competicao?.subtitulo_campos ?? []

  const nModalidades = new Set(modalidades.map(m => esporteBase(m.nome))).size

  const participantes = [...new Map(inscricoes.map((i: any) => [i.participante_id, i.participante])).values()]
    .sort((a: any, b: any) => (a?.nome ?? '').localeCompare(b?.nome ?? '', 'pt-BR', { sensitivity: 'base' }))
  const nInscritos = participantes.length

  // Paginação que se ajusta ao espaço da janela: um grid de medição (oculto) renderiza
  // todos os participantes; contamos quantos cabem na altura disponível para definir o
  // tamanho da página. O grid visível mostra só a página atual e elas trocam sozinhas.
  const measureRef = useRef<HTMLDivElement>(null)
  const [perPage, setPerPage] = useState(0)
  const [page, setPage] = useState(0)

  const camposKey = camposSubtitulo.join('|')

  useLayoutEffect(() => {
    const el = measureRef.current
    if (!el) return
    const recompute = () => {
      const avail = el.clientHeight
      const rows = Array.from(el.children) as HTMLElement[]
      if (avail <= 0 || rows.length === 0) return
      let count = 0
      for (const r of rows) {
        if (r.offsetTop + r.offsetHeight <= avail) count++
        else break
      }
      setPerPage(Math.max(count, 1))
    }
    recompute()
    const ro = new ResizeObserver(recompute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [participantes.length, camposKey])

  const pages = perPage > 0 ? Math.ceil(participantes.length / perPage) : 1
  const pageItems = perPage > 0 ? participantes.slice(page * perPage, page * perPage + perPage) : participantes

  useEffect(() => {
    if (page >= pages) setPage(0)
  }, [pages, page])

  useEffect(() => {
    if (pages <= 1) return
    const t = setInterval(() => setPage(p => (p + 1) % pages), ROTATE_MS)
    return () => clearInterval(t)
  }, [pages])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Bloco 1: logo + nome */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 20, flexShrink: 0 }}>
        {evento?.logo_url && (
          <div style={{
            width: 96, height: 96, flexShrink: 0,
            display: 'grid', placeItems: 'center',
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--cw-card-bd)',
            borderRadius: 'var(--radius-lg)', padding: 8, overflow: 'hidden',
          }}>
            <img src={evento.logo_url} alt={`Logo ${evento.nome}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <p className="cw-sub" style={{ margin: 0 }}>Bem-vindos</p>
          <h1 className="cw-h1" style={{ margin: '6px 0 0' }}>{evento?.nome ?? ''}</h1>
        </div>
      </div>

      {/* Bloco 2: big numbers */}
      <div className="cw-md-card-stats" style={{ marginBottom: 28, flexShrink: 0 }}>
        <div className="cw-md-stat"><b style={{ color: 'var(--cw-accent)' }}>{nModalidades}</b><span>Modalidades</span></div>
        <div className="cw-md-stat"><b style={{ color: 'var(--cw-accent)' }}>{nInscritos}</b><span>Inscritos</span></div>
      </div>

      {/* Bloco 3: participantes do evento (paginado, ajusta ao espaço da janela) */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <h2 className="cw-h2" style={{ fontSize: 'clamp(20px, 2vw, 26px)', marginBottom: 14, flexShrink: 0 }}>
          Participantes <span style={{ color: DIM }}>({nInscritos})</span>
          {pages > 1 && (
            <span style={{ color: DIM, fontWeight: 600, fontSize: 16, marginLeft: 10 }}>· {page + 1}/{pages}</span>
          )}
        </h2>
        {isLoading ? (
          <p className="cw-sub">Carregando participantes...</p>
        ) : participantes.length === 0 ? (
          <p className="cw-sub">Nenhum participante inscrito neste evento.</p>
        ) : (
          <>
            <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
              {/* grid de medição (oculto): mede quantos cabem na área disponível */}
              <div
                ref={measureRef}
                className="cw-plist"
                aria-hidden
                style={{ position: 'absolute', inset: 0, overflow: 'hidden', visibility: 'hidden', pointerEvents: 'none' }}
              >
                {participantes.map((p: any, idx: number) => (
                  <ParticipanteRow key={`m-${p?.id ?? idx}`} p={p} n={idx + 1} campos={camposSubtitulo} />
                ))}
              </div>
              {/* grid visível: só a página atual */}
              <div className="cw-plist" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                {pageItems.map((p: any, i: number) => (
                  <ParticipanteRow key={p?.id ?? i} p={p} n={page * perPage + i + 1} campos={camposSubtitulo} />
                ))}
              </div>
            </div>
            {pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, paddingTop: 14, flexShrink: 0 }}>
                {Array.from({ length: pages }).map((_, i) => (
                  <span key={i} style={{
                    width: i === page ? 22 : 8, height: 8, borderRadius: 99,
                    background: i === page ? 'var(--cw-accent)' : 'var(--cw-card-bd)',
                    transition: 'width .3s, background .3s',
                  }} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 20, flexShrink: 0 }}>
        <button onClick={onIniciar} className="cw-btn cw-btn-primary cw-btn-xl">
          Iniciar <ArrowRight size={22} />
        </button>
      </div>
    </div>
  )
}
