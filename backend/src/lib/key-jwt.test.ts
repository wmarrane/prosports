import { describe, it, expect } from 'vitest'
import jwt from 'jsonwebtoken'
process.env.JWT_SECRET = 'test-secret-for-key-jwt'
import { signKeyToken, verifyKeyToken } from './key-jwt'

describe('key-jwt', () => {
  it('sign + verify roundtrip OK', () => {
    const token = signKeyToken({ keyId: 1, eventoId: 10, deviceFp: 'abc' })
    const payload = verifyKeyToken(token)
    expect(payload.keyId).toBe(1)
    expect(payload.eventoId).toBe(10)
    expect(payload.deviceFp).toBe('abc')
    expect(payload.type).toBe('event-key')
  })

  it('verifyKeyToken rejeita token de tipo errado (admin access)', () => {
    const adminToken = jwt.sign({ sub: 1, email: 'a@b', role: 'ADMIN' }, 'test-secret-for-key-jwt')
    expect(() => verifyKeyToken(adminToken)).toThrow(/tipo/)
  })

  it('verifyKeyToken rejeita lixo', () => {
    expect(() => verifyKeyToken('lixo')).toThrow()
  })
})
