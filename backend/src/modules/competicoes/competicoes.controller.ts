import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { parseIntParam } from '../../lib/parse-id'
import * as service from './competicoes.service'

const CAMPOS_VALIDOS = ['subtitulo', 'municipio', 'inspetoria', 'delegacia'] as const

const createSchema = z.object({
  nome: z.string().min(1),
  estados: z.array(z.string().length(2)).min(1, 'Selecione ao menos uma UF'),
  subtitulo_campos: z.array(z.enum(CAMPOS_VALIDOS))
    .max(4)
    .refine(arr => new Set(arr).size === arr.length, { message: 'Campos duplicados' })
    .optional()
    .default([]),
  considerar_anfitriao: z.boolean().optional().default(false),
  subtitulo_municipio_por_modalidade: z.boolean().optional().default(false),
})

const updateSchema = createSchema.partial()

export async function listar(_req: Request, res: Response, next: NextFunction) {
  try { res.json(await service.listar()) } catch (err) { next(err) }
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
