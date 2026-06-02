import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './evento_keys.service'

const createSchema = z.object({
  email: z.string().email({ message: 'Email inválido' }),
})

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const evento_id = Number(req.params.evento_id)
    res.json(await service.listarPorEvento(evento_id))
  } catch (err) { next(err) }
}

export async function criar(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = createSchema.parse(req.body)
    const evento_id = Number(req.params.evento_id)
    const criada_por = (req as any).user.sub
    res.status(201).json(await service.criar({ evento_id, email, criada_por }))
  } catch (err) { next(err) }
}

export async function revogar(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.revogar(Number(req.params.keyId)))
  } catch (err) { next(err) }
}

export async function resetDevice(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.resetDevice(Number(req.params.keyId)))
  } catch (err) { next(err) }
}

export async function apagar(req: Request, res: Response, next: NextFunction) {
  try {
    await service.apagar(Number(req.params.keyId))
    res.status(204).send()
  } catch (err) { next(err) }
}
