import type { SnapEvento } from '../snapshot-types'
import { progressoSorteios, inscritos, totalModalidades } from '../lib/evento-stats'
import { dataPtBr } from '../../lib/boletim-categorias'
import { Medal, MapPin, ArrowRight } from 'lucide-react'

type StatusListagem = 'sorteado' | 'andamento' | 'aguardando'

const STATUS_INFO: Record<StatusListagem, { label: string; grad: string; dot: string }> = {
  sorteado: { label: 'Sorteado', grad: 'var(--grad-accent)', dot: 'var(--accent)' },
  andamento: { label: 'Sorteios em andamento', grad: 'var(--grad-brand)', dot: 'var(--info)' },
  aguardando: { label: 'Aguardando sorteio', grad: 'var(--grad-warn)', dot: 'var(--warn)' },
}

function statusDe(sorteadas: number, done: boolean): StatusListagem {
  if (done) return 'sorteado'
  if (sorteadas > 0) return 'andamento'
  return 'aguardando'
}

export default function EventoCardListagem({ evento }: { evento: SnapEvento }) {
  const { sorteadas, done } = progressoSorteios(evento)
  const status = statusDe(sorteadas, done)
  const info = STATUS_INFO[status]
  const sortCls = sorteadas === 0 ? 'zero' : done ? 'hl' : ''
  return (
    <a className="evc" href={`/evento-${evento.id}.html`} data-status={status}>
      <div className="accent" style={{ background: info.grad }} />
      <div className="evc-h">
        <div className="evc-tile" style={{ background: info.grad }}><Medal size={19} /></div>
      </div>
      <div className="evc-body">
        <h3 className="evc-title">{evento.nome}</h3>
        <div className="evc-loc"><MapPin size={13} /> {evento.cidade} · {dataPtBr(evento.data)}</div>
      </div>
      <div className="evc-stats">
        <div><b>{totalModalidades(evento)}</b><span>Modalidades</span></div>
        <div><b>{inscritos(evento)}</b><span>Inscritos</span></div>
        <div><b className={sortCls}>{sorteadas}</b><span>Sorteios</span></div>
      </div>
      <div className="evc-foot">
        <span className="evc-status"><span className="d" style={{ background: info.dot }} />{info.label}</span>
        <span className="evc-go">Ver evento <ArrowRight size={14} /></span>
      </div>
    </a>
  )
}
