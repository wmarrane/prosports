function mulberry32(seed: number) {
  return function() {
    let t = (seed += 0x6D2B79F5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seedToInt(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

export function shuffleSeeded<T>(arr: readonly T[], seed: string): T[] {
  const rng = mulberry32(seedToInt(seed))
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

type RegraGrupos = {
  id: number
  quantidade_grupos: number
  grupos_3_componentes: number
  grupos_4_componentes: number
  numero_classificados: number
}

export type GruposResultado = {
  regra_id: number
  classificados_por_grupo: number
  grupos: { letra: string; participantes: number[] }[]
}

export function drawGroups(
  participantes: readonly number[],
  regra: RegraGrupos,
  seed: string,
): GruposResultado {
  const shuffled = shuffleSeeded(participantes, seed)
  // Ordem dos tamanhos (quais grupos têm 3 vs 4 componentes) também é aleatória.
  // Sub-seed independente para que dois embaralhamentos derivados da mesma seed
  // não fiquem correlacionados.
  const sizes: number[] = [
    ...Array(regra.grupos_3_componentes).fill(3),
    ...Array(regra.grupos_4_componentes).fill(4),
  ]
  const shuffledSizes = shuffleSeeded(sizes, `${seed}:sizes`)
  const grupos: { letra: string; participantes: number[] }[] = []
  let i = 0
  for (let g = 0; g < shuffledSizes.length; g++) {
    const tam = shuffledSizes[g]
    grupos.push({
      letra: String.fromCharCode(65 + g),
      participantes: shuffled.slice(i, i + tam),
    })
    i += tam
  }
  return {
    regra_id: regra.id,
    classificados_por_grupo: regra.numero_classificados,
    grupos,
  }
}

export type BracketResultado = {
  size: number
  slots: (number | null)[]
}

export function drawBracket(participantes: readonly number[], seed: string): BracketResultado {
  const n = participantes.length
  const size = n <= 1 ? 1 : 2 ** Math.ceil(Math.log2(n))
  const padded: (number | null)[] = [...participantes, ...Array(size - n).fill(null)]
  const shuffled = shuffleSeeded(padded, seed)
  return { size, slots: shuffled }
}

export type OrdemResultado = { ordem: number[] }

export function shuffleOrder(participantes: readonly number[], seed: string): OrdemResultado {
  return { ordem: shuffleSeeded(participantes, seed) }
}
