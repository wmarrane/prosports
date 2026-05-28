import { Request, Response, NextFunction } from 'express'
import { verifyAccess } from '../modules/auth/auth.service'

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Token não fornecido' })
    return
  }

  try {
    const token = header.slice(7)
    const payload = verifyAccess(token)
    ;(req as any).user = payload
    next()
  } catch {
    res.status(401).json({ message: 'Token inválido ou expirado' })
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ message: 'Acesso negado' })
      return
    }
    next()
  }
}
