import { it, expect } from 'vitest'
import { resolveRef } from './bracket'

const slots = [10, 20, 30] // posições 1..3
const nomes = new Map<number, string>([[10, 'Ana'], [20, 'Bia'], [30, 'Cris']])

it('P<n> resolve para o participante da posição n (1-indexed) + seed', () => {
  expect(resolveRef('P2', slots, nomes)).toEqual({ pid: 20, nome: 'Bia', label: null, seed: 2 })
})
it('P<n> sem participante (slot null) vira BYE/—', () => {
  expect(resolveRef('P9', slots, nomes)).toEqual({ pid: null, nome: null, label: '—', seed: 9 })
})
it('V:/L: viram rótulos de vencedor/perdedor', () => {
  expect(resolveRef('V:J1', slots, nomes)).toEqual({ pid: null, nome: null, label: 'Vencedor J1', seed: null })
  expect(resolveRef('L:J7', slots, nomes)).toEqual({ pid: null, nome: null, label: 'Perdedor J7', seed: null })
})
it('BYE vira rótulo BYE', () => {
  expect(resolveRef('BYE', slots, nomes)).toEqual({ pid: null, nome: null, label: 'BYE', seed: null })
})
