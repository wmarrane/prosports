import type { CSSProperties } from 'react'

type Variant = 'horizontal-cor' | 'horizontal-branco' | 'simbolo'

type Props = {
  variant?: Variant
  height?: number
  style?: CSSProperties
  className?: string
  title?: string
}

const FONT = 'Liberation Sans, DejaVu Sans, Arial, sans-serif'

export default function LogoMontana({
  variant = 'horizontal-cor',
  height = 40,
  style,
  className,
  title = 'Montana Eventos',
}: Props) {
  if (variant === 'simbolo') {
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
          <path d="M16 27.71 A32 32 0 1 1 30.07 -10.94" stroke="#1B3A5B" strokeWidth="6" />
          <path d="M43.33 7.64 A44 44 0 1 1 15.05 -41.35" stroke="#20578A" strokeWidth="7" />
          <path d="M42.90 -36.0 A56 56 0 1 1 -28.0 -48.5" stroke="#2E7DBE" strokeWidth="8" />
          <path d="M0 -68 A68 68 0 1 1 -66.96 -11.80" stroke="#5BA3D9" strokeWidth="9" />
          <circle cx="0" cy="-68" r="6" fill="#1B3A5B" />
        </g>
      </svg>
    )
  }

  const branco = variant === 'horizontal-branco'
  const symbolColors = branco
    ? ['#FFFFFF', '#D4E2F1', '#A9C8E8', '#7FB0DA']
    : ['#1B3A5B', '#20578A', '#2E7DBE', '#5BA3D9']
  const dotFill = branco ? '#FFFFFF' : '#1B3A5B'
  const mainText = branco ? '#FFFFFF' : '#1B3A5B'
  const subText = branco ? '#9CC2E5' : '#2E7DBE'
  const tinyText = branco ? '#C3CCD3' : '#6B7884'
  const tagText = branco ? '#AEBECE' : '#8C99A4'

  // aspect 620:180 ≈ 3.44
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
        <path d="M16 27.71 A32 32 0 1 1 30.07 -10.94" stroke={symbolColors[0]} strokeWidth="6" />
        <path d="M43.33 7.64 A44 44 0 1 1 15.05 -41.35" stroke={symbolColors[1]} strokeWidth="7" />
        <path d="M42.90 -36.0 A56 56 0 1 1 -28.0 -48.5" stroke={symbolColors[2]} strokeWidth="8" />
        <path d="M0 -68 A68 68 0 1 1 -66.96 -11.80" stroke={symbolColors[3]} strokeWidth="9" />
        <circle cx="0" cy="-68" r="6" fill={dotFill} />
      </g>
      <text x="205" y="86" fontFamily={FONT} fontSize="46" fontWeight="bold" letterSpacing="1" fill={mainText}>MONTANA</text>
      <text x="207" y="115" fontFamily={FONT} fontSize="19" letterSpacing="8.5" fill={subText}>EVENTOS</text>
      <text x="207" y="144" fontFamily={FONT} fontSize="12" letterSpacing="2.2" fill={tinyText}>CONGRESSOS ESPORTIVOS · MULTIMODALIDADES</text>
      <text x="208" y="163" fontFamily={FONT} fontSize="11" fill={tagText}>Há mais de 20 anos pelo Brasil</text>
    </svg>
  )
}
