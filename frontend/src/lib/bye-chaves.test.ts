import { describe, it, expect } from 'vitest'
import { isByeRef, matchIsBye } from './bye-chaves'

describe('isByeRef', () => {
  const slots = [10, null, 30] // P1=10, P2=vazio, P3=30

  it('ref literal BYE é bye', () => {
    expect(isByeRef('BYE', slots)).toBe(true)
  })
  it('P{n} apontando para slot nulo é bye', () => {
    expect(isByeRef('P2', slots)).toBe(true)
  })
  it('P{n} apontando para slot preenchido não é bye', () => {
    expect(isByeRef('P1', slots)).toBe(false)
    expect(isByeRef('P3', slots)).toBe(false)
  })
  it('refs de vencedor/perdedor não são bye', () => {
    expect(isByeRef('V:J1', slots)).toBe(false)
    expect(isByeRef('L:J2', slots)).toBe(false)
  })
  it('P{n} fora do range é bye (slot inexistente = nulo)', () => {
    expect(isByeRef('P9', slots)).toBe(true)
  })
})

describe('matchIsBye', () => {
  const slots = [10, null, 30, 40]

  it('bye no top', () => {
    expect(matchIsBye({ top: 'P2', bottom: 'P1' }, slots)).toBe(true)
  })
  it('bye no bottom (BYE literal)', () => {
    expect(matchIsBye({ top: 'P1', bottom: 'BYE' }, slots)).toBe(true)
  })
  it('sem bye', () => {
    expect(matchIsBye({ top: 'P1', bottom: 'P3' }, slots)).toBe(false)
  })
  it('match entre vencedores não é bye', () => {
    expect(matchIsBye({ top: 'V:J1', bottom: 'V:J2' }, slots)).toBe(false)
  })
})
