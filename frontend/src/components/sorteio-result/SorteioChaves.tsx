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

function buildBracket(slots: readonly (number | null)[]): Match[][] {
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
        id: `R0M${i / 2}`,
        round: 0,
        index: i / 2,
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

function roundLabel(matchesNesta: number, roundIdx: number): string {
  if (matchesNesta === 1) return 'Final'
  if (matchesNesta === 2) return 'Semifinal'
  if (matchesNesta === 4) return 'Quartas'
  if (matchesNesta === 8) return 'Oitavas'
  return `${roundIdx + 1}ª Rodada`
}

type SlotRenderProps = {
  pid: number | null
  isRoundZero: boolean
  matchIndex: number
  large: boolean
  participantesById: Map<number, Participante>
  campeoesByParticipanteId?: Map<number, number>
}

function SlotRender({ pid, isRoundZero, matchIndex, large, participantesById, campeoesByParticipanteId }: SlotRenderProps) {
  const fontSize = large ? '1.25rem' : '0.95rem'
  if (pid === null) {
    return (
      <span style={{ color: 'var(--t4)', fontStyle: 'italic', fontSize }}>
        {isRoundZero ? 'BYE' : `Vencedor M${matchIndex + 1}`}
      </span>
    )
  }
  const p = participantesById.get(pid)
  const pos = campeoesByParticipanteId?.get(pid)
  if (!p) {
    return <span style={{ color: 'var(--t4)', fontSize }}>—</span>
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize, color: 'var(--t1)' }}>
      {pos && <CampeaoBadge posicao={pos} large={large} />}
      <span>
        {p.nome}
        {p.subtitulo && (
          <span style={{ fontSize: '0.85em', color: 'var(--t3)', marginLeft: 4 }}>— {p.subtitulo}</span>
        )}
      </span>
    </span>
  )
}

type MatchCardProps = {
  match: Match
  large: boolean
  participantesById: Map<number, Participante>
  campeoesByParticipanteId?: Map<number, number>
}

function MatchCard({ match, large, participantesById, campeoesByParticipanteId }: MatchCardProps) {
  const isRoundZero = match.round === 0
  return (
    <div
      className="bg-[var(--card-bg-2)] border border-[var(--card-border)] rounded-lg"
      style={{ padding: large ? 12 : 8 }}
    >
      <div style={{ padding: '4px 0' }}>
        <SlotRender
          pid={match.top}
          isRoundZero={isRoundZero}
          matchIndex={match.index * 2}
          large={large}
          participantesById={participantesById}
          campeoesByParticipanteId={campeoesByParticipanteId}
        />
      </div>
      <div style={{ borderTop: '1px solid var(--card-border)', margin: '4px 0' }} />
      <div style={{ padding: '4px 0' }}>
        <SlotRender
          pid={match.bottom}
          isRoundZero={isRoundZero}
          matchIndex={match.index * 2 + 1}
          large={large}
          participantesById={participantesById}
          campeoesByParticipanteId={campeoesByParticipanteId}
        />
      </div>
    </div>
  )
}

export default function SorteioChaves({ resultado, participantesById, large = false, campeoesByParticipanteId }: Props) {
  const rounds = buildBracket(resultado.slots)

  return (
    <div
      style={{
        display: 'flex',
        gap: large ? 32 : 16,
        overflowX: 'auto',
        padding: large ? 16 : 8,
      }}
    >
      {rounds.map((roundMatches, r) => (
        <div
          key={r}
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-around',
            gap: large ? 16 : 8,
            minWidth: large ? 280 : 200,
            flexShrink: 0,
          }}
        >
          <div className="eyebrow text-[var(--t3)]" style={{ textAlign: 'center', marginBottom: 4 }}>
            {roundLabel(roundMatches.length, r)} · {roundMatches.length} {roundMatches.length === 1 ? 'match' : 'matches'}
          </div>
          {roundMatches.map(match => (
            <MatchCard
              key={match.id}
              match={match}
              large={large}
              participantesById={participantesById}
              campeoesByParticipanteId={campeoesByParticipanteId}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
