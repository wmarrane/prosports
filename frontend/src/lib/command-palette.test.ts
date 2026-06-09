import { describe, it, expect } from 'vitest'
import { normalize, filterEntities } from './command-palette'

const data = {
  eventos: [{ id: 1, nome: 'Jogos Regionais de Campinas' }, { id: 2, nome: 'Copa São Paulo' }],
  modalidades: [
    { id: 10, nome: 'Judô Feminino Livre', sigla: 'JFL' },
    { id: 11, nome: 'Futsal Masculino', sigla: 'FUT' },
  ],
  competicoes: [{ id: 20, nome: 'Jogos Regionais' }],
}

describe('normalize', () => {
  it('remove acento e caixa', () => {
    expect(normalize('São Judô')).toBe('sao judo')
  })
})

describe('filterEntities', () => {
  it('query vazia retorna grupos vazios', () => {
    expect(filterEntities('  ', data)).toEqual({ eventos: [], modalidades: [], competicoes: [] })
  })

  it('casa evento por nome (acento-insensitive) e monta rota', () => {
    const r = filterEntities('sao paulo', data)
    expect(r.eventos).toEqual([{ id: 2, label: 'Copa São Paulo', to: '/eventos/2/inscricoes' }])
  })

  it('casa modalidade por nome e por sigla', () => {
    expect(filterEntities('judo', data).modalidades.map(m => m.id)).toEqual([10])
    const porSigla = filterEntities('jfl', data).modalidades
    expect(porSigla).toEqual([{ id: 10, label: 'Judô Feminino Livre', sublabel: 'JFL', to: '/modalidades/10/editar' }])
  })

  it('casa competição por nome e monta rota de editar', () => {
    expect(filterEntities('regionais', data).competicoes).toEqual([
      { id: 20, label: 'Jogos Regionais', to: '/competicoes/20/editar' },
    ])
  })

  it('limita a 6 por grupo', () => {
    const many = { eventos: Array.from({ length: 9 }, (_, i) => ({ id: i, nome: `Evento ${i}` })), modalidades: [], competicoes: [] }
    expect(filterEntities('evento', many).eventos).toHaveLength(6)
  })
})
