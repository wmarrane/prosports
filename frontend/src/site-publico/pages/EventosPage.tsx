import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import EventoCard from '../components/EventoCard'
import type { SnapEvento } from '../snapshot-types'

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
            const inscritos = lista.reduce((s, e) => s + e.modalidades.reduce((t, m) => t + m.participantes.length, 0), 0)
            return (
              <div className="year-group" key={ano}>
                <div className="year-head">
                  <span className="yr">{ano}</span>
                  <span className="yc">{lista.length} eventos · {inscritos} inscritos</span>
                </div>
                <div className="ev-grid">
                  {lista.map(e => <EventoCard key={e.id} evento={e} />)}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
