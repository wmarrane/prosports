import SiteNav from '../components/SiteNav'
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

      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <div>
              <a className="brand-mark" href="/index.html"><b>Montana Eventos</b><small>Congressos esportivos</small></a>
              <p className="f-about">Há mais de 20 anos organizando congressos e competições esportivas por todo o Brasil, com inovação e tecnologia na formação de grupos, chaves e sorteios.</p>
            </div>
            <div>
              <h5>Navegação</h5>
              <div className="f-links">
                <a href="/index.html">Início</a>
                <a href="/eventos.html">Eventos</a>
                <a href="/sobre.html">Sobre</a>
              </div>
            </div>
            <div>
              <h5>Plataforma</h5>
              <div className="f-links">
                <a href="https://newprosports.web.app/login">Entrar no ProSports</a>
                <a href="/sobre.html">Como funciona</a>
                <a href="/eventos.html">Resultados</a>
              </div>
            </div>
            <div>
              <h5>Contato</h5>
              <div className="f-links">
                <a href="mailto:contato@montanaeventos.com.br">contato@montanaeventos.com.br</a>
                <a href="/sobre.html">São Paulo · Brasil</a>
              </div>
            </div>
          </div>
          <div className="footer-bar">
            <span>© 2026 Montana Eventos. Todos os direitos reservados.</span>
            <span>Sorteios auditáveis · semente registrada e reproduzível</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
