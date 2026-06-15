import type { SnapEvento } from '../snapshot-types'
import { esporteBase } from '../lib/esporte'

export default function EventoCard({ evento }: { evento: SnapEvento }) {
  const total = new Set(evento.modalidades.map(m => esporteBase(m.nome))).size
  const inscritos = new Set(evento.modalidades.flatMap(m => m.participantes.map(p => p.id))).size
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
