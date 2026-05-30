const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' } as const
const LABELS = {
  1: '1º colocado no ano anterior',
  2: '2º colocado no ano anterior',
  3: '3º colocado no ano anterior',
} as const

type Props = {
  posicao: 1 | 2 | 3
  large?: boolean
}

export default function CampeaoBadge({ posicao, large = false }: Props) {
  return (
    <span
      title={LABELS[posicao]}
      className={large ? 'text-2xl' : 'text-base'}
      style={{ display: 'inline-block', lineHeight: 1 }}
    >
      {MEDALS[posicao]}
    </span>
  )
}
