import type { ChavesResultado } from '../../types/sorteio'
import type { Participante } from '../../types/participante'

type Props = {
  resultado: ChavesResultado
  participantesById: Map<number, Participante>
  large?: boolean
}

export default function SorteioChaves({ resultado, participantesById, large = false }: Props) {
  const cardPad = large ? 'p-6' : 'p-4'
  const itemSpacing = large ? 'space-y-3' : 'space-y-1.5'
  const indexClass = large ? 'font-mono text-base text-[var(--t3)] w-12' : 'font-mono text-[var(--t3)] w-8'
  const nameClass = large ? 'text-xl text-[var(--t1)]' : 'text-sm text-[var(--t1)]'
  const subClass = large ? 'text-base text-[var(--t3)] ml-2' : 'text-xs text-[var(--t3)] ml-1'
  const byeClass = large ? 'text-xl text-[var(--t4)] italic' : 'text-sm text-[var(--t4)] italic'

  return (
    <div className={`bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-xl ${cardPad}`}>
      <ul className={itemSpacing}>
        {resultado.slots.map((pid, idx) => (
          <li key={idx} className="flex items-center gap-3">
            <span className={indexClass}>{String(idx + 1).padStart(2, '0')}</span>
            {pid == null ? (
              <span className={byeClass}>BYE</span>
            ) : (
              (() => {
                const p = participantesById.get(pid)
                return p
                  ? <span className={nameClass}>{p.nome}{p.subtitulo ? <span className={subClass}>— {p.subtitulo}</span> : null}</span>
                  : <span className="text-[var(--t4)]">—</span>
              })()
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
