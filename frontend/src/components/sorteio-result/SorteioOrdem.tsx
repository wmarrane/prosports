import type { OrdemResultado } from '../../types/sorteio'
import type { Participante } from '../../types/participante'

type Props = {
  resultado: OrdemResultado
  participantesById: Map<number, Participante>
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function SorteioOrdem({ resultado, participantesById }: Props) {
  return (
    <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-xl p-4">
      <ol className="space-y-1.5">
        {resultado.ordem.map((pid, idx) => {
          const p = participantesById.get(pid)
          const prefix = idx < 3 ? MEDALS[idx] : <span className="font-mono text-[var(--t3)] w-8 inline-block">{String(idx + 1).padStart(2, '0')}</span>
          return (
            <li key={pid} className="flex items-center gap-3 text-sm text-[var(--t1)]">
              <span className="w-8 inline-flex items-center justify-center">{prefix}</span>
              {p
                ? <span>{p.nome}{p.subtitulo ? <span className="text-xs text-[var(--t3)] ml-1">— {p.subtitulo}</span> : null}</span>
                : <span className="text-[var(--t4)]">—</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
