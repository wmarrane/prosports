import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './delegacoes.service'

const createSchema = z.object({
  nome: z.string().min(1),
  municipio_id: z.coerce.number().int().positive(),
})

const updateSchema = createSchema.partial()

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.listar())
  } catch (err) { next(err) }
}

export async function buscarPorId(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.buscarPorId(Number(req.params.id)))
  } catch (err) { next(err) }
}

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchema.parse(req.body)
    const logo_path = (req.file as Express.Multer.File | undefined)?.filename
    res.status(201).json(await service.criar({ ...body, logo_path }))
  } catch (err) { next(err) }
}

export async function editar(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    const body = updateSchema.parse(req.body)
    const logo_path = (req.file as Express.Multer.File | undefined)?.filename
    const current = await service.buscarPorId(id)
    res.json(await service.editar(id, { ...body, ...(logo_path ? { logo_path } : {}) }, current.logo_path))
  } catch (err) { next(err) }
}

export async function remover(req: Request, res: Response, next: NextFunction) {
  try {
    await service.remover(Number(req.params.id))
    res.status(204).send()
  } catch (err) { next(err) }
}
