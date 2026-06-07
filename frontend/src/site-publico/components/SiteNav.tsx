import { LOGIN_URL } from '../constants'

export default function SiteNav({ active }: { active: 'inicio' | 'eventos' | 'sobre' }) {
  return (
    <nav className="site-nav">
      <a href="/index.html" className="site-brand">
        <img src="/montana/simbolo.png" alt="" className="site-brand-logo" />
        <span>Montana Eventos</span>
      </a>
      <div className="site-nav-links">
        <a href="/index.html" aria-current={active === 'inicio' ? 'page' : undefined}>Início</a>
        <a href="/eventos.html" aria-current={active === 'eventos' ? 'page' : undefined}>Eventos</a>
        <a href="/sobre.html" aria-current={active === 'sobre' ? 'page' : undefined}>Sobre</a>
        <a className="btn btn-primary" href={LOGIN_URL}>Entrar</a>
      </div>
    </nav>
  )
}
