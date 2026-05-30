import type { OrdemResultado } from '../../types/sorteio'
import type { Participante } from '../../types/participante'

type Props = {
  resultado: OrdemResultado
  participantesById: Map<number, Participante>
  large?: boolean
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function SorteioOrdem({ resultado, participantesById, large = false }: Props) {
  const cardPad = large ? 'p-6' : 'p-4'
  const itemSpacing = large ? 'space-y-3' : 'space-y-1.5'
  const itemClass = large ? 'text-xl text-[var(--t1)]' : 'text-sm text-[var(--t1)]'
  const medalSize = large ? 'text-3xl' : 'text-base'
  const indexClass = large ? 'font-mono text-base text-[var(--t3)] w-12 inline-block' : 'font-mono text-[var(--t3)] w-8 inline-block'
  const subClass = large ? 'text-base text-[var(--t3)] ml-2' : 'text-xs text-[var(--t3)] ml-1'

  return (
    <div className={`bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-xl ${cardPad}`}>
      <ol className={itemSpacing}>
        {resultado.ordem.map((pid, idx) => {
          const p = participantesById.get(pid)
          const prefix = idx < 3
            ? <span className={medalSize}>{MEDALS[idx]}</span>
            : <span className={indexClass}>{String(idx + 1).padStart(2, '0')}</span>
          return (
            <li key={pid} className={`flex items-center gap-3 ${itemClass}`}>
              <span className="w-12 inline-flex items-center justify-center">{prefix}</span>
              {p
                ? <span>{p.nome}{p.subtitulo ? <span className={subClass}>— {p.subtitulo}</span> : null}</span>
                : <span className="text-[var(--t4)]">—</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
