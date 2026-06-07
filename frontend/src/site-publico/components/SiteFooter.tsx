import { LOGIN_URL } from '../constants'

export default function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-inner">
          <div>
            <a className="brand-mark" href="/index.html">
              <img src="/montana/simbolo.png" alt="" className="footer-logo" />
              <span><b>Montana Eventos</b><small>Congressos esportivos</small></span>
            </a>
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
              <a href={LOGIN_URL}>Entrar no ProSports</a>
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
  )
}
