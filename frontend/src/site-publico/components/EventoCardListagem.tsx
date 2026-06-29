import type { SnapEvento } from '../snapshot-types'
import { progressoSorteios, inscritos, modalidadesDistintas } from '../lib/evento-stats'
import { dataPtBr } from '../../lib/boletim-categorias'
import { Medal, MapPin, ArrowRight } from 'lucide-react'
import { statusPublico } from '../lib/status-evento'

export default function EventoCardListagem({ evento }: { evento: SnapEvento }) {
  const { sorteadas, done } = progressoSorteios(evento)
  const info = statusPublico(evento.status)
  const sortCls = sorteadas === 0 ? 'zero' : done ? 'hl' : ''
  return (
    <a className="evc" href={`/evento-${evento.id}.html`} data-status={evento.status}>
      <div className="accent" style={{ background: info.grad }} />
      <div className="evc-h">
        <div className="evc-tile" style={{ background: info.grad }}><Medal size={19} /></div>
      </div>
      <div className="evc-body">
        <h3 className="evc-title">{evento.nome}</h3>
        <div className="evc-loc"><MapPin size={13} /> {evento.cidade} · {dataPtBr(evento.data)}</div>
      </div>
      <div className="evc-stats">
        <div><b>{modalidadesDistintas(evento)}</b><span>Modalidades</span></div>
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
