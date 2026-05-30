import type { ChavesResultado } from '../../types/sorteio'
import type { Participante } from '../../types/participante'
import CampeaoBadge from '../CampeaoBadge'

type Props = {
  resultado: ChavesResultado
  participantesById: Map<number, Participante>
  large?: boolean
  campeoesByParticipanteId?: Map<number, number>
}

type Match = {
  id: string
  round: number
  index: number
  top: number | null
  bottom: number | null
}

function nextPow2(n: number): number {
  return n <= 1 ? 1 : 2 ** Math.ceil(Math.log2(n))
}

function buildBracketLegacy(slots: readonly (number | null)[]): Match[][] {
  const N = slots.length
  const pot2 = nextPow2(N)
  const bracketSlots: (number | null)[] = [...slots, ...Array(Math.max(0, pot2 - N)).fill(null)]
  const totalRounds = Math.max(1, Math.log2(pot2))
  const result: Match[][] = []

  const round0: Match[] = []
  if (pot2 === 1) {
    round0.push({ id: 'R0M0', round: 0, index: 0, top: bracketSlots[0] ?? null, bottom: null })
  } else {
    for (let i = 0; i < pot2; i += 2) {
      round0.push({
        id: `R0M${i / 2}`, round: 0, index: i / 2,
        top: bracketSlots[i] ?? null,
        bottom: bracketSlots[i + 1] ?? null,
      })
    }
  }
  result.push(round0)
  for (let r = 1; r < totalRounds; r++) {
    const matchesNesta = pot2 / 2 ** (r + 1)
    const round: Match[] = []
    for (let i = 0; i < matchesNesta; i++) {
      round.push({ id: `R${r}M${i}`, round: r, index: i, top: null, bottom: null })
    }
    result.push(round)
  }
  return result
}

function buildR1FromPlanilha(slots: readonly (number | null)[], byePositions: number[]): Match[] {
  const byeSet = new Set(byePositions)
  const nonByeIndices = Array.from({ length: slots.length }, (_, i) => i + 1).filter(p => !byeSet.has(p))
  const matches: Match[] = []
  for (let i = 0; i < nonByeIndices.length; i += 2) {
    matches.push({
      id: `R0M${i / 2}`,
      round: 0,
      index: i / 2,
      top: slots[nonByeIndices[i] - 1] ?? null,
      bottom: (i + 1) < nonByeIndices.length ? (slots[nonByeIndices[i + 1] - 1] ?? null) : null,
    })
  }
  return matches
}

function roundLabel(matchesNesta: number, roundIdx: number): string {
  if (matchesNesta === 1) return 'Final'
  if (matchesNesta === 2) return 'Semifinal'
  if (matchesNesta === 4) return 'Quartas'
  if (matchesNesta === 8) return 'Oitavas'
  return `${roundIdx + 1}ª Rodada`
}

type SlotRenderProps = {
  pid: number | null
  fallbackText: string
  large: boolean
  participantesById: Map<number, Participante>
  campeoesByParticipanteId?: Map<number, number>
}

function SlotRender({ pid, fallbackText, large, participantesById, campeoesByParticipanteId }: SlotRenderProps) {
  const fontSize = large ? '1.25rem' : '0.95rem'
  if (pid === null) {
    return <span style={{ color: 'var(--t4)', fontStyle: 'italic', fontSize }}>{fallbackText}</span>
  }
  const p = participantesById.get(pid)
  const pos = campeoesByParticipanteId?.get(pid)
  if (!p) return <span style={{ color: 'var(--t4)', fontSize }}>—</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize, color: 'var(--t1)' }}>
      {pos && <CampeaoBadge posicao={pos} large={large} />}
      <span>
        {p.nome}
        {p.subtitulo && <span style={{ fontSize: '0.85em', color: 'var(--t3)', marginLeft: 4 }}>— {p.subtitulo}</span>}
      </span>
    </span>
  )
}

type MatchCardProps = {
  match: Match
  large: boolean
  participantesById: Map<number, Participante>
  campeoesByParticipanteId?: Map<number, number>
  topFallback?: string
  bottomFallback?: string
}

function MatchCard({ match, large, participantesById, campeoesByParticipanteId, topFallback, bottomFallback }: MatchCardProps) {
  return (
    <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg" style={{ padding: large ? 12 : 8 }}>
      <div style={{ padding: '4px 0' }}>
        <SlotRender
          pid={match.top} fallbackText={topFallback ?? 'BYE'}
          large={large} participantesById={participantesById} campeoesByParticipanteId={campeoesByParticipanteId}
        />
      </div>
      <div style={{ borderTop: '1px solid var(--card-border)', margin: '4px 0' }} />
      <div style={{ padding: '4px 0' }}>
        <SlotRender
          pid={match.bottom} fallbackText={bottomFallback ?? 'BYE'}
          large={large} participantesById={participantesById} campeoesByParticipanteId={campeoesByParticipanteId}
        />
      </div>
    </div>
  )
}

function ByeCard({ pid, large, participantesById, campeoesByParticipanteId }: {
  pid: number | null
  large: boolean
  participantesById: Map<number, Participante>
  campeoesByParticipanteId?: Map<number, number>
}) {
  return (
    <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg" style={{ padding: large ? 12 : 8 }}>
      <div style={{ padding: '4px 0' }}>
        <SlotRender pid={pid} fallbackText="—" large={large} participantesById={participantesById} campeoesByParticipanteId={campeoesByParticipanteId} />
      </div>
      <div style={{ fontSize: large ? '0.85rem' : '0.75rem', color: 'var(--t3)', fontStyle: 'italic', textAlign: 'center', marginTop: 4 }}>
        avança direto
      </div>
    </div>
  )
}

export default function SorteioChaves({ resultado, participantesById, large = false, campeoesByParticipanteId }: Props) {
  // Fallback para sorteios pré-v1.18.0 (sem byePositions)
  if (!resultado.byePositions) {
    const rounds = buildBracketLegacy(resultado.slots)
    return (
      <div style={{ display: 'flex', gap: large ? 32 : 16, overflowX: 'auto', padding: large ? 16 : 8 }}>
        {rounds.map((roundMatches, r) => (
          <div key={r} style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'space-around',
            gap: large ? 16 : 8, minWidth: large ? 280 : 200, flexShrink: 0,
          }}>
            <div className="eyebrow text-[var(--t3)]" style={{ textAlign: 'center', marginBottom: 4 }}>
              {roundLabel(roundMatches.length, r)} · {roundMatches.length} {roundMatches.length === 1 ? 'match' : 'matches'}
            </div>
            {roundMatches.map(match => (
              <MatchCard key={match.id} match={match} large={large}
                participantesById={participantesById} campeoesByParticipanteId={campeoesByParticipanteId}
                topFallback={r === 0 ? 'BYE' : `Vencedor M${match.index * 2 + 1}`}
                bottomFallback={r === 0 ? 'BYE' : `Vencedor M${match.index * 2 + 2}`}
              />
            ))}
          </div>
        ))}
      </div>
    )
  }

  // Novo builder em 3 colunas: R1 / Avançam / Demais rodadas
  const r1 = buildR1FromPlanilha(resultado.slots, resultado.byePositions)
  const colMinWidth = large ? 280 : 200
  const gap = large ? 32 : 16
  const pad = large ? 16 : 8

  return (
    <div style={{ display: 'flex', gap, overflowX: 'auto', padding: pad }}>
      {/* Coluna 1: R1 */}
      {r1.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: large ? 16 : 8, minWidth: colMinWidth, flexShrink: 0 }}>
          <div className="eyebrow text-[var(--t3)]" style={{ textAlign: 'center', marginBottom: 4 }}>
            {roundLabel(r1.length, 0)} · {r1.length} {r1.length === 1 ? 'match' : 'matches'}
          </div>
          {r1.map(match => (
            <MatchCard key={match.id} match={match} large={large}
              participantesById={participantesById} campeoesByParticipanteId={campeoesByParticipanteId} />
          ))}
        </div>
      )}

      {/* Coluna 2: BYEs (avançam) */}
      {resultado.byePositions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: large ? 16 : 8, minWidth: colMinWidth, flexShrink: 0 }}>
          <div className="eyebrow text-[var(--t3)]" style={{ textAlign: 'center', marginBottom: 4 }}>
            Avançam (BYEs) · {resultado.byePositions.length}
          </div>
          {resultado.byePositions.map((pos, i) => (
            <ByeCard key={`bye-${i}`} pid={resultado.slots[pos - 1] ?? null} large={large}
              participantesById={participantesById} campeoesByParticipanteId={campeoesByParticipanteId} />
          ))}
        </div>
      )}

      {/* Coluna 3: Demais rodadas */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: large ? 16 : 8, minWidth: colMinWidth, flexShrink: 0 }}>
        <div className="eyebrow text-[var(--t3)]" style={{ textAlign: 'center', marginBottom: 4 }}>
          Demais rodadas
        </div>
        <div className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg" style={{ padding: large ? 16 : 12, textAlign: 'center', fontStyle: 'italic', color: 'var(--t3)', fontSize: large ? '1rem' : '0.85rem' }}>
          Conforme regulamento da modalidade
        </div>
      </div>
    </div>
  )
}
