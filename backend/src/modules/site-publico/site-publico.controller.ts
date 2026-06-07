import type { Request, Response, NextFunction } from 'express'
import * as service from './site-publico.service'

export async function publicar(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    await service.publicar(id)
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function despublicar(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    await service.despublicar(id)
    res.json({ ok: true })
  } catch (err) { next(err) }
}
