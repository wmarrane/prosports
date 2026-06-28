import { describe, it, expect } from 'vitest'
import type { SnapEvento } from '../snapshot-types'
import { tiposPresentes, tipoDominante, inscritos, totalModalidades, categorias, progressoSorteios, statusEvento } from './evento-stats'

function ev(mods: any[]): SnapEvento {
  return { id: 1, nome: 'E', competicao: 'C', cidade: 'M', local: 'L', data: '2026-06-01T00:00:00.000Z', organizador: null, publicadoEm: '', dataInicio: null, dataFim: null, boletins: [], modalidades: mods } as any
}

describe('evento-stats', () => {
  it('tiposPresentes ordena por frequência desc; dominante é o mais comum', () => {
    const e = ev([
      { nome: 'Judô A', tipo: 'chaves', status: 'sorteado', participantes: [{ id: 1 }] },
      { nome: 'Judô B', tipo: 'chaves', status: 'aguardando', participantes: [{ id: 2 }] },
      { nome: 'Futsal', tipo: 'grupos', status: 'aguardando', participantes: [{ id: 1 }] },
    ])
    expect(tiposPresentes(e)).toEqual(['chaves', 'grupos'])
    expect(tipoDominante(e)).toBe('chaves')
  })
  it('inscritos = participantes distintos; categorias = esportes distintos; total = nº modalidades', () => {
    const e = ev([
      { nome: 'Judô Masculino', tipo: 'chaves', status: 'sorteado', participantes: [{ id: 1 }, { id: 2 }] },
      { nome: 'Judô Feminino', tipo: 'chaves', status: 'aguardando', participantes: [{ id: 2 }, { id: 3 }] },
    ])
    expect(inscritos(e)).toBe(3)
    expect(totalModalidades(e)).toBe(2)
    expect(categorias(e)).toBe(1) // ambos esporteBase "Judô"
  })
  it('progresso ignora especifico em M; done quando todas as sorteáveis estão sorteadas', () => {
    const e = ev([
      { nome: 'A', tipo: 'chaves', status: 'sorteado', participantes: [] },
      { nome: 'B', tipo: 'grupos', status: 'sorteado', participantes: [] },
      { nome: 'C', tipo: 'especifico', status: 'aguardando', participantes: [] },
    ])
    const p = progressoSorteios(e)
    expect(p).toMatchObject({ sorteadas: 2, sorteaveis: 2, pct: 100, done: true })
    expect(statusEvento(e)).toBe('Sorteado')
  })
  it('só especifico → sorteaveis 0 (oculta progresso)', () => {
    const e = ev([{ nome: 'X', tipo: 'especifico', status: 'aguardando', participantes: [] }])
    expect(progressoSorteios(e).sorteaveis).toBe(0)
  })
})
