import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { parseIntParam } from '../../lib/parse-id'
import * as service from './sistemas_disputa.service'

const gruposSchema = z.object({
  competicao_id: z.number().int().positive(),
  quantidade_equipes: z.number().int().positive(),
  quantidade_grupos: z.number().int().positive(),
  grupos_3_componentes: z.number().int().min(0),
  grupos_4_componentes: z.number().int().min(0),
  numero_classificados: z.number().int().positive(),
})
const gruposUpdateSchema = gruposSchema.partial()

const chavesSchema = z.object({
  competicao_id: z.number().int().positive(),
  numero_inscrito: z.number().int().positive(),
  posicao_primeiro_cabeca: z.number().int().positive(),
  posicao_segundo_cabeca: z.number().int().positive(),
  posicao_terceiro_cabeca: z.number().int().positive(),
  posicao_quarto_cabeca: z.number().int().positive(),
})
const chavesUpdateSchema = chavesSchema.partial()

const copiarSchema = z.object({
  origem_id: z.number().int().positive(),
  destino_id: z.number().int().positive(),
  tipo: z.enum(['grupos', 'chaves', 'ambos']),
})

function requireCompeticaoId(req: Request): number {
  const id = Number(req.query.competicao_id)
  if (!Number.isInteger(id) || id <= 0) {
    throw Object.assign(new Error('competicao_id é obrigatório.'), { status: 400 })
  }
  return id
}

export const grupos = {
  listar: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await service.grupos.listar(requireCompeticaoId(req))) } catch (err) { next(err) }
  },
  criar: async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json(await service.grupos.criar(gruposSchema.parse(req.body))) } catch (err) { next(err) }
  },
  editar: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await service.grupos.editar(parseIntParam(req.params.id, 'id'), gruposUpdateSchema.parse(req.body))) } catch (err) { next(err) }
  },
  remover: async (req: Request, res: Response, next: NextFunction) => {
    try { await service.grupos.remover(parseIntParam(req.params.id, 'id')); res.status(204).send() } catch (err) { next(err) }
  },
}

export const chaves = {
  listar: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await service.chaves.listar(requireCompeticaoId(req))) } catch (err) { next(err) }
  },
  criar: async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json(await service.chaves.criar(chavesSchema.parse(req.body))) } catch (err) { next(err) }
  },
  editar: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await service.chaves.editar(parseIntParam(req.params.id, 'id'), chavesUpdateSchema.parse(req.body))) } catch (err) { next(err) }
  },
  remover: async (req: Request, res: Response, next: NextFunction) => {
    try { await service.chaves.remover(parseIntParam(req.params.id, 'id')); res.status(204).send() } catch (err) { next(err) }
  },
}

export async function copiar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = copiarSchema.parse(req.body)
    res.json(await service.copiar(body))
  } catch (err) { next(err) }
}
