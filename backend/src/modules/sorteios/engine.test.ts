import { describe, it, expect } from 'vitest'
import {
  shuffleSeeded,
  drawGroups,
  drawBracket,
  shuffleOrder,
  shuffleOrderAnfitriao,
  liftByesToFirstRoundV2,
  metadesDoGrafo,
} from './engine'
import type { MatchesGraph } from './engine'

describe('shuffleSeeded', () => {
  it('mesma seed produz mesma saída', () => {
    const a = shuffleSeeded([1,2,3,4,5,6,7,8,9,10], 'abc')
    const b = shuffleSeeded([1,2,3,4,5,6,7,8,9,10], 'abc')
    expect(a).toEqual(b)
  })

  it('seeds diferentes produzem saídas diferentes', () => {
    const a = shuffleSeeded([1,2,3,4,5,6,7,8,9,10], 'abc')
    const b = shuffleSeeded([1,2,3,4,5,6,7,8,9,10], 'xyz')
    expect(a).not.toEqual(b)
  })

  it('não muta o array original', () => {
    const input = [1,2,3,4,5]
    const snapshot = [...input]
    shuffleSeeded(input, 'seed')
    expect(input).toEqual(snapshot)
  })

  it('preserva todos os elementos (permutação)', () => {
    const input = [10,20,30,40,50]
    const out = shuffleSeeded(input, 'seed')
    expect(out.sort()).toEqual([10,20,30,40,50])
  })
})

describe('drawGroups', () => {
  it('6 participantes + regra (2g, 2 de 3, 0 de 4) distribui em 2 grupos de 3 com todos os ids', () => {
    const regra = { id: 1, quantidade_grupos: 2, grupos_3_componentes: 2, grupos_4_componentes: 0, numero_classificados: 2 }
    const out = drawGroups([1,2,3,4,5,6], regra, 'seed1')
    expect(out.regra_id).toBe(1)
    expect(out.classificados_por_grupo).toBe(2)
    expect(out.grupos).toHaveLength(2)
    expect(out.grupos[0].letra).toBe('A')
    expect(out.grupos[1].letra).toBe('B')
    expect(out.grupos[0].participantes).toHaveLength(3)
    expect(out.grupos[1].participantes).toHaveLength(3)
    const todos = [...out.grupos[0].participantes, ...out.grupos[1].participantes].sort()
    expect(todos).toEqual([1,2,3,4,5,6])
  })

  it('7 participantes + regra (1 de 3, 1 de 4) → tamanhos {3,4} em ordem aleatória, todos os ids presentes', () => {
    const regra = { id: 2, quantidade_grupos: 2, grupos_3_componentes: 1, grupos_4_componentes: 1, numero_classificados: 2 }
    const out = drawGroups([10,20,30,40,50,60,70], regra, 'seed2')
    expect(out.grupos).toHaveLength(2)
    const tamanhos = out.grupos.map(g => g.participantes.length).sort()
    expect(tamanhos).toEqual([3, 4])
    const todos = [...out.grupos[0].participantes, ...out.grupos[1].participantes].sort((a,b)=>a-b)
    expect(todos).toEqual([10,20,30,40,50,60,70])
  })

  it('ordem dos tamanhos é determinística para a mesma seed (mas pode variar entre seeds)', () => {
    const regra = { id: 3, quantidade_grupos: 4, grupos_3_componentes: 2, grupos_4_componentes: 2, numero_classificados: 2 }
    const participantes = [1,2,3,4,5,6,7,8,9,10,11,12,13,14]
    const a = drawGroups(participantes, regra, 'seedA')
    const b = drawGroups(participantes, regra, 'seedA')
    expect(a.grupos.map(g => g.participantes.length)).toEqual(b.grupos.map(g => g.participantes.length))
    // Soma e cobertura
    expect(a.grupos.map(g => g.participantes.length).sort()).toEqual([3,3,4,4])
  })

  it('sem campeoesPids: comportamento igual (regressão)', () => {
    const regra = { id: 1, quantidade_grupos: 2, grupos_3_componentes: 2, grupos_4_componentes: 0, numero_classificados: 2 }
    const a = drawGroups([1,2,3,4,5,6], regra, 'seed-x')
    const b = drawGroups([1,2,3,4,5,6], regra, 'seed-x', [])
    expect(a).toEqual(b)
  })

  it('1 campeão + 5 outros (regra 2g de 3): campeão na 1ª pos do Grupo A; outros 5 distribuídos', () => {
    const regra = { id: 1, quantidade_grupos: 2, grupos_3_componentes: 2, grupos_4_componentes: 0, numero_classificados: 2 }
    const out = drawGroups([10,20,30,40,50,60], regra, 'seed-c1', [10])
    expect(out.grupos[0].participantes[0]).toBe(10)
    const todos = [...out.grupos[0].participantes, ...out.grupos[1].participantes].sort((a,b)=>a-b)
    expect(todos).toEqual([10,20,30,40,50,60])
  })

  it('3 campeões + 3 outros (regra 2g de 3): 1º e 2º campeões nas 1ªs pos de A e B; 3º entra no shuffle', () => {
    const regra = { id: 1, quantidade_grupos: 2, grupos_3_componentes: 2, grupos_4_componentes: 0, numero_classificados: 2 }
    const out = drawGroups([10,20,30,40,50,60], regra, 'seed-c3', [10, 20, 30])
    expect(out.grupos[0].participantes[0]).toBe(10)
    expect(out.grupos[1].participantes[0]).toBe(20)
    const todos = [...out.grupos[0].participantes, ...out.grupos[1].participantes]
    expect(todos.includes(30)).toBe(true)
    expect(out.grupos[0].participantes[0]).not.toBe(30)
    expect(out.grupos[1].participantes[0]).not.toBe(30)
    expect(todos.sort((a,b)=>a-b)).toEqual([10,20,30,40,50,60])
  })
})

describe('drawBracket', () => {
  it('sem campeoes + regra qualquer + 5 inscritos → size=5, todos pids presentes, sem nulls', () => {
    const regra = { posicao_primeiro_cabeca: 1, posicao_segundo_cabeca: 5, posicao_terceiro_cabeca: 4, posicao_quarto_cabeca: 3 }
    const out = drawBracket([1,2,3,4,5], regra, { numero_inscrito: 5, posicoes_bye: [] }, null, 'seed-b')
    expect(out.size).toBe(5)
    expect(out.slots).toHaveLength(5)
    expect(out.slots.filter(s => s === null)).toHaveLength(0)
    const pids = out.slots.filter((s): s is number => s !== null).sort()
    expect(pids).toEqual([1,2,3,4,5])
  })

  it('4 campeoes inscritos + regra (1,8,5,4): slots fixos preenchidos, outros shuffled', () => {
    const regra = { posicao_primeiro_cabeca: 1, posicao_segundo_cabeca: 8, posicao_terceiro_cabeca: 5, posicao_quarto_cabeca: 4 }
    const out = drawBracket([1,2,3,4,5,6,7,8], regra, { numero_inscrito: 8, posicoes_bye: [] }, null, 'seed-b4b', [1, 2, 3, 4])
    expect(out.size).toBe(8)
    expect(out.slots[0]).toBe(1)
    expect(out.slots[7]).toBe(2)
    expect(out.slots[4]).toBe(3)
    expect(out.slots[3]).toBe(4)
    const outrosSlots = [out.slots[1], out.slots[2], out.slots[5], out.slots[6]].sort((a, b) => (a as number) - (b as number))
    expect(outrosSlots).toEqual([5, 6, 7, 8])
  })

  it('2 campeoes + regra com terceira_cabeca=0 → só 2 cabeças usadas', () => {
    const regra = { posicao_primeiro_cabeca: 1, posicao_segundo_cabeca: 4, posicao_terceiro_cabeca: 0, posicao_quarto_cabeca: 0 }
    const out = drawBracket([1,2,3,4], regra, { numero_inscrito: 4, posicoes_bye: [] }, null, 'seed-b2', [1, 2])
    expect(out.size).toBe(4)
    expect(out.slots[0]).toBe(1)
    expect(out.slots[3]).toBe(2)
    const outrosSlots = [out.slots[1], out.slots[2]].sort((a, b) => (a as number) - (b as number))
    expect(outrosSlots).toEqual([3, 4])
  })

  it('sem campeoes (default) → todos no shuffle, regras ignoradas para fixação', () => {
    const regra = { posicao_primeiro_cabeca: 1, posicao_segundo_cabeca: 4, posicao_terceiro_cabeca: 3, posicao_quarto_cabeca: 2 }
    const a = drawBracket([1,2,3,4], regra, { numero_inscrito: 4, posicoes_bye: [] }, null, 'seed-b-equal')
    const b = drawBracket([1,2,3,4], regra, { numero_inscrito: 4, posicoes_bye: [] }, null, 'seed-b-equal', [])
    expect(a).toEqual(b)
    expect(a.size).toBe(4)
    const pids = a.slots.filter((s): s is number => s !== null).sort()
    expect(pids).toEqual([1,2,3,4])
  })
})

describe('shuffleOrder', () => {
  it('tamanho preservado e mesma seed → mesma ordem', () => {
    const a = shuffleOrder([1,2,3,4,5], 'seed')
    const b = shuffleOrder([1,2,3,4,5], 'seed')
    expect(a.ordem).toHaveLength(5)
    expect(a).toEqual(b)
  })
})

describe('drawBracket — com regraBracket (v1.18.0)', () => {
  const regraChavesN6 = {
    numero_inscrito: 6,
    posicao_primeiro_cabeca: 1,
    posicao_segundo_cabeca: 6,
    posicao_terceiro_cabeca: 4,
    posicao_quarto_cabeca: 3,
  }
  const regraBracketN6 = { numero_inscrito: 6, posicoes_bye: [1, 6] }

  it('aloca cabeças nas posições reservadas e retorna byePositions', () => {
    const pids = [101, 102, 103, 104, 105, 106]
    const campeoes = [101, 102]
    const r = drawBracket(pids, regraChavesN6, regraBracketN6, null, 'seed-x', campeoes)
    expect(r.size).toBe(6)
    expect(r.slots).toHaveLength(6)
    expect(r.slots[0]).toBe(101)
    expect(r.slots[5]).toBe(102)
    expect(r.byePositions).toEqual([1, 6])
  })

  it('preenche posições restantes deterministicamente via seed', () => {
    const pids = [101, 102, 103, 104, 105, 106]
    const r1 = drawBracket(pids, regraChavesN6, regraBracketN6, null, 'seed-x', [])
    const r2 = drawBracket(pids, regraChavesN6, regraBracketN6, null, 'seed-x', [])
    expect(r1.slots).toEqual(r2.slots)
  })

  it('N=8 (pow2): sem byes, slots todos preenchidos', () => {
    const regraChavesN8 = {
      numero_inscrito: 8,
      posicao_primeiro_cabeca: 1,
      posicao_segundo_cabeca: 8,
      posicao_terceiro_cabeca: 5,
      posicao_quarto_cabeca: 4,
    }
    const regraBracketN8 = { numero_inscrito: 8, posicoes_bye: [] }
    const pids = [11, 22, 33, 44, 55, 66, 77, 88]
    const r = drawBracket(pids, regraChavesN8, regraBracketN8, null, 's', [])
    expect(r.byePositions).toEqual([])
    expect(r.slots.filter(s => s !== null)).toHaveLength(8)
  })

  it('N=22 (6 byes, 4 cabeças): 4 cabeças em posições reservadas; 2 byes sobrando recebem random', () => {
    const regraChavesN22 = {
      numero_inscrito: 22,
      posicao_primeiro_cabeca: 1,
      posicao_segundo_cabeca: 22,
      posicao_terceiro_cabeca: 12,
      posicao_quarto_cabeca: 11,
    }
    const regraBracketN22 = { numero_inscrito: 22, posicoes_bye: [1, 6, 11, 12, 17, 22] }
    const pids = Array.from({ length: 22 }, (_, i) => 200 + i)
    const campeoes = [200, 201, 202, 203]
    const r = drawBracket(pids, regraChavesN22, regraBracketN22, null, 's', campeoes)
    expect(r.slots[0]).toBe(200)
    expect(r.slots[21]).toBe(201)
    expect(r.slots[11]).toBe(202)
    expect(r.slots[10]).toBe(203)
    expect(r.slots[5]).not.toBeNull()
    expect(r.slots[16]).not.toBeNull()
    expect([200, 201, 202, 203]).not.toContain(r.slots[5])
    expect([200, 201, 202, 203]).not.toContain(r.slots[16])
    expect(r.byePositions).toEqual([1, 6, 11, 12, 17, 22])
  })
})

describe('drawBracket — com matchesGraph (v1.19.0)', () => {
  const regraChavesN6 = {
    numero_inscrito: 6,
    posicao_primeiro_cabeca: 1,
    posicao_segundo_cabeca: 6,
    posicao_terceiro_cabeca: 4,
    posicao_quarto_cabeca: 3,
  }
  const regraBracketN6 = { numero_inscrito: 6, posicoes_bye: [1, 6] }
  const matchesGraphN6 = {
    matches: [
      { id: 'J1', round: 1, top: 'P2', bottom: 'P3' },
      { id: 'J2', round: 1, top: 'P4', bottom: 'P5' },
      { id: 'J3', round: 2, top: 'P1', bottom: 'V:J1' },
      { id: 'J4', round: 2, top: 'V:J2', bottom: 'P6' },
      { id: 'J5', round: 3, top: 'V:J3', bottom: 'V:J4' },
    ],
    final: 'J5',
    thirdPlace: null,
  }

  it('retorna matchesGraph quando fornecido', () => {
    const pids = [101, 102, 103, 104, 105, 106]
    const r = drawBracket(pids, regraChavesN6, regraBracketN6, matchesGraphN6, 'seed-x', [])
    expect(r.matchesGraph).toEqual(matchesGraphN6)
  })

  it('retorna matchesGraph=null quando não fornecido (fallback)', () => {
    const pids = [101, 102, 103, 104, 105, 106]
    const r = drawBracket(pids, regraChavesN6, regraBracketN6, null, 'seed-x', [])
    expect(r.matchesGraph).toBeNull()
  })
})

describe('liftByesToFirstRoundV2', () => {
  // Grafo real N=6: byes nas posições 1 e 6 (P1 em J3/r2, P6 em J4/r2)
  const graphN6 = {
    matches: [
      { id: 'J1', top: 'P2', bottom: 'P3', round: 1 },
      { id: 'J2', top: 'P4', bottom: 'P5', round: 1 },
      { id: 'J3', top: 'P1', bottom: 'V:J1', round: 2 },
      { id: 'J4', top: 'V:J2', bottom: 'P6', round: 2 },
      { id: 'J6', top: 'V:J3', bottom: 'V:J4', round: 3 },
      { id: 'J5', top: 'L:J3', bottom: 'L:J4', round: 3 },
    ],
    final: 'J6',
    thirdPlace: 'J5',
  }

  it('cria um stub B* de 1ª rodada para cada BYE (P-ref em rodada >= 2)', () => {
    const out = liftByesToFirstRoundV2(graphN6)
    const stubs = out.matches.filter(m => m.id.startsWith('B'))
    expect(stubs).toHaveLength(2)
    for (const s of stubs) {
      expect(s.round).toBe(1)
      expect(s.bottom).toBe('BYE')
      expect(s.top).toMatch(/^P\d+$/)
    }
  })

  it('nenhum P-ref permanece em rodada >= 2 e as refs viram V:B*', () => {
    const out = liftByesToFirstRoundV2(graphN6)
    const r2plus = out.matches.filter(m => m.round >= 2)
    for (const m of r2plus) {
      expect(m.top.startsWith('P')).toBe(false)
      expect(m.bottom.startsWith('P')).toBe(false)
    }
    const j3 = out.matches.find(m => m.id === 'J3')!
    const j4 = out.matches.find(m => m.id === 'J4')!
    expect(j3.top).toBe('V:B1')
    expect(j4.bottom).toBe('V:B2')
  })

  it('preserva jogos reais (J*), final e thirdPlace', () => {
    const out = liftByesToFirstRoundV2(graphN6)
    const reais = out.matches.filter(m => m.id.startsWith('J'))
    expect(reais).toHaveLength(6)
    expect(out.final).toBe('J6')
    expect(out.thirdPlace).toBe('J5')
  })

  it('não muta o grafo de entrada', () => {
    const snapshot = JSON.parse(JSON.stringify(graphN6))
    liftByesToFirstRoundV2(graphN6)
    expect(graphN6).toEqual(snapshot)
  })

  it('lida com dois BYEs no mesmo jogo de 2ª rodada (gera dois stubs)', () => {
    const g = {
      matches: [
        { id: 'J1', top: 'P1', bottom: 'P2', round: 2 },
        { id: 'J2', top: 'V:J1', bottom: 'V:J1', round: 3 },
      ],
      final: 'J2',
      thirdPlace: null,
    }
    const out = liftByesToFirstRoundV2(g)
    const stubs = out.matches.filter(m => m.id.startsWith('B'))
    expect(stubs).toHaveLength(2)
    const j1 = out.matches.find(m => m.id === 'J1')!
    expect(j1.top).toBe('V:B1')
    expect(j1.bottom).toBe('V:B2')
  })
})

describe('shuffleOrderAnfitriao', () => {
  it('coloca o anfitrião na posição (1-based) e mantém todos', () => {
    const out = shuffleOrderAnfitriao([1, 2, 3, 4, 5], 'seed', 3, 2)
    expect(out.ordem[1]).toBe(3)
    expect(out.ordem).toHaveLength(5)
    expect([...out.ordem].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5])
  })

  it('determinístico para a mesma seed', () => {
    const a = shuffleOrderAnfitriao([1, 2, 3, 4, 5], 's', 1, 1)
    const b = shuffleOrderAnfitriao([1, 2, 3, 4, 5], 's', 1, 1)
    expect(a).toEqual(b)
  })

  it('posição 1 e última', () => {
    expect(shuffleOrderAnfitriao([10, 20, 30], 's', 20, 1).ordem[0]).toBe(20)
    const ult = shuffleOrderAnfitriao([10, 20, 30], 's', 20, 3)
    expect(ult.ordem[2]).toBe(20)
  })
})

// N=4 simétrico: J1 e J2 na 1ª rodada, J3 é a final.
const GRAFO_4: MatchesGraph = {
  matches: [
    { id: 'J1', round: 1, top: 'P1', bottom: 'P2' },
    { id: 'J2', round: 1, top: 'P3', bottom: 'P4' },
    { id: 'J3', round: 2, top: 'V:J1', bottom: 'V:J2' },
  ],
  final: 'J3',
  thirdPlace: null,
}

// N=3: P1 entra direto na final (bye). Espelha a chave real de 3 (1 em cima / 2 embaixo).
const GRAFO_3: MatchesGraph = {
  matches: [
    { id: 'J1', round: 1, top: 'P2', bottom: 'P3' },
    { id: 'J2', round: 2, top: 'P1', bottom: 'V:J1' },
  ],
  final: 'J2',
  thirdPlace: null,
}

// N=7 assimétrico: espelha a chave real de 7 (3 em cima / 4 embaixo) e tem 3º lugar.
const GRAFO_7: MatchesGraph = {
  matches: [
    { id: 'J1', round: 1, top: 'P2', bottom: 'P3' },
    { id: 'J2', round: 1, top: 'P4', bottom: 'P5' },
    { id: 'J3', round: 1, top: 'P6', bottom: 'P7' },
    { id: 'J4', round: 2, top: 'P1', bottom: 'V:J1' },
    { id: 'J5', round: 2, top: 'V:J2', bottom: 'V:J3' },
    { id: 'J6', round: 3, top: 'V:J4', bottom: 'V:J5' },
    { id: 'J7', round: 3, top: 'L:J4', bottom: 'L:J5' },
  ],
  final: 'J6',
  thirdPlace: 'J7',
}

describe('metadesDoGrafo', () => {
  it('parte a chave simétrica ao meio', () => {
    const { cima, baixo } = metadesDoGrafo(GRAFO_4)
    expect([...cima].sort((a, b) => a - b)).toEqual([1, 2])
    expect([...baixo].sort((a, b) => a - b)).toEqual([3, 4])
  })

  it('em chave ímpar segue o desenho, não o arredondamento', () => {
    // N=3 real é 1/2 — se alguém usasse ceil(3/2) daria 2/1.
    const { cima, baixo } = metadesDoGrafo(GRAFO_3)
    expect([...cima]).toEqual([1])
    expect([...baixo].sort((a, b) => a - b)).toEqual([2, 3])
  })

  it('N=7 fica 3/4, com o extra embaixo, e o 3º lugar não polui as metades', () => {
    const { cima, baixo } = metadesDoGrafo(GRAFO_7)
    expect([...cima].sort((a, b) => a - b)).toEqual([1, 2, 3])
    expect([...baixo].sort((a, b) => a - b)).toEqual([4, 5, 6, 7])
  })

  it('a metade de cima é sempre a que contém a posição 1', () => {
    const invertido: MatchesGraph = {
      ...GRAFO_4,
      matches: GRAFO_4.matches.map(m => (m.id === 'J3' ? { ...m, top: 'V:J2', bottom: 'V:J1' } : m)),
    }
    const { cima } = metadesDoGrafo(invertido)
    expect(cima.has(1)).toBe(true)
  })

  it('as metades cobrem todas as posições sem sobreposição', () => {
    const { cima, baixo } = metadesDoGrafo(GRAFO_7)
    const todas = [...cima, ...baixo].sort((a, b) => a - b)
    expect(todas).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect([...cima].some(p => baixo.has(p))).toBe(false)
  })

  it('grafo V2 (byes na 1ª rodada) produz as mesmas metades', () => {
    const v1 = metadesDoGrafo(GRAFO_7)
    const v2 = metadesDoGrafo(liftByesToFirstRoundV2(GRAFO_7))
    expect([...v2.cima].sort((a, b) => a - b)).toEqual([...v1.cima].sort((a, b) => a - b))
    expect([...v2.baixo].sort((a, b) => a - b)).toEqual([...v1.baixo].sort((a, b) => a - b))
  })
})

// N=8 simétrico: cima = 1..4, baixo = 5..8.
const GRAFO_8: MatchesGraph = {
  matches: [
    { id: 'J1', round: 1, top: 'P1', bottom: 'P2' },
    { id: 'J2', round: 1, top: 'P3', bottom: 'P4' },
    { id: 'J3', round: 1, top: 'P5', bottom: 'P6' },
    { id: 'J4', round: 1, top: 'P7', bottom: 'P8' },
    { id: 'J5', round: 2, top: 'V:J1', bottom: 'V:J2' },
    { id: 'J6', round: 2, top: 'V:J3', bottom: 'V:J4' },
    { id: 'J7', round: 3, top: 'V:J5', bottom: 'V:J6' },
  ],
  final: 'J7',
  thirdPlace: null,
}

const SEM_CABECA = { posicao_primeiro_cabeca: 0, posicao_segundo_cabeca: 0, posicao_terceiro_cabeca: 0, posicao_quarto_cabeca: 0 }
const BYES_8 = { numero_inscrito: 8, posicoes_bye: [] }
const PIDS_8 = [11, 12, 13, 14, 15, 16, 17, 18]

/** Posição 1-indexed em que o pid caiu. */
function posDe(slots: (number | null)[], pid: number): number {
  return slots.findIndex(s => s === pid) + 1
}

describe('drawBracket com metade da chave', () => {
  it('respeita a metade pedida por cada inscrito', () => {
    const metades = new Map([[11, 'cima' as const], [12, 'baixo' as const]])
    const r = drawBracket(PIDS_8, SEM_CABECA, BYES_8, GRAFO_8, 'seed-1', [], { metadePorPid: metades })
    expect(posDe(r.slots, 11)).toBeLessThanOrEqual(4)
    expect(posDe(r.slots, 12)).toBeGreaterThanOrEqual(5)
    expect(r.slots.filter(s => s !== null)).toHaveLength(8)
  })

  it('quem não pediu metade preenche os dois lados', () => {
    // 1 pede cima, 1 pede baixo: sobram 3 vagas de cada lado para os 6 sem
    // preferência. Se o balde livre ficasse preso a um lado, esta conta quebra.
    const metades = new Map([[11, 'cima' as const], [12, 'baixo' as const]])
    const r = drawBracket(PIDS_8, SEM_CABECA, BYES_8, GRAFO_8, 'seed-1', [], { metadePorPid: metades })
    const posicoes = PIDS_8.filter(p => p !== 11 && p !== 12).map(p => posDe(r.slots, p))
    expect(posicoes.filter(p => p <= 4)).toHaveLength(3)
    expect(posicoes.filter(p => p >= 5)).toHaveLength(3)
  })

  it('recusa quando os pedidos não cabem na metade', () => {
    const metades = new Map(PIDS_8.slice(0, 5).map(p => [p, 'cima' as const]))
    expect(() => drawBracket(PIDS_8, SEM_CABECA, BYES_8, GRAFO_8, 'seed-1', [], { metadePorPid: metades }))
      .toThrow(/5 .*cima.*4/s)
  })

  it('cabeça prevalece: a metade dela é ignorada e registrada', () => {
    const regra = { ...SEM_CABECA, posicao_primeiro_cabeca: 1 }  // posição 1 = metade de cima
    const metades = new Map([[11, 'baixo' as const]])
    const r = drawBracket(PIDS_8, regra, BYES_8, GRAFO_8, 'seed-1', [11], { metadePorPid: metades })
    expect(posDe(r.slots, 11)).toBe(1)
    expect(r.metadesIgnoradas).toEqual([11])
  })

  it('exige o desenho da chave quando alguém pediu metade', () => {
    const metades = new Map([[11, 'cima' as const]])
    expect(() => drawBracket(PIDS_8, SEM_CABECA, BYES_8, null, 'seed-1', [], { metadePorPid: metades }))
      .toThrow(/desenho de chave/i)
  })

  it('sem ninguém pedindo metade, o resultado é idêntico ao de hoje', () => {
    const semOpts = drawBracket(PIDS_8, SEM_CABECA, BYES_8, GRAFO_8, 'seed-42')
    const comMapaVazio = drawBracket(PIDS_8, SEM_CABECA, BYES_8, GRAFO_8, 'seed-42', [], {
      metadePorPid: new Map(PIDS_8.map(p => [p, null])),
    })
    expect(comMapaVazio.slots).toEqual(semOpts.slots)
    expect(comMapaVazio.metadesIgnoradas).toEqual([])
  })

  it('mesma seed, mesmo resultado', () => {
    const metades = new Map([[11, 'cima' as const], [18, 'baixo' as const]])
    const a = drawBracket(PIDS_8, SEM_CABECA, BYES_8, GRAFO_8, 'seed-7', [], { metadePorPid: metades })
    const b = drawBracket(PIDS_8, SEM_CABECA, BYES_8, GRAFO_8, 'seed-7', [], { metadePorPid: metades })
    expect(a.slots).toEqual(b.slots)
  })
})
