import { describe, it, expect } from 'vitest'
import { addVista } from './congresso-vistas'

describe('addVista', () => {
  it('adiciona um id novo ao fim', () => {
    expect(addVista([1, 2], 3)).toEqual([1, 2, 3])
  })
  it('é idempotente (não duplica)', () => {
    expect(addVista([1, 2], 2)).toEqual([1, 2])
  })
  it('preserva a ordem existente', () => {
    expect(addVista([5, 1], 9)).toEqual([5, 1, 9])
  })
  it('parte de lista vazia', () => {
    expect(addVista([], 7)).toEqual([7])
  })
})
