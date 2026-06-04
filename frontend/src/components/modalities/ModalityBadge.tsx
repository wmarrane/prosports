import { resolveSport, resolveGender, type Gender } from "./sportIcons";

interface ModalityBadgeProps {
  /** Nome cru da modalidade, ex.: "Atletismo Feminino Livre" */
  name: string;
  /** Tamanho do badge em px (default 56) */
  size?: number;
  /** Mostra o marcador de gênero no canto (♀ / ♂) */
  showGender?: boolean;
  /** Sobrescreve a cor sugerida do esporte */
  color?: string;
  className?: string;
}

const GENDER_GLYPH: Record<Gender, string> = { F: "♀", M: "♂", L: "" };

/** Escurece/clareia um hex (#rrggbb) por uma porcentagem. */
function shade(hex: string, percent: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (t: number) => Math.max(0, Math.min(255, Math.round(t + (t * percent) / 100)));
  return `#${((f(r) << 16) | (f(g) << 8) | f(b)).toString(16).padStart(6, "0")}`;
}

export default function ModalityBadge({
  name,
  size = 56,
  showGender = false,
  color,
  className = "",
}: ModalityBadgeProps) {
  const { icon } = resolveSport(name);
  const gender = resolveGender(name);
  const base = color ?? icon.color;
  const glyph = GENDER_GLYPH[gender];

  return (
    <div
      className={`relative grid place-items-center shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: `linear-gradient(150deg, ${base}, ${shade(base, -22)})`,
        boxShadow: `0 12px 22px -12px ${base}`,
      }}
      role="img"
      aria-label={icon.label}
      title={icon.label}
    >
      <svg
        width={size * 0.54}
        height={size * 0.54}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "#fff" }}
        dangerouslySetInnerHTML={{ __html: icon.path }}
      />
      {showGender && glyph && (
        <span
          className="absolute grid place-items-center rounded-full bg-white font-bold leading-none"
          style={{
            right: -size * 0.08,
            bottom: -size * 0.08,
            width: size * 0.36,
            height: size * 0.36,
            fontSize: size * 0.22,
            color: base,
            boxShadow: "0 2px 6px rgba(16,22,47,.22)",
          }}
        >
          {glyph}
        </span>
      )}
    </div>
  );
}
