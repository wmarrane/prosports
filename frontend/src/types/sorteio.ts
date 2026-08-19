export type GruposResultado = {
  regra_id: number
  classificados_por_grupo: number
  grupos: { letra: string; participantes: number[] }[]
}

export type MatchesGraph = {
  matches: Array<{
    id: string
    round: number
    top: string   // 'P{n}' | 'V:J{x}' | 'L:J{x}'
    bottom: string
  }>
  final: string
  thirdPlace: string | null
}

export type ChavesResultado = {
  size: number
  slots: (number | null)[]
  byePositions?: number[]  // 1-indexed; ausente em sorteios pré-v1.18.0
  matchesGraph?: MatchesGraph | null   // NOVO
  metadesIgnoradas?: number[]   // pids de cabeças cuja metade foi descartada (posição de cabeça prevalece)
}

export type OrdemResultado = {
  ordem: number[]
}

type SorteioBase = {
  id: number
  evento_id: number
  modalidade_id: number
  seed: string
  gerado_em: string
  atualizado_em: string
}

export type Sorteio =
  | (SorteioBase & { tipo: 'grupos'; resultado: GruposResultado })
  | (SorteioBase & { tipo: 'chaves'; resultado: ChavesResultado })
  | (SorteioBase & { tipo: 'ordem_entrada'; resultado: OrdemResultado })
  | (SorteioBase & { tipo: 'especifico'; resultado: unknown })
