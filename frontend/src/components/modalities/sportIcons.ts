// ─────────────────────────────────────────────────────────────
//  ProSports · ícones de modalidades
//  SVG line icons (viewBox 24×24, stroke currentColor) — um por esporte.
//  O resolvedor identifica esporte + gênero a partir do nome cru,
//  ex.: "Atletismo Feminino Livre" → { key: "atletismo", gender: "F" }.
// ─────────────────────────────────────────────────────────────

export type Gender = "F" | "M" | "L"; // Feminino · Masculino · Livre/Misto

export interface SportIcon {
  label: string;
  color: string; // cor sugerida do badge
  path: string; // conteúdo interno do <svg>
  keywords: string[]; // termos normalizados que identificam a modalidade
}

export const SPORT_ICONS: Record<string, SportIcon> = {
  atletismo: { label: "Atletismo", color: "#f97316", keywords: ["atletismo"], path: `<circle cx="16.5" cy="4.5" r="2"/><path d="M15 7 9.5 9.5l3.2 2.8.4 4.7"/><path d="m12.7 12.3-3.4 5.7"/><path d="M9.5 9.5 4.8 11"/><path d="m14.2 8.8 4 2.6"/>` },
  futebol: { label: "Futebol", color: "#10b981", keywords: ["futebol", "futbol"], path: `<circle cx="12" cy="12" r="8.5"/><path d="m12 7.5 3.2 2.3-1.2 3.8h-4L8.8 9.8z"/><path d="M12 7.5V3.5"/><path d="m15.2 9.8 3.6-1.1"/><path d="m13.9 13.6 2.2 3.1"/><path d="m10 13.6-2.2 3.1"/><path d="M8.8 9.8 5.2 8.7"/>` },
  futsal: { label: "Futsal", color: "#14b8a6", keywords: ["futsal"], path: `<circle cx="12" cy="10" r="6.3"/><path d="m12 6.6 2.3 1.7-.9 2.8h-2.8l-.9-2.8z"/><path d="M12 6.6V4.3"/><path d="m14.3 8.3 2.4-.7"/><path d="M9.7 8.3 7.3 7.6"/><path d="M4 20h16"/><path d="M9.2 20v-1.8h5.6V20"/>` },
  basquete: { label: "Basquete", color: "#ea580c", keywords: ["basquete", "basquetebol"], path: `<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17"/><path d="M3.5 12h17"/><path d="M5.8 5.8C8 8 8 16 5.8 18.2"/><path d="M18.2 5.8C16 8 16 16 18.2 18.2"/>` },
  volei: { label: "Voleibol", color: "#f59e0b", keywords: ["voleibol", "volei"], path: `<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a14 14 0 0 0 0 17"/><path d="M4.6 7a14 14 0 0 0 12.4 10.4"/><path d="M19.4 7a14 14 0 0 1-12.4 10.4"/>` },
  beach: { label: "Beach", color: "#0ea5e9", keywords: ["beach", "praia"], path: `<circle cx="10" cy="14.5" r="5"/><path d="M10 9.7a8 8 0 0 0 0 9.6"/><path d="M5.7 11.6a8 8 0 0 0 6 7.2"/><circle cx="18" cy="6.3" r="2"/><path d="M18 2.8v1.2M18 8.6v1.2M14.6 6.3h1.1M20.3 6.3h1.1M15.6 3.9l.8.8M19.6 8.3l.8.8M20.4 3.9l-.8.8M15.6 8.7l.8-.8"/>` },
  biribol: { label: "Biribol", color: "#06b6d4", keywords: ["biribol"], path: `<circle cx="12" cy="8.2" r="5"/><path d="M12 3.6a8 8 0 0 0 0 9.2"/><path d="M7.4 5.4a8 8 0 0 0 5.6 7"/><path d="M3 17.5c1.5-1.4 3-1.4 4.5 0s3 1.4 4.5 0 3-1.4 4.5 0"/><path d="M3 20.6c1.5-1.4 3-1.4 4.5 0s3 1.4 4.5 0 3-1.4 4.5 0"/>` },
  handebol: { label: "Handebol", color: "#ef4444", keywords: ["handebol", "handball"], path: `<circle cx="13.2" cy="11" r="6.3"/><path d="M13.2 4.7v12.6"/><path d="M6.9 11h12.6"/><path d="m4 6.6 2 .9"/><path d="m3 10.6 2.2.4"/><path d="m4 14.6 2-.5"/>` },
  tenis: { label: "Tênis", color: "#84cc16", keywords: ["tenis"], path: `<circle cx="8.8" cy="8.8" r="5.2"/><path d="m5.4 6.4 6.8 4.8"/><path d="m6.4 12.2 4.8-6.8"/><path d="m12.4 12.4 5.4 5.4"/><circle cx="18.3" cy="6" r="1.7"/>` },
  badminton: { label: "Badminton", color: "#3b82f6", keywords: ["badminton"], path: `<path d="M9.2 13.7 6.8 4.2l5.2 2 5.2-2-2.4 9.5"/><path d="M9.2 13.7a2.8 2.8 0 0 0 5.6 0"/><path d="M12 6.2v7.5"/><path d="m9.6 5.4.9 8.1"/><path d="m14.4 5.4-.9 8.1"/>` },
  ciclismo: { label: "Ciclismo", color: "#2563eb", keywords: ["ciclismo"], path: `<circle cx="6" cy="15.5" r="3.5"/><circle cx="18" cy="15.5" r="3.5"/><path d="m6 15.5 3.2-6h5.3l-3.2 6"/><path d="M9.2 9.5 10.6 7h2.4"/><path d="m14.5 9.5 3.5 6"/><path d="M9.5 7h4"/>` },
  natacao: { label: "Natação", color: "#1d4ed8", keywords: ["natacao"], path: `<circle cx="16.5" cy="6" r="1.9"/><path d="M3 11.5c1.6 0 1.6-1.3 3.2-1.3S7.8 11.5 9.4 11.5l5-3.2 3.3 1.1"/><path d="M3 16.3c1.5 0 1.5-1.3 3-1.3s1.5 1.3 3 1.3 1.5-1.3 3-1.3 1.5 1.3 3 1.3 1.5-1.3 3-1.3"/><path d="M3 20c1.5 0 1.5-1.3 3-1.3s1.5 1.3 3 1.3 1.5-1.3 3-1.3 1.5 1.3 3 1.3 1.5-1.3 3-1.3"/>` },
  judo: { label: "Judô", color: "#4f46e5", keywords: ["judo"], path: `<path d="M4.5 9c3 1.6 5 1.6 7.5 0"/><path d="M12 9c2.5 1.6 4.5 1.6 7.5 0"/><rect x="9" y="7.8" width="6" height="5.4" rx="1.2"/><path d="m10.2 13.2-2 4.8"/><path d="m13.8 13.2 2 4.8"/>` },
  karate: { label: "Karatê", color: "#7c3aed", keywords: ["karate"], path: `<circle cx="12" cy="5" r="2.1"/><path d="M12 7.1v6"/><path d="m12 9-6 1.2"/><path d="m12 9.4 6-2.2"/><path d="m12 13.1-3.2 5.9"/><path d="m12 13.1 3.2 5.9"/>` },
  taekwondo: { label: "Taekwondo", color: "#9333ea", keywords: ["taekwondo"], path: `<circle cx="8.5" cy="5" r="2.1"/><path d="M8.5 7.1v5"/><path d="m8.5 9-3.8 3"/><path d="m8.5 9.2 3.8-1"/><path d="m8.5 12-2 7"/><path d="m8.5 12 9.5-3.2"/>` },
  capoeira: { label: "Capoeira", color: "#d97706", keywords: ["capoeira"], path: `<circle cx="12" cy="17.5" r="2.1"/><path d="M12 15.4v-4.6"/><path d="m12 12.8-4-1.8"/><path d="m12 12.8 4-1.8"/><path d="m12 10.8-3-5"/><path d="m12 10.8 4-4.2"/>` },
  ginastica: { label: "Ginástica", color: "#c026d3", keywords: ["ginastica"], path: `<path d="m4 20 3.5-3.5"/><path d="M7.5 16.5c2.5 0 2.5-3 5-3s2.5 3 5 2.5"/><path d="M17.5 16c-2.2.5-2.2 3.6 0 3.6"/>` },
  danca: { label: "Dança", color: "#db2777", keywords: ["danca"], path: `<circle cx="13.5" cy="5" r="2"/><path d="m13.5 7-1.8 5 1 4.5"/><path d="m11.7 12-3 5"/><path d="m13.5 8 4-2.8"/><path d="m12.4 9.2-4.4 1.8"/>` },
  coreografia: { label: "Coreografia", color: "#8b5cf6", keywords: ["coreografia"], path: `<path d="M9 18V6.2l8-1.8v11"/><ellipse cx="6.8" cy="18" rx="2.2" ry="1.8" fill="currentColor" stroke="none"/><ellipse cx="14.8" cy="15.4" rx="2.2" ry="1.8" fill="currentColor" stroke="none"/>` },
  bocha: { label: "Bocha", color: "#16a34a", keywords: ["bocha"], path: `<circle cx="9.5" cy="14" r="5"/><circle cx="17.7" cy="8.4" r="2.2"/><path d="M6.8 11.8c1-1.5 3.6-1.8 5.3.2"/>` },
  malha: { label: "Malha", color: "#ca8a04", keywords: ["malha"], path: `<path d="M12 5.2v10.4"/><path d="M10 5.2h4"/><ellipse cx="12" cy="16.6" rx="7" ry="2.3"/><path d="M5 19c1.6 1 3.6 1.6 7 1.6s5.4-.6 7-1.6"/>` },
  damas: { label: "Damas", color: "#52525b", keywords: ["damas"], path: `<ellipse cx="12" cy="7.5" rx="6.2" ry="2.2"/><path d="M5.8 7.5v2.6c0 1.2 2.8 2.2 6.2 2.2s6.2-1 6.2-2.2V7.5"/><path d="M5.8 10.6v2.6c0 1.2 2.8 2.2 6.2 2.2s6.2-1 6.2-2.2"/><path d="M5.8 13.7v2.6c0 1.2 2.8 2.2 6.2 2.2s6.2-1 6.2-2.2v-2.6"/>` },
  xadrez: { label: "Xadrez", color: "#475569", keywords: ["xadrez"], path: `<circle cx="12" cy="5.5" r="2.3"/><path d="M9.8 8c0 1.6 1.2 2 1.2 3.7L9.5 16.5h5L13 11.7c0-1.7 1.2-2.1 1.2-3.7"/><path d="M7.8 16.5h8.4l1.2 3.5H6.6z"/>` },
  domino: { label: "Dominó", color: "#57534e", keywords: ["domino"], path: `<rect x="7.5" y="3.5" width="9" height="17" rx="2"/><path d="M7.5 12h9"/><circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="10" cy="16.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="14" cy="16.5" r="1.1" fill="currentColor" stroke="none"/>` },
  truco: { label: "Truco", color: "#f43f5e", keywords: ["truco"], path: `<rect x="5.5" y="6" width="8" height="11.5" rx="1.8" transform="rotate(-13 9.5 11.7)"/><rect x="10.5" y="5.5" width="8" height="11.5" rx="1.8" transform="rotate(11 14.5 11.2)"/><path d="M14.6 10.1c-.9-1.3-2.6-.2-1.4 1.2l1.4 1.5 1.3-1.6c1.1-1.4-.6-2.4-1.3-1.1z" fill="currentColor" stroke="none"/>` },
  buraco: { label: "Buraco", color: "#ec4899", keywords: ["buraco"], path: `<g transform="rotate(-22 12 19)"><rect x="8.5" y="7.5" width="7" height="10.5" rx="1.5"/></g><rect x="8.5" y="6.5" width="7" height="10.5" rx="1.5"/><g transform="rotate(22 12 19)"><rect x="8.5" y="7.5" width="7" height="10.5" rx="1.5"/></g>` },
};

/** Ícone genérico para modalidades sem correspondência. */
export const FALLBACK_ICON: SportIcon = {
  label: "Modalidade",
  color: "#10b981",
  keywords: [],
  path: `<path d="M6 3h9l5 5v13H6z"/><path d="M14 3v6h6"/>`,
};

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Identifica o esporte a partir do nome cru da modalidade. */
export function resolveSport(name: string): { key: string; icon: SportIcon } {
  const n = normalize(name);
  let best: { key: string; len: number } | null = null;
  for (const [key, icon] of Object.entries(SPORT_ICONS)) {
    for (const kw of icon.keywords) {
      if (n.includes(kw) && (!best || kw.length > best.len)) {
        best = { key, len: kw.length };
      }
    }
  }
  return best
    ? { key: best.key, icon: SPORT_ICONS[best.key] }
    : { key: "fallback", icon: FALLBACK_ICON };
}

/** Detecta o gênero. "Livre" no nome é categoria de idade, não gênero. */
export function resolveGender(name: string): Gender {
  const n = normalize(name);
  if (n.includes("feminino")) return "F";
  if (n.includes("masculino")) return "M";
  return "L"; // livre / misto / sem indicação
}
