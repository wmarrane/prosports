import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import * as service from './inscricoes.service'
import { parseIntParam } from '../../lib/parse-id'

const createSchema = z.object({
  evento_id: z.coerce.number().int().positive(),
  modalidade_id: z.coerce.number().int().positive(),
  participante_id: z.coerce.number().int().positive(),
  subtitulo: z.string().max(200).nullish(),
  municipio_id: z.coerce.number().int().positive().nullish(),
})

const listQuerySchema = z.object({
  evento_id: z.coerce.number().int().positive().optional(),
  modalidade_id: z.coerce.number().int().positive().optional(),
})

const importRowSchema = z.object({
  nome: z.string().min(1).max(200),
  municipio_uf: z.string().length(2),
  municipio_nome: z.string().min(1).max(120),
  subtitulo: z.string().max(200).optional(),
  municipio_mod_uf: z.string().length(2).optional(),
  municipio_mod_nome: z.string().max(120).optional(),
})

const importSchema = z.object({
  evento_id: z.coerce.number().int().positive(),
  modalidade_id: z.coerce.number().int().positive(),
  dry_run: z.boolean(),
  rows: z.array(importRowSchema).min(1).max(2000),
})

const bulkSchema = z.object({
  evento_id: z.coerce.number().int().positive(),
  modalidade_id: z.coerce.number().int().positive(),
  participante_ids: z.array(z.coerce.number().int().positive()).min(1).max(500),
})

const countsQuerySchema = z.object({
  evento_id: z.coerce.number().int().positive(),
})

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const filtros = listQuerySchema.parse(req.query)
    res.json(await service.listar(filtros))
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

export async function remover(req: Request, res: Response, next: NextFunction) {
  try {
    await service.remover(parseIntParam(req.params.id, 'id'))
    res.status(204).send()
  } catch (err) { next(err) }
}

export async function removerTodosDaModalidade(req: Request, res: Response, next: NextFunction) {
  try {
    const evento_id = parseIntParam(req.params.eventoId, 'eventoId')
    const modalidade_id = parseIntParam(req.params.modalidadeId, 'modalidadeId')
    res.json(await service.removerTodosDaModalidade(evento_id, modalidade_id))
  } catch (err) { next(err) }
}

export async function importar(req: Request, res: Response, next: NextFunction) {
  try {
    const body = importSchema.parse(req.body)
    res.json(await service.importar(body))
  } catch (err) { next(err) }
}

export async function counts(req: Request, res: Response, next: NextFunction) {
  try {
    const { evento_id } = countsQuerySchema.parse(req.query)
    res.json(await service.contarPorModalidade(evento_id))
  } catch (err) { next(err) }
}

export async function criarBulk(req: Request, res: Response, next: NextFunction) {
  try {
    const body = bulkSchema.parse(req.body)
    res.status(201).json(await service.criarBulk(body))
  } catch (err) { next(err) }
}
