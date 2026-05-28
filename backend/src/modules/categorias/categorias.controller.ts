import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './categorias.service'

const generoEnum = z.enum(['MASCULINO', 'FEMININO', 'MISTO', 'LIVRE'])

const createSchema = z.object({
  modalidade_id: z.coerce.number().int().positive(),
  nome: z.string().min(1),
  genero: generoEnum,
  idade_min: z.coerce.number().int().positive().optional(),
  idade_max: z.coerce.number().int().positive().optional(),
})

const updateSchema = createSchema.partial()

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const modalidade_id = req.query.modalidade_id ? Number(req.query.modalidade_id) : undefined
    res.json(await service.listar(modalidade_id))
  } catch (err) { next(err) }
}

export async function buscarPorId(req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.buscarPorId(Number(req.params.id))) } catch (err) { next(err) }
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
    res.json(await service.editar(Number(req.params.id), body))
  } catch (err) { next(err) }
}

export async function remover(req: Request, res: Response, next: NextFunction) {
  try {
    await service.remover(Number(req.params.id))
    res.status(204).send()
  } catch (err) { next(err) }
}
