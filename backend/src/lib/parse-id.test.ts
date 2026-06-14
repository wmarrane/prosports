import { describe, it, expect } from 'vitest'
import { parseIntParam } from './parse-id'

describe('parseIntParam', () => {
  it('retorna o inteiro positivo', () => {
    expect(parseIntParam('5')).toBe(5)
  })
  it('rejeita inválidos com status 400', () => {
    for (const v of ['abc', '', undefined, '0', '-3', '1.5', 'NaN']) {
      let err: any
      try { parseIntParam(v as any) } catch (e) { err = e }
      expect(err).toBeTruthy()
      expect(err.status).toBe(400)
    }
  })
})
