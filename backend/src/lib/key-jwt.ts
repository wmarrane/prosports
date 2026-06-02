import jwt from 'jsonwebtoken'

const EXPIRES = '365d'

export type KeyTokenPayload = {
  type: 'event-key'
  keyId: number
  eventoId: number
  deviceFp: string
}

export function signKeyToken(data: Omit<KeyTokenPayload, 'type'>): string {
  const payload: KeyTokenPayload = { type: 'event-key', ...data }
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: EXPIRES })
}

export function verifyKeyToken(token: string): KeyTokenPayload {
  const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
  if (decoded?.type !== 'event-key') {
    throw new Error('Token de tipo inválido')
  }
  return decoded as KeyTokenPayload
}
