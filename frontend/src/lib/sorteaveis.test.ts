import { describe, it, expect } from 'vitest'
import { isSorteavel } from './sorteaveis'

describe('isSorteavel', () => {
  it('especifico nunca é sorteável', () => {
    expect(isSorteavel({ id: 1, tipo: 'especifico' }, 10)).toBe(false)
  })

  it('sem inscritos (0) não é sorteável', () => {
    expect(isSorteavel({ id: 1, tipo: 'grupos' }, 0)).toBe(false)
  })

  it('regra "pular sorteio" que casa torna não sorteável', () => {
    const m = { id: 1, tipo: 'chaves', mensagens_inscritos: [{ min: 2, max: 2, mensagem: 'x', pular_sorteio: true }] }
    expect(isSorteavel(m, 2)).toBe(false)
  })

  it('regra que casa SEM pular_sorteio continua sorteável', () => {
    const m = { id: 1, tipo: 'chaves', mensagens_inscritos: [{ min: 2, max: 2, mensagem: 'x', pular_sorteio: false }] }
    expect(isSorteavel(m, 2)).toBe(true)
  })

  it('grupos/chaves com inscritos e sem regra de pular é sorteável', () => {
    expect(isSorteavel({ id: 1, tipo: 'grupos' }, 8)).toBe(true)
    expect(isSorteavel({ id: 2, tipo: 'chaves', mensagens_inscritos: [{ min: 1, max: 1, mensagem: 'y', pular_sorteio: true }] }, 8)).toBe(true)
  })
})
