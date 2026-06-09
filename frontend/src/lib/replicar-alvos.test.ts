import { describe, it, expect } from 'vitest'
import { agruparAlvosPorCompeticao } from './replicar-alvos'

const mod = (id: number, nome: string, sigla: string, comp: string, tipo: string) =>
  ({ id, nome, sigla, competicao: { nome: comp }, tipo_modalidade: { tipo } }) as any

describe('agruparAlvosPorCompeticao', () => {
  const lista = [
    mod(1, 'Judô', 'JUD', 'Copa B', 'grupos'),
    mod(2, 'Futsal', 'FUT', 'Copa A', 'grupos'),
    mod(3, 'Vôlei', 'VOL', 'Copa A', 'chaves'),
    mod(4, 'Xadrez', 'XAD', 'Copa A', 'grupos'),
  ]

  it('filtra por tipo, exclui a origem e agrupa por competição (ordenado)', () => {
    const out = agruparAlvosPorCompeticao(lista, { tipo: 'grupos', excluirId: 2 })
    expect(out).toEqual([
      { competicao: 'Copa A', itens: [{ id: 4, nome: 'Xadrez', sigla: 'XAD', competicao: 'Copa A' }] },
      { competicao: 'Copa B', itens: [{ id: 1, nome: 'Judô', sigla: 'JUD', competicao: 'Copa B' }] },
    ])
  })

  it('tipo sem alvos retorna lista vazia', () => {
    expect(agruparAlvosPorCompeticao(lista, { tipo: 'ordem_entrada', excluirId: 0 })).toEqual([])
  })
})
