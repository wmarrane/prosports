import { describe, it, expect } from 'vitest'
import { cabecasComGrupo } from './cabecas-grupo'

const g = (letra: string, participantes: number[]) => ({ letra, participantes })

describe('cabecasComGrupo', () => {
  it('3 campeões inscritos, 3 grupos, sem anfitrião → A/B/C na ordem', () => {
    const out = cabecasComGrupo({
      campeoes: [
        { participante_id: 10, posicao: 1, nome: 'Um' },
        { participante_id: 20, posicao: 2, nome: 'Dois' },
        { participante_id: 30, posicao: 3, nome: 'Três' },
      ],
      inscritosIds: new Set([10, 20, 30]),
      anfitriaoPid: null, anfitriaoNome: null, consideraAnfitriao: false,
      grupos: [g('A', [10]), g('B', [20]), g('C', [30])],
    })
    expect(out).toEqual([
      { nome: 'Um', grupo: 'Grupo A' },
      { nome: 'Dois', grupo: 'Grupo B' },
      { nome: 'Três', grupo: 'Grupo C' },
    ])
  })

  it('anfitrião considerado (não-campeão), 3 grupos → anfitrião sintético no fim, Grupo C', () => {
    const out = cabecasComGrupo({
      campeoes: [
        { participante_id: 10, posicao: 1, nome: 'Um' },
        { participante_id: 20, posicao: 2, nome: 'Dois' },
      ],
      inscritosIds: new Set([10, 20, 99]),
      anfitriaoPid: 99, anfitriaoNome: 'Anfitriao', consideraAnfitriao: true,
      grupos: [g('A', [10]), g('B', [20]), g('C', [99])],
    })
    expect(out).toEqual([
      { nome: 'Um', grupo: 'Grupo A' },
      { nome: 'Dois', grupo: 'Grupo B' },
      { nome: 'Anfitriao', grupo: 'Grupo C' },
    ])
  })

  it('4 campeões, 3 grupos → o 4º fica sem grupo', () => {
    const out = cabecasComGrupo({
      campeoes: [
        { participante_id: 10, posicao: 1, nome: 'Um' },
        { participante_id: 20, posicao: 2, nome: 'Dois' },
        { participante_id: 30, posicao: 3, nome: 'Três' },
        { participante_id: 40, posicao: 4, nome: 'Quatro' },
      ],
      inscritosIds: new Set([10, 20, 30, 40]),
      anfitriaoPid: null, anfitriaoNome: null, consideraAnfitriao: false,
      grupos: [g('A', [10]), g('B', [20]), g('C', [30])],
    })
    expect(out[3]).toEqual({ nome: 'Quatro', grupo: null })
  })

  it('campeão não inscrito → listado sem grupo', () => {
    const out = cabecasComGrupo({
      campeoes: [
        { participante_id: 10, posicao: 1, nome: 'Um' },
        { participante_id: 20, posicao: 2, nome: 'Fora' },
      ],
      inscritosIds: new Set([10]),
      anfitriaoPid: null, anfitriaoNome: null, consideraAnfitriao: false,
      grupos: [g('A', [10])],
    })
    expect(out).toEqual([
      { nome: 'Um', grupo: 'Grupo A' },
      { nome: 'Fora', grupo: null },
    ])
  })

  it('grupos null → todos sem grupo', () => {
    const out = cabecasComGrupo({
      campeoes: [{ participante_id: 10, posicao: 1, nome: 'Um' }],
      inscritosIds: new Set([10]),
      anfitriaoPid: null, anfitriaoNome: null, consideraAnfitriao: false,
      grupos: null,
    })
    expect(out).toEqual([{ nome: 'Um', grupo: null }])
  })
})
