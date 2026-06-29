import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import EventoCardListagem from '../components/EventoCardListagem'
import { inscritos } from '../lib/evento-stats'
import type { SnapEvento } from '../snapshot-types'
import { statusPublico, STATUS_ORDEM } from '../lib/status-evento'

export default function EventosPage({ eventos }: { eventos: SnapEvento[] }) {
  const porAno = new Map<number, SnapEvento[]>()
  for (const e of eventos) { const y = new Date(e.data).getFullYear(); const a = porAno.get(y) ?? []; a.push(e); porAno.set(y, a) }
  const anos = [...porAno.keys()].sort((a, b) => b - a)

  return (
    <div className="site">
      <SiteNav active="eventos" />

      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-eyebrow"><span className="dot" />Agenda · resultados</div>
          <h1>Eventos</h1>
          <p className="lead">Cada evento tem sua própria página com inscritos, campeões do ano anterior e os sorteios de cada modalidade.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {anos.map(ano => {
            const lista = porAno.get(ano)!
            const inscritosAno = lista.reduce((s, e) => s + inscritos(e), 0)
            return (
              <div className="year-group" key={ano}>
                <div className="yr-head">
                  <span className="yr">{ano}</span>
                  <span className="sub"><b>{lista.length}</b> eventos · <b>{inscritosAno}</b> inscritos</span>
                  <span className="spacer" />
                  <div className="yr-filter">
                    <button type="button" className="on" data-filter="todos">Todos</button>
                    {STATUS_ORDEM.filter((s) => lista.some((e) => e.status === s)).map((s) => (
                      <button type="button" key={s} data-filter={s}><span className="d" style={{ background: statusPublico(s).dot }} />{statusPublico(s).label}</button>
                    ))}
                  </div>
                </div>
                <div className="ev-grid3">
                  {lista.map(e => <EventoCardListagem key={e.id} evento={e} />)}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <script dangerouslySetInnerHTML={{ __html:
        "document.querySelectorAll('.year-group').forEach(function(g){var btns=g.querySelectorAll('.yr-filter button');var cards=g.querySelectorAll('.evc');btns.forEach(function(b){b.addEventListener('click',function(){var f=b.getAttribute('data-filter');btns.forEach(function(x){x.classList.remove('on')});b.classList.add('on');cards.forEach(function(c){c.style.display=(f==='todos'||c.getAttribute('data-status')===f)?'':'none'})})})});"
      }} />

      <SiteFooter />
    </div>
  )
}
