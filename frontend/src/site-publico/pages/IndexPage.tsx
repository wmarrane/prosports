import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import EventoCard from '../components/EventoCard'
import type { SnapEvento } from '../snapshot-types'
import { LOGIN_URL } from '../constants'

export default function IndexPage({ eventos }: { eventos: SnapEvento[] }) {
  const destaque = [...eventos]
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    .slice(0, 6)

  return (
    <div className="site">
      <SiteNav active="inicio" />

      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-eyebrow">
            <span className="dot" />Há mais de 20 anos · congressos e competições por todo o Brasil
          </div>
          <h1>Organização esportiva com <span className="hl">tecnologia e transparência</span>.</h1>
          <p className="lead">
            A Montana Eventos organiza congressos e competições em todo o país, aplicando inovação na
            formação de grupos, chaves e demais modalidades — cada sorteio justo, aleatório e auditável
            pela plataforma ProSports.
          </p>
          <div className="hero-cta">
            <a className="btn btn-onhero btn-lg" href="/eventos.html">Ver eventos</a>
            <a className="btn btn-ghost-hero btn-lg" href={LOGIN_URL}>Entrar na plataforma</a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="sec-head center">
            <div className="sec-eyebrow">Como organizamos</div>
            <h2>Cada modalidade no seu formato de disputa</h2>
            <p>
              Do chaveamento eliminatório à fase de grupos e à ordem de entrada — o sistema aplica a
              tabela de disputas correta para cada quantidade de inscritos.
            </p>
          </div>
          <div className="feat-grid">
            <div className="feat">
              <h3>Chaves eliminatórias</h3>
              <p>Chaveamento canônico com posições de cabeça fixas pela tabela do sistema, byes distribuídos automaticamente e confrontos numerados.</p>
            </div>
            <div className="feat">
              <h3>Fase de grupos</h3>
              <p>Número e tamanho dos grupos derivados da quantidade de inscritos, com campeões posicionados e regiões separadas.</p>
            </div>
            <div className="feat">
              <h3>Ordem de entrada</h3>
              <p>Sequência de apresentação sorteada de forma puramente aleatória, com destaque para o pódio.</p>
            </div>
            <div className="feat">
              <h3>Sorteios auditáveis</h3>
              <p>Cada sorteio registra uma semente reproduzível — qualquer resultado pode ser reconstruído e auditado.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container">
          <div className="split">
            <div>
              <div className="sec-eyebrow">A plataforma ProSports</div>
              <h2>Tecnologia que torna cada sorteio justo e reproduzível</h2>
              <p>Os inscritos, campeões e sorteios de cada evento são conduzidos pelo ProSports — a plataforma própria da Montana Eventos.</p>
              <ul className="checks">
                <li>Importação de inscritos por planilha, direto para cada modalidade.</li>
                <li>Tabelas <b>sistema_disputas_chaves</b> e <b>sistema_disputas_grupos</b> aplicadas automaticamente.</li>
                <li>Campeões do ano anterior entram como cabeças de chave ou 1ª posição de grupo.</li>
                <li>Semente registrada: todo resultado é <b>reproduzível e auditável</b>.</li>
              </ul>
              <div className="split-cta">
                <a className="btn btn-primary btn-lg" href={LOGIN_URL}>Acessar a plataforma</a>
              </div>
            </div>
            <div className="ph"><span className="ph-tag">captura · painel ProSports</span></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="sec-head">
            <div className="sec-eyebrow">Agenda</div>
            <h2>Eventos em destaque</h2>
            <p>Acesse a página de cada evento para ver inscritos, campeões do ano anterior e os sorteios de cada modalidade.</p>
          </div>
          <div className="ev-grid">
            {destaque.map(e => <EventoCard key={e.id} evento={e} />)}
          </div>
          <div className="sec-cta">
            <a className="btn btn-secondary btn-lg" href="/eventos.html">Ver todos os eventos</a>
          </div>
        </div>
      </section>

      <section className="section dark">
        <div className="container center">
          <div className="sec-eyebrow">Acesso à organização</div>
          <h2>Equipe técnica? Acesse a plataforma ProSports</h2>
          <p>Conduza congressos, importe inscritos e realize os sorteios das modalidades com total rastreabilidade.</p>
          <div className="sec-cta">
            <a className="btn btn-onhero btn-lg" href={LOGIN_URL}>Entrar na plataforma</a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
