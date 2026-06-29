import type { TipoDisputa } from '../../types/modalidade'
import type { EventoStatus } from '../../types/evento'
import { STATUS_LABEL } from '../../lib/evento-status'
import { Brackets, Group, ListOrdered, FileText, Trophy, Users, List, MapPin } from 'lucide-react'

const TIPO_GRAD: Record<TipoDisputa, string> = {
  chaves: 'var(--grad-brand)', grupos: 'var(--grad-accent)', ordem_entrada: 'var(--grad-violet)', especifico: 'var(--grad-warn)',
}
const TIPO_ICON: Record<TipoDisputa, typeof Brackets> = {
  chaves: Brackets, grupos: Group, ordem_entrada: ListOrdered, especifico: FileText,
}

export interface EventoCardPreviewProps {
  nome: string
  competicaoNome: string
  cidade: string
  dataLabel: string
  status: EventoStatus
  tipos: TipoDisputa[]
  totalModalidades: number
  inscritos: number
  sorteadas: number
  sorteaveis: number
}

export default function EventoCardPreview(p: EventoCardPreviewProps) {
  const dominante = p.tipos.length > 1 ? 'var(--grad-brand-deep)' : p.tipos.length === 1 ? TIPO_GRAD[p.tipos[0]] : 'var(--grad-brand)'
  const pct = p.sorteaveis > 0 ? Math.round((p.sorteadas / p.sorteaveis) * 100) : 0
  const full = p.sorteaveis > 0 && p.sorteadas === p.sorteaveis
  const tiles = p.tipos.slice(0, 2)
  const extra = p.tipos.length - tiles.length
  return (
    <div className="evx-prev">
      <div className="evx-cover" style={{ background: dominante }}>
        <div className="evx-cover-top">
          <div className="evx-tiles">
            {tiles.map((t) => { const Ic = TIPO_ICON[t]; return <div className="evx-gtile" key={t}><Ic size={18} /></div> })}
            {extra > 0 && <div className="evx-gtile more">+{extra}</div>}
          </div>
          <span className="evx-cbadge"><span className="dot" />{STATUS_LABEL[p.status]}</span>
        </div>
        <div className="evx-cover-loc"><MapPin /> {p.cidade || '—'}{p.dataLabel ? ` · ${p.dataLabel}` : ''}</div>
      </div>
      <div className="evx-prev-body">
        <h3 className="evx-prev-title">{p.nome || 'Nome do evento'}</h3>
        <div className="evx-prev-comp"><Trophy /> {p.competicaoNome || '—'}</div>
        {p.sorteaveis > 0 && (
          <div className="evx-prog">
            <div className="evx-prog-h">
              <span className="evx-prog-lab">Andamento dos sorteios</span>
              <span className={`evx-prog-n${full ? ' full' : ''}`}>{p.sorteadas}/{p.sorteaveis}{full ? ' ✓' : ''}</span>
            </div>
            <div className="evx-bar"><i style={{ width: `${Math.max(pct, 3)}%`, background: full ? 'var(--grad-accent)' : dominante }} /></div>
          </div>
        )}
        <div className="evx-prev-foot">
          <span className="it"><Users /> <b>{p.inscritos}</b> inscritos</span>
          <span className="it"><List /> <b>{p.totalModalidades}</b> modalidades</span>
        </div>
      </div>
    </div>
  )
}
