import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './sorteios.service'

const executarSchema = z.object({
  evento_id: z.coerce.number().int().positive(),
  modalidade_id: z.coerce.number().int().positive(),
})

const listQuerySchema = z.object({
  evento_id: z.coerce.number().int().positive().optional(),
  modalidade_id: z.coerce.number().int().positive().optional(),
})

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const filtros = listQuerySchema.parse(req.query)
    res.json(await service.listar(filtros))
  } catch (err) { next(err) }
}

export async function buscarPorId(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.buscarPorId(Number(req.params.id))) } catch (err) { next(err) }
}

export async function executar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = executarSchema.parse(req.body)
    res.json(await service.executar(body))
  } catch (err) { next(err) }
}

export async function remover(req: Request, res: Response, next: NextFunction) {
  try {
    await service.remover(Number(req.params.id))
    res.status(204).send()
  } catch (err) { next(err) }
}

export async function removerTodosDoEvento(req: Request, res: Response, next: NextFunction) {
  try {
    const evento_id = Number(req.params.evento_id)
    if (!Number.isInteger(evento_id) || evento_id <= 0) {
      res.status(400).json({ message: 'evento_id inválido.' })
      return
    }
    res.json(await service.removerTodosDoEvento(evento_id))
  } catch (err) { next(err) }
}
