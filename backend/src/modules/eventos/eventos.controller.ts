import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './eventos.service'

const STATUS_VALUES = ['rascunho','inscricoes','pronto','sorteado','parcial'] as const

const createSchema = z.object({
  nome: z.string().min(1),
  data_hora: z.coerce.date(),
  local: z.string().min(1),
  organizador: z.string().optional(),
  status: z.enum(STATUS_VALUES).optional(),
  competicao_id: z.coerce.number().int().positive(),
  municipio_id: z.coerce.number().int().positive(),
  anfitriao_id: z.coerce.number().int().positive().nullable().optional(),
})
const updateSchema = createSchema.partial()
const listQuerySchema = z.object({
  competicao_id: z.coerce.number().int().positive().optional(),
})

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const { competicao_id } = listQuerySchema.parse(req.query)
    res.json(await service.listar(competicao_id))
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
