import type { SnapEvento } from '../snapshot-types'
import { GitFork, Grid2x2, ListOrdered, List, Trophy, Users, MapPin, ArrowRight } from 'lucide-react'
import { dataPtBr } from '../../lib/boletim-categorias'
import { TIPO_INFO, tiposPresentes, tipoDominante, progressoSorteios, inscritos, totalModalidades, statusEvento, type TipoSorteio } from '../lib/evento-stats'

const ICON: Record<TipoSorteio, typeof GitFork> = {
  chaves: GitFork, grupos: Grid2x2, ordem_entrada: ListOrdered, especifico: List,
}

export default function EventoCard({ evento }: { evento: SnapEvento }) {
  const tipos = tiposPresentes(evento)
  const dom = TIPO_INFO[tipoDominante(evento)]
  const prog = progressoSorteios(evento)
  const visiveis = tipos.slice(0, 2)
  const extra = tipos.length - visiveis.length
  return (
    <a className="ev2" href={`/evento-${evento.id}.html`}>
      <div className="cover" style={{ background: dom.grad }}>
        <div className="cover-top">
          <div className="c-icons">
            {visiveis.map((t) => { const Ic = ICON[t]; return <div className="c-tile" key={t}><Ic size={20} /></div> })}
            {extra > 0 && <div className="c-more">+{extra}</div>}
          </div>
          <span className="c-badge"><span className="dot" />{statusEvento(evento)}</span>
        </div>
        <div className="c-loc"><MapPin size={13} /> {evento.cidade} · {dataPtBr(evento.data)}</div>
      </div>
      <div className="b">
        <h3 className="b-title">{evento.nome}</h3>
        <div className="b-comp"><Trophy size={14} /> {evento.competicao}</div>
        {prog.sorteaveis > 0 && (
          <div className="prog">
            <div className="prog-head">
              <span className="lab">Andamento dos sorteios</span>
              <b className={prog.done ? 'done' : ''}>{prog.sorteadas}/{prog.sorteaveis}{prog.done ? ' ✓' : ''}</b>
            </div>
            <div className="bar"><span style={{ width: `${Math.max(prog.pct, 3)}%`, background: prog.done ? 'var(--grad-accent)' : dom.grad }} /></div>
          </div>
        )}
        <div className="foot">
          <span className="st"><Users size={14} /> <b>{inscritos(evento)}</b> inscritos</span>
          <span className="st"><List size={14} /> <b>{totalModalidades(evento)}</b> modalidades</span>
          <span className="go">Ver evento <ArrowRight size={14} /></span>
        </div>
      </div>
    </a>
  )
}
