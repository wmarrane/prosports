import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { parseIntParam } from '../../lib/parse-id'
import * as service from './inspetorias.service'

const createSchema = z.object({
  nome: z.string().min(1),
  delegacia_id: z.number().int().positive(),
})
const updateSchema = createSchema.partial()

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const delegacia_id = req.query.delegacia_id ? Number(req.query.delegacia_id) : undefined
    res.json(await service.listar({ delegacia_id }))
  } catch (err) { next(err) }
}

export async function buscarPorId(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.buscarPorId(parseIntParam(req.params.id, 'id'))) } catch (err) { next(err) }
}

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchema.parse(req.body)
    res.status(201).json(await service.criar(body))
  } catch (err) { next(err) }
}

export async function editar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = updateSchema.parse(req.body)
    res.json(await service.editar(parseIntParam(req.params.id, 'id'), body))
  } catch (err) { next(err) }
}

export async function remover(req: Request, res: Response, next: NextFunction) {
  try {
    await service.remover(parseIntParam(req.params.id, 'id'))
    res.status(204).send()
  } catch (err) { next(err) }
}
