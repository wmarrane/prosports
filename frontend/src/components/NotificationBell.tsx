import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueries } from '@tanstack/react-query'
import { Bell } from '../lib/icons'
import { eventosService } from '../services/eventos'
import { modalidadesService } from '../services/modalidades'
import { inscricoesService } from '../services/inscricoes'
import { sistemasDisputaService } from '../services/sistemas-disputa'
import { deriveEventoAlerts, deriveSemRegraAlerts, type Alerta } from '../lib/alertas'
import { aplicarLida, carregarLidas, salvarLidas, type AlertaLido } from '../lib/alertas-lidas'

const ATIVOS = new Set(['inscricoes', 'pronto', 'parcial'])
const STALE = 60_000

export default function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [aba, setAba] = useState<'novas' | 'lidas'>('novas')
  const [lidas, setLidas] = useState<AlertaLido[]>(() => carregarLidas())
  const ref = useRef<HTMLDivElement>(null)

  const { data: eventos = [] } = useQuery({ queryKey: ['eventos'], queryFn: () => eventosService.listar() })
  const { data: modalidades = [] } = useQuery({ queryKey: ['modalidades'], queryFn: () => modalidadesService.listar() })

  const eventosAtivos = useMemo(
    () => eventos.filter(e => ATIVOS.has(e.status)).map(e => ({ id: e.id, nome: e.nome, competicao_id: e.competicao_id })),
    [eventos],
  )
  const competicoesAtivas = useMemo(
    () => Array.from(new Set(eventosAtivos.map(e => e.competicao_id))),
    [eventosAtivos],
  )

  const countsQueries = useQueries({
    queries: eventosAtivos.map(e => ({
      queryKey: ['inscricoes-counts', e.id],
      queryFn: () => inscricoesService.counts(e.id),
      staleTime: STALE,
    })),
  })
  const gruposQueries = useQueries({
    queries: competicoesAtivas.map(cid => ({
      queryKey: ['sistemas-grupos', cid],
      queryFn: () => sistemasDisputaService.grupos.listar(cid),
      staleTime: STALE,
    })),
  })
  const chavesQueries = useQueries({
    queries: competicoesAtivas.map(cid => ({
      queryKey: ['sistemas-chaves', cid],
      queryFn: () => sistemasDisputaService.chaves.listar(cid),
      staleTime: STALE,
    })),
  })

  const alertas = useMemo(() => {
    const status = deriveEventoAlerts(eventos)

    const modalidadesById: Record<number, { id: number; nome: string; tipo: any }> = {}
    for (const m of modalidades) modalidadesById[m.id] = { id: m.id, nome: m.nome, tipo: m.tipo_modalidade.tipo }

    const countsByEvento: Record<number, Record<number, number>> = {}
    eventosAtivos.forEach((e, i) => { countsByEvento[e.id] = countsQueries[i]?.data ?? {} })

    const rulesByCompeticao: Record<number, { grupos: number[]; chaves: number[] }> = {}
    competicoesAtivas.forEach((cid, i) => {
      rulesByCompeticao[cid] = {
        grupos: (gruposQueries[i]?.data ?? []).map(r => r.quantidade_equipes),
        chaves: (chavesQueries[i]?.data ?? []).map(r => r.numero_inscrito),
      }
    })

    const semRegra = deriveSemRegraAlerts({ eventosAtivos, modalidadesById, countsByEvento, rulesByCompeticao })
    return [...status, ...semRegra]
  }, [eventos, modalidades, eventosAtivos, competicoesAtivas, countsQueries, gruposQueries, chavesQueries])

  const lidasIds = useMemo(() => new Set(lidas.map(l => l.id)), [lidas])
  const novas = useMemo(() => alertas.filter(a => !lidasIds.has(a.id)), [alertas, lidasIds])

  function marcarLida(a: Alerta) {
    setLidas(prev => { const next = aplicarLida(prev, a); salvarLidas(next); return next })
  }
  function marcarTodas() {
    setLidas(prev => {
      let next = prev
      for (const a of novas) next = aplicarLida(next, a)
      salvarLidas(next)
      return next
    })
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  function goTo(to: string) { setOpen(false); navigate(to) }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="icon-btn"
        style={{ position: 'relative' }}
        title="Alertas"
        onClick={() => setOpen(o => !o)}
      >
        <Bell size={19} />
        {novas.length > 0 && (
          <span
            style={{
              position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, padding: '0 4px',
              borderRadius: 9999, background: 'var(--danger)', color: '#fff',
              fontSize: 10, fontWeight: 700, lineHeight: '16px', textAlign: 'center',
            }}
          >{novas.length}</span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Alertas"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 360, maxHeight: 420, overflowY: 'auto',
            background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-card)', zIndex: 60, padding: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px 8px' }}>
            <button
              onClick={() => setAba('novas')}
              style={{
                flex: 1, padding: '6px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                border: 'none', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                background: aba === 'novas' ? 'var(--brand-500)' : 'transparent',
                color: aba === 'novas' ? '#fff' : 'var(--t3)',
              }}
            >Novas {novas.length > 0 ? `(${novas.length})` : ''}</button>
            <button
              onClick={() => setAba('lidas')}
              style={{
                flex: 1, padding: '6px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                border: 'none', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                background: aba === 'lidas' ? 'var(--brand-500)' : 'transparent',
                color: aba === 'lidas' ? '#fff' : 'var(--t3)',
              }}
            >Lidas</button>
          </div>

          {aba === 'novas' ? (
            novas.length === 0 ? (
              <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--t3)' }}>Nenhuma mensagem nova.</div>
            ) : (
              <>
                <div style={{ padding: '2px 6px 6px', textAlign: 'right' }}>
                  <button
                    onClick={marcarTodas}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--brand-500)' }}
                  >Marcar todas como lidas</button>
                </div>
                {novas.map(a => (
                  <button
                    key={a.id}
                    onClick={() => { marcarLida(a); goTo(a.to) }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                      padding: '8px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--t1)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-bg-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{a.titulo}</div>
                    <div style={{ fontSize: 12, color: 'var(--t3)' }}>{a.descricao}</div>
                  </button>
                ))}
              </>
            )
          ) : lidas.length === 0 ? (
            <div style={{ padding: '14px 10px', fontSize: 13, color: 'var(--t3)' }}>Nenhuma mensagem lida.</div>
          ) : (
            lidas.map(l => (
              <button
                key={l.id}
                onClick={() => goTo(l.to)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                  padding: '8px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--t1)',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-bg-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>{l.titulo}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>{l.descricao}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
