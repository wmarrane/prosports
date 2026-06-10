import { describe, it, expect } from 'vitest'
import { isSorteavel, matchMensagem } from './sorteaveis'

describe('matchMensagem', () => {
  it('primeira regra que casa; max nulo; inclusivo; sem match', () => {
    const r = [{ min: 1, max: 5, mensagem: 'A', pular_sorteio: false }, { min: 3, max: 5, mensagem: 'B', pular_sorteio: false }]
    expect(matchMensagem(r, 4)?.mensagem).toBe('A')
    expect(matchMensagem([{ min: 6, max: null, mensagem: 'C', pular_sorteio: false }], 9)?.mensagem).toBe('C')
    expect(matchMensagem([{ min: 3, max: 5, mensagem: 'D', pular_sorteio: false }], 5)?.mensagem).toBe('D')
    expect(matchMensagem([], 2)).toBeNull()
  })
})

describe('isSorteavel', () => {
  it('especifico nunca', () => {
    expect(isSorteavel({ tipo: 'especifico' }, 10)).toBe(false)
  })
  it('sem inscritos nunca', () => {
    expect(isSorteavel({ tipo: 'grupos' }, 0)).toBe(false)
  })
  it('regra pular_sorteio que casa torna não sorteável', () => {
    expect(isSorteavel({ tipo: 'chaves', mensagens_inscritos: [{ min: 2, max: 2, mensagem: 'x', pular_sorteio: true }] }, 2)).toBe(false)
  })
  it('grupos/chaves com inscritos e sem pular é sorteável', () => {
    expect(isSorteavel({ tipo: 'grupos' }, 8)).toBe(true)
    expect(isSorteavel({ tipo: 'chaves', mensagens_inscritos: [{ min: 2, max: 2, mensagem: 'x', pular_sorteio: false }] }, 2)).toBe(true)
  })
  it('mensagens_inscritos não-array é tratado como vazio', () => {
    expect(isSorteavel({ tipo: 'grupos', mensagens_inscritos: null }, 4)).toBe(true)
  })
})
