import { Home } from 'lucide-react'

type Props = {
  large?: boolean
}

/**
 * Badge visual para marcar o participante anfitrião (cidade sede) do evento.
 * Quadrado verde com ícone de casa. Usado nas telas de sorteio, inscrições
 * e bracket para identificar de relance quem é o anfitrião.
 */
export default function AnfitriaoBadge({ large = false }: Props) {
  const size = large ? 28 : 22
  const iconSize = large ? 16 : 12
  return (
    <span
      style={{
        width: size, height: size, borderRadius: 6,
        background: 'linear-gradient(135deg, #0d9488 0%, #14b88a 100%)',
        color: '#fff',
        display: 'inline-grid', placeItems: 'center',
        flexShrink: 0,
        boxShadow: '0 2px 6px -2px rgba(13,148,136,0.5)',
      }}
      title="Anfitrião do evento"
    >
      <Home size={iconSize} />
    </span>
  )
}
