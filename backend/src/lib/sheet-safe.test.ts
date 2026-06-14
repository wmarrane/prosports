import { describe, it, expect } from 'vitest'
import { sheetSafe } from './sheet-safe'

describe('sheetSafe', () => {
  it('prefixa apóstrofo em strings de fórmula', () => {
    expect(sheetSafe('=SOMA(A1)')).toBe(`'=SOMA(A1)`)
    expect(sheetSafe('+1')).toBe(`'+1`)
    expect(sheetSafe('-2')).toBe(`'-2`)
    expect(sheetSafe('@x')).toBe(`'@x`)
  })
  it('mantém strings normais e não-strings', () => {
    expect(sheetSafe('Campinas')).toBe('Campinas')
    expect(sheetSafe(10)).toBe(10)
    expect(sheetSafe(null)).toBe(null)
  })
})
