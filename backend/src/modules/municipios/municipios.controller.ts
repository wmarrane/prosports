import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { parseIntParam } from '../../lib/parse-id'
import * as service from './municipios.service'
import { importarCsv } from './import.service'

const createSchema = z.object({
  codigo_ibge: z.string().regex(/^\d{7}$/, 'codigo_ibge deve ter 7 dígitos'),
  nome: z.string().min(1),
  uf: z.string().length(2),
})
const updateSchema = createSchema.partial()

const listQuerySchema = z.object({
  uf: z.string().length(2).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
})

export async function listar(req: Request, res: Response, next: NextFunction) {
  try {
    const params = listQuerySchema.parse(req.query)
    res.json(await service.listar(params))
  } catch (err) { next(err) }
}

export async function buscarPorId(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await service.buscarPorId(parseIntParam(req.params.id, 'id')))
  } catch (err) { next(err) }
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

export async function importar(req: Request, res: Response, next: NextFunction) {
  try {
    const file = (req as any).file as Express.Multer.File | undefined
    if (!file) {
      res.status(400).json({ message: 'Arquivo CSV obrigatório no campo "arquivo".' })
      return
    }
    const content = file.buffer.toString('utf8')
    res.json(await importarCsv(content))
  } catch (err) { next(err) }
}
