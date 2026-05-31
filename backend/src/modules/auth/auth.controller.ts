import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as authService from './auth.service'

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(6),
})

const alterarSenhaSchema = z.object({
  senha_atual: z.string().min(1),
  nova_senha: z.string().min(8).max(72),
})

const REFRESH_COOKIE = 'prosports_rt'
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/auth/refresh',
}

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = loginSchema.parse(req.body)
    const result = await authService.login(body.email, body.senha)

    res.cookie(REFRESH_COOKIE, `${result.refreshJti}::${result.refreshToken}`, COOKIE_OPTS)
    res.json({ accessToken: result.accessToken, user: result.user })
  } catch (err) {
    next(err)
  }
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined
    if (!raw) {
      res.status(401).json({ message: 'Não autenticado' })
      return
    }

    const [, refreshToken] = raw.split('::')
    const result = await authService.refresh(refreshToken)
    res.json({ accessToken: result.accessToken })
  } catch (err) {
    next(err)
  }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined
    if (raw) {
      const [jti] = raw.split('::')
      const user = (req as any).user
      if (user?.sub && jti) {
        await authService.logout(user.sub, jti)
      }
    }

    res.clearCookie(REFRESH_COOKIE, { path: '/auth/refresh' })
    res.json({ message: 'Logout realizado' })
  } catch (err) {
    next(err)
  }
}

export async function meHandler(req: Request, res: Response) {
  res.json((req as any).user)
}

export async function alterarSenhaHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = alterarSenhaSchema.parse(req.body)
    const user = (req as any).user as { sub: number }
    await authService.alterarSenha(user.sub, body.senha_atual, body.nova_senha)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
}
