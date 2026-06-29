import type { Evento } from '../../types/evento'
import type { TipoDisputa } from '../../types/modalidade'
import { STATUS_LABEL, STATUS_COLOR } from '../../lib/evento-status'
import { Brackets, Group, ListOrdered, FileText, List, Trophy, Users, MapPin } from 'lucide-react'

const TIPO_GRAD: Record<TipoDisputa, string> = {
  chaves: 'var(--grad-brand)',
  grupos: 'var(--grad-accent)',
  ordem_entrada: 'var(--grad-violet)',
  especifico: 'var(--grad-warn)',
}
const TIPO_ICON: Record<TipoDisputa, typeof Brackets> = {
  chaves: Brackets, grupos: Group, ordem_entrada: ListOrdered, especifico: FileText,
}
const TIPO_LABEL: Record<TipoDisputa, string> = {
  chaves: 'Chaves', grupos: 'Grupos', ordem_entrada: 'Ordem de entrada', especifico: 'Específico',
}

function tiposPorFrequencia(ev: Evento): TipoDisputa[] {
  const freq = new Map<TipoDisputa, number>()
  for (const m of ev.competicao?.modalidades ?? []) {
    const t = m.tipo_modalidade?.tipo
    if (t) freq.set(t, (freq.get(t) ?? 0) + 1)
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
}

function formatDateBR(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

export interface EventoAdminCardProps {
  evento: Evento
  isAdmin: boolean
  publicando: boolean
  despublicando: boolean
  republicando: boolean
  onAbrir: (ev: Evento) => void
  onInscricoes: (ev: Evento) => void
  onPublicar: (id: number) => void
  onDespublicar: (id: number) => void
  onRepublicar: (id: number) => void
  onRemover: (ev: Evento) => void
}

export default function EventoAdminCard({
  evento: ev, publicando, despublicando, republicando,
  onAbrir, onInscricoes, onPublicar, onDespublicar, onRepublicar, onRemover,
}: EventoAdminCardProps) {
  const tipos = tiposPorFrequencia(ev)
  const dominanteGrad = tipos.length > 0 ? TIPO_GRAD[tipos[0]] : 'var(--grad-brand)'
  const total = ev.competicao?.modalidades?.length ?? 0
  const modalidadesCount = ev.modalidades_distintas ?? total
  const inscritos = ev.total_participantes ?? 0
  const sorteadas = ev._count?.sorteios ?? 0
  const sorteaveis = ev.modalidades_sorteaveis ?? total
  const pct = sorteaveis > 0 ? Math.round((sorteadas / sorteaveis) * 100) : 0
  const done = sorteaveis > 0 && sorteadas === sorteaveis
  const suspenso = ev.status === 'suspenso'
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div
      onClick={() => onAbrir(ev)}
      className="fade-in"
      style={{
        position: 'relative',
        background: suspenso ? 'var(--warn-soft)' : 'var(--card-bg)',
        border: suspenso ? '1px solid var(--warn)' : '1px solid var(--card-border)',
        borderRadius: 'var(--radius-xl)',
        cursor: 'pointer',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-card)',
        transition: 'border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-400)'; e.currentTarget.style.transform = 'translateY(-3px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = suspenso ? 'var(--warn)' : 'var(--card-border)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      {/* Cover */}
      <div style={{ position: 'relative', background: dominanteGrad, padding: '16px 18px', minHeight: 100, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1.4px)', backgroundSize: '14px 14px', opacity: 0.5, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {tipos.length === 0 && (
              <div title="Sem modalidades" style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', color: '#fff', background: 'rgba(255,255,255,0.14)', border: '1px dashed rgba(255,255,255,0.4)' }}>
                <FileText size={20} />
              </div>
            )}
            {tipos.slice(0, 2).map(t => {
              const Icon = TIPO_ICON[t]
              return (
                <div key={t} title={TIPO_LABEL[t]} style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', color: '#fff', background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)' }}>
                  <Icon size={20} />
                </div>
              )
            })}
            {tipos.length > 2 && (
              <div style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', font: '700 12px var(--font-mono)', color: '#fff', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.24)' }}>
                +{tipos.length - 2}
              </div>
            )}
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[ev.status]}`} style={{ whiteSpace: 'nowrap' }}>
            {STATUS_LABEL[ev.status]}
          </span>
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 7, font: '600 12px var(--font-mono)', color: 'rgba(255,255,255,0.92)' }}>
          <MapPin size={13} /> {ev.municipio.nome}/{ev.municipio.uf} · {formatDateBR(ev.data_hora)}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '18px 20px 20px' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--t1)', lineHeight: 1.2, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {ev.nome}
        </h3>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--t3)', marginTop: 8 }}>
          <Trophy size={14} style={{ color: 'var(--t4)' }} /> {ev.competicao.nome}
        </div>

        {sorteaveis > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--t4)' }}>Andamento dos sorteios</span>
              <b style={{ font: '800 13px var(--font-mono)', color: done ? 'var(--accent-700)' : 'var(--t1)', fontVariantNumeric: 'tabular-nums' }}>
                {sorteadas}/{sorteaveis}{done ? ' ✓' : ''}
              </b>
            </div>
            <div style={{ height: 7, borderRadius: 9999, background: 'var(--card-border)', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', borderRadius: 9999, width: `${Math.max(pct, 3)}%`, background: done ? 'var(--grad-accent)' : dominanteGrad }} />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, paddingTop: 15, borderTop: '1px solid var(--hairline)', fontSize: 12, color: 'var(--t3)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Users size={14} style={{ color: 'var(--t4)' }} /> <b style={{ color: 'var(--t1)', fontWeight: 700 }}>{inscritos.toLocaleString('pt-BR')}</b> inscritos
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <List size={14} style={{ color: 'var(--t4)' }} /> <b style={{ color: 'var(--t1)', fontWeight: 700 }}>{modalidadesCount}</b> modalidades
          </span>
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 14 }}>
          <button
            onClick={e => { stop(e); onInscricoes(ev) }}
            title="Abrir inscrições, sorteio e campeões do evento"
            className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)] font-semibold"
          >Inscrições</button>
          {ev.site_publicado_em ? (
            <>
              <button
                onClick={e => { stop(e); onRepublicar(ev.id) }}
                disabled={republicando}
                title="Atualiza/sobrescreve o snapshot publicado com o estado atual do evento (~1–2 min)."
                className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >Republicar</button>
              <button
                onClick={e => { stop(e); onDespublicar(ev.id) }}
                disabled={despublicando}
                title="Remove o evento do site público (~1–2 min). Re-publicar atualiza/sobrescreve o snapshot."
                className="text-xs text-[var(--t3)] hover:text-[var(--t1)] font-semibold"
              >Despublicar</button>
            </>
          ) : (
            <button
              onClick={e => { stop(e); onPublicar(ev.id) }}
              disabled={publicando || ev.status !== 'sorteado'}
              title={ev.status !== 'sorteado' ? 'Disponível apenas quando o evento estiver Sorteado' : 'Publica um retrato (snapshot) do evento no site público (~1–2 min). Para refletir mudanças depois, publique novamente.'}
              className="text-xs text-[var(--brand-500)] hover:text-[var(--brand-400)] font-semibold disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[var(--brand-500)]"
            >Publicar no site</button>
          )}
          <button
            onClick={e => { stop(e); onRemover(ev) }}
            title="Excluir o evento (inscrições e sorteios vinculados serão perdidos)"
            className="text-xs text-[var(--danger)] hover:text-[var(--danger-700)] font-semibold"
          >Remover</button>
        </div>
      </div>
    </div>
  )
}
