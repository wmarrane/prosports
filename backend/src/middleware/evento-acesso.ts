import { Request, Response, NextFunction } from 'express'
import prisma from '../lib/prisma'

type AuthUser = { sub: number; role: string; email?: string }

export async function usuarioTemAcessoAoEvento(user: AuthUser, evento_id: number): Promise<boolean> {
  if (!user) return false
  if (user.role === 'ADMIN') return true
  if (user.role === 'COMISSAO_TECNICA') {
    const row = await prisma.eventoComissao.findUnique({
      where: { evento_id_usuario_id: { evento_id, usuario_id: user.sub } },
      select: { id: true },
    })
    return row != null
  }
  return false
}

// Resolve o evento_id da requisição (params/body/lookup) e autoriza ADMIN ou
// COMISSAO_TECNICA atribuída ao evento. 400 se não resolver; 403 se negar.
export function requireAcessoEvento(resolver: (req: Request) => number | null | Promise<number | null>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user as AuthUser
      // ADMIN tem acesso global — não precisa resolver/scopo de evento.
      if (user?.role === 'ADMIN') { next(); return }
      const evento_id = await resolver(req)
      if (evento_id == null || Number.isNaN(evento_id)) {
        res.status(400).json({ message: 'Evento não identificado na requisição.' })
        return
      }
      if (await usuarioTemAcessoAoEvento(user, evento_id)) { next(); return }
      res.status(403).json({ message: 'Acesso negado a este evento.' })
    } catch (err) { next(err) }
  }
}
