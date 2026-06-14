import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { parseIntParam } from '../../lib/parse-id'
import * as service from './modalidades-excluidas.service'
import { modalidadesDoEvento } from './evento-modalidades.service'

const setSchema = z.object({
  excluidas: z.array(z.number().int().positive()),
})

export async function getExcluidas(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.getExcluidas(parseIntParam(req.params.id, 'id')))
  } catch (err) { next(err) }
}

export async function setExcluidas(req: Request, res: Response, next: NextFunction) {
  try {
    const body = setSchema.parse(req.body)
    res.json(await service.setExcluidas(parseIntParam(req.params.id, 'id'), body.excluidas))
  } catch (err) { next(err) }
}

export async function getModalidadesDoEvento(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await modalidadesDoEvento(parseIntParam(req.params.id, 'id')))
  } catch (err) { next(err) }
}
