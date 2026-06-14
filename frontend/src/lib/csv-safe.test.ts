import { describe, it, expect } from 'vitest'
import { csvCell } from './csv-safe'

describe('csvCell', () => {
  it('neutraliza fórmula com prefixo apóstrofo', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+1')).toBe(`'+1`)
    expect(csvCell('-2')).toBe(`'-2`)
    expect(csvCell('@cmd')).toBe(`'@cmd`)
  })
  it('mantém valores normais', () => {
    expect(csvCell('Campinas')).toBe('Campinas')
    expect(csvCell(10)).toBe('10')
    expect(csvCell(null)).toBe('')
  })
  it('aplica RFC4180 quando há vírgula/aspas/quebra', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('a"b')).toBe('"a""b"')
  })
})
