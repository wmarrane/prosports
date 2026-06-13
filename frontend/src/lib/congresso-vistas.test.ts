import { describe, it, expect, vi, afterEach } from 'vitest'
import { addVista, clearVistas } from './congresso-vistas'

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

describe('clearVistas', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('remove a chave do localStorage do evento', () => {
    const removeItem = vi.fn()
    vi.stubGlobal('localStorage', { removeItem, getItem: vi.fn(), setItem: vi.fn() })
    clearVistas(5)
    expect(removeItem).toHaveBeenCalledWith('prosports.congresso.vistas.5')
  })

  it('tolera localStorage indisponível (não lança)', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(() => clearVistas(9)).not.toThrow()
  })
})
