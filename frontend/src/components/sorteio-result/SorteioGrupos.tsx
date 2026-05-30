import type { GruposResultado } from '../../types/sorteio'
import type { Participante } from '../../types/participante'

type Props = {
  resultado: GruposResultado
  participantesById: Map<number, Participante>
}

export default function SorteioGrupos({ resultado, participantesById }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
      {resultado.grupos.map(g => (
        <div
          key={g.letra}
          className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-xl p-4"
        >
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-base font-semibold text-[var(--t1)]">Grupo {g.letra}</h4>
            <span className="text-xs text-[var(--t3)]">{resultado.classificados_por_grupo} classificados</span>
          </div>
          <ul className="space-y-1.5">
            {g.participantes.map(pid => {
              const p = participantesById.get(pid)
              return (
                <li key={pid} className="text-sm text-[var(--t1)]">
                  {p ? p.nome : <span className="text-[var(--t4)]">—</span>}
                  {p?.subtitulo && <span className="text-xs text-[var(--t3)] ml-1">— {p.subtitulo}</span>}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
