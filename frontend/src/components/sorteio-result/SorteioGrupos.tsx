import type { GruposResultado } from '../../types/sorteio'
import type { Participante } from '../../types/participante'
import CampeaoBadge from '../CampeaoBadge'

type Props = {
  resultado: GruposResultado
  participantesById: Map<number, Participante>
  large?: boolean
  campeoesByParticipanteId?: Map<number, number>
  onGroupClick?: (letra: string) => void
  mostrarSubtitulo?: boolean
}

export default function SorteioGrupos({ resultado, participantesById, large = false, campeoesByParticipanteId, onGroupClick, mostrarSubtitulo = false }: Props) {
  const minCol = large ? 360 : 240
  const gap = large ? 24 : 16
  const cardPad = large ? 'p-6' : 'p-4'
  // Título do Grupo: âmbar (--warn) via inline style para escapar do
  // override de `h1..h5 { color: var(--fg-1) }` definido em tokens.css.
  // Mesmo amarelo usado em "Cabeças" e badge da Final.
  const titleClass = large ? 'text-2xl font-bold' : 'text-base font-semibold'
  const titleStyle: React.CSSProperties = { color: 'var(--warn)' }
  const subClass = large ? 'text-sm text-[var(--t3)]' : 'text-xs text-[var(--t3)]'
  const itemClass = large ? 'text-xl text-[var(--t1)]' : 'text-sm text-[var(--t1)]'
  const subItemClass = large ? 'text-base text-[var(--t3)] ml-2' : 'text-xs text-[var(--t3)] ml-1'
  const clickable = !!onGroupClick

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minCol}px, 1fr))`, gap }}>
      {resultado.grupos.map(g => (
        <div
          key={g.letra}
          onClick={clickable ? () => onGroupClick!(g.letra) : undefined}
          className={`bg-[var(--card-bg-2)] rounded-xl ${cardPad} ${clickable ? 'cursor-pointer transition-colors' : ''}`}
          style={{ border: '1.5px solid var(--t2)' }}
        >
          <div
            className={`flex justify-between items-center ${large ? 'mb-4 pb-3' : 'mb-3 pb-2'}`}
            style={{ borderBottom: '1px solid var(--t3)' }}
          >
            <h4 className={titleClass} style={titleStyle}>Grupo {g.letra}</h4>
            <span className={subClass}>{resultado.classificados_por_grupo} classificados</span>
          </div>
          <ul className={large ? 'space-y-3' : 'space-y-1.5'}>
            {g.participantes.map(pid => {
              const p = participantesById.get(pid)
              const pos = campeoesByParticipanteId?.get(pid)
              return (
                <li key={pid} className={`${itemClass} inline-flex items-center gap-2 w-full`}>
                  {pos && <CampeaoBadge posicao={pos} large={large} />}
                  <span>
                    {p ? p.nome : <span className="text-[var(--t4)]">—</span>}
                    {mostrarSubtitulo && p?.subtitulo && <span className={subItemClass}>— {p.subtitulo}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
