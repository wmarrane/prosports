import { Grid2x2, X } from 'lucide-react'
import { TIPO_INFO, type TipoSorteio } from '../lib/evento-stats'

export type SecaoNav = { key: string; count: number; tipo: TipoSorteio; sorteadas: number }

export default function EventoEsportesNav({ secoes }: { secoes: SecaoNav[] }) {
  return (
    <>
      <div className="em-catbar">
        <div className="em-pills">
          {secoes.map((s, i) => (
            <button type="button" className="em-pill" key={s.key} data-sport={s.key} data-on={i === 0 ? 'true' : 'false'}>
              <span className="d" style={{ background: TIPO_INFO[s.tipo].grad }} />
              {s.key}<span className="pc">{s.count}</span>
            </button>
          ))}
          <button type="button" className="em-grid-btn" data-sheet-open aria-label="Todos os esportes"><Grid2x2 size={18} /></button>
        </div>
        <div className="seg">
          <button type="button" data-sf="all" data-on="true">Todas</button>
          <button type="button" data-sf="aberto">Abertas</button>
          <button type="button" data-sf="sorteado">Sorteado</button>
        </div>
      </div>
      <div className="em-scrim" data-open="false" data-sheet-close />
      <div className="em-sheet" data-open="false">
        <div className="em-sheet-grip" />
        <div className="em-sheet-h"><b>Esportes</b><button type="button" className="em-iconbtn" data-sheet-close aria-label="Fechar"><X size={20} /></button></div>
        <div className="em-sheet-list">
          {secoes.map((s) => (
            <button type="button" className="em-sheet-item" key={s.key} data-sport={s.key}>
              <span className="em-sheet-dot" style={{ background: TIPO_INFO[s.tipo].grad }}><Grid2x2 size={16} /></span>
              <span className="em-sheet-tx"><b>{s.key}</b><span>{s.count} modalidades</span></span>
              <span className="em-sheet-mini"><span className="mb"><i style={{ width: `${s.count ? Math.round((s.sorteadas / s.count) * 100) : 0}%` }} /></span><span className="mn">{s.sorteadas}/{s.count}</span></span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
