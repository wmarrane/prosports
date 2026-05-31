import { useMemo } from 'react'
import type { MatchesGraph } from '../../types/sorteio'
import type { Participante } from '../../types/participante'
import CampeaoBadge from '../CampeaoBadge'

type Props = {
  matchesGraph: MatchesGraph
  slots: (number | null)[]
  participantesById: Map<number, Participante>
  campeoesByParticipanteId?: Map<number, number>
  large?: boolean
}

type MatchLayout = {
  id: string
  round: number
  top: string
  bottom: string
  x: number
  y: number
  isFinal: boolean
  isThirdPlace: boolean
}

const CARD_WIDTH = 200
const CARD_HEIGHT = 64
const COL_GAP = 80
const ROW_GAP = 24
const POS_ROW_HEIGHT = CARD_HEIGHT + ROW_GAP

function computeLayout(graph: MatchesGraph, N: number): { matches: MatchLayout[]; width: number; height: number } {
  const posY: Record<string, number> = {}
  for (let p = 1; p <= N; p++) {
    posY[`P${p}`] = (p - 0.5) * POS_ROW_HEIGHT
  }

  const matchesSorted = [...graph.matches].sort((a, b) => a.round - b.round)
  const matchById: Record<string, MatchLayout> = {}

  const resolveY = (ref: string): number => {
    if (ref.startsWith('P')) return posY[ref] ?? 0
    const id = ref.slice(2)
    return matchById[id]?.y ?? 0
  }

  for (const m of matchesSorted) {
    const y = (resolveY(m.top) + resolveY(m.bottom)) / 2
    const x = (m.round - 1) * (CARD_WIDTH + COL_GAP)
    const isFinal = m.id === graph.final
    const isThirdPlace = m.id === graph.thirdPlace
    matchById[m.id] = {
      id: m.id, round: m.round, top: m.top, bottom: m.bottom,
      x, y, isFinal, isThirdPlace,
    }
  }

  const maxRound = Math.max(...matchesSorted.map(m => m.round))
  const width = (maxRound - 1) * (CARD_WIDTH + COL_GAP) + CARD_WIDTH
  const height = Math.max(N * POS_ROW_HEIGHT, ...Object.values(matchById).map(m => m.y + CARD_HEIGHT))
  return { matches: Object.values(matchById), width, height }
}

function renderSlot(
  ref: string,
  slots: (number | null)[],
  participantesById: Map<number, Participante>,
  campeoesByParticipanteId: Map<number, number> | undefined,
  large: boolean,
): React.ReactNode {
  const fontSize = large ? '1rem' : '0.85rem'
  if (ref.startsWith('P')) {
    const pos = parseInt(ref.slice(1), 10)
    const pid = slots[pos - 1] ?? null
    if (pid === null) return <span style={{ color: 'var(--t4)', fontStyle: 'italic', fontSize }}>BYE</span>
    const p = participantesById.get(pid)
    const cp = campeoesByParticipanteId?.get(pid)
    if (!p) return <span style={{ color: 'var(--t4)', fontSize }}>—</span>
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize, color: 'var(--t1)' }}>
        {cp && <CampeaoBadge posicao={cp} large={false} />}
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</span>
      </span>
    )
  }
  if (ref.startsWith('V:')) {
    return <span style={{ color: 'var(--t3)', fontStyle: 'italic', fontSize }}>Vencedor {ref.slice(2)}</span>
  }
  if (ref.startsWith('L:')) {
    return <span style={{ color: 'var(--t3)', fontStyle: 'italic', fontSize }}>Perdedor {ref.slice(2)}</span>
  }
  return null
}

export default function BracketTree({ matchesGraph, slots, participantesById, campeoesByParticipanteId, large = false }: Props) {
  const layout = useMemo(() => computeLayout(matchesGraph, slots.length), [matchesGraph, slots.length])

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', padding: 16, position: 'relative' }}>
      <div style={{ position: 'relative', width: layout.width, height: layout.height, minWidth: '100%' }}>
        {layout.matches.map(m => (
          <div
            key={m.id}
            className={`bg-[var(--card-bg-2)] border rounded-lg ${m.isFinal ? 'border-amber-500' : 'border-[var(--card-border)]'}`}
            style={{
              position: 'absolute',
              left: m.x,
              top: m.y - CARD_HEIGHT / 2,
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              padding: 6,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            {m.isFinal && (
              <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>
                🏆 {m.isThirdPlace ? '3º lugar' : 'Final'}
              </div>
            )}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: 4 }}>
              {renderSlot(m.top, slots, participantesById, campeoesByParticipanteId, large)}
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingTop: 4 }}>
              {renderSlot(m.bottom, slots, participantesById, campeoesByParticipanteId, large)}
            </div>
            <div style={{ position: 'absolute', top: 2, right: 4, fontSize: '0.65rem', color: 'var(--t4)' }}>{m.id}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
