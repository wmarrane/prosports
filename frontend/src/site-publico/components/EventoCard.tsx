import type { SnapEvento } from '../snapshot-types'

export default function EventoCard({ evento }: { evento: SnapEvento }) {
  const total = evento.modalidades.length
  const inscritos = evento.modalidades.reduce((s, m) => s + m.participantes.length, 0)
  const sorteadas = evento.modalidades.filter(m => m.status === 'sorteado').length
  return (
    <a className="evento-card" href={`/evento-${evento.id}.html`}>
      <h3>{evento.nome}</h3>
      <p className="evento-meta">{evento.cidade} · {new Date(evento.data).toLocaleDateString('pt-BR')}</p>
      <div className="evento-counts">
        <span>{total} modalidades</span><span>{inscritos} inscritos</span><span>{sorteadas} sorteadas</span>
      </div>
    </a>
  )
}
