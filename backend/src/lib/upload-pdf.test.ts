import { describe, it, expect } from 'vitest'
import { assertPdf, sanitizeFilename } from './upload-pdf'

describe('assertPdf', () => {
  it('aceita buffer que começa com %PDF', () => {
    expect(() => assertPdf(Buffer.from('%PDF-1.7\n...'))).not.toThrow()
  })
  it('rejeita buffer que não é PDF com status 400', () => {
    try { assertPdf(Buffer.from('<html>oi</html>')); expect.unreachable() }
    catch (e: any) { expect(e.status).toBe(400) }
  })
  it('rejeita buffer curto', () => {
    try { assertPdf(Buffer.from('%P')); expect.unreachable() }
    catch (e: any) { expect(e.status).toBe(400) }
  })
})

describe('sanitizeFilename', () => {
  it('remove control chars e separadores de caminho', () => {
    expect(sanitizeFilename('a\x00b\x1fc\x7f.pdf')).toBe('abc.pdf')
    expect(sanitizeFilename('a b/c\\d.pdf')).toBe('a b_c_d.pdf')
  })
  it('limita a 150 chars', () => {
    expect(sanitizeFilename('x'.repeat(300) + '.pdf').length).toBe(150)
  })
  it('fallback quando vazio', () => {
    expect(sanitizeFilename(' ')).toBe('boletim.pdf')
  })
})
