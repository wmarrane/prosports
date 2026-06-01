import type { OrdemResultado } from '../../types/sorteio'
import type { Participante } from '../../types/participante'
import AnfitriaoBadge from '../AnfitriaoBadge'

type Props = {
  resultado: OrdemResultado
  participantesById: Map<number, Participante>
  large?: boolean
  anfitriaoPid?: number | null
  subtituloLine?: (p: Participante) => string | null
}

export default function SorteioOrdem({ resultado, participantesById, large = false, anfitriaoPid, subtituloLine }: Props) {
  const cardPad = large ? 'p-6' : 'p-4'
  const itemSpacing = large ? 'space-y-3' : 'space-y-1.5'
  const itemClass = large ? 'text-xl text-[var(--t1)]' : 'text-sm text-[var(--t1)]'
  const indexClass = large
    ? 'font-mono text-lg font-bold text-[var(--brand-500)] w-10 text-right'
    : 'font-mono text-sm font-bold text-[var(--brand-500)] w-8 text-right'
  const subClass = large ? 'text-base text-[var(--t3)] ml-2' : 'text-xs text-[var(--t3)] ml-1'

  return (
    <div className={`bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-xl ${cardPad}`}>
      <ol className={itemSpacing}>
        {resultado.ordem.map((pid, idx) => {
          const p = participantesById.get(pid)
          const linha = p && subtituloLine ? subtituloLine(p) : null
          const isAnfitriao = anfitriaoPid != null && pid === anfitriaoPid
          return (
            <li key={pid} className={`flex items-center gap-3 ${itemClass}`}>
              <span className={indexClass}>{idx + 1}.</span>
              {isAnfitriao && <AnfitriaoBadge large={large} />}
              {p
                ? <span>{p.nome}{linha ? <span className={subClass}>— {linha}</span> : null}</span>
                : <span className="text-[var(--t4)]">—</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
