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
  campeoesPids: readonly number[] = [],
): GruposResultado {
  // Sequência de tamanhos embaralhada (igual ao atual)
  const sizes: number[] = [
    ...Array(regra.grupos_3_componentes).fill(3),
    ...Array(regra.grupos_4_componentes).fill(4),
  ]
  const shuffledSizes = shuffleSeeded(sizes, `${seed}:sizes`)
  const numGrupos = shuffledSizes.length

  // Campeões que viram cabeça de grupo (até numGrupos)
  const cabecas = campeoesPids.slice(0, numGrupos)
  const cabecasSet = new Set<number>(cabecas)

  // Outros = participantes que NÃO são cabeças (incluindo campeões excedentes)
  const outros = participantes.filter(pid => !cabecasSet.has(pid))
  const outrosShuffled = shuffleSeeded(outros, seed)

  // Montar grupos
  const grupos: { letra: string; participantes: number[] }[] = []
  let cursor = 0
  for (let g = 0; g < numGrupos; g++) {
    const tam = shuffledSizes[g]
    const grupoParticipantes: number[] = []
    if (g < cabecas.length) {
      grupoParticipantes.push(cabecas[g])
    } else {
      grupoParticipantes.push(outrosShuffled[cursor++])
    }
    for (let j = 1; j < tam; j++) {
      grupoParticipantes.push(outrosShuffled[cursor++])
    }
    grupos.push({
      letra: String.fromCharCode(65 + g),
      participantes: grupoParticipantes,
    })
  }

  return {
    regra_id: regra.id,
    classificados_por_grupo: regra.numero_classificados,
    grupos,
  }
}

export type MatchRef = string  // 'P{n}' | 'V:J{x}' | 'L:J{x}'

export type MatchesGraph = {
  matches: Array<{
    id: string
    round: number
    top: MatchRef
    bottom: MatchRef
  }>
  final: string
  thirdPlace: string | null
}

export type BracketResultado = {
  size: number
  slots: (number | null)[]
  byePositions: number[]
  matchesGraph: MatchesGraph | null
}

export type RegraChaves = {
  posicao_primeiro_cabeca: number
  posicao_segundo_cabeca: number
  posicao_terceiro_cabeca: number
  posicao_quarto_cabeca: number
}

export type RegraBracket = {
  numero_inscrito: number
  posicoes_bye: number[]
}

export function drawBracket(
  participantes: readonly number[],
  regra: RegraChaves,
  regraBracket: RegraBracket,
  matchesGraph: MatchesGraph | null,
  seed: string,
  campeoesPids: readonly number[] = [],
): BracketResultado {
  const N = participantes.length
  const slots: (number | null)[] = new Array(N).fill(null)

  const cabecasPos = [
    regra.posicao_primeiro_cabeca,
    regra.posicao_segundo_cabeca,
    regra.posicao_terceiro_cabeca,
    regra.posicao_quarto_cabeca,
  ].filter(p => p > 0)

  const usedPids = new Set<number>()
  for (let i = 0; i < cabecasPos.length && i < campeoesPids.length; i++) {
    const pid = campeoesPids[i]
    if (cabecasPos[i] >= 1 && cabecasPos[i] <= N) {
      slots[cabecasPos[i] - 1] = pid
      usedPids.add(pid)
    }
  }

  const restantes = participantes.filter(p => !usedPids.has(p))
  const shuffled = shuffleSeeded(restantes, seed)

  let idx = 0
  for (let i = 0; i < N; i++) {
    if (slots[i] === null && idx < shuffled.length) {
      slots[i] = shuffled[idx++]
    }
  }

  const byePositions = [...regraBracket.posicoes_bye].sort((a, b) => a - b)
  return { size: N, slots, byePositions, matchesGraph }
}

export type OrdemResultado = { ordem: number[] }

export function shuffleOrder(participantes: readonly number[], seed: string): OrdemResultado {
  return { ordem: shuffleSeeded(participantes, seed) }
}
