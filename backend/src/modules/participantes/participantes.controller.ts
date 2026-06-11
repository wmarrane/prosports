import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './participantes.service'

const createSchema = z.object({
  nome: z.string().min(1),
  subtitulo: z.string().optional(),
  inspetoria_id: z.coerce.number().int().positive().nullable().optional(),
  delegacia_id: z.coerce.number().int().positive().nullable().optional(),
  municipio_id: z.coerce.number().int().positive(),
})

const updateSchema = createSchema.partial()

export async function listar(_req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.listar()) } catch (err) { next(err) }
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

const importRowSchema = z.object({
  nome: z.string().min(1).max(200),
  municipio_uf: z.string().length(2),
  municipio_nome: z.string().min(1).max(120),
  subtitulo: z.string().max(200).optional(),
})
const importSchema = z.object({
  dry_run: z.boolean(),
  rows: z.array(importRowSchema).min(1).max(5000),
})

export async function importar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = importSchema.parse(req.body)
    res.json(await service.importar(body))
  } catch (err) { next(err) }
}
