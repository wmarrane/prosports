import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './key_access.service'

const loginSchema = z.object({
  token: z.string().min(1),
  device_fp: z.string().min(1).max(200),
  device_label: z.string().min(1).max(200),
})

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const body = loginSchema.parse(req.body)
    res.json(await service.login(body))
  } catch (err) { next(err) }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const key = (req as any).eventoKey
    res.json({ evento: key.evento, valido: true })
  } catch (err) { next(err) }
}

export async function modalidades(req: Request, res: Response, next: NextFunction) {
  try {
    const key = (req as any).eventoKey
    res.json(await service.getModalidades(key.evento))
  } catch (err) { next(err) }
}

export async function modalidadeDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const key = (req as any).eventoKey
    res.json(await service.getModalidadeDetail(key.evento, Number(req.params.id)))
  } catch (err) { next(err) }
}
