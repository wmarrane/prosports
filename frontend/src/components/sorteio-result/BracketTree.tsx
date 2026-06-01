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
  subtituloLine?: (p: Participante) => string | null
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

const CARD_WIDTH = 260
const CARD_HEIGHT = 120
const COL_GAP = 80
const ROW_GAP = 14
const POS_ROW_HEIGHT = CARD_HEIGHT + ROW_GAP

function computeLayout(graph: MatchesGraph, N: number): { matches: MatchLayout[]; width: number; height: number } {
  // Agrupa matches por rodada.
  const matchesByRound: Record<number, typeof graph.matches> = {}
  const matchesSorted = [...graph.matches].sort((a, b) => a.round - b.round)
  for (const m of matchesSorted) {
    ;(matchesByRound[m.round] ??= []).push(m)
  }

  // Altura total é determinada pelo NÚMERO DE R1 MATCHES (não por N de inscritos)
  // — isso compacta o bracket para que os matches fiquem próximos verticalmente.
  const r1Count = Math.max(1, (matchesByRound[1] ?? []).filter(m => m.id !== graph.thirdPlace).length)
  const totalHeight = r1Count * POS_ROW_HEIGHT

  // Posições (P1..PN) mapeadas linearmente em [0, totalHeight] pelo índice.
  // BYE positions (que não aparecem como card) usam esse Y para o cálculo de
  // midpoint das R2 BYE matches.
  const posY: Record<string, number> = {}
  for (let p = 1; p <= N; p++) {
    posY[`P${p}`] = ((p - 0.5) / N) * totalHeight
  }

  // Para ORDENAR matches dentro de cada rodada, usamos Y "natural" (média de inputs).
  const naturalY: Record<string, number> = {}
  for (const m of matchesSorted) {
    const resolve = (ref: string): number => {
      if (ref.startsWith('P')) return posY[ref] ?? 0
      return naturalY[ref.slice(2)] ?? 0
    }
    naturalY[m.id] = (resolve(m.top) + resolve(m.bottom)) / 2
  }

  // Layout final:
  //   - R1: espaçamento igual na altura total (funil-base).
  //   - R2 em diante: cada match no MEIO entre seus inputs (funil convergente).
  //   - 3º lugar: abaixo do bracket, alinhado com a Final.
  const matchById: Record<string, MatchLayout> = {}
  const resolveLaidOutY = (ref: string): number => {
    if (ref.startsWith('P')) return posY[ref] ?? 0
    return matchById[ref.slice(2)]?.y ?? 0
  }

  for (const round of Object.keys(matchesByRound).map(Number).sort((a, b) => a - b)) {
    const bracketMatches = matchesByRound[round]
      .filter(m => m.id !== graph.thirdPlace)
      .sort((a, b) => naturalY[a.id] - naturalY[b.id])
    const n = bracketMatches.length
    bracketMatches.forEach((m, i) => {
      let y: number
      if (round === 1) {
        y = ((i + 0.5) / n) * totalHeight  // R1: equal spacing
      } else {
        // R2+: se um input é BYE (P ref) e o outro é um match real (V:/L:),
        // alinha o card para que o slot do BYE fique na mesma LINHA do match
        // que o antecede. Caso contrário, midpoint dos inputs.
        const topIsP = m.top.startsWith('P')
        const botIsP = m.bottom.startsWith('P')
        if (topIsP && !botIsP) {
          y = resolveLaidOutY(m.bottom) + CARD_HEIGHT / 4
        } else if (botIsP && !topIsP) {
          y = resolveLaidOutY(m.top) - CARD_HEIGHT / 4
        } else {
          y = (resolveLaidOutY(m.top) + resolveLaidOutY(m.bottom)) / 2
        }
      }
      const x = (m.round - 1) * (CARD_WIDTH + COL_GAP)
      matchById[m.id] = {
        id: m.id, round: m.round, top: m.top, bottom: m.bottom,
        x, y, isFinal: m.id === graph.final, isThirdPlace: false,
      }
    })
  }

  // 3º lugar (se houver) — abaixo do bracket, alinhado com a final
  if (graph.thirdPlace) {
    const tp = graph.matches.find(m => m.id === graph.thirdPlace)
    if (tp) {
      const finalMatch = matchById[graph.final]
      const x = finalMatch?.x ?? 0
      const y = totalHeight + CARD_HEIGHT + ROW_GAP
      matchById[tp.id] = {
        id: tp.id, round: tp.round, top: tp.top, bottom: tp.bottom,
        x, y, isFinal: false, isThirdPlace: true,
      }
    }
  }

  const maxRound = Math.max(...matchesSorted.map(m => m.round))
  const width = (maxRound - 1) * (CARD_WIDTH + COL_GAP) + CARD_WIDTH
  const height = Math.max(totalHeight, ...Object.values(matchById).map(m => m.y + CARD_HEIGHT))
  return { matches: Object.values(matchById), width, height }
}

function renderSlot(
  ref: string,
  slots: (number | null)[],
  participantesById: Map<number, Participante>,
  campeoesByParticipanteId: Map<number, number> | undefined,
  large: boolean,
  subtituloLine?: (p: Participante) => string | null,
): React.ReactNode {
  // Fonte do nome do participante = maior (destaque). Labels BYE/Vencedor/Perdedor = original.
  const labelFontSize = large ? '1rem' : '0.85rem'
  const nameFontSize = large ? '1.2rem' : '1rem'
  const subFontSize = large ? '0.8rem' : '0.7rem'
  if (ref.startsWith('P')) {
    const pos = parseInt(ref.slice(1), 10)
    const pid = slots[pos - 1] ?? null
    if (pid === null) return <span style={{ color: 'var(--t4)', fontStyle: 'italic', fontSize: labelFontSize }}>BYE</span>
    const p = participantesById.get(pid)
    const cp = campeoesByParticipanteId?.get(pid)
    if (!p) return <span style={{ color: 'var(--t4)', fontSize: labelFontSize }}>—</span>
    const linha = subtituloLine?.(p) ?? null
    return (
      <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 4, color: 'var(--t1)', minWidth: 0, width: '100%' }}>
        {cp && <span style={{ flexShrink: 0, marginTop: 2 }}><CampeaoBadge posicao={cp} large={false} /></span>}
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <span style={{
            fontSize: nameFontSize, fontWeight: 600, lineHeight: 1.15,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{p.nome}</span>
          {linha && (
            <span style={{
              fontSize: subFontSize, color: 'var(--t3)', lineHeight: 1.2, marginTop: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{linha}</span>
          )}
        </span>
      </span>
    )
  }
  if (ref.startsWith('V:')) {
    return <span style={{ color: 'var(--t3)', fontStyle: 'italic', fontSize: labelFontSize }}>Vencedor {ref.slice(2)}</span>
  }
  if (ref.startsWith('L:')) {
    return <span style={{ color: 'var(--t3)', fontStyle: 'italic', fontSize: labelFontSize }}>Perdedor {ref.slice(2)}</span>
  }
  return null
}

export default function BracketTree({ matchesGraph, slots, participantesById, campeoesByParticipanteId, large = false, subtituloLine }: Props) {
  const layout = useMemo(() => computeLayout(matchesGraph, slots.length), [matchesGraph, slots.length])

  // Compute connectors: for each match input that references V:Jx or L:Jx,
  // draw L-shape from source match's right edge to destination input edge.
  type Connector = { d: string; key: string }
  const matchMap: Record<string, MatchLayout> = {}
  for (const m of layout.matches) matchMap[m.id] = m

  // Color por match-source: hue rotativo HSL para distinguir cada confronto.
  // Saturação/lightness fixos para combinar com o tom das caixas em ambos os
  // modos. 3º lugar usa cor neutra (--t4) para se diferenciar.
  const totalMatches = layout.matches.length
  const sourceColor = (matchId: string): string => {
    const n = parseInt(matchId.replace(/\D/g, ''), 10) || 0
    const hue = ((n - 1) * 360 / Math.max(1, totalMatches)) % 360
    return `hsl(${hue}deg 65% 60%)`
  }

  type ConnectorEx = Connector & { stroke: string; isThirdPlace: boolean }
  const connectors: ConnectorEx[] = []
  for (const m of layout.matches) {
    for (const [slot, ref] of [['top', m.top], ['bottom', m.bottom]] as const) {
      if (!ref.startsWith('V:') && !ref.startsWith('L:')) continue
      const srcId = ref.slice(2)
      const src = matchMap[srcId]
      if (!src) continue
      const x1 = src.x + CARD_WIDTH
      const y1 = src.y
      const x2 = m.x
      const y2 = m.y + (slot === 'top' ? -CARD_HEIGHT / 4 : CARD_HEIGHT / 4)
      const xm = (x1 + x2) / 2
      const d = `M ${x1} ${y1} L ${xm} ${y1} L ${xm} ${y2} L ${x2} ${y2}`
      const isThirdPlace = m.isThirdPlace || ref.startsWith('L:')
      connectors.push({
        d,
        key: `${srcId}-${m.id}-${slot}`,
        stroke: isThirdPlace ? 'var(--t4)' : sourceColor(srcId),
        isThirdPlace,
      })
    }
  }

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', padding: 16, position: 'relative' }}>
      <div style={{ position: 'relative', width: layout.width, height: layout.height, minWidth: '100%' }}>
        <svg
          style={{ position: 'absolute', inset: 0, width: layout.width, height: layout.height, pointerEvents: 'none' }}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
        >
          {connectors.map(c => (
            <path
              key={c.key}
              d={c.d}
              stroke={c.stroke}
              strokeWidth={c.isThirdPlace ? 2.5 : 4}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
        {layout.matches.map(m => (
          <div
            key={m.id}
            className={`bg-[var(--card-bg-2)] rounded-lg ${m.isFinal ? 'border-amber-500' : ''}`}
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
              border: m.isFinal ? '2px solid #f59e0b' : '1.5px solid var(--t2)',
            }}
          >
            {(m.isFinal || m.isThirdPlace) && (
              <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>
                🏆 {m.isThirdPlace ? '3º lugar' : 'Final'}
              </div>
            )}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--t3)', paddingBottom: 4 }}>
              {renderSlot(m.top, slots, participantesById, campeoesByParticipanteId, large, subtituloLine)}
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingTop: 4 }}>
              {renderSlot(m.bottom, slots, participantesById, campeoesByParticipanteId, large, subtituloLine)}
            </div>
            <div style={{ position: 'absolute', top: 2, right: 4, fontSize: '0.65rem', color: 'var(--t4)' }}>{m.id}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
