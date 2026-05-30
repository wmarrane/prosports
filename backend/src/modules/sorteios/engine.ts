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

export type BracketResultado = {
  size: number
  slots: (number | null)[]
}

export type RegraChaves = {
  posicao_primeiro_cabeca: number
  posicao_segundo_cabeca: number
  posicao_terceiro_cabeca: number
  posicao_quarto_cabeca: number
}

export function drawBracket(
  participantes: readonly number[],
  regra: RegraChaves,
  seed: string,
  campeoesPids: readonly number[] = [],
): BracketResultado {
  const n = participantes.length
  const slots: (number | null)[] = new Array(n).fill(null)

  // Mapear cabeças nas posições da regra (até 4)
  const posicoes = [
    regra.posicao_primeiro_cabeca,
    regra.posicao_segundo_cabeca,
    regra.posicao_terceiro_cabeca,
    regra.posicao_quarto_cabeca,
  ]
  for (let i = 0; i < 4; i++) {
    const pos = posicoes[i]
    const pid = campeoesPids[i]
    if (pos === 0 || pid === undefined) continue
    if (pos < 1 || pos > n) continue
    slots[pos - 1] = pid
  }

  // Outros = participantes que NÃO foram colocados como cabeça
  const colocadosSet = new Set<number>(slots.filter((s): s is number => s !== null))
  const outros = participantes.filter(pid => !colocadosSet.has(pid))
  const outrosShuffled = shuffleSeeded(outros, seed)

  // Preencher slots vazios em ordem
  let cursor = 0
  for (let j = 0; j < n; j++) {
    if (slots[j] === null) {
      slots[j] = outrosShuffled[cursor++]
    }
  }

  return { size: n, slots }
}

export type OrdemResultado = { ordem: number[] }

export function shuffleOrder(participantes: readonly number[], seed: string): OrdemResultado {
  return { ordem: shuffleSeeded(participantes, seed) }
}
