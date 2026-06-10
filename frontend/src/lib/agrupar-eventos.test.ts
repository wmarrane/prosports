import { describe, it, expect } from 'vitest'
import { agruparEventosPorCompeticao } from './agrupar-eventos'

const ev = (id: number, cid: number, nome: string, data: string) =>
  ({ id, competicao_id: cid, competicao: { nome }, data_hora: data }) as any

describe('agruparEventosPorCompeticao', () => {
  it('agrupa por competição; grupos por data mais recente desc; eventos por data desc', () => {
    const out = agruparEventosPorCompeticao([
      ev(1, 10, 'Copa A', '2026-01-10'),
      ev(2, 20, 'Copa B', '2026-03-01'),
      ev(3, 10, 'Copa A', '2026-02-20'),
    ])
    expect(out.map(g => g.competicaoId)).toEqual([20, 10])
    expect(out[1].eventos.map(e => e.id)).toEqual([3, 1])
  })

  it('empate de data desempata por nome (pt-BR)', () => {
    const out = agruparEventosPorCompeticao([
      ev(1, 10, 'Zeta', '2026-05-01'),
      ev(2, 20, 'Alfa', '2026-05-01'),
    ])
    expect(out.map(g => g.competicaoNome)).toEqual(['Alfa', 'Zeta'])
  })

  it('lista vazia → []', () => {
    expect(agruparEventosPorCompeticao([])).toEqual([])
  })
})
