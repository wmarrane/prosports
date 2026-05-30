import type { ChavesResultado } from '../../types/sorteio'
import type { Participante } from '../../types/participante'

type Props = {
  resultado: ChavesResultado
  participantesById: Map<number, Participante>
}

export default function SorteioChaves({ resultado, participantesById }: Props) {
  return (
    <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-xl p-4">
      <ul className="space-y-1.5">
        {resultado.slots.map((pid, idx) => (
          <li key={idx} className="flex items-center gap-3 text-sm">
            <span className="font-mono text-[var(--t3)] w-8">{String(idx + 1).padStart(2, '0')}</span>
            {pid == null ? (
              <span className="text-[var(--t4)] italic">BYE</span>
            ) : (
              (() => {
                const p = participantesById.get(pid)
                return p
                  ? <span className="text-[var(--t1)]">{p.nome}{p.subtitulo ? <span className="text-xs text-[var(--t3)] ml-1">— {p.subtitulo}</span> : null}</span>
                  : <span className="text-[var(--t4)]">—</span>
              })()
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
