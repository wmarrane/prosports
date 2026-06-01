import type { CSSProperties } from 'react'

type Variant = 'horizontal-cor' | 'horizontal-branco' | 'simbolo' | 'simbolo-branco'

type Props = {
  variant?: Variant
  height?: number
  style?: CSSProperties
  className?: string
  title?: string
}

const FONT = 'Liberation Sans, DejaVu Sans, Arial, sans-serif'

const SIMBOLO_URL = '/montana/simbolo.png'
const HORIZONTAL_URL = '/montana/horizontal.png'
// aspect do horizontal V3: 1120 x 440 ≈ 2.545
const HORIZONTAL_ASPECT = 1120 / 440

export default function LogoMontana({
  variant = 'horizontal-cor',
  height = 40,
  style,
  className,
  title = 'Montana Eventos',
}: Props) {
  // Variantes "cor" (V3) usam as imagens novas em PNG. As variantes
  // "branco" continuam como SVG inline desenhado proceduralmente para
  // contraste sobre fundos escuros (login hero, etc).
  if (variant === 'simbolo') {
    return (
      <img
        src={SIMBOLO_URL}
        alt={title}
        title={title}
        height={height}
        width={height}
        style={{ display: 'block', height, width: height, objectFit: 'contain', ...style }}
        className={className}
      />
    )
  }

  if (variant === 'horizontal-cor') {
    const width = Math.round(height * HORIZONTAL_ASPECT)
    return (
      <img
        src={HORIZONTAL_URL}
        alt={title}
        title={title}
        height={height}
        width={width}
        style={{ display: 'block', height, width, objectFit: 'contain', ...style }}
        className={className}
      />
    )
  }

  if (variant === 'simbolo-branco') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 170 170"
        height={height}
        width={height}
        style={style}
        className={className}
        role="img"
        aria-label={title}
      >
        <title>{title}</title>
        <g transform="translate(85,87)" fill="none" strokeLinecap="round">
          <path d="M16 27.71 A32 32 0 1 1 30.07 -10.94" stroke="#FFFFFF" strokeWidth="6" />
          <path d="M43.33 7.64 A44 44 0 1 1 15.05 -41.35" stroke="#D4E2F1" strokeWidth="7" />
          <path d="M42.90 -36.0 A56 56 0 1 1 -28.0 -48.5" stroke="#A9C8E8" strokeWidth="8" />
          <path d="M0 -68 A68 68 0 1 1 -66.96 -11.80" stroke="#7FB0DA" strokeWidth="9" />
          <circle cx="0" cy="-68" r="6" fill="#FFFFFF" />
        </g>
      </svg>
    )
  }

  // horizontal-branco (mantém SVG procedural para uso em fundos escuros)
  const width = Math.round(height * (620 / 180))
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 620 180"
      height={height}
      width={width}
      style={style}
      className={className}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <g transform="translate(95,92)" fill="none" strokeLinecap="round">
        <path d="M16 27.71 A32 32 0 1 1 30.07 -10.94" stroke="#FFFFFF" strokeWidth="6" />
        <path d="M43.33 7.64 A44 44 0 1 1 15.05 -41.35" stroke="#D4E2F1" strokeWidth="7" />
        <path d="M42.90 -36.0 A56 56 0 1 1 -28.0 -48.5" stroke="#A9C8E8" strokeWidth="8" />
        <path d="M0 -68 A68 68 0 1 1 -66.96 -11.80" stroke="#7FB0DA" strokeWidth="9" />
        <circle cx="0" cy="-68" r="6" fill="#FFFFFF" />
      </g>
      <text x="205" y="86" fontFamily={FONT} fontSize="46" fontWeight="bold" letterSpacing="1" fill="#FFFFFF">MONTANA</text>
      <text x="207" y="115" fontFamily={FONT} fontSize="19" letterSpacing="8.5" fill="#9CC2E5">EVENTOS</text>
      <text x="207" y="144" fontFamily={FONT} fontSize="12" letterSpacing="2.2" fill="#C3CCD3">CONGRESSOS ESPORTIVOS · MULTIMODALIDADES</text>
      <text x="208" y="163" fontFamily={FONT} fontSize="11" fill="#AEBECE">Há mais de 20 anos pelo Brasil</text>
    </svg>
  )
}
