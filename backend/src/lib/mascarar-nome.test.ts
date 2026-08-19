import { describe, it, expect } from 'vitest'
import { mascararNome } from './mascarar-nome'

describe('mascararNome', () => {
  it('mantém o primeiro nome e esconde o resto', () => {
    expect(mascararNome('Wagner Rosa Marrane')).toBe('Wagner **********')
    expect(mascararNome('Rodrigo Moreira')).toBe('Rodrigo **********')
  })

  it('usa sempre 10 asteriscos, para não revelar o tamanho do sobrenome', () => {
    expect(mascararNome('Ana Sá')).toBe('Ana **********')
    expect(mascararNome('Ana Carolina de Albuquerque')).toBe('Ana **********')
  })

  it('nome de uma palavra fica intacto', () => {
    expect(mascararNome('Wagner')).toBe('Wagner')
  })

  it('tolera espaços sobrando', () => {
    expect(mascararNome('  Wagner   Rosa  ')).toBe('Wagner **********')
  })
})
