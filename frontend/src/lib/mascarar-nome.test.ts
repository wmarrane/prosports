import { describe, it, expect } from 'vitest'
import { mascararNome } from './mascarar-nome'

describe('mascararNome', () => {
  it('mantém o primeiro nome e esconde o resto', () => {
    expect(mascararNome('Wagner Rosa Marrane')).toBe('Wagner **********')
    expect(mascararNome('Rodrigo Moreira')).toBe('Rodrigo **********')
  })

  it('usa sempre 10 asteriscos', () => {
    expect(mascararNome('Ana Sá')).toBe('Ana **********')
  })

  it('nome de uma palavra fica intacto', () => {
    expect(mascararNome('Wagner')).toBe('Wagner')
  })
})
