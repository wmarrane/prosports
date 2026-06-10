import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './anfitriao-ordem.service'

const setSchema = z.object({
  modalidade_id: z.number().int().positive(),
  posicao: z.number().int().min(1).nullable(),
})

export async function getAnfitriaoOrdem(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.getAnfitriaoOrdem(Number(req.params.id)))
  } catch (err) { next(err) }
}

export async function setAnfitriaoOrdem(req: Request, res: Response, next: NextFunction) {
  try {
    const body = setSchema.parse(req.body)
    res.json(await service.setAnfitriaoOrdem(Number(req.params.id), body.modalidade_id, body.posicao))
  } catch (err) { next(err) }
}
