import { describe, it, expect } from 'vitest'
import type { SnapEvento } from '../snapshot-types'
import { tiposPresentes, tipoDominante, inscritos, totalModalidades, categorias, progressoSorteios, statusEvento, modalidadesDistintas } from './evento-stats'

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
      { nome: 'A', tipo: 'chaves', status: 'sorteado', participantes: [{ id: 1 }] },
      { nome: 'B', tipo: 'grupos', status: 'sorteado', participantes: [{ id: 2 }] },
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

  it('progressoSorteios ignora modalidades sem inscritos no total sorteavel', () => {
    const e = {
      id: 1, nome: 'E', competicao: 'C', cidade: 'X', local: 'L', data: '2026-01-01T00:00:00.000Z',
      organizador: null, publicadoEm: '', dataInicio: null, dataFim: null, boletins: [],
      modalidades: [
        { id: 1, nome: 'Judô', grupo: null, tipo: 'chaves', status: 'sorteado', seed: null, anfitriaoId: null, participantes: [{ id: 1, nome: 'A', subtitulo: null }], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [] },
        { id: 2, nome: 'Futsal', grupo: null, tipo: 'chaves', status: 'aguardando', seed: null, anfitriaoId: null, participantes: [], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [] },
      ],
    } as any
    const p = progressoSorteios(e)
    expect(p.sorteaveis).toBe(1)
    expect(p.sorteadas).toBe(1)
    expect(p.done).toBe(true)
  })

  it('modalidadesDistintas conta esportes pela base do nome', () => {
    const e = {
      id: 1, nome: 'E', competicao: 'C', cidade: 'X', local: 'L', data: '2026-01-01T00:00:00.000Z',
      organizador: null, publicadoEm: '', dataInicio: null, dataFim: null, boletins: [],
      modalidades: [
        { id: 1, nome: 'Atletismo Masculino', grupo: null, tipo: 'chaves', status: 'aguardando', seed: null, anfitriaoId: null, participantes: [], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [] },
        { id: 2, nome: 'Atletismo Feminino', grupo: null, tipo: 'chaves', status: 'aguardando', seed: null, anfitriaoId: null, participantes: [], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [] },
        { id: 3, nome: 'Judô Livre', grupo: null, tipo: 'chaves', status: 'aguardando', seed: null, anfitriaoId: null, participantes: [], campeoes: [], cabecasPids: [], resultado: null, mensagens_inscritos: [] },
      ],
    } as any
    expect(modalidadesDistintas(e)).toBe(2)
  })
})
