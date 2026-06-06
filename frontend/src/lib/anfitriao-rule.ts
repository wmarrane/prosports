// Espelho client-side da regra applyAnfitriaoRule do backend
// (backend/src/modules/sorteios/sorteios.service.ts).
// Mantém o comportamento idêntico: quando aplicável, injeta o anfitrião
// no índice alvo (chaves=3, 3 grupos=2, 4+ grupos=3), preservando posições
// anteriores ocupadas por campeões melhor colocados.
export function applyAnfitriaoRuleFront(
  campeoesPidsInscritos: number[],
  anfitriaoPid: number | null,
  anfitriaoInscrito: boolean,
  consideraAnfitriao: boolean,
  tipo: 'chaves' | 'grupos',
  quantidadeGrupos?: number,
): number[] {
  if (!consideraAnfitriao || anfitriaoPid === null || !anfitriaoInscrito) {
    return campeoesPidsInscritos
  }
  let targetIdx: number
  if (tipo === 'chaves') {
    targetIdx = 3
  } else {
    if (quantidadeGrupos === undefined || quantidadeGrupos < 3) return campeoesPidsInscritos
    targetIdx = quantidadeGrupos === 3 ? 2 : 3
  }
  const currentIdx = campeoesPidsInscritos.indexOf(anfitriaoPid)
  if (currentIdx >= 0 && currentIdx < targetIdx) return campeoesPidsInscritos
  const sem = campeoesPidsInscritos.filter((p) => p !== anfitriaoPid)
  const out = [...sem]
  out.splice(targetIdx, 0, anfitriaoPid)
  return out
}

export function grupoLetra(idx: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + idx)
}
