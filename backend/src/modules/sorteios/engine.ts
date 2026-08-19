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

export type MetadeChave = 'cima' | 'baixo'

export type Metades = { cima: Set<number>; baixo: Set<number> }

/**
 * Metades da chave lidas do DESENHO, não do número de inscritos: cada lado da
 * final é uma metade. É isso que garante a promessa da regra — quem está numa
 * metade só encontra a outra na final.
 *
 * Não use ⌈N/2⌉: nas planilhas CHAVES CT o participante extra das chaves
 * ímpares fica embaixo em 33 dos 38 tamanhos (N=7 é 3/4, N=19 é 9/10).
 *
 * A metade que contém a posição 1 é a "de cima". O jogo de 3º lugar não
 * participa: o caminho é percorrido a partir da final.
 */
export function metadesDoGrafo(graph: MatchesGraph): Metades {
  const byId = new Map(graph.matches.map(m => [m.id, m]))

  const posicoes = (ref: MatchRef): Set<number> => {
    if (ref === 'BYE') return new Set()
    if (ref.startsWith('P')) return new Set([Number(ref.slice(1))])
    const alvo = byId.get(ref.split(':')[1])
    if (!alvo) return new Set()
    const out = posicoes(alvo.top)
    for (const p of posicoes(alvo.bottom)) out.add(p)
    return out
  }

  const final = byId.get(graph.final)
  if (!final) {
    throw Object.assign(new Error('Desenho da chave sem jogo final.'), { status: 400 })
  }
  const a = posicoes(final.top)
  const b = posicoes(final.bottom)
  return a.has(1) ? { cima: a, baixo: b } : { cima: b, baixo: a }
}

export type BracketResultado = {
  size: number
  slots: (number | null)[]
  byePositions: number[]
  matchesGraph: MatchesGraph | null
  /** Pids de cabeças cuja metade foi descartada — a posição de cabeça prevalece. */
  metadesIgnoradas: number[]
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
  opts: { metadePorPid?: ReadonlyMap<number, MetadeChave | null> } = {},
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
  const headPositions = new Map<number, number>()
  for (let i = 0; i < cabecasPos.length && i < campeoesPids.length; i++) {
    const pid = campeoesPids[i]
    if (cabecasPos[i] >= 1 && cabecasPos[i] <= N) {
      slots[cabecasPos[i] - 1] = pid
      usedPids.add(pid)
      headPositions.set(pid, cabecasPos[i])
    }
  }

  const restantes = participantes.filter(p => !usedPids.has(p))
  const metadePorPid = opts.metadePorPid
  const metadeDe = (pid: number): MetadeChave | null => metadePorPid?.get(pid) ?? null

  // Cabeça prevalece: quem já tem posição fixa tem a metade descartada — mas só
  // entra na lista quando dá pra confirmar que o pedido não foi atendido. Sem
  // matchesGraph não há como verificar, então mantém a marcação otimista.
  const marcadosComPosicaoFixa = [...usedPids].filter(pid => metadeDe(pid) !== null)
  const metadesIgnoradas = matchesGraph
    ? (() => {
        const { cima, baixo } = metadesDoGrafo(matchesGraph)
        return marcadosComPosicaoFixa.filter(pid => {
          const pos = headPositions.get(pid)!
          return metadeDe(pid) === 'cima' ? !cima.has(pos) : !baixo.has(pos)
        })
      })()
    : marcadosComPosicaoFixa

  const pedemCima = restantes.filter(p => metadeDe(p) === 'cima')
  const pedemBaixo = restantes.filter(p => metadeDe(p) === 'baixo')

  // Ninguém pediu nada: caminho de hoje, byte a byte.
  if (pedemCima.length === 0 && pedemBaixo.length === 0) {
    const shuffled = shuffleSeeded(restantes, seed)
    let idx = 0
    for (let i = 0; i < N; i++) {
      if (slots[i] === null && idx < shuffled.length) {
        slots[i] = shuffled[idx++]
      }
    }
    const byePositions = [...regraBracket.posicoes_bye].sort((a, b) => a - b)
    return { size: N, slots, byePositions, matchesGraph, metadesIgnoradas }
  }

  if (!matchesGraph) {
    throw Object.assign(
      new Error(
        `Não há desenho de chave cadastrado para ${N} inscritos — ele é necessário para respeitar a metade da chave.`,
      ),
      { status: 400 },
    )
  }

  const { cima, baixo } = metadesDoGrafo(matchesGraph)
  const livres: number[] = []
  for (let i = 0; i < N; i++) if (slots[i] === null) livres.push(i + 1)
  const livresCima = livres.filter(p => cima.has(p))
  const livresBaixo = livres.filter(p => baixo.has(p))

  if (livresCima.length + livresBaixo.length !== livres.length) {
    throw Object.assign(
      new Error(
        `O desenho da chave de ${N} inscritos está incompleto: ${livres.length - livresCima.length - livresBaixo.length} posições não pertencem a nenhuma metade.`,
      ),
      { status: 400 },
    )
  }

  if (pedemCima.length > livresCima.length) {
    throw Object.assign(
      new Error(
        `${pedemCima.length} inscritos pedem a parte de cima da chave, que tem ${livresCima.length} vagas.`,
      ),
      { status: 400 },
    )
  }
  if (pedemBaixo.length > livresBaixo.length) {
    throw Object.assign(
      new Error(
        `${pedemBaixo.length} inscritos pedem a parte de baixo da chave, que tem ${livresBaixo.length} vagas.`,
      ),
      { status: 400 },
    )
  }

  // Embaralhar as POSIÇÕES (e não só os pids) evita que os inscritos com metade
  // marcada caiam sempre nas primeiras vagas do seu lado — o que enviesaria
  // quem pega bye.
  const posCima = shuffleSeeded(livresCima, `${seed}:pos-cima`)
  const posBaixo = shuffleSeeded(livresBaixo, `${seed}:pos-baixo`)
  const sobra = [...posCima.slice(pedemCima.length), ...posBaixo.slice(pedemBaixo.length)]
  const posLivre = shuffleSeeded(sobra, `${seed}:pos-livre`)
  const semPreferencia = restantes.filter(p => metadeDe(p) === null)

  const atribui = (posicoes: readonly number[], pids: readonly number[]) => {
    for (let k = 0; k < pids.length; k++) slots[posicoes[k] - 1] = pids[k]
  }
  atribui(posCima, pedemCima)
  atribui(posBaixo, pedemBaixo)
  atribui(posLivre, semPreferencia)

  const byePositions = [...regraBracket.posicoes_bye].sort((a, b) => a - b)
  return { size: N, slots, byePositions, matchesGraph, metadesIgnoradas }
}

export type OrdemResultado = { ordem: number[] }

export function shuffleOrder(participantes: readonly number[], seed: string): OrdemResultado {
  return { ordem: shuffleSeeded(participantes, seed) }
}

export function shuffleOrderAnfitriao(
  participantes: readonly number[],
  seed: string,
  anfitriaoPid: number,
  posicao: number,
): OrdemResultado {
  const others = participantes.filter(p => p !== anfitriaoPid)
  const shuffled = shuffleSeeded(others, seed)
  const ordem: number[] = []
  let j = 0
  for (let i = 0; i < participantes.length; i++) {
    if (i === posicao - 1) ordem.push(anfitriaoPid)
    else ordem.push(shuffled[j++])
  }
  return { ordem }
}

// V2: leva cada BYE (P-ref em rodada >= 2) para uma linha "vs BYE" na 1ª rodada.
// Função pura — não muta o grafo de entrada. IDs de stub usam prefixo 'B'.
export function liftByesToFirstRoundV2(graph: MatchesGraph): MatchesGraph {
  let counter = 0
  const stubs: MatchesGraph['matches'] = []
  const lift = (ref: MatchRef): MatchRef => {
    if (!ref.startsWith('P')) return ref
    counter += 1
    const id = `B${counter}`
    stubs.push({ id, round: 1, top: ref, bottom: 'BYE' })
    return `V:${id}`
  }
  const matches = graph.matches.map(m => {
    if (m.round < 2) return { ...m }
    return { ...m, top: lift(m.top), bottom: lift(m.bottom) }
  })
  return { ...graph, matches: [...matches, ...stubs] }
}
