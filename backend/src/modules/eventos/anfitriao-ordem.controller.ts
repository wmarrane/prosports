import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { parseIntParam } from '../../lib/parse-id'
import * as service from './anfitriao-ordem.service'

const setSchema = z.object({
  modalidade_id: z.number().int().positive(),
  posicao: z.number().int().min(1).nullable(),
})

export async function getAnfitriaoOrdem(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.getAnfitriaoOrdem(parseIntParam(req.params.id, 'id')))
  } catch (err) { next(err) }
}

export async function setAnfitriaoOrdem(req: Request, res: Response, next: NextFunction) {
  try {
    const body = setSchema.parse(req.body)
    res.json(await service.setAnfitriaoOrdem(parseIntParam(req.params.id, 'id'), body.modalidade_id, body.posicao))
  } catch (err) { next(err) }
}
