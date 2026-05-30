import type { GruposResultado } from '../../types/sorteio'
import type { Participante } from '../../types/participante'

type Props = {
  resultado: GruposResultado
  participantesById: Map<number, Participante>
  large?: boolean
}

export default function SorteioGrupos({ resultado, participantesById, large = false }: Props) {
  const minCol = large ? 360 : 240
  const gap = large ? 24 : 16
  const cardPad = large ? 'p-6' : 'p-4'
  const titleClass = large ? 'text-2xl font-bold text-[var(--t1)]' : 'text-base font-semibold text-[var(--t1)]'
  const subClass = large ? 'text-sm text-[var(--t3)]' : 'text-xs text-[var(--t3)]'
  const itemClass = large ? 'text-xl text-[var(--t1)]' : 'text-sm text-[var(--t1)]'
  const subItemClass = large ? 'text-base text-[var(--t3)] ml-2' : 'text-xs text-[var(--t3)] ml-1'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minCol}px, 1fr))`, gap }}>
      {resultado.grupos.map(g => (
        <div
          key={g.letra}
          className={`bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-xl ${cardPad}`}
        >
          <div className={`flex justify-between items-center ${large ? 'mb-4' : 'mb-3'}`}>
            <h4 className={titleClass}>Grupo {g.letra}</h4>
            <span className={subClass}>{resultado.classificados_por_grupo} classificados</span>
          </div>
          <ul className={large ? 'space-y-3' : 'space-y-1.5'}>
            {g.participantes.map(pid => {
              const p = participantesById.get(pid)
              return (
                <li key={pid} className={itemClass}>
                  {p ? p.nome : <span className="text-[var(--t4)]">—</span>}
                  {p?.subtitulo && <span className={subItemClass}>— {p.subtitulo}</span>}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
