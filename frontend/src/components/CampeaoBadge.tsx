const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

type Props = {
  posicao: number
  large?: boolean
}

export default function CampeaoBadge({ posicao, large = false }: Props) {
  const title = `${posicao}º colocado no ano anterior`
  const medal = MEDALS[posicao]

  if (medal) {
    return (
      <span
        title={title}
        className={large ? 'text-2xl' : 'text-base'}
        style={{ display: 'inline-block', lineHeight: 1 }}
      >
        {medal}
      </span>
    )
  }

  // 4º a 12º — círculo discreto com o número ordinal
  const size = large ? 32 : 22
  const fontSize = large ? 13 : 10
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--card-bg-2)',
        border: '1px solid var(--card-border)',
        color: 'var(--t2)',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize,
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {posicao}º
    </span>
  )
}
