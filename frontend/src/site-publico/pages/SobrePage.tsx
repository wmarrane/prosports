import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'

export default function SobrePage() {
  return (
    <div className="site">
      <SiteNav active="sobre" />

      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-eyebrow"><span className="dot" />Quem somos</div>
          <h1>Sobre a Montana Eventos</h1>
          <p className="lead">Há mais de 20 anos organizando congressos e competições esportivas por todo o Brasil.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="split">
            <div>
              <div className="sec-eyebrow">Nossa história</div>
              <h2>Mais de duas décadas conduzindo competições pelo país</h2>
              <p>
                A Montana Eventos é uma empresa com mais de 20 anos de experiência na organização de
                congressos e competições esportivas em todo o Brasil. Aplicamos inovação e tecnologia
                nos processos de formação de grupos, chaves e demais formatos de disputa.
              </p>
              <p>
                Para isso desenvolvemos o <b>ProSports</b>, nossa plataforma própria que conduz
                inscrições, congressos e sorteios com transparência e rastreabilidade total.
              </p>
            </div>
            <div className="ph"><span className="ph-tag">foto · equipe Montana em evento</span></div>
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container">
          <div className="sec-head center">
            <div className="sec-eyebrow">Metodologia</div>
            <h2>Da inscrição ao sorteio auditável</h2>
            <p>Um processo padronizado que garante competições justas, independentemente do esporte ou do formato de disputa.</p>
          </div>
          <div className="feat-grid">
            <div className="feat">
              <h3>Inscrições</h3>
              <p>Os participantes são importados por planilha para cada modalidade — cadastro global, válido para qualquer competição.</p>
            </div>
            <div className="feat">
              <h3>Congresso</h3>
              <p>Antes da disputa, o congresso reúne as delegações e define os emparceiramentos de cada modalidade.</p>
            </div>
            <div className="feat">
              <h3>Sorteio auditável</h3>
              <p>O sistema conduz o sorteio aplicando as regras e registra uma semente — o resultado é reproduzível e auditável.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section dark">
        <div className="container">
          <div className="statband center">
            <div><div className="s-val">20<span className="u">+</span></div><div className="s-lab">Anos de história</div></div>
            <div><div className="s-val">6</div><div className="s-lab">Competições</div></div>
            <div><div className="s-val">8</div><div className="s-lab">Eventos em 2026</div></div>
            <div><div className="s-val">1093</div><div className="s-lab">Inscritos</div></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container center">
          <div className="sec-eyebrow">Fale com a gente</div>
          <h2>Quer organizar sua competição com a Montana?</h2>
          <p>Entre em contato e leve inovação e transparência para o seu evento esportivo.</p>
          <div className="sec-cta">
            <a className="btn btn-primary btn-lg" href="mailto:contato@montanaeventos.com.br">contato@montanaeventos.com.br</a>
            <a className="btn btn-secondary btn-lg" href="/eventos.html">Ver eventos</a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
