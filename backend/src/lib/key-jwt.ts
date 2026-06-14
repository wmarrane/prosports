import jwt from 'jsonwebtoken'

const EXPIRES = '7d'
// Leitura preguiçosa (em tempo de chamada) — não capturar no carregamento do módulo.
// Segredo dedicado opcional; cai em JWT_SECRET se JWT_KEY_SECRET não estiver setado.
const keySecret = () => process.env.JWT_KEY_SECRET ?? process.env.JWT_SECRET!

export type KeyTokenPayload = {
  type: 'event-key'
  keyId: number
  eventoId: number
  deviceFp: string
}

export function signKeyToken(data: Omit<KeyTokenPayload, 'type'>): string {
  const payload: KeyTokenPayload = { type: 'event-key', ...data }
  return jwt.sign(payload, keySecret(), { expiresIn: EXPIRES, algorithm: 'HS256' })
}

export function verifyKeyToken(token: string): KeyTokenPayload {
  const decoded = jwt.verify(token, keySecret(), { algorithms: ['HS256'] }) as any
  if (decoded?.type !== 'event-key') {
    throw new Error('Token de tipo inválido')
  }
  return decoded as KeyTokenPayload
}
