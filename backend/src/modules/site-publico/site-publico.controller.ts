import type { Request, Response, NextFunction } from 'express'
import * as service from './site-publico.service'
import { parseIntParam } from '../../lib/parse-id'

export async function publicar(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseIntParam(req.params.id, 'id')
    const permitirParcial = req.query.parcial === '1'
    await service.publicar(id, { permitirParcial })
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function publicarParcial(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseIntParam(req.params.id, 'id')
    await service.publicar(id, { permitirParcial: true })
    res.json({ ok: true })
  } catch (err) { next(err) }
}

export async function despublicar(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseIntParam(req.params.id, 'id')
    await service.despublicar(id)
    res.json({ ok: true })
  } catch (err) { next(err) }
}
